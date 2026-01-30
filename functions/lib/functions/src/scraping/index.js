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
Object.defineProperty(exports, "__esModule", { value: true });
exports.scrapeWebsite = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const puppeteer = __importStar(require("puppeteer"));
const cheerio = __importStar(require("cheerio"));
const crypto = __importStar(require("crypto"));
const rateLimiter_1 = require("../utils/rateLimiter");
const logger_1 = require("../utils/logger");
// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// ============================================
// CACHING CONFIGURATION
// ============================================
const CACHE_COLLECTION = 'scrapedContent';
const DEFAULT_CACHE_TTL_DAYS = 7;
/**
 * Generate a hash for the URL to use as cache key
 */
function getUrlHash(url) {
    return crypto.createHash('sha256').update(url.toLowerCase().trim()).digest('hex').substring(0, 32);
}
/**
 * Get cached scrape result if available and not expired
 */
async function getCachedScrape(url) {
    var _a, _b;
    try {
        // Check if caching is enabled in config
        const configDoc = await db.doc('config/scalingConfig').get();
        const config = configDoc.exists ? configDoc.data() : null;
        if ((config === null || config === void 0 ? void 0 : config.cacheEnabled) === false) {
            return null;
        }
        const cacheTTLDays = (config === null || config === void 0 ? void 0 : config.cacheTTLDays) || DEFAULT_CACHE_TTL_DAYS;
        const hash = getUrlHash(url);
        const doc = await db.collection(CACHE_COLLECTION).doc(hash).get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        const cachedAt = ((_b = (_a = data.cachedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(0);
        const ageInDays = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays > cacheTTLDays) {
            // Cache expired, delete it
            await db.collection(CACHE_COLLECTION).doc(hash).delete();
            return null;
        }
        return data.assets;
    }
    catch (error) {
        console.error('Cache read error:', error);
        return null; // Fail open - continue with scrape
    }
}
/**
 * Store scrape result in cache
 */
async function setCachedScrape(url, assets) {
    try {
        // Check if caching is enabled
        const configDoc = await db.doc('config/scalingConfig').get();
        const config = configDoc.exists ? configDoc.data() : null;
        if ((config === null || config === void 0 ? void 0 : config.cacheEnabled) === false) {
            return;
        }
        const hash = getUrlHash(url);
        await db.collection(CACHE_COLLECTION).doc(hash).set({
            url,
            urlHash: hash,
            assets,
            cachedAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + ((config === null || config === void 0 ? void 0 : config.cacheTTLDays) || DEFAULT_CACHE_TTL_DAYS) * 24 * 60 * 60 * 1000)
        });
    }
    catch (error) {
        console.error('Cache write error:', error);
        // Fail silently - caching is optional
    }
}
// ============================================
// HELPER FUNCTIONS
// ============================================
/**
 * Classify an image based on its alt text, src, and surrounding context
 */
function classifyImage(alt, src, context) {
    const altLower = alt.toLowerCase();
    const srcLower = src.toLowerCase();
    const contextLower = (context || '').toLowerCase();
    // Logo detection
    if (altLower.includes('logo') || srcLower.includes('logo')) {
        return 'logo';
    }
    // Hero detection
    if (srcLower.includes('hero') || srcLower.includes('banner') ||
        contextLower.includes('hero') || altLower.includes('banner')) {
        return 'hero';
    }
    // Team detection
    if (altLower.includes('team') || altLower.includes('staff') ||
        altLower.includes('doctor') || altLower.includes('founder') ||
        srcLower.includes('team') || srcLower.includes('staff')) {
        return 'team';
    }
    // Service detection
    if (altLower.includes('service') || srcLower.includes('service') ||
        contextLower.includes('service')) {
        return 'service';
    }
    // Product detection
    if (altLower.includes('product') || srcLower.includes('product')) {
        return 'product';
    }
    // Gallery detection
    if (srcLower.includes('gallery') || srcLower.includes('portfolio') ||
        contextLower.includes('gallery')) {
        return 'gallery';
    }
    return 'other';
}
/**
 * Extract color palette from page CSS
 */
async function extractColorsFromPage(page) {
    return page.evaluate(() => {
        const colors = new Set();
        const elements = document.querySelectorAll('*');
        elements.forEach(el => {
            const styles = window.getComputedStyle(el);
            const bgColor = styles.backgroundColor;
            const textColor = styles.color;
            // Convert RGB to Hex and filter out common colors
            const rgbToHex = (rgb) => {
                const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                if (!match)
                    return null;
                const r = parseInt(match[1]);
                const g = parseInt(match[2]);
                const b = parseInt(match[3]);
                // Skip white, black, and transparent
                if ((r === 255 && g === 255 && b === 255) ||
                    (r === 0 && g === 0 && b === 0) ||
                    (r === 0 && g === 0 && b === 0 && rgb.includes('rgba'))) {
                    return null;
                }
                return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
            };
            const bgHex = rgbToHex(bgColor);
            const textHex = rgbToHex(textColor);
            if (bgHex)
                colors.add(bgHex);
            if (textHex)
                colors.add(textHex);
        });
        // Return top 6 most likely brand colors
        return Array.from(colors).slice(0, 6);
    });
}
/**
 * Check if URL should be skipped (icons, favicons, etc.)
 */
function shouldSkipImage(src) {
    const skipPatterns = [
        'favicon', 'icon', 'sprite', 'pixel', 'tracking',
        'spacer', 'blank', '1x1', 'loading', 'spinner',
        'social', 'facebook', 'twitter', 'instagram', 'linkedin',
        'google', 'yelp', 'tripadvisor'
    ];
    const srcLower = src.toLowerCase();
    return skipPatterns.some(pattern => srcLower.includes(pattern));
}
// ============================================
// MAIN SCRAPING FUNCTION - 2nd Gen with Full Auto-Scale
// ============================================
/**
 * Scrape website and extract assets
 *
 * 2nd Gen Cloud Function with:
 * - Full auto-scaling (no maxInstances limit)
 * - Concurrency: 80 requests per instance
 * - URL caching with configurable TTL
 * - Built-in CORS support
 */
exports.scrapeWebsite = (0, https_1.onRequest)({
    timeoutSeconds: 300, // 5 minutes for complex sites
    memory: '2GiB', // 2GB for Puppeteer
    cpu: 2, // 2 vCPUs for better performance
    concurrency: 80, // Handle 80 concurrent requests per instance
    // NO maxInstances = full auto-scale to regional quota (~1000 instances)
    cors: true, // Built-in CORS support
    region: 'us-central1'
}, async (req, res) => {
    const tracker = (0, logger_1.createTracker)('scrapeWebsite');
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        // Rate limiting - prevents abuse while allowing scale
        const clientId = (0, rateLimiter_1.getClientIdentifier)(req);
        const rateLimit = await (0, rateLimiter_1.checkRateLimit)(clientId, 'scrapeWebsite');
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
        // Check cache first (unless forceRefresh is true)
        if (!forceRefresh) {
            const cached = await getCachedScrape(url);
            if (cached) {
                tracker.success({ cached: true, imagesExtracted: cached.images.length });
                res.json({ ...cached, fromCache: true });
                return;
            }
        }
        // Launch Puppeteer with optimized args for Cloud Functions
        const browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--no-first-run',
                '--no-zygote',
                '--disable-gpu',
                '--single-process',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--hide-scrollbars',
                '--metrics-recording-only',
                '--mute-audio',
                '--no-default-browser-check'
            ]
        });
        try {
            const page = await browser.newPage();
            // Set viewport for consistent rendering
            await page.setViewport({ width: 1920, height: 1080 });
            // Set user agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            // Navigate to page
            await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            // Get HTML content
            const html = await page.content();
            const $ = cheerio.load(html);
            const result = {
                images: [],
                content: {
                    services: [],
                    testimonials: []
                },
                colorPalette: []
            };
            // Extract logo
            const logoSelectors = [
                'img[alt*="logo" i]',
                'img[src*="logo" i]',
                '.logo img',
                '#logo img',
                'header img:first-of-type',
                '[class*="logo"] img',
                'a[href="/"] img'
            ];
            for (const selector of logoSelectors) {
                const logoEl = $(selector).first();
                if (logoEl.length) {
                    const logoSrc = logoEl.attr('src');
                    if (logoSrc && !shouldSkipImage(logoSrc)) {
                        result.logo = new URL(logoSrc, url).href;
                        break;
                    }
                }
            }
            // Extract all meaningful images
            const seenUrls = new Set();
            $('img').each((_, el) => {
                const src = $(el).attr('src');
                const alt = $(el).attr('alt') || '';
                if (!src || shouldSkipImage(src))
                    return;
                const absoluteUrl = new URL(src, url).href;
                // Skip duplicates
                if (seenUrls.has(absoluteUrl))
                    return;
                seenUrls.add(absoluteUrl);
                // Get parent context for classification
                const parent = $(el).parent();
                const parentClass = parent.attr('class') || '';
                const parentId = parent.attr('id') || '';
                const context = `${parentClass} ${parentId}`;
                const imageType = classifyImage(alt, src, context);
                // Skip if it's the logo we already extracted
                if (imageType === 'logo' && result.logo === absoluteUrl)
                    return;
                result.images.push({
                    url: absoluteUrl,
                    alt,
                    type: imageType
                });
            });
            // Extract hero content
            const heroSelectors = ['h1', '.hero h2', '[class*="hero"] h1', '[class*="hero"] h2', '#hero h1'];
            for (const selector of heroSelectors) {
                const heroText = $(selector).first().text().trim();
                if (heroText && heroText.length > 5) {
                    result.content.hero = heroText;
                    break;
                }
            }
            // Extract about content
            const aboutSelectors = [
                '[class*="about"]',
                '#about',
                '[data-section="about"]',
                'section:contains("About")'
            ];
            for (const selector of aboutSelectors) {
                const aboutEl = $(selector).first();
                if (aboutEl.length) {
                    const aboutText = aboutEl.find('p').text().trim().substring(0, 500);
                    if (aboutText && aboutText.length > 20) {
                        result.content.about = aboutText;
                        break;
                    }
                }
            }
            // Extract services
            const serviceSelectors = [
                '[class*="service"] h3',
                '[class*="service"] h4',
                '#services li',
                '.services-list li',
                '[data-section="services"] h3'
            ];
            const services = [];
            serviceSelectors.forEach(selector => {
                $(selector).each((_, el) => {
                    const text = $(el).text().trim();
                    if (text && text.length > 2 && text.length < 100 && services.length < 10) {
                        services.push(text);
                    }
                });
            });
            if (services.length > 0) {
                result.content.services = [...new Set(services)];
            }
            // Extract testimonials
            const testimonialSelectors = [
                '[class*="testimonial"] p',
                '[class*="review"] p',
                '.quote',
                'blockquote'
            ];
            const testimonials = [];
            testimonialSelectors.forEach(selector => {
                $(selector).each((_, el) => {
                    const text = $(el).text().trim();
                    if (text && text.length > 30 && text.length < 500 && testimonials.length < 5) {
                        testimonials.push(text);
                    }
                });
            });
            if (testimonials.length > 0) {
                result.content.testimonials = testimonials;
            }
            // Extract color palette
            result.colorPalette = await extractColorsFromPage(page);
            // Cache the result for future requests
            await setCachedScrape(url, result);
            tracker.success({ cached: false, imagesExtracted: result.images.length, hasLogo: !!result.logo });
            res.json({ ...result, fromCache: false });
        }
        finally {
            await browser.close();
        }
    }
    catch (error) {
        tracker.error(error);
        console.error('scrapeWebsite error:', error);
        res.status(500).json({
            error: error.message || 'Failed to scrape website',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});
//# sourceMappingURL=index.js.map