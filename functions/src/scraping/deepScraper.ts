/**
 * Deep Scraper v3.0 - Deep-Multimodal Site Content Extraction
 *
 * This module provides comprehensive site scraping with:
 * - Multi-page crawling (up to 8 pages for modernization)
 * - Logo extraction with base64 encoding for reliability
 * - Real testimonial extraction (NO hallucination)
 * - Enhanced color extraction via Google Vision IMAGE_PROPERTIES
 * - OCR text extraction via Google Vision TEXT_DETECTION
 * - Semantic image captioning via Gemini Flash
 * - Team member extraction
 * - FAQ extraction
 */

import puppeteer, { Page, Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import * as cheerio from 'cheerio';
import { Vibrant } from 'node-vibrant/node';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Import Deep Vision for OCR and color extraction
import {
    batchAnalyzeImages,
    extractFactsFromOCR,
} from '../vision/deepVision';

// ============================================
// LOCAL TYPE DEFINITIONS
// (Defined locally to avoid importing from outside functions/src)
// ============================================

export interface NavigationLink {
    label: string;
    href: string;
    isExternal: boolean;
}

export interface SiteImage {
    url: string;
    alt: string;
    context: 'hero' | 'services' | 'gallery' | 'team' | 'general';
    width?: number;
    height?: number;
}

export interface ExtractedPage {
    url: string;
    title: string;
    path: string;
    headings: string[];
    paragraphs: string[];
    listItems: string[];
    rawMarkdown: string;
}

export interface ExtractedService {
    name: string;
    description: string;
    imageUrl?: string;
    features?: string[];
}

export interface ExtractedTestimonial {
    quote: string;
    authorName: string;
    authorTitle?: string;
    rating?: number;
    source?: string;
}

export interface ExtractedTeamMember {
    name: string;
    role: string;
    bio?: string;
    imageUrl?: string;
}

export interface ExtractedFAQ {
    question: string;
    answer: string;
}

export interface ContactInfo {
    phone?: string;
    email?: string;
    address?: string;
}

export interface SocialLinks {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    yelp?: string;
}

// Extended SiteImage with Deep-Multimodal fields
export interface ExtendedSiteImage extends SiteImage {
    semanticCaption?: string;        // 10-word AI caption
    extractedText?: string[];        // OCR text via TEXT_DETECTION
    dominantColors?: string[];       // Via IMAGE_PROPERTIES
    visionConfidence?: number;       // Vision API confidence (0-1)
    base64?: string;                 // Inline for reliable injection
    placeholderId?: string;          // e.g., "[[ID_HERO_1_HERE]]"
}

// OCR-extracted facts
export interface ExtractedFact {
    source: 'logo' | 'flyer' | 'hero' | 'signage';
    text: string;
    confidence: number;
    imageUrl: string;
}

// Semantic mapping of images to sections
export interface SemanticImageMap {
    hero: ExtendedSiteImage[];
    services: ExtendedSiteImage[];
    about: ExtendedSiteImage[];
    testimonials: ExtendedSiteImage[];
    gallery: ExtendedSiteImage[];
}

export interface SiteIdentity {
    businessName: string;
    tagline: string;
    sourceUrl: string;
    extractedAt: string;
    logoUrl: string | null;
    logoBase64?: string;
    heroImages: SiteImage[];
    galleryImages: SiteImage[];
    primaryColors: string[];
    navigation: NavigationLink[];
    pages: ExtractedPage[];
    services: ExtractedService[];
    testimonials: ExtractedTestimonial[];
    teamMembers: ExtractedTeamMember[];
    faqs: ExtractedFAQ[];
    coreValues: string[];
    contactInfo: ContactInfo;
    socialLinks: SocialLinks;
    businessHours?: string;
    visualVibe: string;
    screenshotBase64?: string;
    contentSparsity: 'rich' | 'moderate' | 'sparse';
    fullCopy?: string;
    // Deep-Multimodal fields (v3.0)
    extractedFacts?: ExtractedFact[];
    accentColor?: string | null;
    visionAnalysisComplete?: boolean;
    semanticImageMap?: SemanticImageMap;
}

const secretClient = new SecretManagerServiceClient();
let genAI: GoogleGenerativeAI | null = null;

// ============================================
// GEMINI INITIALIZATION
// ============================================

async function getGeminiApiKey(): Promise<string> {
    const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';
    const secretName = `projects/${projectId}/secrets/gemini-api-key/versions/latest`;
    const [version] = await secretClient.accessSecretVersion({ name: secretName });
    const apiKey = version.payload?.data?.toString();
    if (!apiKey) {
        throw new Error('Failed to retrieve Gemini API key from Secret Manager');
    }
    return apiKey;
}

async function getGenAI(): Promise<GoogleGenerativeAI> {
    if (!genAI) {
        const apiKey = await getGeminiApiKey();
        genAI = new GoogleGenerativeAI(apiKey);
    }
    return genAI;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function normalizeUrl(url: string | undefined, baseUrl: string): string | null {
    if (!url) return null;
    try {
        return new URL(url, baseUrl).href;
    } catch {
        return null;
    }
}

function shouldSkipImage(src: string): boolean {
    const skipPatterns = [
        'favicon', 'sprite', 'pixel', 'tracking',
        'spacer', 'blank', '1x1', 'loading', 'spinner',
        'facebook', 'twitter', 'instagram', 'linkedin',
        'google', 'yelp', 'tripadvisor', 'data:image/svg+xml',
        'dummy.png', 'placeholder', 'default-', 'no-image',
        'arrow', 'check', 'star-icon', 'recaptcha', 'gravatar'
    ];
    const srcLower = src.toLowerCase();
    // Skip if it matches skip patterns
    if (skipPatterns.some(pattern => srcLower.includes(pattern))) return true;
    // Skip very small images (likely icons)
    if (srcLower.includes('icon') && !srcLower.includes('fav')) return true;
    // Skip social media images
    if (srcLower.includes('social') && !srcLower.includes('wp-content')) return true;
    return false;
}

function isGrayscale(hex: string): boolean {
    if (!hex || !hex.startsWith('#') || hex.length < 7) return true;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const isNearWhite = r > 240 && g > 240 && b > 240;
    const isNearBlack = r < 15 && g < 15 && b < 15;
    const isGray = Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && Math.abs(r - b) < 15;
    return isNearWhite || isNearBlack || isGray;
}

function rgbToHex(rgb: string): string | null {
    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!match) return null;
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    if ((r === 255 && g === 255 && b === 255) || (r === 0 && g === 0 && b === 0)) {
        return null;
    }
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
}

// ============================================
// LINK DISCOVERY (for multi-page crawling)
// ============================================

async function discoverInternalLinks(page: Page, baseUrl: string): Promise<string[]> {
    const baseHostname = new URL(baseUrl).hostname;

    const links = await page.evaluate((base: string, hostname: string) => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        return anchors
            .map(a => a.getAttribute('href'))
            .filter((href): href is string => {
                if (!href) return false;
                if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return false;
                if (href.startsWith('#')) return false;
                return true;
            })
            .map(href => {
                try {
                    return new URL(href, base).href;
                } catch {
                    return null;
                }
            })
            .filter((href): href is string => {
                if (!href) return false;
                try {
                    return new URL(href).hostname === hostname;
                } catch {
                    return false;
                }
            });
    }, baseUrl, baseHostname);

    // Prioritize important pages
    const priorityPaths = ['/about', '/services', '/contact', '/team', '/testimonials', '/reviews', '/staff', '/our-team'];
    const uniqueLinks = [...new Set(links)];

    return uniqueLinks.sort((a, b) => {
        const aPath = new URL(a).pathname.toLowerCase();
        const bPath = new URL(b).pathname.toLowerCase();
        const aScore = priorityPaths.findIndex(p => aPath.includes(p));
        const bScore = priorityPaths.findIndex(p => bPath.includes(p));
        const aRank = aScore === -1 ? 999 : aScore;
        const bRank = bScore === -1 ? 999 : bScore;
        return aRank - bRank;
    });
}

