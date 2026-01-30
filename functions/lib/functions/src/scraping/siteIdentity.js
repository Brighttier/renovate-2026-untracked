"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractSiteIdentity = void 0;
exports.extractSiteIdentityCore = extractSiteIdentityCore;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
const chromium_1 = __importDefault(require("@sparticuz/chromium"));
const cheerio = __importStar(require("cheerio"));
const crypto = __importStar(require("crypto"));
// node-vibrant v4 requires import from node-vibrant/node for Node.js usage
const node_1 = require("node-vibrant/node");
const secret_manager_1 = require("@google-cloud/secret-manager");
const generative_ai_1 = require("@google/generative-ai");
const rateLimiter_1 = require("../utils/rateLimiter");
const logger_1 = require("../utils/logger");
// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const secretClient = new secret_manager_1.SecretManagerServiceClient();
let genAI = null;
// ============================================
// GEMINI INITIALIZATION
// ============================================
async function getGeminiApiKey() {
    var _a, _b;
    const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';
    const secretName = `projects/${projectId}/secrets/gemini-api-key/versions/latest`;
    const [version] = await secretClient.accessSecretVersion({ name: secretName });
    const apiKey = (_b = (_a = version.payload) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.toString();
    if (!apiKey) {
        throw new Error('Failed to retrieve Gemini API key from Secret Manager');
    }
    return apiKey;
}
async function getGenAI() {
    if (!genAI) {
        const apiKey = await getGeminiApiKey();
        genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    }
    return genAI;
}
// ============================================
// CACHING CONFIGURATION
// ============================================
const IDENTITY_CACHE_COLLECTION = 'siteIdentityCache';
const IDENTITY_CACHE_TTL_HOURS = 24; // 24 hours for modernization
function getUrlHash(url) {
    return crypto.createHash('sha256').update(url.toLowerCase().trim()).digest('hex').substring(0, 32);
}
async function getCachedIdentity(url) {
    var _a, _b;
    try {
        const hash = getUrlHash(url);
        const doc = await db.collection(IDENTITY_CACHE_COLLECTION).doc(hash).get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        const cachedAt = ((_b = (_a = data.cachedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(0);
        const ageInHours = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);
        if (ageInHours > IDENTITY_CACHE_TTL_HOURS) {
            await db.collection(IDENTITY_CACHE_COLLECTION).doc(hash).delete();
            return null;
        }
        return data.identity;
    }
    catch (error) {
        console.error('Identity cache read error:', error);
        return null;
    }
}
async function setCachedIdentity(url, identity) {
    try {
        const hash = getUrlHash(url);
        // Don't cache the screenshot to save storage space
        const identityToCache = { ...identity, screenshotBase64: undefined };
        await db.collection(IDENTITY_CACHE_COLLECTION).doc(hash).set({
            url,
            urlHash: hash,
            identity: identityToCache,
            cachedAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + IDENTITY_CACHE_TTL_HOURS * 60 * 60 * 1000)
        });
    }
    catch (error) {
        console.error('Identity cache write error:', error);
    }
}
// ============================================
// HELPER FUNCTIONS
// ============================================
/**
 * Normalize a potentially relative URL to an absolute URL
 */
function normalizeUrl(url, baseUrl) {
    if (!url)
        return null;
    try {
        return new URL(url, baseUrl).href;
    }
    catch (_a) {
        return null;
    }
}
/**
 * Check if URL should be skipped (icons, favicons, tracking pixels, etc.)
 */
function shouldSkipImage(src) {
    const skipPatterns = [
        'favicon', 'icon', 'sprite', 'pixel', 'tracking',
        'spacer', 'blank', '1x1', 'loading', 'spinner',
        'social', 'facebook', 'twitter', 'instagram', 'linkedin',
        'google', 'yelp', 'tripadvisor', 'data:image'
    ];
    const srcLower = src.toLowerCase();
    return skipPatterns.some(pattern => srcLower.includes(pattern));
}
/**
 * Check if a hex color is grayscale (black, white, or gray)
 */
function isGrayscale(hex) {
    if (!hex || !hex.startsWith('#') || hex.length < 7)
        return true;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const isNearWhite = r > 240 && g > 240 && b > 240;
    const isNearBlack = r < 15 && g < 15 && b < 15;
    const isGray = Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && Math.abs(r - b) < 15;
    return isNearWhite || isNearBlack || isGray;
}
/**
 * Check if a link should be excluded from navigation
 */
function shouldSkipNavLink(href, label, baseHostname) {
    const hrefLower = href.toLowerCase();
    const labelLower = label.toLowerCase();
    // Skip special protocols
    if (hrefLower.startsWith('mailto:') || hrefLower.startsWith('tel:') || hrefLower.startsWith('javascript:')) {
        return true;
    }
    // Skip social media links
    const socialPatterns = ['facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'linkedin.com', 'yelp.com', 'youtube.com'];
    if (socialPatterns.some(p => hrefLower.includes(p))) {
        return true;
    }
    // Skip auth paths
    const authPatterns = ['/login', '/signup', '/register', '/signin', '/logout', '/account', '/cart', '/checkout'];
    if (authPatterns.some(p => hrefLower.includes(p))) {
        return true;
    }
    // Skip common non-navigation labels
    const skipLabels = ['login', 'sign in', 'sign up', 'register', 'cart', 'checkout', 'my account'];
    if (skipLabels.some(l => labelLower.includes(l))) {
        return true;
    }
    // Skip external links (different hostname)
    try {
        const linkUrl = new URL(href, `https://${baseHostname}`);
        if (linkUrl.hostname !== baseHostname && !href.startsWith('/') && !href.startsWith('#')) {
            return true;
        }
    }
    catch (_a) {
        // Invalid URL, skip it
        return true;
    }
    return false;
}
/**
 * Normalize a navigation href to an anchor format
 */
function normalizeNavHref(href) {
    // Already an anchor
    if (href.startsWith('#')) {
        return href;
    }
    // Extract path and convert to anchor
    try {
        const url = new URL(href, 'http://example.com');
        const path = url.pathname.replace(/^\/|\/$/g, ''); // Remove leading/trailing slashes
        if (!path || path === '' || path === 'index.html' || path === 'index') {
            return '#hero';
        }
        // Convert path to anchor: /about-us -> #about, /our-services -> #services
        const anchor = path
            .split('/').pop() // Get last segment
            .replace(/[-_]/g, '') // Remove dashes and underscores
            .replace(/\.html?$/i, '') // Remove .html extension
            .toLowerCase();
        // Map common variations
        const mappings = {
            'aboutus': 'about',
            'aboutme': 'about',
            'ourstory': 'about',
            'services': 'services',
            'ourservices': 'services',
            'whatwedo': 'services',
            'contact': 'contact',
            'contactus': 'contact',
            'getintouch': 'contact',
            'team': 'team',
            'ourteam': 'team',
            'staff': 'team',
            'testimonials': 'testimonials',
            'reviews': 'testimonials',
            'portfolio': 'gallery',
            'gallery': 'gallery',
            'work': 'gallery',
            'projects': 'gallery',
            'faq': 'faq',
            'faqs': 'faq',
            'pricing': 'pricing',
            'rates': 'pricing'
        };
        return `#${mappings[anchor] || anchor}`;
    }
    catch (_a) {
        return '#hero';
    }
}
/**
 * Assess content sparsity based on character count
 */
function assessContentSparsity(fullCopy) {
    const charCount = fullCopy.length;
    if (charCount < 500)
        return 'sparse';
    if (charCount < 1500)
        return 'moderate';
    return 'rich';
}
// ============================================
// EXTRACTION FUNCTIONS
// ============================================
/**
 * Extract logo URL from the page
 */
function extractLogo($, sourceUrl) {
    console.log('[LogoExtract] Starting logo extraction...');
    // Extended selectors including Webflow-specific patterns
    const logoSelectors = [
        'img[alt*="logo" i]',
        'img[src*="logo" i]',
        '.logo img',
        '#logo img',
        'header img:first-of-type',
        '[class*="logo"] img',
        'a[href="/"] img',
        '[class*="brand"] img',
        // Webflow-specific selectors
        '.navbar-brand img',
        '.brand img',
        '.w-nav-brand img',
        'nav a:first-child img',
        // Additional common patterns
        '[data-logo] img',
        '[aria-label*="logo" i] img',
        '.site-logo img',
        '.header-logo img'
    ];
    // Try standard selectors first
    for (const selector of logoSelectors) {
        const logoEl = $(selector).first();
        if (logoEl.length) {
            const rawLogoSrc = logoEl.attr('src');
            if (rawLogoSrc && !shouldSkipImage(rawLogoSrc)) {
                const normalizedUrl = normalizeUrl(rawLogoSrc, sourceUrl);
                if (normalizedUrl) {
                    console.log(`[LogoExtract] Found logo via selector "${selector}": ${normalizedUrl}`);
                    return normalizedUrl;
                }
            }
        }
    }
    // Fallback: Check all images with URL-decoded matching
    // This catches logos with URL-encoded paths like "logo%2032px.png"
    const imgs = $('img').toArray();
    for (const img of imgs) {
        const src = $(img).attr('src') || '';
        try {
            const decodedSrc = decodeURIComponent(src).toLowerCase();
            if (decodedSrc.includes('logo') && !shouldSkipImage(src)) {
                const normalizedUrl = normalizeUrl(src, sourceUrl);
                if (normalizedUrl) {
                    console.log(`[LogoExtract] Found logo via decoded URL match: ${normalizedUrl}`);
                    return normalizedUrl;
                }
            }
        }
        catch (e) {
            // Ignore decode errors, continue searching
        }
    }
    // Try SVG logo selectors
    const svgSelectors = [
        'svg[class*="logo" i]',
        '[class*="logo"] svg',
        '.navbar-brand svg',
        'header svg:first-of-type',
        '.w-nav-brand svg'
    ];
    for (const selector of svgSelectors) {
        const svgEl = $(selector).first();
        if (svgEl.length) {
            // Check if SVG has a use element pointing to an external source
            const useEl = svgEl.find('use');
            if (useEl.length) {
                const xlinkHref = useEl.attr('xlink:href') || useEl.attr('href');
                if (xlinkHref && xlinkHref.startsWith('http')) {
                    console.log(`[LogoExtract] Found SVG logo via use href: ${xlinkHref}`);
                    return xlinkHref;
                }
            }
            // Note: For inline SVGs, we'd need to convert to data URL (complex, skip for now)
            console.log(`[LogoExtract] Found inline SVG logo (selector: ${selector}), but skipping inline SVGs`);
        }
    }
    // Try background-image logo detection
    const bgSelectors = ['.logo', '#logo', '[class*="logo"]', '.brand', '.navbar-brand', '.w-nav-brand'];
    for (const selector of bgSelectors) {
        const el = $(selector).first();
        if (el.length) {
            const style = el.attr('style') || '';
            const bgMatch = style.match(/url\(['"]?([^'")]+)['"]?\)/);
            if (bgMatch && bgMatch[1]) {
                const bgUrl = normalizeUrl(bgMatch[1], sourceUrl);
                if (bgUrl && !shouldSkipImage(bgMatch[1])) {
                    console.log(`[LogoExtract] Found logo via background-image: ${bgUrl}`);
                    return bgUrl;
                }
            }
        }
    }
    console.log('[LogoExtract] No logo found');
    return null;
}
/**
 * Check if an image is likely a product/service image worth enhancing
 * Must be substantial (not decorative), and have meaningful content
 */
function isProductServiceImage(src, alt, context) {
    const srcLower = src.toLowerCase();
    const altLower = alt.toLowerCase();
    const contextLower = context.toLowerCase();
    // Skip logos (handled separately)
    if (srcLower.includes('logo') || altLower.includes('logo')) {
        return false;
    }
    // Skip stock-looking patterns
    const stockPatterns = ['shutterstock', 'istock', 'getty', 'unsplash', 'pexels', 'placeholder', 'stock'];
    if (stockPatterns.some(p => srcLower.includes(p))) {
        return false;
    }
    // Skip avatar/profile images
    const avatarPatterns = ['avatar', 'profile', 'user', 'headshot'];
    if (avatarPatterns.some(p => srcLower.includes(p) || altLower.includes(p))) {
        return false;
    }
    // Positive indicators for product/service images
    const productIndicators = [
        'product', 'service', 'work', 'project', 'portfolio',
        'gallery', 'before', 'after', 'result', 'completed',
        'kitchen', 'bathroom', 'room', 'home', 'office',
        'treatment', 'procedure', 'equipment', 'facility',
        'food', 'dish', 'menu', 'meal', 'cuisine'
    ];
    // Context indicators (where the image was found)
    const contextIndicators = ['service', 'portfolio', 'gallery', 'work', 'project', 'hero', 'featured'];
    const hasProductIndicator = productIndicators.some(p => srcLower.includes(p) || altLower.includes(p) || contextLower.includes(p));
    const hasContextIndicator = contextIndicators.some(p => contextLower.includes(p));
    // Accept if it has meaningful alt text (more than 3 words) or positive indicators
    const hasMeaningfulAlt = alt.trim().split(/\s+/).length >= 3;
    return hasProductIndicator || hasContextIndicator || hasMeaningfulAlt;
}
/**
 * Extract Top 3 Product/Service Images for enhancement
 * These are the most impactful images that would benefit from aesthetic studio edits
 */
function extractProductImages($, sourceUrl, logoUrl) {
    const productImages = [];
    const seenUrls = new Set();
    // Skip the logo URL
    if (logoUrl) {
        seenUrls.add(logoUrl);
    }
    // Priority selectors - images in important sections first
    const prioritySelectors = [
        // Hero images
        { selector: '[class*="hero"] img, #hero img, .banner img', context: 'hero' },
        { selector: 'section:first-of-type img', context: 'hero' },
        // Service/Product sections
        { selector: '[class*="service"] img, #services img', context: 'services' },
        { selector: '[class*="product"] img, #products img', context: 'products' },
        // Portfolio/Gallery
        { selector: '[class*="portfolio"] img, [class*="gallery"] img', context: 'gallery' },
        { selector: '[class*="work"] img, [class*="project"] img', context: 'portfolio' },
        // Featured/Main content
        { selector: 'main img, article img', context: 'main' },
        { selector: '.featured img, [class*="feature"] img', context: 'featured' },
        // General large images (likely important)
        { selector: 'img[width][height]', context: 'general' }
    ];
    for (const { selector, context } of prioritySelectors) {
        if (productImages.length >= 3)
            break;
        const elements = $(selector).toArray();
        for (const el of elements) {
            if (productImages.length >= 3)
                break;
            const src = $(el).attr('src');
            const alt = $(el).attr('alt') || '';
            const width = parseInt($(el).attr('width') || '0', 10);
            const height = parseInt($(el).attr('height') || '0', 10);
            // Skip if no src or already seen
            if (!src || shouldSkipImage(src))
                continue;
            const normalizedUrl = normalizeUrl(src, sourceUrl);
            if (!normalizedUrl || seenUrls.has(normalizedUrl))
                continue;
            // Skip small images (likely decorative)
            if (width > 0 && height > 0 && (width < 200 || height < 150))
                continue;
            // Get parent context for better classification
            const parentClass = $(el).parent().attr('class') || '';
            const parentId = $(el).parent().attr('id') || '';
            const fullContext = `${context} ${parentClass} ${parentId}`;
            // Check if this is a product/service image
            if (!isProductServiceImage(src, alt, fullContext))
                continue;
            seenUrls.add(normalizedUrl);
            productImages.push({
                originalUrl: normalizedUrl,
                alt: alt || `${context} image`,
                context: context
            });
            console.log(`[ProductImage] Found: ${normalizedUrl} (context: ${context})`);
        }
    }
    console.log(`[ProductImages] Extracted ${productImages.length} images for enhancement`);
    return productImages;
}
/**
 * Extract navigation links from the page
 */
function extractNavigation($, sourceUrl) {
    const links = [];
    const seenHrefs = new Set();
    const seenLabels = new Set();
    let baseHostname;
    try {
        baseHostname = new URL(sourceUrl).hostname;
    }
    catch (_a) {
        baseHostname = '';
    }
    const navSelectors = [
        'nav a',
        'header nav a',
        '.nav a, .navigation a',
        '#nav a, #navigation a',
        '[role="navigation"] a',
        '.menu a, #menu a',
        'header ul li a'
    ];
    for (const selector of navSelectors) {
        const elements = $(selector).toArray();
        for (const el of elements) {
            if (links.length >= 6)
                break; // Cap at 6 items
            const href = $(el).attr('href');
            const label = $(el).text().trim();
            if (!href || !label || label.length < 2 || label.length > 30)
                continue;
            if (seenLabels.has(label.toLowerCase()))
                continue;
            if (shouldSkipNavLink(href, label, baseHostname))
                continue;
            const normalizedHref = normalizeNavHref(href);
            if (seenHrefs.has(normalizedHref))
                continue;
            seenHrefs.add(normalizedHref);
            seenLabels.add(label.toLowerCase());
            links.push({
                label,
                href: normalizedHref,
                isExternal: false
            });
        }
        if (links.length >= 6)
            break;
    }
    return links;
}
/**
 * Extract social media links from the page
 */
function extractSocialLinks($) {
    const social = {};
    // Search in footer first, then whole page
    const searchAreas = ['footer a', 'a'];
    for (const selector of searchAreas) {
        $(selector).each((_, el) => {
            const href = $(el).attr('href');
            if (!href)
                return;
            const hrefLower = href.toLowerCase();
            if (!social.facebook && hrefLower.includes('facebook.com')) {
                social.facebook = href;
            }
            if (!social.instagram && hrefLower.includes('instagram.com')) {
                social.instagram = href;
            }
            if (!social.twitter && (hrefLower.includes('twitter.com') || hrefLower.includes('x.com'))) {
                social.twitter = href;
            }
            if (!social.linkedin && hrefLower.includes('linkedin.com')) {
                social.linkedin = href;
            }
            if (!social.yelp && hrefLower.includes('yelp.com')) {
                social.yelp = href;
            }
        });
        // If we found any social links in footer, don't search whole page
        if (Object.keys(social).length > 0)
            break;
    }
    return social;
}
/**
 * Extract contact information from the page
 */
function extractContactInfo($) {
    const contact = {};
    const pageText = $('body').text();
    // Phone patterns
    const phoneRegex = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phoneMatches = pageText.match(phoneRegex);
    if (phoneMatches && phoneMatches.length > 0) {
        contact.phone = phoneMatches[0].trim();
    }
    // Email patterns
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = pageText.match(emailRegex);
    if (emailMatches && emailMatches.length > 0) {
        // Filter out common non-business emails
        const businessEmail = emailMatches.find(e => !e.includes('example.com') &&
            !e.includes('email.com') &&
            !e.includes('domain.com'));
        if (businessEmail) {
            contact.email = businessEmail;
        }
    }
    // Address - look in structured data or contact sections
    const addressSelectors = [
        '[itemtype*="PostalAddress"]',
        '[itemprop="address"]',
        '.address:not(nav .address)',
        '#address',
        'footer [class*="address"]',
        'footer [class*="location"]',
        '.contact-info [class*="address"]',
        '.contact [class*="location"]'
    ];
    for (const selector of addressSelectors) {
        const addressEl = $(selector).first();
        if (addressEl.length) {
            let addressText = addressEl.text().trim().replace(/\s+/g, ' ');
            // Filter out CSS/HTML noise patterns
            const noisePatterns = [
                /skip to content/i,
                /open menu/i,
                /close menu/i,
                /@supports/i,
                /\.header/i,
                /\.top-bun/i,
                /\.patty/i,
                /height:\s*\d+px/i,
                /\{[^}]*\}/, // CSS blocks
                /^0\s+/, // Starts with "0 "
            ];
            // Check if text looks like noise
            const isNoise = noisePatterns.some(pattern => pattern.test(addressText));
            if (isNoise)
                continue;
            // Only accept if it looks like an address (has numbers and letters, reasonable length)
            const hasNumbers = /\d/.test(addressText);
            const hasLetters = /[a-zA-Z]/.test(addressText);
            const isReasonableLength = addressText.length > 10 && addressText.length < 300;
            if (hasNumbers && hasLetters && isReasonableLength) {
                contact.address = addressText.slice(0, 200);
                break;
            }
        }
    }
    // Fallback: Try to find address pattern in footer text
    if (!contact.address) {
        const footerText = $('footer').text();
        // Look for common address patterns (Street, Ave, Blvd, etc.)
        const addressPattern = /\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl)[\s,]+[\w\s]+,?\s*[A-Z]{2}\s*\d{5}/i;
        const addressMatch = footerText.match(addressPattern);
        if (addressMatch) {
            contact.address = addressMatch[0].trim();
        }
    }
    return contact;
}
/**
 * Extract services/offerings from the page
 */
function extractServices($) {
    const services = [];
    const seenServices = new Set();
    const serviceSelectors = [
        '[class*="service"] h3',
        '[class*="service"] h4',
        '[class*="service"] h2',
        '#services li',
        '.services-list li',
        '[data-section="services"] h3',
        '[class*="offering"] h3',
        '[class*="feature"] h3'
    ];
    for (const selector of serviceSelectors) {
        const elements = $(selector).toArray();
        for (const el of elements) {
            if (services.length >= 10)
                break;
            const text = $(el).text().trim();
            const normalized = text.toLowerCase();
            if (text && text.length > 2 && text.length < 100 && !seenServices.has(normalized)) {
                seenServices.add(normalized);
                services.push(text);
            }
        }
        if (services.length >= 10)
            break;
    }
    return services;
}
/**
 * Extract full copy/content from the page as markdown
 */
function extractFullCopy($) {
    // Clone to avoid modifying the original
    const $content = cheerio.load($.html());
    // Remove non-content elements
    $content('script, style, nav, header, footer, noscript, iframe, [aria-hidden="true"]').remove();
    const sections = [];
    // Extract from main content areas
    $content('main, article, section, .content, #content, [role="main"], .main, #main').each((_, el) => {
        let markdown = '';
        // Headings -> markdown
        $content(el).find('h1, h2, h3').each((_, h) => {
            var _a;
            const tag = ((_a = h.tagName) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || 'h2';
            const prefix = tag === 'h1' ? '# ' : tag === 'h2' ? '## ' : '### ';
            const text = $content(h).text().trim();
            if (text && text.length > 2) {
                markdown += prefix + text + '\n\n';
            }
        });
        // Paragraphs
        $content(el).find('p').each((_, p) => {
            const text = $content(p).text().trim();
            if (text && text.length > 20) {
                markdown += text + '\n\n';
            }
        });
        // List items
        $content(el).find('li').each((_, li) => {
            const text = $content(li).text().trim();
            if (text && text.length > 5 && text.length < 200) {
                markdown += '- ' + text + '\n';
            }
        });
        if (markdown.trim()) {
            sections.push(markdown.trim());
        }
    });
    // Cap at 5000 chars for token limits
    return sections.join('\n\n---\n\n').slice(0, 5000);
}
/**
 * Extract business name from the page
 */
function extractBusinessName($, sourceUrl) {
    // Common noise patterns to filter out
    const noisePatterns = [
        /google\s*reviews?/i,
        /yelp\s*reviews?/i,
        /facebook\s*reviews?/i,
        /customer\s*reviews?/i,
        /testimonials?/i,
        /home\s*page/i,
        /welcome\s*to/i,
        /loading/i,
        /menu/i,
        /skip\s*to/i,
        /^\d+$/, // Just numbers
        /^reviews?$/i, // Just "reviews"
    ];
    const isNoisyName = (name) => {
        return noisePatterns.some(pattern => pattern.test(name)) || name.length < 3 || name.length > 80;
    };
    // Try meta tags first (most reliable)
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');
    if (ogSiteName && !isNoisyName(ogSiteName)) {
        return ogSiteName.trim();
    }
    // Try schema.org structured data
    const schemaName = $('[itemtype*="Organization"] [itemprop="name"]').first().text().trim();
    if (schemaName && !isNoisyName(schemaName)) {
        return schemaName;
    }
    // Try title tag
    const title = $('title').text().trim();
    if (title) {
        // Remove common suffixes and clean up
        const cleaned = title
            .split(/[|\-–—:]/)[0]
            .trim()
            .replace(/\s*(home|homepage|official|site|website)\s*/gi, '')
            .trim();
        if (!isNoisyName(cleaned)) {
            return cleaned;
        }
    }
    // Try h1 in header
    const headerH1 = $('header h1').first().text().trim();
    if (headerH1 && !isNoisyName(headerH1)) {
        return headerH1;
    }
    // Try logo alt text
    const logoAlt = $('img[alt*="logo" i]').first().attr('alt');
    if (logoAlt) {
        const cleaned = logoAlt.replace(/\s*logo\s*/gi, '').trim();
        if (!isNoisyName(cleaned)) {
            return cleaned;
        }
    }
    // Try aria-label on logo link
    const logoAriaLabel = $('a[href="/"] img').parent().attr('aria-label') ||
        $('[class*="logo"]').attr('aria-label');
    if (logoAriaLabel && !isNoisyName(logoAriaLabel)) {
        return logoAriaLabel.replace(/\s*logo\s*/gi, '').trim();
    }
    // Fall back to hostname (formatted nicely)
    try {
        const hostname = new URL(sourceUrl).hostname.replace('www.', '');
        const domain = hostname.split('.')[0];
        // Capitalize and handle common patterns
        return domain
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    catch (_a) {
        return 'Business';
    }
}
/**
 * Analyze visual vibe using Gemini multimodal
 */
async function analyzeVisualVibe(page) {
    try {
        // Set viewport for screenshot
        await page.setViewport({ width: 1280, height: 720 });
        // Wait for page to fully render (images, fonts, animations)
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Take screenshot
        const screenshotBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 80,
            encoding: 'base64'
        });
        // Send to Gemini for multimodal analysis
        const ai = await getGenAI();
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `Analyze this website screenshot and describe the brand's visual "vibe" in 2-3 sentences.

Consider:
- Color mood (warm/cool, vibrant/muted, professional/playful)
- Typography feel (modern/classic, bold/elegant, corporate/casual)
- Layout style (minimal/busy, structured/organic, traditional/contemporary)
- Overall personality (e.g., "rugged and industrial", "soft and feminine", "tech-forward and clean", "warm and homey")

Output ONLY the vibe description, no preamble.`;
        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    mimeType: 'image/jpeg',
                    data: screenshotBuffer
                }
            }
        ]);
        return {
            vibe: result.response.text().trim(),
            screenshot: screenshotBuffer
        };
    }
    catch (error) {
        console.warn('Visual vibe analysis failed:', error);
        return {
            vibe: 'professional and approachable',
            screenshot: ''
        };
    }
}
/**
 * Extract colors with advanced logo color extraction
 */
