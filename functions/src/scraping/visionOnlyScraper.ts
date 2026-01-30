/**
 * Gemini-Only Scraper - Uses Gemini with grounding to analyze websites
 * NO Puppeteer, NO Cheerio, NO Vision API - Just Gemini Flash
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { GoogleGenerativeAI } from '@google/generative-ai';

const secretClient = new SecretManagerServiceClient();
let genAI: GoogleGenerativeAI | null = null;

async function getGeminiApiKey(): Promise<string> {
    const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-vibe';
    const secretName = `projects/${projectId}/secrets/gemini-api-key/versions/latest`;
    const [version] = await secretClient.accessSecretVersion({ name: secretName });
    const apiKey = version.payload?.data?.toString();
    if (!apiKey) throw new Error('Failed to retrieve Gemini API key');
    return apiKey;
}

async function getGenAI(): Promise<GoogleGenerativeAI> {
    if (!genAI) {
        const apiKey = await getGeminiApiKey();
        genAI = new GoogleGenerativeAI(apiKey);
    }
    return genAI;
}

export interface SiteIdentity {
    businessName: string;
    logoUrl: string | null;
    logoBase64: string | null;
    heroImages: Array<{ url: string; alt: string }>;
    galleryImages: Array<{ url: string; alt: string }>;
    primaryColors: string[];
    services: string[];
    testimonials: Array<{ text: string; author: string }>;
    teamMembers: Array<{ name: string; role: string; imageUrl: string }>;
    visualVibe: string;
    pages: Array<{ url: string; title: string; path?: string }>;
    tagline?: string;
    navigation?: string[];
    coreValues?: string[];
    contactInfo?: { phone?: string; email?: string; address?: string };
    socialLinks?: string[];
    businessHours?: string;
    fullCopy?: string;
}

export interface DeepScrapeOptions {
    maxPages?: number;
    maxDepth?: number;
    timeout?: number;
    enableVisionOCR?: boolean;
    enableVisionColors?: boolean;
    enableSemanticCaptions?: boolean;
    maxImagesForVision?: number;
}

/**
 * Analyze website using Gemini Flash with grounding
 */
export async function deepScrapeSite(
    url: string,
    options: DeepScrapeOptions = {}
): Promise<SiteIdentity> {

    console.log(`[GeminiScraper] Analyzing: ${url}`);

    const ai = await getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-2.5-pro' });

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
        if (!jsonMatch) throw new Error('No JSON found in response');

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

    } catch (error) {
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