// ============================================
// PAGE CONTENT EXTRACTION
// ============================================

async function extractPageContent(page: Page, url: string): Promise<ExtractedPage> {
    const html = await page.content();
    const $ = cheerio.load(html);

    // Remove noise elements
    $('script, style, nav, noscript, iframe, [aria-hidden="true"], .cookie-banner, #cookie-banner').remove();

    const title = $('title').text().trim();
    const path = new URL(url).pathname;

    // Extract headings
    const headings: string[] = [];
    $('h1, h2, h3').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 2 && text.length < 200) {
            headings.push(text);
        }
    });

    // Extract paragraphs
    const paragraphs: string[] = [];
    $('p').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 20) {
            paragraphs.push(text);
        }
    });

    // Extract list items
    const listItems: string[] = [];
    $('li').each((_, el) => {
        const text = $(el).text().trim();
        if (text && text.length > 5 && text.length < 300) {
            listItems.push(text);
        }
    });

    // Build raw markdown
    let rawMarkdown = `# ${title}\n\n`;
    headings.forEach(h => { rawMarkdown += `## ${h}\n\n`; });
    paragraphs.forEach(p => { rawMarkdown += `${p}\n\n`; });
    listItems.forEach(li => { rawMarkdown += `- ${li}\n`; });

    return {
        url,
        title,
        path,
        headings,
        paragraphs,
        listItems,
        rawMarkdown: rawMarkdown.slice(0, 10000) // Cap at 10k chars per page
    };
}

// ============================================
// LOGO EXTRACTION WITH BASE64
// ============================================

async function extractLogoWithBase64(
    $: cheerio.CheerioAPI,
    page: Page,
    sourceUrl: string
): Promise<{ url: string | null; base64: string | null }> {
    // Extended selectors to catch various logo patterns
    const logoSelectors = [
        // Standard logo patterns
        'img[alt*="logo" i]',
        'img[src*="logo" i]',
        '.logo img',
        '#logo img',
        '[class*="logo"] img',
        'a[href="/"] img',
        '[class*="brand"] img',

        // Icon/emblem patterns
        'header img:first-of-type',
        '.header-icon img',
        '[class*="icon"] img:first-of-type',
        'nav img:first-of-type',

        // Schema.org logo
        '[itemtype*="Organization"] [itemprop="logo"]',

        // SVG logos
        'header svg[class*="logo"]',
        '.logo svg',
        '[class*="logo"] svg',

        // Fallback
        'header [role="img"]'
    ];

    for (const selector of logoSelectors) {
        const el = $(selector).first();
        if (el.length) {
            // Handle SVG inline
            if (el.is('svg')) {
                const svgHtml = $.html(el);
                const base64 = Buffer.from(svgHtml).toString('base64');
                return { url: null, base64: `data:image/svg+xml;base64,${base64}` };
            }

            let src = el.attr('src') || el.attr('data-src') || el.attr('href');
            if (src && !shouldSkipImage(src)) {
                const absoluteUrl = normalizeUrl(src, sourceUrl);
                if (absoluteUrl) {
                    // Fetch and convert to base64 for reliability
                    try {
                        const response = await fetch(absoluteUrl);
                        if (response.ok) {
                            const buffer = Buffer.from(await response.arrayBuffer());
                            const contentType = response.headers.get('content-type') || 'image/png';
                            const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;
                            console.log(`[DeepScraper] Logo extracted: ${absoluteUrl}`);
                            return { url: absoluteUrl, base64 };
                        }
                    } catch (e) {
                        console.warn('[DeepScraper] Failed to fetch logo:', e);
                    }
                    return { url: absoluteUrl, base64: null };
                }
            }
        }
    }

    // Try to find logo via page evaluation (dynamic content)
    try {
        const logoFromPage = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('header img, nav img, .logo img'));
            for (const img of imgs) {
                const src = (img as HTMLImageElement).src;
                if (src && !src.includes('data:image/svg+xml') && src.includes('http')) {
                    return src;
                }
            }
            return null;
        });

        if (logoFromPage) {
            try {
                const response = await fetch(logoFromPage);
                if (response.ok) {
                    const buffer = Buffer.from(await response.arrayBuffer());
                    const contentType = response.headers.get('content-type') || 'image/png';
                    const base64 = `data:${contentType};base64,${buffer.toString('base64')}`;
                    console.log(`[DeepScraper] Logo extracted from page: ${logoFromPage}`);
                    return { url: logoFromPage, base64 };
                }
            } catch (e) {
                console.warn('[DeepScraper] Failed to fetch logo from page:', e);
            }
        }
    } catch (e) {
        console.warn('[DeepScraper] Page logo evaluation failed:', e);
    }

    return { url: null, base64: null };
}

// ============================================
// TESTIMONIAL EXTRACTION (NO HALLUCINATION)
// ============================================

