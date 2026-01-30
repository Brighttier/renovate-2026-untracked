"use strict";
/**
 * Exhaustive Scraper v4.0 - Total Content Modernization
 *
 * Recursive crawler that extracts the COMPLETE digital presence of a business:
 * - Crawls up to 12 internal pages
 * - Classifies content by semantic intent
 * - Extracts hidden gems via Vision API OCR
 * - Builds UniversalBusinessDNA object
 */
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
exports.exhaustiveScrapeSite = exhaustiveScrapeSite;
exports.quickScrapeSite = quickScrapeSite;
const puppeteer = __importStar(require("puppeteer-core"));
const chromium_1 = __importDefault(require("@sparticuz/chromium"));
const types_1 = require("../../../types");
const deepVision_1 = require("../vision/deepVision");
// ============================================
// CONFIGURATION
// ============================================
const EXHAUSTIVE_CONFIG = {
    maxPages: 12,
    crawlTimeout: 180000, // 3 minutes
    pageTimeout: 30000, // 30 seconds per page
    maxImagesPerPage: 20,
    maxTotalImages: 50,
    priorityPaths: [
        '/', '/about', '/about-us', '/our-story',
        '/services', '/what-we-do', '/offerings',
        '/team', '/staff', '/our-team', '/meet-the-team',
        '/contact', '/contact-us', '/get-in-touch',
        '/testimonials', '/reviews', '/success-stories',
        '/faq', '/faqs', '/questions',
        '/pricing', '/rates', '/packages',
        '/gallery', '/portfolio', '/our-work', '/projects',
        '/blog', '/news', '/articles',
        '/privacy', '/privacy-policy', '/terms', '/terms-of-service',
    ],
};
// ============================================
// SEMANTIC INTENT CLASSIFICATION
// ============================================
/**
 * Classify page content by semantic intent
 */