async function extractColorsAdvanced(page, logoUrl, sourceUrl) {
    const allColors = [];
    console.log('[ColorExtract] Starting advanced color extraction...');
    // PRIORITY 1: CSS Custom Properties
    try {
        const cssColors = await page.evaluate(() => {
            const root = document.documentElement;
            const style = getComputedStyle(root);
            const brandVars = [
                '--primary-color', '--brand-color', '--accent-color',
                '--primary', '--brand', '--accent',
                '--color-primary', '--color-brand', '--color-accent',
                '--main-color', '--theme-color'
            ];
            const found = [];
            for (const varName of brandVars) {
                const value = style.getPropertyValue(varName).trim();
                if (value && value.startsWith('#')) {
                    found.push(value.toLowerCase());
                }
            }
            return found;
        });
        if (cssColors.length > 0) {
            console.log(`[ColorExtract] CSS vars found: ${cssColors.join(', ')}`);
            allColors.push(...cssColors);
        }
    }
    catch (error) {
        console.warn('[ColorExtract] CSS color extraction failed:', error);
    }
    // PRIORITY 1.5: Inline style hex colors (CRITICAL for sites like mytribefitnc.com)
    // This extracts colors from style="" attributes which are commonly missed
    try {
        const inlineColors = await page.evaluate(() => {
            const found = [];
            // Select elements with style attributes containing # (hex colors)
            document.querySelectorAll('[style*="#"]').forEach(el => {
                const style = el.getAttribute('style') || '';
                // Match hex colors: #RGB, #RRGGBB (word boundary to avoid matching in URLs)
                const hexMatches = style.match(/#[0-9A-Fa-f]{3,6}(?=\s|;|"|'|$)/g);
                if (hexMatches) {
                    hexMatches.forEach(hex => {
                        // Normalize 3-digit hex to 6-digit
                        if (hex.length === 4) {
                            const r = hex[1], g = hex[2], b = hex[3];
                            found.push(`#${r}${r}${g}${g}${b}${b}`.toLowerCase());
                        }
                        else {
                            found.push(hex.toLowerCase());
                        }
                    });
                }
            });
            return found;
        });
        if (inlineColors.length > 0) {
            console.log(`[ColorExtract] Inline style colors found: ${inlineColors.join(', ')}`);
            allColors.push(...inlineColors);
        }
    }
    catch (error) {
        console.warn('[ColorExtract] Inline style extraction failed:', error);
    }
    // PRIORITY 1.6: Extract hex colors from <style> tags
    try {
        const styleTagColors = await page.evaluate(() => {
            const found = [];
            document.querySelectorAll('style').forEach(style => {
                const text = style.textContent || '';
                // Match hex colors that look like CSS values (not in URLs)
                const hexMatches = text.match(/:\s*#[0-9A-Fa-f]{3,6}(?=\s|;|!|$)/g);
                if (hexMatches) {
                    hexMatches.forEach(match => {
                        const hex = match.replace(/^:\s*/, '');
                        if (hex.length === 4) {
                            const r = hex[1], g = hex[2], b = hex[3];
                            found.push(`#${r}${r}${g}${g}${b}${b}`.toLowerCase());
                        }
                        else {
                            found.push(hex.toLowerCase());
                        }
                    });
                }
            });
            return found;
        });
        if (styleTagColors.length > 0) {
            console.log(`[ColorExtract] Style tag colors found: ${styleTagColors.join(', ')}`);
            allColors.push(...styleTagColors);
        }
    }
    catch (error) {
        console.warn('[ColorExtract] Style tag extraction failed:', error);
    }
    // PRIORITY 2: Logo Color Extraction (if not enough colors found)
    if (allColors.length < 2 && logoUrl) {
        try {
            // Ensure logoUrl is absolute
            const absoluteLogoUrl = logoUrl.startsWith('http')
                ? logoUrl
                : new URL(logoUrl, sourceUrl).href;
            console.log(`[ColorExtract] Fetching logo for color extraction: ${absoluteLogoUrl}`);
            // Fetch logo image
            const response = await fetch(absoluteLogoUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch logo: ${response.status}`);
            }
            const buffer = Buffer.from(await response.arrayBuffer());
            // Extract dominant colors using node-vibrant
            const palette = await node_1.Vibrant.from(buffer).getPalette();
            const logoColors = [];
            // Priority: Vibrant > DarkVibrant > Muted
            if (palette.Vibrant)
                logoColors.push(palette.Vibrant.hex.toLowerCase());
            if (palette.DarkVibrant)
                logoColors.push(palette.DarkVibrant.hex.toLowerCase());
            if (palette.Muted && logoColors.length < 3)
                logoColors.push(palette.Muted.hex.toLowerCase());
            if (logoColors.length > 0) {
                console.log(`[ColorExtract] Logo colors found: ${logoColors.join(', ')}`);
                allColors.push(...logoColors);
            }
        }
        catch (err) {
            console.warn('[ColorExtract] Logo color extraction failed:', err);
        }
    }
    // PRIORITY 3: Page CSS analysis (enhanced fallback)
    if (allColors.length < 2) {
        try {
            const pageColors = await page.evaluate(() => {
                const foundColors = [];
                const elements = document.querySelectorAll('*');
                const rgbToHex = (color) => {
                    // Handle rgb() and rgba()
                    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                    if (rgbMatch) {
                        const r = parseInt(rgbMatch[1]);
                        const g = parseInt(rgbMatch[2]);
                        const b = parseInt(rgbMatch[3]);
                        // Skip near-white and near-black
                        if ((r > 240 && g > 240 && b > 240) || (r < 15 && g < 15 && b < 15)) {
                            return null;
                        }
                        return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
                    }
                    // Handle direct hex (some browsers return hex)
                    if (color.startsWith('#')) {
                        return color.toLowerCase();
                    }
                    return null;
                };
                elements.forEach(el => {
                    const styles = window.getComputedStyle(el);
                    const bgColor = styles.backgroundColor;
                    const textColor = styles.color;
                    const borderColor = styles.borderColor;
                    const bgHex = rgbToHex(bgColor);
                    const textHex = rgbToHex(textColor);
                    const borderHex = rgbToHex(borderColor);
                    if (bgHex)
                        foundColors.push(bgHex.toLowerCase());
                    if (textHex)
                        foundColors.push(textHex.toLowerCase());
                    if (borderHex)
                        foundColors.push(borderHex.toLowerCase());
                });
                return foundColors;
            });
            if (pageColors.length > 0) {
                console.log(`[ColorExtract] Page CSS colors found: ${pageColors.length} colors`);
                allColors.push(...pageColors);
            }
        }
        catch (error) {
            console.warn('[ColorExtract] Page color extraction failed:', error);
        }
    }
    // Count color frequency for better brand color detection
    const colorCounts = new Map();
    allColors.forEach(c => {
        const normalized = c.toLowerCase();
        colorCounts.set(normalized, (colorCounts.get(normalized) || 0) + 1);
    });
    // Sort by frequency (most used = likely brand color), then filter grayscale
    const sortedColors = [...colorCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([color]) => color)
        .filter(c => !isGrayscale(c))
        .slice(0, 5);
    console.log(`[ColorExtract] Final colors (by frequency): ${sortedColors.join(', ')}`);
    return sortedColors.slice(0, 3);
}
/**
 * Apply fallback values for missing data
 */
function applyFallbacks(identity) {
    // Default navigation if none found
    if (identity.navigation.length === 0) {
        identity.navigation = [
            { label: 'Home', href: '#hero', isExternal: false },
            { label: 'Services', href: '#services', isExternal: false },
            { label: 'About', href: '#about', isExternal: false },
            { label: 'Contact', href: '#contact', isExternal: false }
        ];
    }
    // Default colors if none found
    if (identity.primaryColors.length === 0) {
        identity.primaryColors = ['#3B82F6', '#1E40AF', '#60A5FA'];
    }
    // Default vibe if analysis failed
    if (!identity.visualVibe) {
        identity.visualVibe = 'professional and approachable';
    }
    // Ensure productImages is always an array
    if (!identity.productImages) {
        identity.productImages = [];
    }
    return identity;
}
// ============================================
// CORE EXTRACTION FUNCTION
// ============================================
/**
 * Core function to extract site identity from a URL
 */
async function extractSiteIdentityCore(url, forceRefresh = false) {
    // Check cache first
    if (!forceRefresh) {
        const cached = await getCachedIdentity(url);
        if (cached) {
            console.log('Returning cached site identity for:', url);
            return cached;
        }
    }
    console.log('Extracting site identity for:', url);
    // Launch Puppeteer with @sparticuz/chromium for serverless environments
    const browser = await puppeteer_core_1.default.launch({
        args: chromium_1.default.args,
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: await chromium_1.default.executablePath(),
        headless: true
    });
    try {
        const page = await browser.newPage();
        // Set viewport and user agent
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        // Navigate to page
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        // Get HTML content
        const html = await page.content();
        const $ = cheerio.load(html);
        // Extract all data in parallel where possible
        const [vibeResult, logoUrl] = await Promise.all([
            analyzeVisualVibe(page),
            Promise.resolve(extractLogo($, url))
        ]);
        // Extract colors (needs logoUrl)
        const primaryColors = await extractColorsAdvanced(page, logoUrl, url);
        // Extract other data (synchronous)
        const businessName = extractBusinessName($, url);
        const navigation = extractNavigation($, url);
        const services = extractServices($);
        const fullCopy = extractFullCopy($);
        const socialLinks = extractSocialLinks($);
        const contactInfo = extractContactInfo($);
        // Extract top 3 product/service images for enhancement
        const productImages = extractProductImages($, url, logoUrl);
        // Build identity object
        let identity = {
            businessName,
            logoUrl,
            primaryColors,
            navigation,
            services,
            fullCopy,
            visualVibe: vibeResult.vibe,
            screenshotBase64: vibeResult.screenshot,
            productImages,
            socialLinks,
            contactInfo,
            sourceUrl: url,
            extractedAt: new Date().toISOString(),
            contentSparsity: assessContentSparsity(fullCopy)
        };
        // Apply fallbacks
        identity = applyFallbacks(identity);
        // Cache the result (without screenshot)
        await setCachedIdentity(url, identity);
        console.log('Site identity extracted successfully:', {
            businessName: identity.businessName,
            colorsFound: identity.primaryColors.length,
            navLinksFound: identity.navigation.length,
            servicesFound: identity.services.length,
            productImagesFound: identity.productImages.length,
            contentSparsity: identity.contentSparsity,
            vibeAnalyzed: !!identity.visualVibe
        });
        return identity;
    }
    finally {
        await browser.close();
    }
}
// ============================================
// CLOUD FUNCTION ENDPOINT
// ============================================
/**
 * HTTP endpoint to extract site identity
 *
 * SAFEGUARD: Uses 2GiB memory and 90s timeout for Puppeteer + node-vibrant + Gemini
 */
exports.extractSiteIdentity = (0, https_1.onRequest)({
    timeoutSeconds: 90, // REQUIRED: Screenshot + Gemini call takes time
    memory: '2GiB', // REQUIRED: Puppeteer + node-vibrant need this
    cpu: 2, // REQUIRED: Better performance for image processing
    concurrency: 40,
    cors: true,
    region: 'us-central1'
}, async (req, res) => {
    const tracker = (0, logger_1.createTracker)('extractSiteIdentity');
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        // Rate limiting
        const clientId = (0, rateLimiter_1.getClientIdentifier)(req);
        const rateLimit = await (0, rateLimiter_1.checkRateLimit)(clientId, 'extractSiteIdentity');
        if (!rateLimit.allowed) {
            (0, rateLimiter_1.rateLimitResponse)(res, rateLimit);
            return;
        }
        const { url, forceRefresh = false } = req.body;
        if (!url) {
            res.status(400).json({ error: 'url is required' });
            return;
        }
        // Validate URL
        try {
            new URL(url);
        }
        catch (_a) {
            res.status(400).json({ error: 'Invalid URL format' });
            return;
        }
        // Extract identity
        const identity = await extractSiteIdentityCore(url, forceRefresh);
        tracker.success({
            businessName: identity.businessName,
            colorsFound: identity.primaryColors.length,
            contentSparsity: identity.contentSparsity
        });
        // Don't return screenshotBase64 in response (too large)
        const responseIdentity = { ...identity, screenshotBase64: undefined };
        res.json(responseIdentity);
    }
    catch (error) {
        tracker.error(error);
        console.error('extractSiteIdentity error:', error);
        res.status(500).json({
            error: error.message || 'Failed to extract site identity',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});
//# sourceMappingURL=siteIdentity.js.map