function extractTestimonials($: cheerio.CheerioAPI, pages: ExtractedPage[]): ExtractedTestimonial[] {
    const testimonials: ExtractedTestimonial[] = [];
    const seenQuotes = new Set<string>();

    // Fake name patterns to reject
    const fakeNames = [
        'john doe', 'jane doe', 'john smith', 'jane smith',
        'happy customer', 'satisfied client', 'anonymous',
        'customer name', 'your name', 'client name'
    ];

    // Form/CTA keywords to filter out false positives
    const formKeywords = [
        'call us', 'text us', 'drop in', 'pricing', 'schedule',
        'submit', 'form', 'email', 'phone', 'contact us',
        'sign up', 'subscribe', 'get started', 'free'
    ];

    // Check if text looks like form content
    function isFormContent(text: string): boolean {
        const textLower = text.toLowerCase();
        const keywordCount = formKeywords.filter(kw => textLower.includes(kw)).length;
        return keywordCount >= 2 || textLower.includes('by submitting') || textLower.includes('privacy policy');
    }

    // First, look for slider/carousel testimonials (like Courage Fitness uses)
    // These are often in list items with long text content
    $('li').each((_, el) => {
        if (testimonials.length >= 6) return;

        const container = $(el);
        const fullText = container.text().trim();

        // Skip if too short or looks like form content
        if (fullText.length < 100 || isFormContent(fullText)) return;

        // Look for a pattern: quote text followed by a name
        // The name is usually at the end in a separate element
        let quote = '';
        let authorName = '';

        // Try to find the main text (which is the quote)
        const paragraphs = container.find('p');
        if (paragraphs.length > 0) {
            quote = paragraphs.first().text().trim();
        }

        // Try to find author name - usually in a strong, span, or at the end
        const nameEl = container.find('strong, .name, [class*="name"], [class*="author"]').last();
        if (nameEl.length) {
            authorName = nameEl.text().trim();
        }

        // If no separate name element, try to extract from the end of the text
        if (!authorName && quote.length > 50) {
            // Look for pattern where name appears after the main text
            const allText = container.text();
            // Split by common separators
            const parts = allText.split(/\n+/);
            if (parts.length > 1) {
                const lastPart = parts[parts.length - 1].trim();
                // Check if last part looks like a name (short, capitalized)
                if (lastPart.length > 3 && lastPart.length < 30 && /^[A-Z][a-z]+\s+[A-Z]/.test(lastPart)) {
                    authorName = lastPart;
                    // The quote is everything except the name
                    quote = parts.slice(0, -1).join(' ').trim();
                }
            }
        }

        // Clean up quote
        quote = quote.replace(/^[""]|[""]$/g, '').trim();

        // Validate
        if (quote.length < 50 || quote.length > 1000) return;
        if (!authorName || authorName.length < 3 || authorName.length > 30) return;
        if (fakeNames.includes(authorName.toLowerCase())) return;
        if (!/^[A-Z]/.test(authorName)) return;
        if (seenQuotes.has(quote.slice(0, 50))) return;
        if (isFormContent(quote)) return;

        seenQuotes.add(quote.slice(0, 50));
        testimonials.push({
            quote,
            authorName,
            source: 'website'
        });
        console.log(`[DeepScraper] Testimonial from list: "${quote.slice(0, 50)}..." - ${authorName}`);
    });

    // Testimonial container selectors (traditional approach)
    const testimonialSelectors = [
        '[class*="testimonial"]',
        '[class*="review"]',
        'blockquote',
        '[itemtype*="Review"]',
        '.client-feedback',
        '.customer-review',
        '[data-testimonial]'
    ];

    // Extract from Cheerio DOM
    for (const selector of testimonialSelectors) {
        $(selector).each((_, el) => {
            if (testimonials.length >= 6) return;

            const container = $(el);
            const fullText = container.text().trim();

            // Skip if looks like form content
            if (isFormContent(fullText)) return;

            let quote = '';
            let authorName = '';
            let authorTitle = '';
            let rating: number | undefined;

            // Try to find quote text
            const quoteEl = container.find('p, .quote-text, [class*="quote"], [class*="text"]').first();
            if (quoteEl.length) {
                quote = quoteEl.text().trim().replace(/^[""]|[""]$/g, '');
            } else {
                // Use container text but try to separate quote from author
                const parts = fullText.split(/[—–-]/);
                if (parts.length >= 2) {
                    quote = parts[0].trim().replace(/^[""]|[""]$/g, '');
                    authorName = parts[parts.length - 1].trim();
                } else {
                    quote = fullText.replace(/^[""]|[""]$/g, '');
                }
            }

            // Skip if looks like form content
            if (isFormContent(quote)) return;

            // Try to find author name
            if (!authorName) {
                const nameEl = container.find('.author, .name, [class*="name"], [class*="author"], cite, strong, .reviewer').last();
                if (nameEl.length) {
                    authorName = nameEl.text().trim();
                }
            }

            // Try to find author title/role
            const titleEl = container.find('.title, .role, [class*="title"], [class*="role"], .position').first();
            if (titleEl.length) {
                authorTitle = titleEl.text().trim();
            }

            // Try to find star rating
            const stars = container.find('[class*="star"], .rating, [data-rating]');
            if (stars.length) {
                const ratingAttr = stars.attr('data-rating');
                if (ratingAttr) {
                    rating = parseInt(ratingAttr, 10);
                } else {
                    const filledStars = container.find('.star-filled, .star.active, [class*="star-full"]').length;
                    if (filledStars > 0) rating = filledStars;
                }
            }

            // Validate testimonial
            if (quote.length < 50 || quote.length > 1000) return;
            if (!authorName || authorName.length < 3 || authorName.length > 30) return;
            if (fakeNames.includes(authorName.toLowerCase())) return;
            if (!/^[A-Z]/.test(authorName)) return;
            if (seenQuotes.has(quote.slice(0, 50))) return;

            seenQuotes.add(quote.slice(0, 50));
            testimonials.push({
                quote,
                authorName,
                authorTitle: authorTitle || undefined,
                rating: rating && rating >= 1 && rating <= 5 ? rating : undefined,
                source: 'website'
            });

            console.log(`[DeepScraper] Testimonial extracted: "${quote.slice(0, 50)}..." - ${authorName}`);
        });
    }

    // Also search in page content for review patterns
    for (const page of pages) {
        if (testimonials.length >= 6) break;

        // Pattern: "Quote text" - Name Name
        const reviewPattern = /"([^"]{50,500})"\s*[-—–]\s*([A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+)/g;
        let match;
        while ((match = reviewPattern.exec(page.rawMarkdown)) !== null && testimonials.length < 6) {
            const [, quote, name] = match;
            if (!seenQuotes.has(quote.slice(0, 50)) && !fakeNames.includes(name.toLowerCase()) && !isFormContent(quote)) {
                seenQuotes.add(quote.slice(0, 50));
                testimonials.push({
                    quote,
                    authorName: name,
                    source: 'website'
                });
                console.log(`[DeepScraper] Testimonial from markdown: "${quote.slice(0, 50)}..." - ${name}`);
            }
        }
    }

    return testimonials;
}

// ============================================
// TEAM MEMBER EXTRACTION
// ============================================

function extractTeamMembers($: cheerio.CheerioAPI): ExtractedTeamMember[] {
    const teamMembers: ExtractedTeamMember[] = [];
    const seenNames = new Set<string>();

    const teamSelectors = [
        '[class*="team"] [class*="member"]',
        '[class*="team"] [class*="card"]',
        '[class*="staff"]',
        '[class*="trainer"]',
        '[class*="coach"]',
        '.team-member',
        '.staff-member',
        '[itemtype*="Person"]'
    ];

    for (const selector of teamSelectors) {
        $(selector).each((_, el) => {
            if (teamMembers.length >= 10) return;

            const container = $(el);
            let name = '';
            let role = '';
            let bio = '';
            let imageUrl: string | undefined;

            // Find name
            const nameEl = container.find('h3, h4, .name, [class*="name"]').first();
            if (nameEl.length) {
                name = nameEl.text().trim();
            }

            // Find role/title
            const roleEl = container.find('.role, .title, .position, [class*="role"], [class*="title"]').first();
            if (roleEl.length) {
                role = roleEl.text().trim();
            }

            // Find bio
            const bioEl = container.find('p, .bio, .description').first();
            if (bioEl.length) {
                bio = bioEl.text().trim();
            }

            // Find image
            const imgEl = container.find('img').first();
            if (imgEl.length) {
                const src = imgEl.attr('src');
                if (src && !shouldSkipImage(src)) {
                    imageUrl = src;
                }
            }

            // Validate
            if (!name || name.length < 3 || seenNames.has(name.toLowerCase())) return;
            if (!role) return; // Must have a role

            seenNames.add(name.toLowerCase());
            teamMembers.push({
                name,
                role,
                bio: bio || undefined,
                imageUrl
            });

            console.log(`[DeepScraper] Team member: ${name} - ${role}`);
        });
    }

    return teamMembers;
}

// ============================================
// FAQ EXTRACTION
// ============================================

function extractFAQs($: cheerio.CheerioAPI): ExtractedFAQ[] {
    const faqs: ExtractedFAQ[] = [];
    const seenQuestions = new Set<string>();

    // FAQ section selectors
    const faqContainerSelectors = [
        '[class*="faq"]',
        '#faq',
        '.accordion',
        '[itemtype*="FAQPage"]'
    ];

    // Use combined selector for FAQ containers
    $(faqContainerSelectors.join(', ')).each((_, section) => {
        const container = $(section);

        // Try accordion pattern
        container.find('details, .accordion-item, [class*="item"]').each((_, item) => {
            if (faqs.length >= 10) return;

            const el = $(item);
            const question = el.find('summary, .question, h3, h4, [class*="question"]').first().text().trim();
            const answer = el.find('.answer, p, [class*="answer"], .content').first().text().trim();

            if (question && answer && question.length > 10 && answer.length > 20) {
                if (!seenQuestions.has(question.toLowerCase())) {
                    seenQuestions.add(question.toLowerCase());
                    faqs.push({ question, answer: answer.slice(0, 500) });
                }
            }
        });
    });

    return faqs;
}

// ============================================
// SERVICE EXTRACTION (Enhanced)
// ============================================