function classifySemanticIntent(path, title, content) {
    const pathLower = path.toLowerCase();
    const titleLower = title.toLowerCase();
    const contentLower = content.toLowerCase().slice(0, 2000); // First 2000 chars
    // Pattern matching for intent classification
    const patterns = {
        vision_mission: {
            pathPatterns: [/about|story|mission|vision|philosophy|values/],
            contentPatterns: [/our mission|our vision|we believe|our purpose|founded|established|journey/gi],
            weight: 1.0,
        },
        value_proposition: {
            pathPatterns: [/why-us|difference|unique|about/],
            contentPatterns: [/what makes us|why choose|our difference|unlike|stand out|unique approach/gi],
            weight: 0.9,
        },
        service_offering: {
            pathPatterns: [/service|offering|what-we-do|solution|product/],
            contentPatterns: [/we offer|our services|we provide|packages|pricing|starting at/gi],
            weight: 1.0,
        },
        team_culture: {
            pathPatterns: [/team|staff|people|careers|join|culture/],
            contentPatterns: [/meet our|our team|staff|trainer|coach|therapist|doctor|ceo|founder/gi],
            weight: 1.0,
        },
        social_proof: {
            pathPatterns: [/testimonial|review|success|case-stud|client/],
            contentPatterns: [/testimonial|review|said|stars|rated|recommend|loved|amazing experience/gi],
            weight: 1.0,
        },
        operational: {
            pathPatterns: [/contact|location|hour|schedule|book|appointment/],
            contentPatterns: [/hours|open|closed|monday|tuesday|call us|email|address|located/gi],
            weight: 0.9,
        },
        educational: {
            pathPatterns: [/blog|news|article|guide|tip|how-to|resource/],
            contentPatterns: [/learn|discover|guide|tips|how to|step by step|tutorial/gi],
            weight: 0.8,
        },
        legal: {
            pathPatterns: [/privacy|terms|policy|legal|disclaimer|refund/],
            contentPatterns: [/privacy policy|terms of service|legal|disclaimer|refund|gdpr|cookie/gi],
            weight: 1.0,
        },
        promotional: {
            pathPatterns: [/offer|deal|sale|promo|special/],
            contentPatterns: [/limited time|special offer|discount|save|free|bonus|exclusive/gi],
            weight: 0.8,
        },
        unknown: {
            pathPatterns: [],
            contentPatterns: [],
            weight: 0.0,
        },
    };
    let bestIntent = 'unknown';
    let bestScore = 0;
    for (const [intent, config] of Object.entries(patterns)) {
        if (intent === 'unknown')
            continue;
        let score = 0;
        // Path matching (high weight)
        for (const pattern of config.pathPatterns) {
            if (pattern.test(pathLower)) {
                score += 0.5 * config.weight;
                break;
            }
        }
        // Title matching
        for (const pattern of config.contentPatterns) {
            if (pattern.test(titleLower)) {
                score += 0.2 * config.weight;
                break;
            }
        }
        // Content matching (count occurrences)
        for (const pattern of config.contentPatterns) {
            const matches = contentLower.match(pattern);
            if (matches) {
                score += Math.min(matches.length * 0.1, 0.3) * config.weight;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            bestIntent = intent;
        }
    }
    return {
        intent: bestIntent,
        confidence: Math.min(bestScore, 1.0),
    };
}
/**
 * Determine emotional tone from content
 */
function analyzeEmotionalTone(content) {
    const contentLower = content.toLowerCase();
    const tonePatterns = {
        luxury: /premium|exclusive|bespoke|curated|artisan|handcraft|sophisticated|elegant/gi,
        authoritative: /expert|certified|licensed|award|recognized|leading|trusted|proven/gi,
        friendly: /welcome|family|community|together|love|passion|care|heart|smile/gi,
        casual: /hey|awesome|cool|great|fun|easy|simple|quick/gi,
        professional: /professional|quality|service|solution|efficient|reliable/gi,
    };
    const scores = {};
    for (const [tone, pattern] of Object.entries(tonePatterns)) {
        const matches = contentLower.match(pattern);
        scores[tone] = matches ? matches.length : 0;
    }
    const maxTone = Object.entries(scores).reduce((a, b) => (a[1] > b[1] ? a : b));
    return maxTone[0];
}
/**
 * Extract key phrases from content
 */
function extractKeyPhrases(content) {
    const phrases = [];
    // Extract quoted text
    const quotedMatches = content.match(/"([^"]{10,100})"/g);
    if (quotedMatches) {
        phrases.push(...quotedMatches.map(q => q.replace(/"/g, '')));
    }
    // Extract phrases with specific patterns
    const patterns = [
        /(?:we (?:are|offer|provide|believe|specialize))[^.!?]{10,80}/gi,
        /(?:our (?:mission|vision|goal|team|approach))[^.!?]{10,80}/gi,
        /(?:(?:years|decades) of experience)[^.!?]{0,50}/gi,
        /(?:award[- ]winning|certified|licensed)[^.!?]{0,50}/gi,
    ];
    for (const pattern of patterns) {
        const matches = content.match(pattern);
        if (matches) {
            phrases.push(...matches.map(m => m.trim()));
        }
    }
    // Deduplicate and limit
    return [...new Set(phrases)].slice(0, 10);
}
// ============================================
// HIDDEN GEM EXTRACTION
// ============================================
/**
 * Extract hidden gems from OCR text
 */
function extractHiddenGems(ocrText, imageUrl) {
    const gems = [];
    // Founding dates
    const foundingPatterns = [
        /(?:est\.?|established|since|founded)\s*(?:in\s*)?(\d{4})/gi,
        /(\d{4})\s*-\s*(?:present|today|now)/gi,
    ];
    for (const pattern of foundingPatterns) {
        const matches = ocrText.matchAll(pattern);
        for (const match of matches) {
            gems.push({
                type: 'founding_date',
                text: match[0],
                source: imageUrl,
                confidence: 0.9,
                displaySuggestion: 'Badge or Hero subtitle',
            });
        }
    }
    // Awards
    const awardPatterns = [
        /(?:winner|awarded|voted|#1|number one|best of|top \d+)[^.!?\n]{5,60}/gi,
        /(?:award|recognition|honor|accolade)[^.!?\n]{5,60}/gi,
    ];
    for (const pattern of awardPatterns) {
        const matches = ocrText.match(pattern);
        if (matches) {
            matches.forEach(m => {
                gems.push({
                    type: 'award',
                    text: m.trim(),
                    source: imageUrl,
                    confidence: 0.85,
                    displaySuggestion: 'Trust badge or About section',
                });
            });
        }
    }
    // Certifications
    const certPatterns = [
        /(?:certified|licensed|accredited|registered)[^.!?\n]{5,60}/gi,
        /(?:ISO|OSHA|FDA|BBB|HIPAA)[^.!?\n]{0,40}/gi,
    ];
    for (const pattern of certPatterns) {
        const matches = ocrText.match(pattern);
        if (matches) {
            matches.forEach(m => {
                gems.push({
                    type: 'certification',
                    text: m.trim(),
                    source: imageUrl,
                    confidence: 0.9,
                    displaySuggestion: 'Footer or Trust section',
                });
            });
        }
    }
    // Statistics
    const statPatterns = [
        /(\d+(?:,\d{3})*\+?)\s*(?:clients|customers|members|projects|years|locations)/gi,
        /(?:over|more than)\s*(\d+(?:,\d{3})*)\s*(?:satisfied|happy|served)/gi,
    ];
    for (const pattern of statPatterns) {
        const matches = ocrText.match(pattern);
        if (matches) {
            matches.forEach(m => {
                gems.push({
                    type: 'statistic',
                    text: m.trim(),
                    source: imageUrl,
                    confidence: 0.8,
                    displaySuggestion: 'Stats counter section',
                });
            });
        }
    }
    // Location details
    const locationPatterns = [
        /(?:located in|serving|proudly serving)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
        /(?:Durham|Raleigh|Charlotte|Atlanta|NYC|LA|Chicago|Austin)[^.!?\n]{0,30}/gi,
    ];
    for (const pattern of locationPatterns) {
        const matches = ocrText.match(pattern);
        if (matches) {
            matches.forEach(m => {
                gems.push({
                    type: 'location_detail',
                    text: m.trim(),
                    source: imageUrl,
                    confidence: 0.75,
                    displaySuggestion: 'Hero subtitle or Contact section',
                });
            });
        }
    }
    // Slogans (quoted or all-caps phrases)
    const sloganPatterns = [
        /"([^"]{5,50})"/g,
        /([A-Z][A-Z\s]{10,40}[A-Z])/g, // ALL CAPS phrases
    ];
    for (const pattern of sloganPatterns) {
        const matches = ocrText.matchAll(pattern);
        for (const match of matches) {
            const text = match[1] || match[0];
            if (text.length > 5 && text.length < 60) {
                gems.push({
                    type: 'slogan',
                    text: text.trim(),
                    source: imageUrl,
                    confidence: 0.7,
                    displaySuggestion: 'Hero tagline',
                });
            }
        }
    }
    // Deduplicate by text
    const uniqueGems = gems.filter((gem, index, self) => index === self.findIndex(g => g.text.toLowerCase() === gem.text.toLowerCase()));
    return uniqueGems.slice(0, 15); // Limit to 15 gems
}
// ============================================
// PAGE EXTRACTION
// ============================================
/**
 * Extract all content from a single page
 */
async function extractPageContent(page, url) {
    const pageData = await page.evaluate(() => {
        var _a, _b;
        // Get title
        const title = document.title || ((_a = document.querySelector('h1')) === null || _a === void 0 ? void 0 : _a.textContent) || '';
        // Get path
        const path = window.location.pathname;
        // Get all headings
        const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
            .map(h => { var _a; return (_a = h.textContent) === null || _a === void 0 ? void 0 : _a.trim(); })
            .filter(Boolean);
        // Get all paragraphs
        const paragraphs = Array.from(document.querySelectorAll('p'))
            .map(p => { var _a; return (_a = p.textContent) === null || _a === void 0 ? void 0 : _a.trim(); })
            .filter(p => p && p.length > 20);
        // Get list items
        const listItems = Array.from(document.querySelectorAll('li'))
            .map(li => { var _a; return (_a = li.textContent) === null || _a === void 0 ? void 0 : _a.trim(); })
            .filter(Boolean);
        // Get all text content for analysis
        const bodyText = ((_b = document.body) === null || _b === void 0 ? void 0 : _b.innerText) || '';
        // Get all images
        const images = Array.from(document.querySelectorAll('img'))
            .map(img => img.src)
            .filter(src => src && src.startsWith('http') && !src.includes('data:'));
        // Get all internal links
        const baseUrl = window.location.origin;
        const links = Array.from(document.querySelectorAll('a[href]'))
            .map(a => a.href)
            .filter(href => href.startsWith(baseUrl) || href.startsWith('/'))
            .map(href => href.startsWith('/') ? `${baseUrl}${href}` : href);
        return {
            title,
            path,
            headings,
            paragraphs,
            listItems,
            bodyText,
            images: [...new Set(images)],
            links: [...new Set(links)],
        };
    });
    // Build raw markdown
    const rawMarkdown = [
        `# ${pageData.title}`,
        '',
        pageData.headings.map(h => `## ${h}`).join('\n\n'),
        '',
        pageData.paragraphs.join('\n\n'),
        '',
        pageData.listItems.map(li => `- ${li}`).join('\n'),
    ].join('\n');
    // Classify semantic intent
    const { intent, confidence } = classifySemanticIntent(pageData.path, pageData.title, pageData.bodyText);
    // Analyze emotional tone
    const emotionalTone = analyzeEmotionalTone(pageData.bodyText);
    // Extract key phrases
    const keyPhrases = extractKeyPhrases(pageData.bodyText);
    // Determine content priority
    const contentPriority = intent === 'vision_mission' || intent === 'service_offering' || intent === 'social_proof'
        ? 'critical'
        : intent === 'team_culture' || intent === 'operational' || intent === 'value_proposition'
            ? 'important'
            : 'supplementary';
    const semanticPage = {
        url,
        title: pageData.title,
        path: pageData.path,
        headings: pageData.headings,
        paragraphs: pageData.paragraphs,
        listItems: pageData.listItems,
        rawMarkdown,
        semanticIntent: intent,
        intentConfidence: confidence,
        keyPhrases,
        emotionalTone,
        contentPriority,
    };
    return {
        semanticPage,
        images: pageData.images,
        links: pageData.links,
    };
}
// ============================================
// CONTENT EXTRACTION HELPERS
// ============================================
/**
 * Extract services from semantic pages
 */
function extractServices(pages) {
    const services = [];
    const servicePages = pages.filter(p => p.semanticIntent === 'service_offering' || p.path.includes('service'));
    for (const page of servicePages) {
        // Extract from headings
        for (const heading of page.headings.slice(1)) { // Skip first h1
            if (heading.length > 5 && heading.length < 100) {
                services.push({
                    name: heading,
                    description: page.paragraphs.find(p => p.includes(heading.split(' ')[0])) || '',
                    features: [],
                });
            }
        }
        // Extract from list items that look like services
        for (const item of page.listItems) {
            if (item.length > 10 && item.length < 150) {
                const existingService = services.find(s => s.name.toLowerCase().includes(item.toLowerCase().slice(0, 20)) ||
                    item.toLowerCase().includes(s.name.toLowerCase().slice(0, 20)));
                if (!existingService) {
                    services.push({
                        name: item.split(':')[0].trim(),
                        description: item.includes(':') ? item.split(':').slice(1).join(':').trim() : '',
                        features: [],
                    });
                }
            }
        }
    }
    // Deduplicate by name similarity
    return services.filter((service, index, self) => index === self.findIndex(s => s.name.toLowerCase() === service.name.toLowerCase())).slice(0, 20);
}
/**
 * Extract testimonials from semantic pages
 */
function extractTestimonials(pages) {
    const testimonials = [];
    const proofPages = pages.filter(p => p.semanticIntent === 'social_proof' ||
        p.path.includes('testimonial') ||
        p.path.includes('review'));
    for (const page of proofPages) {
        // Look for quoted text
        for (const paragraph of page.paragraphs) {
            const quoteMatch = paragraph.match(/"([^"]{20,500})"/);
            if (quoteMatch) {
                testimonials.push({
                    quote: quoteMatch[1],
                    authorName: 'Verified Customer',
                    source: 'Website',
                });
            }
            // Look for patterns like "- Name" or "– Name"
            const authorMatch = paragraph.match(/(?:—|–|-)\s*([A-Z][a-z]+ [A-Z][a-z]+)/);
            if (authorMatch && testimonials.length > 0) {
                testimonials[testimonials.length - 1].authorName = authorMatch[1];
            }
        }
    }
    return testimonials.slice(0, 10);
}
/**
 * Extract team members from semantic pages
 */
function extractTeamMembers(pages) {
    var _a;
    const members = [];
    const teamPages = pages.filter(p => p.semanticIntent === 'team_culture' ||
        p.path.includes('team') ||
        p.path.includes('staff'));
    for (const page of teamPages) {
        // Look for name + role patterns in headings
        for (let i = 0; i < page.headings.length; i++) {
            const heading = page.headings[i];
            const nameMatch = heading.match(/^([A-Z][a-z]+ [A-Z][a-z]+)(?:\s*[-–]\s*(.+))?$/);
            if (nameMatch) {
                members.push({
                    name: nameMatch[1],
                    role: nameMatch[2] || 'Team Member',
                    bio: page.paragraphs[i] || undefined,
                });
            }
        }
        // Look for title patterns in paragraphs
        const titlePatterns = /(?:CEO|Founder|Owner|Director|Manager|Coach|Trainer|Therapist|Doctor|Dr\.)/gi;
        for (const paragraph of page.paragraphs) {
            if (titlePatterns.test(paragraph)) {
                const nameMatch = paragraph.match(/([A-Z][a-z]+ [A-Z][a-z]+)/);
                if (nameMatch && !members.some(m => m.name === nameMatch[1])) {
                    members.push({
                        name: nameMatch[1],
                        role: ((_a = paragraph.match(titlePatterns)) === null || _a === void 0 ? void 0 : _a[0]) || 'Team Member',
                        bio: paragraph,
                    });
                }
            }
        }
    }
    return members.slice(0, 15);
}
/**
 * Extract FAQs from semantic pages
 */
function extractFAQs(pages) {
    const faqs = [];
    const faqPages = pages.filter(p => p.path.includes('faq') || p.rawMarkdown.toLowerCase().includes('frequently asked'));
    for (const page of faqPages) {
        // Look for Q&A patterns
        for (let i = 0; i < page.headings.length; i++) {
            const heading = page.headings[i];
            if (heading.includes('?') || heading.toLowerCase().startsWith('what') ||
                heading.toLowerCase().startsWith('how') || heading.toLowerCase().startsWith('why')) {
                faqs.push({
                    question: heading,
                    answer: page.paragraphs[i] || page.paragraphs[0] || '',
                });
            }
        }
    }
    return faqs.slice(0, 15);
}
/**
 * Extract consolidated header from pages
 */
function extractConsolidatedHeader(pages, logoUrl, businessName) {
    const homePage = pages.find(p => p.path === '/' || p.path === '') || pages[0];
    // Extract tagline from home page
    const tagline = (homePage === null || homePage === void 0 ? void 0 : homePage.headings[1]) ||
        (homePage === null || homePage === void 0 ? void 0 : homePage.paragraphs.find(p => p.length < 100 && p.length > 20)) ||
        null;
    // Extract primary navigation
    const navLinks = pages
        .filter(p => p.contentPriority !== 'supplementary')
        .map(p => ({
        label: p.title.split('|')[0].trim() || p.path.replace(/[/-]/g, ' ').trim(),
        href: p.path,
    }))
        .slice(0, 6);
    return {
        logoUrl,
        businessName,
        tagline,
        primaryNavigation: navLinks,
        ctaButton: {
            label: 'Contact Us',
            href: '#contact',
            style: 'primary',
        },
    };
}
/**
 * Extract consolidated footer from all pages
 */
function extractConsolidatedFooter(pages, businessName) {
    // Find contact page for potential future use
    const _contactPage = pages.find(p => p.semanticIntent === 'operational' || p.path.includes('contact'));
    void _contactPage; // Suppress unused variable warning
    const legalPages = pages.filter(p => p.semanticIntent === 'legal');
    // Extract contact info
    const allText = pages.map(p => p.rawMarkdown).join('\n');
    const phoneMatch = allText.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
    const emailMatch = allText.match(/[\w.-]+@[\w.-]+\.\w+/);
    const addressMatch = allText.match(/\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)[^,\n]*,?\s*[A-Za-z\s]+,?\s*[A-Z]{2}\s*\d{5}/);
    // Extract social links
    const socialPatterns = {
        facebook: /facebook\.com\/[\w.-]+/i,
        instagram: /instagram\.com\/[\w.-]+/i,
        twitter: /(?:twitter|x)\.com\/[\w.-]+/i,
        linkedin: /linkedin\.com\/(?:company|in)\/[\w.-]+/i,
        yelp: /yelp\.com\/biz\/[\w.-]+/i,
    };
    const socialLinks = {};
    for (const [platform, pattern] of Object.entries(socialPatterns)) {
        const match = allText.match(pattern);
        if (match) {
            socialLinks[platform] = `https://${match[0]}`;
        }
    }
    // Extract business hours
    const hoursMatch = allText.match(/(?:monday|mon)[\s\S]{0,100}(?:sunday|sun|pm|am)/i);
    // Extract certifications
    const certMatches = allText.match(/(?:BBB|certified|licensed|insured|accredited)[^.!?\n]{0,40}/gi) || [];
    return {
        contactInfo: {
            phone: phoneMatch === null || phoneMatch === void 0 ? void 0 : phoneMatch[0],
            email: emailMatch === null || emailMatch === void 0 ? void 0 : emailMatch[0],
            address: addressMatch === null || addressMatch === void 0 ? void 0 : addressMatch[0],
        },
        socialLinks,
        businessHours: hoursMatch ? { formatted: hoursMatch[0].trim() } : null,
        legalLinks: legalPages.map(p => ({
            label: p.title,
            content: p.rawMarkdown,
        })),
        additionalLinks: [],
        copyrightText: `© ${new Date().getFullYear()} ${businessName}. All rights reserved.`,
        certifications: [...new Set(certMatches)].slice(0, 5),
    };
}
// ============================================
// MAIN EXHAUSTIVE SCRAPER
// ============================================
/**
 * Main exhaustive scraper function
 * Builds complete UniversalBusinessDNA from a website
 */
