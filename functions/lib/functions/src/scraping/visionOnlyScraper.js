"use strict";
/**
 * Gemini-Only Scraper - Uses Gemini with grounding to analyze websites
 * NO Puppeteer, NO Cheerio, NO Vision API - Just Gemini Flash
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepScrapeSite = deepScrapeSite;
const secret_manager_1 = require("@google-cloud/secret-manager");
const generative_ai_1 = require("@google/generative-ai");
const secretClient = new secret_manager_1.SecretManagerServiceClient();
let genAI = null;
async function getGeminiApiKey() {
    var _a, _b;
    const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-vibe';
    const secretName = `projects/${projectId}/secrets/gemini-api-key/versions/latest`;
    const [version] = await secretClient.accessSecretVersion({ name: secretName });
    const apiKey = (_b = (_a = version.payload) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.toString();
    if (!apiKey)
        throw new Error('Failed to retrieve Gemini API key');
    return apiKey;
}
async function getGenAI() {
    if (!genAI) {
        const apiKey = await getGeminiApiKey();
        genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    }
    return genAI;
}
/**
 * Analyze website using Gemini Flash with grounding
 */
async function deepScrapeSite(url, options = {}) {
    console.log(`[GeminiScraper] Analyzing: ${url}`);
    const ai = await getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-3-pro-preview' });
    const prompt = `Analyze this website: ${url}

Extract and return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "businessName": "string",
  "services": ["service1", "service2", "service3"],
  "primaryColors": ["#hex1", "#hex2", "#hex3"],
  "visualVibe": "brief description of visual style",
  "testimonials": [{"text": "quote", "author": "name"}],
  "tagline": "their tagline or slogan",
  "contactInfo": {"phone": "phone", "email": "email", "address": "address"}
}

Only include information that is clearly visible on the website. Use null for missing data.`;
    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();
        // Try to parse JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch)
            throw new Error('No JSON found in response');
        const data = JSON.parse(jsonMatch[0]);
        return {
            businessName: data.businessName || new URL(url).hostname,
            logoUrl: null,
            logoBase64: null,
            heroImages: [],
            galleryImages: [],
            primaryColors: data.primaryColors || ['#3B82F6', '#10B981'],
            services: data.services || [],
            testimonials: data.testimonials || [],
            teamMembers: [],
            visualVibe: data.visualVibe || 'modern and professional',
            pages: [{ url, title: data.businessName || 'Home', path: '/' }],
            tagline: data.tagline,
            contactInfo: data.contactInfo,
            navigation: [],
            coreValues: [],
            socialLinks: [],
            businessHours: undefined,
            fullCopy: undefined
        };
    }
    catch (error) {
        console.error('[GeminiScraper] Error:', error);
        // Return minimal fallback data
        const businessName = new URL(url).hostname.replace('www.', '').split('.')[0];
        return {
            businessName,
            logoUrl: null,
            logoBase64: null,
            heroImages: [],
            galleryImages: [],
            primaryColors: ['#3B82F6', '#10B981'],
            services: [],
            testimonials: [],
            teamMembers: [],
            visualVibe: 'modern and professional',
            pages: [{ url, title: businessName, path: '/' }],
            navigation: [],
            coreValues: [],
            socialLinks: []
        };
    }
}
//# sourceMappingURL=visionOnlyScraper.js.map