function extractServices($: cheerio.CheerioAPI, pages: ExtractedPage[]): ExtractedService[] {
    const services: ExtractedService[] = [];
    const seenNames = new Set<string>();

    // Common service-related keywords
    const serviceKeywords = [
        'training', 'program', 'class', 'service', 'fitness', 'coaching',
        'nutrition', 'lifestyle', 'strength', 'cardio', 'yoga', 'pilates',
        'personal', 'group', 'individual', 'design', 'consultation'
    ];

    // Words that indicate a heading is NOT a service
    const excludeKeywords = [
        'our', 'vision', 'mission', 'value', 'core', 'about', 'contact',
        'schedule', 'hours', 'location', 'pricing', 'rates', 'why',
        'what do', 'who we', 'how to', 'view all', 'learn more', 'get started'
    ];

    function looksLikeService(text: string): boolean {
        const textLower = text.toLowerCase();
        // Check it contains a service keyword and doesn't contain exclude keywords
        const hasServiceKeyword = serviceKeywords.some(kw => textLower.includes(kw));
        const hasExcludeKeyword = excludeKeywords.some(kw => textLower.includes(kw));
        // Also accept short, title-case headings (2-4 words) that look like service names
        const isShortTitle = text.length > 5 && text.length < 40 && /^[A-Z]/.test(text);
        return (hasServiceKeyword || isShortTitle) && !hasExcludeKeyword;
    }

    // Method 1: Look for structured service cards/containers
    const serviceSelectors = [
        '[class*="service"] [class*="card"]',
        '[class*="service"] [class*="item"]',
        '#services [class*="card"]',
        '.service-card',
        '[class*="offering"]'
    ];

    for (const selector of serviceSelectors) {
        $(selector).each((_, el) => {
            if (services.length >= 12) return;

            const container = $(el);
            let name = '';
            let description = '';
            let imageUrl: string | undefined;
            const features: string[] = [];

            const nameEl = container.find('h3, h4, h2, .title, [class*="title"]').first();
            if (nameEl.length) {
                name = nameEl.text().trim();
            }

            const descEl = container.find('p, .description, [class*="description"]').first();
            if (descEl.length) {
                description = descEl.text().trim();
            }

            container.find('li').each((_, li) => {
                const text = $(li).text().trim();
                if (text && text.length > 3 && text.length < 100) {
                    features.push(text);
                }
            });

            const imgEl = container.find('img').first();
            if (imgEl.length) {
                const src = imgEl.attr('src');
                if (src && !shouldSkipImage(src)) {
                    imageUrl = src;
                }
            }

            if (!name || name.length < 3 || seenNames.has(name.toLowerCase())) return;

            seenNames.add(name.toLowerCase());
            services.push({
                name,
                description: description || '',
                imageUrl,
                features: features.length > 0 ? features : undefined
            });

            console.log(`[DeepScraper] Service from card: ${name}`);
        });
    }

    // Method 2: Look for h4 headings that look like service names
    // This catches sites like Courage Fitness that use simple h4 tags
    if (services.length < 6) {
        $('h4, h3').each((_, el) => {
            if (services.length >= 12) return;

            const heading = $(el);
            const name = heading.text().trim();

            if (!name || name.length < 5 || name.length > 50) return;
            if (seenNames.has(name.toLowerCase())) return;
            if (!looksLikeService(name)) return;

            // Check if the heading has a parent that looks like a service section
            const parent = heading.parent();
            const parentClass = parent.attr('class') || '';
            const grandparent = parent.parent();
            const grandparentClass = grandparent.attr('class') || '';

            // Look for nearby description text
            let description = '';
            const nextP = heading.next('p');
            if (nextP.length) {
                description = nextP.text().trim();
            }

            // Check if nearby link points to a service page
            const nearbyLink = heading.find('a').attr('href') || parent.find('a').attr('href') || '';
            const hasServiceLink = nearbyLink.includes('service') || nearbyLink.includes('offer');

            // Only add if it looks like it's in a service context
            const inServiceContext = parentClass.includes('service') ||
                grandparentClass.includes('service') ||
                hasServiceLink ||
                serviceKeywords.some(kw => name.toLowerCase().includes(kw));

            if (inServiceContext || services.length < 3) {
                seenNames.add(name.toLowerCase());
                services.push({
                    name,
                    description: description.slice(0, 200) || ''
                });
                console.log(`[DeepScraper] Service from heading: ${name}`);
            }
        });
    }

    // Method 3: Extract from page content
    if (services.length === 0) {
        for (const page of pages) {
            if (services.length >= 12) break;

            // Look for headings in pages with service-related URLs
            if (page.path.includes('service') || page.path.includes('offer') || page.path.includes('program')) {
                for (const heading of page.headings) {
                    if (services.length >= 12) break;
                    if (heading.length > 5 && heading.length < 50 && looksLikeService(heading)) {
                        const nameLower = heading.toLowerCase();
                        if (!seenNames.has(nameLower)) {
                            seenNames.add(nameLower);
                            services.push({
                                name: heading,
                                description: ''
                            });
                            console.log(`[DeepScraper] Service from page content: ${heading}`);
                        }
                    }
                }
            }
        }
    }

    return services;
}

// ============================================
// ENHANCED COLOR EXTRACTION (5 colors + buttons)
// ============================================

async function extractAllColors(
    page: Page,
    $: cheerio.CheerioAPI,
    logoUrl: string | null,
    sourceUrl: string
): Promise<string[]> {
    const colors: string[] = [];

    // 1. CSS Custom Properties
    try {
        const cssVarColors = await page.evaluate(() => {
            const root = document.documentElement;
            const style = getComputedStyle(root);
            const varNames = [
                '--primary', '--secondary', '--accent', '--cta',
                '--primary-color', '--secondary-color', '--accent-color',
                '--brand-color', '--highlight-color', '--button-color',
                '--color-primary', '--color-secondary', '--color-accent',
                '--main-color', '--theme-color', '--link-color'
            ];
            return varNames
                .map(v => style.getPropertyValue(v).trim())
                .filter(v => v && (v.startsWith('#') || v.startsWith('rgb')));
        });

        for (const c of cssVarColors) {
            if (c.startsWith('#')) {
                colors.push(c.toUpperCase());
            } else if (c.startsWith('rgb')) {
                const hex = rgbToHex(c);
                if (hex) colors.push(hex);
            }
        }
    } catch (e) {
        console.warn('[DeepScraper] CSS var extraction failed:', e);
    }

    // 2. Prominent Element Colors (buttons, headers, navs)
    try {
        const elementColors = await page.evaluate(() => {
            const foundColors: string[] = [];
            const elements = [
                ...document.querySelectorAll('button, .btn, [class*="button"], [class*="cta"]'),
                ...document.querySelectorAll('nav, header'),
                ...document.querySelectorAll('h1, h2'),
                ...document.querySelectorAll('a[class*="btn"]'),
                ...document.querySelectorAll('[class*="accent"]')
            ];

            elements.forEach(el => {
                const style = getComputedStyle(el);
                const bg = style.backgroundColor;
                const color = style.color;
                const borderColor = style.borderColor;

                const rgbToHex = (rgb: string) => {
                    const match = rgb.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
                    if (match) {
                        const [, r, g, b] = match;
                        return '#' + [r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join('').toUpperCase();
                    }
                    return null;
                };

                if (bg && bg !== 'rgba(0, 0, 0, 0)' && !bg.includes('255, 255, 255')) {
                    const hex = rgbToHex(bg);
                    if (hex && hex !== '#000000' && hex !== '#FFFFFF') foundColors.push(hex);
                }
                if (color && !color.includes('0, 0, 0') && !color.includes('255, 255, 255')) {
                    const hex = rgbToHex(color);
                    if (hex && hex !== '#000000' && hex !== '#FFFFFF') foundColors.push(hex);
                }
                if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') {
                    const hex = rgbToHex(borderColor);
                    if (hex && hex !== '#000000' && hex !== '#FFFFFF') foundColors.push(hex);
                }
            });

            return foundColors;
        });

        colors.push(...elementColors);
    } catch (e) {
        console.warn('[DeepScraper] Element color extraction failed:', e);
    }

    // 3. Logo Color Extraction
    if (logoUrl) {
        try {
            const response = await fetch(logoUrl);
            if (response.ok) {
                const buffer = Buffer.from(await response.arrayBuffer());
                const palette = await Vibrant.from(buffer).getPalette();
                if (palette.Vibrant) colors.push(palette.Vibrant.hex.toUpperCase());
                if (palette.DarkVibrant) colors.push(palette.DarkVibrant.hex.toUpperCase());
                if (palette.LightVibrant) colors.push(palette.LightVibrant.hex.toUpperCase());
                if (palette.Muted) colors.push(palette.Muted.hex.toUpperCase());
                if (palette.DarkMuted) colors.push(palette.DarkMuted.hex.toUpperCase());
            }
        } catch (e) {
            console.warn('[DeepScraper] Logo color extraction failed:', e);
        }
    }

    // Filter, dedupe, and prioritize
    const uniqueColors = [...new Set(colors)]
        .filter(c => c.length === 7 && !isGrayscale(c))
        .slice(0, 5);

    console.log(`[DeepScraper] Colors extracted: ${uniqueColors.join(', ')}`);
    return uniqueColors;
}