async function exhaustiveScrapeSite(sourceUrl, config = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const fullConfig = { ...types_1.DEFAULT_TOTAL_CONTENT_CONFIG, ...config };
    const startTime = Date.now();
    console.log(`[ExhaustiveScraper] Starting total content extraction: ${sourceUrl}`);
    let browser = null;
    try {
        // Launch browser with Chromium for Cloud Functions
        browser = await puppeteer.launch({
            args: [...chromium_1.default.args, '--disable-gpu', '--no-sandbox', '--disable-setuid-sandbox', '--single-process', '--disable-dev-shm-usage'],
            executablePath: await chromium_1.default.executablePath('/tmp'),
            headless: true
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        // Track visited URLs and collected data
        const visitedUrls = new Set();
        const semanticPages = [];
        const allImages = [];
        const urlsToVisit = [sourceUrl];
        // Recursive crawl
        while (urlsToVisit.length > 0 && semanticPages.length < fullConfig.maxPages) {
            const currentUrl = urlsToVisit.shift();
            if (visitedUrls.has(currentUrl))
                continue;
            visitedUrls.add(currentUrl);
            try {
                console.log(`[ExhaustiveScraper] Crawling (${semanticPages.length + 1}/${fullConfig.maxPages}): ${currentUrl}`);
                await page.goto(currentUrl, {
                    waitUntil: 'networkidle2',
                    timeout: EXHAUSTIVE_CONFIG.pageTimeout,
                });
                // Wait for dynamic content
                await page.waitForSelector('body', { timeout: 5000 }).catch(() => { });
                // Extract page content
                const { semanticPage, images, links } = await extractPageContent(page, currentUrl);
                semanticPages.push(semanticPage);
                allImages.push(...images.slice(0, EXHAUSTIVE_CONFIG.maxImagesPerPage));
                // Add new links to visit (prioritize known important paths)
                const baseUrl = new URL(sourceUrl).origin;
                for (const link of links) {
                    try {
                        const linkUrl = new URL(link, baseUrl);
                        if (linkUrl.origin === baseUrl && !visitedUrls.has(linkUrl.href)) {
                            // Prioritize important paths
                            const isPriority = EXHAUSTIVE_CONFIG.priorityPaths.some(p => linkUrl.pathname.toLowerCase().includes(p));
                            if (isPriority) {
                                urlsToVisit.unshift(linkUrl.href);
                            }
                            else {
                                urlsToVisit.push(linkUrl.href);
                            }
                        }
                    }
                    catch (_l) {
                        // Invalid URL, skip
                    }
                }
            }
            catch (error) {
                console.warn(`[ExhaustiveScraper] Failed to crawl ${currentUrl}:`, error.message);
            }
            // Check timeout
            if (Date.now() - startTime > fullConfig.crawlTimeout) {
                console.warn('[ExhaustiveScraper] Crawl timeout reached');
                break;
            }
        }
        console.log(`[ExhaustiveScraper] Crawled ${semanticPages.length} pages, found ${allImages.length} images`);
        // Deduplicate images
        const uniqueImages = [...new Set(allImages)].slice(0, EXHAUSTIVE_CONFIG.maxTotalImages);
        // Run Vision API analysis on images
        console.log('[ExhaustiveScraper] Running Vision API analysis...');
        const visionResults = await (0, deepVision_1.batchAnalyzeImages)(uniqueImages, {
            enableOCR: fullConfig.enableOCR,
            enableColorExtraction: fullConfig.enableColorExtraction,
            enableSemanticCaptions: true,
            maxImages: fullConfig.maxImagesForVision,
            concurrency: 3,
        });
        // Extract hidden gems from OCR results
        const hiddenGems = [];
        for (const result of visionResults) {
            if ((_a = result.textDetection) === null || _a === void 0 ? void 0 : _a.fullText) {
                const gems = extractHiddenGems(result.textDetection.fullText, result.imageUrl);
                hiddenGems.push(...gems);
            }
        }
        // Build enriched images
        const enrichedImages = visionResults.map((result, index) => {
            var _a, _b, _c;
            return ({
                url: result.imageUrl,
                alt: result.semanticCaption || `Image ${index + 1}`,
                type: 'other',
                semanticCaption: result.semanticCaption || '',
                vibeDescription: result.semanticCaption || '',
                suggestedSection: 'gallery',
                visualElements: [],
                brandAlignment: 0.5,
                extractedText: ((_a = result.textDetection) === null || _a === void 0 ? void 0 : _a.texts.map(t => t.text)) || [],
                dominantColors: ((_b = result.colorExtraction) === null || _b === void 0 ? void 0 : _b.colors.map(c => c.hex)) || [],
                visionConfidence: ((_c = result.textDetection) === null || _c === void 0 ? void 0 : _c.success) ? 0.9 : 0.5,
            });
        });
        // Extract brand colors
        const allColors = visionResults
            .filter(r => { var _a; return (_a = r.colorExtraction) === null || _a === void 0 ? void 0 : _a.success; })
            .flatMap(r => r.colorExtraction.colors);
        const accentColor = (0, deepVision_1.findAccentColor)(allColors) || '#10b981';
        const primaryColor = ((_b = allColors[0]) === null || _b === void 0 ? void 0 : _b.hex) || '#1f2937';
        const secondaryColor = ((_c = allColors[1]) === null || _c === void 0 ? void 0 : _c.hex) || '#374151';
        // Extract business name from first page
        const businessName = ((_d = semanticPages[0]) === null || _d === void 0 ? void 0 : _d.title.split('|')[0].trim()) ||
            ((_e = semanticPages[0]) === null || _e === void 0 ? void 0 : _e.headings[0]) ||
            new URL(sourceUrl).hostname;
        // Extract structured content
        const services = extractServices(semanticPages);
        const testimonials = extractTestimonials(semanticPages);
        const teamMembers = extractTeamMembers(semanticPages);
        const faqs = extractFAQs(semanticPages);
        // Extract vision/mission from about pages
        const aboutPage = semanticPages.find(p => p.semanticIntent === 'vision_mission');
        const visionStatement = (aboutPage === null || aboutPage === void 0 ? void 0 : aboutPage.paragraphs.find(p => p.toLowerCase().includes('vision') || p.toLowerCase().includes('aspire'))) || null;
        const missionStatement = (aboutPage === null || aboutPage === void 0 ? void 0 : aboutPage.paragraphs.find(p => p.toLowerCase().includes('mission') || p.toLowerCase().includes('purpose'))) || null;
        const coreValues = (aboutPage === null || aboutPage === void 0 ? void 0 : aboutPage.listItems.filter(li => li.length > 10 && li.length < 100).slice(0, 6)) || [];
        // Determine brand personality
        const tones = semanticPages.map(p => p.emotionalTone);
        const brandPersonality = tones.reduce((a, b) => tones.filter(t => t === a).length >= tones.filter(t => t === b).length ? a : b);
        // Extract founding story from hidden gems
        const foundingGem = hiddenGems.find(g => g.type === 'founding_date');
        const foundingStory = foundingGem
            ? `Established ${((_f = foundingGem.text.match(/\d{4}/)) === null || _f === void 0 ? void 0 : _f[0]) || ''}`
            : null;
        // Build consolidated header/footer
        const logoUrl = ((_g = enrichedImages.find(img => img.url.toLowerCase().includes('logo') ||
            img.semanticCaption.toLowerCase().includes('logo'))) === null || _g === void 0 ? void 0 : _g.url) || null;
        const consolidatedHeader = extractConsolidatedHeader(semanticPages, logoUrl, businessName);
        const consolidatedFooter = extractConsolidatedFooter(semanticPages, businessName);
        // Build semantic image map
        const semanticImageMap = {
            hero: enrichedImages.filter(img => img.semanticCaption.toLowerCase().includes('hero') ||
                img.semanticCaption.toLowerCase().includes('banner') ||
                img.semanticCaption.toLowerCase().includes('main')).slice(0, 3),
            services: enrichedImages.filter(img => img.semanticCaption.toLowerCase().includes('service') ||
                img.semanticCaption.toLowerCase().includes('work') ||
                img.semanticCaption.toLowerCase().includes('equipment')).slice(0, 10),
            about: enrichedImages.filter(img => img.semanticCaption.toLowerCase().includes('team') ||
                img.semanticCaption.toLowerCase().includes('office') ||
                img.semanticCaption.toLowerCase().includes('staff')).slice(0, 5),
            testimonials: enrichedImages.filter(img => img.semanticCaption.toLowerCase().includes('customer') ||
                img.semanticCaption.toLowerCase().includes('client')).slice(0, 5),
            gallery: enrichedImages.slice(0, 20),
        };
        // Determine content sparsity
        const totalContent = semanticPages.reduce((sum, p) => sum + p.rawMarkdown.length, 0);
        const contentSparsity = totalContent > 20000 ? 'rich' :
            totalContent > 5000 ? 'moderate' : 'sparse';
        // Build visual vibe description
        const visualVibe = `${brandPersonality.charAt(0).toUpperCase() + brandPersonality.slice(1)} ${contentSparsity === 'rich' ? 'content-rich' : 'focused'} ${((_h = semanticPages[0]) === null || _h === void 0 ? void 0 : _h.emotionalTone) || 'professional'} brand`;
        // Build UniversalBusinessDNA
        const dna = {
            // Identity
            businessName,
            tagline: consolidatedHeader.tagline,
            sourceUrl,
            extractedAt: new Date().toISOString(),
            // Soul
            visionStatement,
            missionStatement,
            coreValues,
            brandPersonality: `${brandPersonality.charAt(0).toUpperCase() + brandPersonality.slice(1)} & ${((_j = semanticPages[0]) === null || _j === void 0 ? void 0 : _j.emotionalTone) || 'Professional'}`,
            uniqueSellingPoints: semanticPages
                .flatMap(p => p.keyPhrases)
                .slice(0, 5),
            // Hidden Gems
            hiddenGems,
            foundingStory,
            achievements: hiddenGems
                .filter(g => g.type === 'award' || g.type === 'certification')
                .map(g => g.text),
            // Offerings
            services,
            pricingInfo: [], // Would need dedicated pricing extraction
            // People
            teamMembers,
            teamCulture: (aboutPage === null || aboutPage === void 0 ? void 0 : aboutPage.paragraphs.find(p => p.toLowerCase().includes('team') || p.toLowerCase().includes('culture'))) || null,
            // Social Proof
            testimonials,
            reviewSummary: {
                averageRating: null,
                totalReviews: null,
                platforms: [],
            },
            mediaFeatures: hiddenGems
                .filter(g => g.type === 'award')
                .map(g => g.text),
            // Content Library
            faqs,
            blogPosts: [],
            educationalContent: semanticPages
                .filter(p => p.semanticIntent === 'educational')
                .flatMap(p => p.keyPhrases),
            // Visual Assets
            enrichedImages,
            semanticImageMap,
            brandColors: {
                primary: primaryColor,
                secondary: secondaryColor,
                accent: accentColor,
                neutrals: ['#f9fafb', '#6b7280', '#1f2937'],
            },
            // Contact & Operations
            consolidatedHeader,
            consolidatedFooter,
            locations: consolidatedFooter.contactInfo.address ? [{
                    name: 'Main Location',
                    address: consolidatedFooter.contactInfo.address,
                    phone: consolidatedFooter.contactInfo.phone,
                    hours: (_k = consolidatedFooter.businessHours) === null || _k === void 0 ? void 0 : _k.formatted,
                }] : [],
            // Semantic Pages
            semanticPages,
            // Metadata
            contentSparsity,
            visualVibe,
            industryCategory: 'General Business', // Would need AI classification
            totalPagesScraped: semanticPages.length,
            visionAnalysisComplete: true,
            pipelineVersion: '4.0-total-content',
        };
        console.log(`[ExhaustiveScraper] Complete! Extracted ${semanticPages.length} pages, ${hiddenGems.length} hidden gems, ${enrichedImages.length} images`);
        return dna;
    }
    finally {
        if (browser) {
            await browser.close();
        }
    }
}
/**
 * Quick scrape for testing (limited pages)
 */
async function quickScrapeSite(sourceUrl, maxPages = 3) {
    return exhaustiveScrapeSite(sourceUrl, {
        maxPages,
        maxImagesForVision: 10,
    });
}
//# sourceMappingURL=exhaustiveScraper.js.map