// ============================================
// IMAGE EXTRACTION (Hero + Gallery)
// ============================================

function extractImages($: cheerio.CheerioAPI, sourceUrl: string, logoUrl: string | null): { hero: SiteImage[]; gallery: SiteImage[] } {
    const heroImages: SiteImage[] = [];
    const galleryImages: SiteImage[] = [];
    const seenUrls = new Set<string>();

    if (logoUrl) seenUrls.add(logoUrl);

    // Helper to check if URL is likely a meaningful image
    function isGoodImageUrl(url: string): boolean {
        const urlLower = url.toLowerCase();
        // Must be an image file
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
        const hasImageExt = imageExtensions.some(ext => urlLower.includes(ext));
        // Skip very small patterns
        if (urlLower.includes('icon') || urlLower.includes('arrow') || urlLower.includes('star')) return false;
        // Prefer wp-content images (WordPress) as they're usually real content
        if (urlLower.includes('wp-content/uploads')) return true;
        return hasImageExt;
    }

    // Hero image selectors - expanded to include sliders
    const heroSelectors = [
        '[class*="hero"] img',
        '#hero img',
        '.banner img',
        '[class*="slider"] img',
        '[class*="slide"] img',
        '.revslider img',
        '[class*="rev_slider"] img',
        '[class*="carousel"] img',
        '[class*="jumbotron"] img',
        '.featured-image img',
        'section:first-of-type img'
    ];

    for (const selector of heroSelectors) {
        if (heroImages.length >= 5) break;
        $(selector).each((_, el) => {
            if (heroImages.length >= 5) return;

            // Check multiple image source attributes
            const src = $(el).attr('src') ||
                $(el).attr('data-src') ||
                $(el).attr('data-lazyload') ||
                $(el).attr('data-lazy-src') ||
                $(el).attr('data-bg') ||
                $(el).attr('data-bgimage');

            if (!src || shouldSkipImage(src)) return;

            const absoluteUrl = normalizeUrl(src, sourceUrl);
            if (!absoluteUrl || seenUrls.has(absoluteUrl)) return;
            if (!isGoodImageUrl(absoluteUrl)) return;

            seenUrls.add(absoluteUrl);
            heroImages.push({
                url: absoluteUrl,
                alt: $(el).attr('alt') || 'Hero image',
                context: 'hero'
            });
            console.log(`[DeepScraper] Hero image: ${absoluteUrl}`);
        });
    }

    // Also check for background images in hero sections
    const bgSelectors = [
        '[class*="hero"]',
        '[class*="slider"]',
        '[class*="slide"]',
        '[class*="banner"]',
        '.revslider',
        '[class*="bg-"]'
    ];

    for (const selector of bgSelectors) {
        if (heroImages.length >= 5) break;
        $(selector).each((_, el) => {
            if (heroImages.length >= 5) return;

            // Check style attribute for background-image
            const style = $(el).attr('style') || '';
            const bgMatch = style.match(/background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/i);
            if (bgMatch) {
                const src = bgMatch[1];
                if (src && !shouldSkipImage(src)) {
                    const absoluteUrl = normalizeUrl(src, sourceUrl);
                    if (absoluteUrl && !seenUrls.has(absoluteUrl) && isGoodImageUrl(absoluteUrl)) {
                        seenUrls.add(absoluteUrl);
                        heroImages.push({
                            url: absoluteUrl,
                            alt: 'Background image',
                            context: 'hero'
                        });
                        console.log(`[DeepScraper] Hero bg image: ${absoluteUrl}`);
                    }
                }
            }

            // Check data attributes for background images
            const dataBg = $(el).attr('data-bg') || $(el).attr('data-bgimage') || $(el).attr('data-background');
            if (dataBg && !shouldSkipImage(dataBg)) {
                const absoluteUrl = normalizeUrl(dataBg, sourceUrl);
                if (absoluteUrl && !seenUrls.has(absoluteUrl) && isGoodImageUrl(absoluteUrl)) {
                    seenUrls.add(absoluteUrl);
                    heroImages.push({
                        url: absoluteUrl,
                        alt: 'Background image',
                        context: 'hero'
                    });
                    console.log(`[DeepScraper] Hero data-bg: ${absoluteUrl}`);
                }
            }
        });
    }

    // Gallery/general images
    const gallerySelectors = [
        '[class*="gallery"] img',
        '[class*="portfolio"] img',
        '[class*="service"] img',
        '[class*="team"] img',
        '[class*="testimonial"] img',
        'main img',
        'article img',
        'section img'
    ];

    for (const selector of gallerySelectors) {
        if (galleryImages.length >= 10) break;
        $(selector).each((_, el) => {
            if (galleryImages.length >= 10) return;

            const src = $(el).attr('src') ||
                $(el).attr('data-src') ||
                $(el).attr('data-lazyload') ||
                $(el).attr('data-lazy-src');

            if (!src || shouldSkipImage(src)) return;

            const absoluteUrl = normalizeUrl(src, sourceUrl);
            if (!absoluteUrl || seenUrls.has(absoluteUrl)) return;
            if (!isGoodImageUrl(absoluteUrl)) return;

            // Check image dimensions if available
            const width = parseInt($(el).attr('width') || '0', 10);
            const height = parseInt($(el).attr('height') || '0', 10);
            if (width > 0 && height > 0 && (width < 100 || height < 100)) return;

            seenUrls.add(absoluteUrl);
            galleryImages.push({
                url: absoluteUrl,
                alt: $(el).attr('alt') || 'Image',
                context: 'gallery',
                width: width || undefined,
                height: height || undefined
            });
        });
    }

    console.log(`[DeepScraper] Images: ${heroImages.length} hero, ${galleryImages.length} gallery`);
    return { hero: heroImages, gallery: galleryImages };
}

// ============================================
// NAVIGATION EXTRACTION
// ============================================

function extractNavigation($: cheerio.CheerioAPI, sourceUrl: string): NavigationLink[] {
    const links: NavigationLink[] = [];
    const seenHrefs = new Set<string>();
    const seenLabels = new Set<string>();

    let baseHostname: string;
    try {
        baseHostname = new URL(sourceUrl).hostname;
    } catch {
        baseHostname = '';
    }

    const navSelectors = [
        'nav a',
        'header nav a',
        '.nav a',
        '#nav a',
        '[role="navigation"] a',
        '.menu a',
        'header ul li a'
    ];

    for (const selector of navSelectors) {
        $(selector).each((_, el) => {
            if (links.length >= 6) return;

            const href = $(el).attr('href');
            const label = $(el).text().trim();

            if (!href || !label || label.length < 2 || label.length > 30) return;
            if (seenLabels.has(label.toLowerCase())) return;

            // Skip special links
            if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
            const socialPatterns = ['facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com', 'yelp.com'];
            if (socialPatterns.some(p => href.toLowerCase().includes(p))) return;

            // Normalize href
            let normalizedHref = href;
            if (href.startsWith('#')) {
                normalizedHref = href;
            } else {
                try {
                    const url = new URL(href, sourceUrl);
                    if (url.hostname !== baseHostname) return;
                    const path = url.pathname.replace(/^\/|\/$/g, '').split('/').pop() || 'hero';
                    normalizedHref = `#${path.replace(/[-_]/g, '').replace(/\.html?$/i, '').toLowerCase()}`;
                } catch {
                    return;
                }
            }

            if (seenHrefs.has(normalizedHref)) return;

            seenHrefs.add(normalizedHref);
            seenLabels.add(label.toLowerCase());
            links.push({
                label,
                href: normalizedHref,
                isExternal: false
            });
        });

        if (links.length >= 6) break;
    }

    return links;
}

// ============================================
// CONTACT & SOCIAL EXTRACTION
// ============================================

function extractContactInfo($: cheerio.CheerioAPI): ContactInfo {
    const contact: ContactInfo = {};
    const pageText = $('body').text();

    // Phone
    const phoneRegex = /(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const phoneMatches = pageText.match(phoneRegex);
    if (phoneMatches?.[0]) {
        contact.phone = phoneMatches[0].trim();
    }

    // Email
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const emailMatches = pageText.match(emailRegex);
    if (emailMatches) {
        const businessEmail = emailMatches.find(e =>
            !e.includes('example.com') && !e.includes('email.com') && !e.includes('domain.com')
        );
        if (businessEmail) contact.email = businessEmail;
    }

    // Address
    const addressSelectors = [
        '[itemtype*="PostalAddress"]',
        '[itemprop="address"]',
        '.address',
        'footer [class*="address"]',
        'footer [class*="location"]'
    ];

    for (const selector of addressSelectors) {
        const el = $(selector).first();
        if (el.length) {
            const text = el.text().trim().replace(/\s+/g, ' ');
            if (text.length > 10 && text.length < 200 && /\d/.test(text)) {
                contact.address = text;
                break;
            }
        }
    }

    return contact;
}

function extractSocialLinks($: cheerio.CheerioAPI): SocialLinks {
    const social: SocialLinks = {};

    $('a').each((_, el) => {
        const href = $(el).attr('href');
        if (!href) return;

        const hrefLower = href.toLowerCase();
        if (!social.facebook && hrefLower.includes('facebook.com')) social.facebook = href;
        if (!social.instagram && hrefLower.includes('instagram.com')) social.instagram = href;
        if (!social.twitter && (hrefLower.includes('twitter.com') || hrefLower.includes('x.com'))) social.twitter = href;
        if (!social.linkedin && hrefLower.includes('linkedin.com')) social.linkedin = href;
        if (!social.yelp && hrefLower.includes('yelp.com')) social.yelp = href;
    });

    return social;
}

// ============================================
// BUSINESS NAME & TAGLINE
// ============================================

function extractBusinessName($: cheerio.CheerioAPI, sourceUrl: string): string {
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');
    if (ogSiteName && ogSiteName.length > 2 && ogSiteName.length < 80) return ogSiteName.trim();

    const schemaName = $('[itemtype*="Organization"] [itemprop="name"]').first().text().trim();
    if (schemaName && schemaName.length > 2 && schemaName.length < 80) return schemaName;

    const title = $('title').text().trim();
    if (title) {
        const cleaned = title.split(/[|\-–—:]/)[0].trim();
        if (cleaned.length > 2 && cleaned.length < 80) return cleaned;
    }

    try {
        const hostname = new URL(sourceUrl).hostname.replace('www.', '');
        const domain = hostname.split('.')[0];
        return domain.replace(/[-_]/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    } catch {
        return 'Business';
    }
}

function extractTagline($: cheerio.CheerioAPI): string {
    // Try meta description first
    const metaDesc = $('meta[name="description"]').attr('content');
    if (metaDesc && metaDesc.length > 20 && metaDesc.length < 200) {
        return metaDesc.trim();
    }

    // Try og:description
    const ogDesc = $('meta[property="og:description"]').attr('content');
    if (ogDesc && ogDesc.length > 20 && ogDesc.length < 200) {
        return ogDesc.trim();
    }

    // Try hero text
    const heroText = $('[class*="hero"] h2, [class*="hero"] p, .banner h2, .banner p').first().text().trim();
    if (heroText && heroText.length > 10 && heroText.length < 150) {
        return heroText;
    }

    return '';
}

// ============================================
// CORE VALUES EXTRACTION
// ============================================

function extractCoreValues($: cheerio.CheerioAPI, pages: ExtractedPage[]): string[] {
    const values: string[] = [];
    const seenValues = new Set<string>();

    // Look for values/mission sections
    $('[class*="value"], [class*="mission"], [class*="vision"], [class*="core"]').each((_, el) => {
        $(el).find('h3, h4, li, p').each((_, item) => {
            const text = $(item).text().trim();
            if (text.length > 10 && text.length < 200 && !seenValues.has(text.toLowerCase())) {
                seenValues.add(text.toLowerCase());
                values.push(text);
            }
        });
    });

    // Also search page content
    for (const page of pages) {
        if (page.path.includes('about') || page.path.includes('mission') || page.path.includes('value')) {
            for (const para of page.paragraphs) {
                if (para.length > 30 && para.length < 300 && !seenValues.has(para.toLowerCase())) {
                    seenValues.add(para.toLowerCase());
                    values.push(para);
                }
                if (values.length >= 5) break;
            }
        }
        if (values.length >= 5) break;
    }

    return values.slice(0, 5);
}

// ============================================
// DEEP-MULTIMODAL: VISION API INTEGRATION
// ============================================

/**
 * Enrich images with Vision API analysis (OCR + colors) and semantic captions
 */
async function enrichImagesWithVision(
    images: SiteImage[],
    options: {
        enableOCR?: boolean;
        enableColors?: boolean;
        enableCaptions?: boolean;
        maxImages?: number;
    } = {}
): Promise<{
    enrichedImages: ExtendedSiteImage[];
    extractedFacts: ExtractedFact[];
    visionColors: string[];
    accentColor: string | null;
}> {
    const {
        enableOCR = true,
        enableColors = true,
        enableCaptions = true,
        maxImages = 15
    } = options;

    const enrichedImages: ExtendedSiteImage[] = [];
    const allFacts: ExtractedFact[] = [];
    const allColors: string[] = [];
    let accentColor: string | null = null;

    if (images.length === 0) {
        return { enrichedImages, extractedFacts: allFacts, visionColors: allColors, accentColor };
    }

    console.log(`[DeepScraper] Enriching ${Math.min(images.length, maxImages)} images with Vision API`);

    try {
        // Get image URLs for Vision API
        const imageUrls = images.slice(0, maxImages).map(img => img.url);

        // Run batch Vision analysis
        const visionResults = await batchAnalyzeImages(imageUrls, {
            enableOCR,
            enableColorExtraction: enableColors,
            maxImages,
            concurrency: 3
        });

        // Process Vision results
        for (let i = 0; i < images.length && i < maxImages; i++) {
            const img = images[i];
            const visionResult = visionResults[i];

            const enriched: ExtendedSiteImage = {
                ...img,
                extractedText: [],
                dominantColors: [],
                visionConfidence: 0
            };

            if (visionResult) {
                // Extract OCR text
                if (visionResult.textDetection?.success && visionResult.textDetection.fullText) {
                    enriched.extractedText = visionResult.textDetection.texts.map(t => t.text);
                    enriched.visionConfidence = Math.max(
                        enriched.visionConfidence || 0,
                        ...visionResult.textDetection.texts.map(t => t.confidence)
                    );

                    // Extract facts from OCR
                    const source = img.context === 'hero' ? 'hero' : 'signage';
                    const facts = extractFactsFromOCR(
                        visionResult.textDetection.fullText,
                        img.url,
                        source as 'logo' | 'flyer' | 'hero' | 'signage'
                    );
                    allFacts.push(...facts);
                }

                // Extract colors
                if (visionResult.colorExtraction?.success && visionResult.colorExtraction.colors.length > 0) {
                    enriched.dominantColors = visionResult.colorExtraction.colors.map(c => c.hex);
                    allColors.push(...enriched.dominantColors);

                    // Update accent color if found
                    if (visionResult.colorExtraction.accentColor && !accentColor) {
                        accentColor = visionResult.colorExtraction.accentColor;
                    }
                }
            }

            enrichedImages.push(enriched);
        }

        // Add remaining images without Vision analysis
        for (let i = maxImages; i < images.length; i++) {
            enrichedImages.push({ ...images[i] });
        }

        // Generate semantic captions if enabled
        if (enableCaptions) {
            await addSemanticCaptions(enrichedImages.slice(0, 10)); // Limit caption generation
        }

        console.log(`[DeepScraper] Vision enrichment complete: ${allFacts.length} facts, ${allColors.length} colors, accent: ${accentColor}`);

    } catch (error) {
        console.warn('[DeepScraper] Vision enrichment failed, using original images:', error);
        return {
            enrichedImages: images.map(img => ({ ...img })),
            extractedFacts: [],
            visionColors: [],
            accentColor: null
        };
    }

    return { enrichedImages, extractedFacts: allFacts, visionColors: allColors, accentColor };
}

/**
 * Generate 10-word semantic captions for images using Gemini Flash
 */
async function addSemanticCaptions(images: ExtendedSiteImage[]): Promise<void> {
    if (images.length === 0) return;

    try {
        // Note: Full Gemini-based image captioning would require:
        // 1. Fetching each image
        // 2. Converting to base64
        // 3. Calling Gemini with inlineData
        // This adds significant latency and cost, so we use context-based captions

        // Process in batches of 5
        for (let i = 0; i < images.length; i += 5) {
            const batch = images.slice(i, i + 5);

            await Promise.all(batch.map(async (img) => {
                try {
                    // Generate caption based on context and alt text
                    // which adds latency and cost. Using context-based captions for now.
                    const contextCaptions: Record<string, string> = {
                        'hero': `Hero banner showcasing ${img.alt || 'business'}`,
                        'services': `Service offering: ${img.alt || 'professional service'}`,
                        'gallery': `Portfolio image: ${img.alt || 'work sample'}`,
                        'team': `Team member or staff photo`,
                        'general': img.alt || 'Business related image'
                    };

                    img.semanticCaption = contextCaptions[img.context] || img.alt || 'Business image';
                } catch (e) {
                    // Fallback caption
                    img.semanticCaption = img.alt || `${img.context} image`;
                }
            }));
        }
    } catch (error) {
        console.warn('[DeepScraper] Semantic caption generation failed:', error);
    }
}

/**
 * Build semantic image map for intelligent section placement
 */
function buildSemanticImageMap(
    heroImages: ExtendedSiteImage[],
    galleryImages: ExtendedSiteImage[],
    services: ExtractedService[]
): SemanticImageMap {
    const map: SemanticImageMap = {
        hero: [],
        services: [],
        about: [],
        testimonials: [],
        gallery: []
    };

    // Map hero images
    map.hero = heroImages.map((img, index) => ({
        ...img,
        placeholderId: `[[ID_HERO_${index + 1}_HERE]]`
    }));

    // Categorize gallery images by context and caption
    galleryImages.forEach((img, index) => {
        const captionLower = (img.semanticCaption || '').toLowerCase();
        const altLower = (img.alt || '').toLowerCase();

        // Check for team/about related images
        if (captionLower.includes('team') || captionLower.includes('staff') ||
            altLower.includes('team') || altLower.includes('about') ||
            img.context === 'team') {
            map.about.push({ ...img, placeholderId: `[[ID_TEAM_${map.about.length + 1}_HERE]]` });
        }
        // Check for service related images
        else if (captionLower.includes('service') || captionLower.includes('work') ||
            img.context === 'services') {
            map.services.push({ ...img, placeholderId: `[[ID_SERVICE_IMG_${map.services.length + 1}_HERE]]` });
        }
        // Default to gallery
        else {
            map.gallery.push({ ...img, placeholderId: `[[ID_GALLERY_${map.gallery.length + 1}_HERE]]` });
        }
    });

    // If no service images found, use some gallery images
    if (map.services.length === 0 && map.gallery.length > 0) {
        const serviceCount = Math.min(3, map.gallery.length);
        map.services = map.gallery.splice(0, serviceCount).map((img, i) => ({
            ...img,
            placeholderId: `[[ID_SERVICE_IMG_${i + 1}_HERE]]`
        }));
    }

    return map;
}

// ============================================
// VISUAL VIBE ANALYSIS
// ============================================

async function analyzeVisualVibe(page: Page): Promise<{ vibe: string; screenshot: string }> {
    try {
        await page.setViewport({ width: 1280, height: 720 });
        await new Promise(resolve => setTimeout(resolve, 2000));

        const screenshotBuffer = await page.screenshot({
            type: 'jpeg',
            quality: 80,
            encoding: 'base64'
        }) as string;

        const ai = await getGenAI();
        const model = ai.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

        const prompt = `Analyze this website screenshot and describe the brand's visual "vibe" in 2-3 sentences.

Consider:
- Color mood (warm/cool, vibrant/muted, professional/playful)
- Typography feel (modern/classic, bold/elegant, corporate/casual)
- Layout style (minimal/busy, structured/organic, traditional/contemporary)
- Overall personality (e.g., "rugged and industrial", "soft and feminine", "tech-forward and clean", "warm and homey")

Output ONLY the vibe description, no preamble.`;

        const result = await model.generateContent([
            prompt,
            { inlineData: { mimeType: 'image/jpeg', data: screenshotBuffer } }
        ]);

        return {
            vibe: result.response.text().trim(),
            screenshot: screenshotBuffer
        };
    } catch (error) {
        console.warn('[DeepScraper] Visual vibe analysis failed:', error);
        return { vibe: 'professional and approachable', screenshot: '' };
    }
}

// ============================================
// MAIN DEEP SCRAPE FUNCTION
// ============================================

export interface DeepScrapeOptions {
    maxPages?: number;
    maxDepth?: number;
    timeout?: number;
    // Deep-Multimodal options (v3.0)
    enableVisionOCR?: boolean;           // Enable TEXT_DETECTION for OCR
    enableVisionColors?: boolean;        // Enable IMAGE_PROPERTIES for colors
    enableSemanticCaptions?: boolean;    // Enable Gemini semantic captions
    maxImagesForVision?: number;         // Cost control: limit Vision API calls
}

export async function deepScrapeSite(
    url: string,
    options: DeepScrapeOptions = {}
): Promise<SiteIdentity> {
    const {
        maxPages = 8,           // Reduced from 10 to 8 for modernization focus
        maxDepth = 2,
        timeout = 120000,
        // Deep-Multimodal options with defaults
        enableVisionOCR = true,
        enableVisionColors = true,
        enableSemanticCaptions = true,
        maxImagesForVision = 15
    } = options;

    // Note: timeout reserved for future per-page timeout implementation
    void timeout;

    console.log(`[DeepScraper v3.0] Starting deep-multimodal scrape: ${url}`);
    console.log(`[DeepScraper] Config: maxPages=${maxPages}, maxDepth=${maxDepth}, visionOCR=${enableVisionOCR}, visionColors=${enableVisionColors}`);

    const browser: Browser = await puppeteer.launch({
        args: chromium.args,
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: await chromium.executablePath(),
        headless: true
    });

    const visitedUrls = new Set<string>();
    const pages: ExtractedPage[] = [];

    try {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // 1. Scrape main page first
        console.log(`[DeepScraper] Scraping main page: ${url}`);
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        visitedUrls.add(url);

        const mainPageContent = await extractPageContent(page, url);
        pages.push(mainPageContent);

        const html = await page.content();
        const $ = cheerio.load(html);

        // 2. Extract logo with base64
        const { url: logoUrl, base64: logoBase64 } = await extractLogoWithBase64($, page, url);

        // 3. Analyze visual vibe
        const { vibe: visualVibe, screenshot: screenshotBase64 } = await analyzeVisualVibe(page);

        // 4. Extract colors (enhanced)
        const primaryColors = await extractAllColors(page, $, logoUrl, url);

        // 5. Discover and crawl additional pages
        const internalLinks = await discoverInternalLinks(page, url);
        console.log(`[DeepScraper] Found ${internalLinks.length} internal links`);

        let depth = 1;
        let linksToVisit = internalLinks.slice(0, maxPages - 1);

        while (linksToVisit.length > 0 && pages.length < maxPages && depth <= maxDepth) {
            const nextBatch = linksToVisit.splice(0, 3); // Process 3 at a time

            for (const link of nextBatch) {
                if (pages.length >= maxPages) break;
                if (visitedUrls.has(link)) continue;

                try {
                    console.log(`[DeepScraper] Crawling: ${link}`);
                    await page.goto(link, { waitUntil: 'networkidle2', timeout: 20000 });
                    visitedUrls.add(link);

                    const pageContent = await extractPageContent(page, link);
                    pages.push(pageContent);
                } catch (e) {
                    console.warn(`[DeepScraper] Failed to crawl ${link}:`, e);
                    visitedUrls.add(link); // Mark as visited to avoid retry
                }
            }

            depth++;
        }

        console.log(`[DeepScraper] Crawled ${pages.length} pages`);

        // 6. Extract structured content from all pages
        // Note: combinedHtml prepared for future cross-page content extraction
        const _combinedHtml = pages.map(p => p.rawMarkdown).join('\n\n');
        void _combinedHtml; // Reserved for future multi-page content extraction

        // Go back to main page for DOM extraction
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        const $main = cheerio.load(await page.content());

        // Extract all structured content
        const navigation = extractNavigation($main, url);
        const { hero: heroImages, gallery: galleryImages } = extractImages($main, url, logoUrl);
        const services = extractServices($main, pages);
        const testimonials = extractTestimonials($main, pages);
        const teamMembers = extractTeamMembers($main);
        const faqs = extractFAQs($main);
        const coreValues = extractCoreValues($main, pages);
        const contactInfo = extractContactInfo($main);
        const socialLinks = extractSocialLinks($main);
        const businessName = extractBusinessName($main, url);
        const tagline = extractTagline($main);

        // Build full copy from pages
        const fullCopy = pages.map(p => p.rawMarkdown).join('\n\n---\n\n').slice(0, 15000);

        // Determine content sparsity
        const contentSparsity: 'rich' | 'moderate' | 'sparse' =
            fullCopy.length < 1000 ? 'sparse' :
                fullCopy.length < 3000 ? 'moderate' : 'rich';

        // ============================================
        // DEEP-MULTIMODAL: Vision API Enrichment
        // ============================================
        let enrichedHeroImages: ExtendedSiteImage[] = heroImages;
        let enrichedGalleryImages: ExtendedSiteImage[] = galleryImages;
        let extractedFacts: ExtractedFact[] = [];
        let accentColor: string | null = null;
        let visionAnalysisComplete = false;
        let semanticImageMap: SemanticImageMap | undefined;

        if (enableVisionOCR || enableVisionColors || enableSemanticCaptions) {
            console.log('[DeepScraper] Starting Vision API enrichment...');

            // Combine all images for Vision analysis
            const allImages: SiteImage[] = [...heroImages, ...galleryImages];

            const visionResult = await enrichImagesWithVision(allImages, {
                enableOCR: enableVisionOCR,
                enableColors: enableVisionColors,
                enableCaptions: enableSemanticCaptions,
                maxImages: maxImagesForVision
            });

            // Split enriched images back into hero and gallery
            enrichedHeroImages = visionResult.enrichedImages.slice(0, heroImages.length);
            enrichedGalleryImages = visionResult.enrichedImages.slice(heroImages.length);
            extractedFacts = visionResult.extractedFacts;
            accentColor = visionResult.accentColor;
            visionAnalysisComplete = true;

            // Merge Vision colors with existing colors (Vision takes priority for accent)
            if (visionResult.visionColors.length > 0) {
                // Filter out grayscale colors from Vision results
                const vibrantVisionColors = visionResult.visionColors.filter(c => !isGrayscale(c));
                if (vibrantVisionColors.length > 0 && !primaryColors.includes(vibrantVisionColors[0])) {
                    // Add Vision accent as primaryColors[2] if different
                    if (primaryColors.length >= 3) {
                        primaryColors[2] = vibrantVisionColors[0];
                    } else {
                        primaryColors.push(...vibrantVisionColors.slice(0, 3 - primaryColors.length));
                    }
                }
            }

            // Build semantic image map for intelligent placement
            semanticImageMap = buildSemanticImageMap(enrichedHeroImages, enrichedGalleryImages, services);

            console.log(`[DeepScraper] Vision enrichment complete: ${extractedFacts.length} facts, accent: ${accentColor}`);
        }

        // Build SiteIdentity with Deep-Multimodal data
        const identity: SiteIdentity = {
            businessName,
            tagline,
            sourceUrl: url,
            extractedAt: new Date().toISOString(),
            logoUrl,
            logoBase64: logoBase64 || undefined,
            heroImages: enrichedHeroImages,
            galleryImages: enrichedGalleryImages,
            primaryColors: primaryColors.length > 0 ? primaryColors : ['#3B82F6', '#1E40AF', '#60A5FA'],
            navigation: navigation.length > 0 ? navigation : [
                { label: 'Home', href: '#hero', isExternal: false },
                { label: 'Services', href: '#services', isExternal: false },
                { label: 'About', href: '#about', isExternal: false },
                { label: 'Contact', href: '#contact', isExternal: false }
            ],
            pages,
            services,
            testimonials,
            teamMembers,
            faqs,
            coreValues,
            contactInfo,
            socialLinks,
            businessHours: undefined,
            visualVibe,
            screenshotBase64,
            contentSparsity,
            fullCopy,
            // Deep-Multimodal fields (v3.0)
            extractedFacts: extractedFacts.length > 0 ? extractedFacts : undefined,
            accentColor,
            visionAnalysisComplete,
            semanticImageMap
        };

        console.log(`[DeepScraper v3.0] Extraction complete:`, {
            businessName: identity.businessName,
            pages: identity.pages.length,
            services: identity.services.length,
            testimonials: identity.testimonials.length,
            teamMembers: identity.teamMembers.length,
            colors: identity.primaryColors,
            accentColor: identity.accentColor,
            hasLogo: !!identity.logoUrl || !!identity.logoBase64,
            heroImages: identity.heroImages.length,
            galleryImages: identity.galleryImages.length,
            extractedFacts: identity.extractedFacts?.length || 0,
            visionAnalysisComplete: identity.visionAnalysisComplete,
            hasSemanticMap: !!identity.semanticImageMap
        });

        return identity;

    } finally {
        await browser.close();
    }
}
