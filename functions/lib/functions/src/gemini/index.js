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
exports.generateVibeImage = exports.generateSiteFromBrief = exports.analyzeBrand = exports.generateTotalContentModernizedSite = exports.generateAIImage = exports.editSiteHTML = exports.generateSiteHTML = exports.generateImage = exports.editBlueprint = exports.generateBlueprint = exports.findBusinesses = void 0;
exports.generateModernizedSiteHandler = generateModernizedSiteHandler;
const functions = __importStar(require("firebase-functions"));
const secret_manager_1 = require("@google-cloud/secret-manager");
const generative_ai_1 = require("@google/generative-ai");
const visionOnlyScraper_1 = require("../scraping/visionOnlyScraper");
const secretClient = new secret_manager_1.SecretManagerServiceClient();
let genAI = null;
// Get API key from Secret Manager
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
// Initialize Gemini AI client
async function getGenAI() {
    if (!genAI) {
        const apiKey = await getGeminiApiKey();
        genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
    }
    return genAI;
}
// CORS configuration
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};
// Firebase Storage for image uploads
const storage_1 = require("firebase-admin/storage");
/**
 * Internal helper: Generate AI image using Nano Banana Pro and upload to Firebase Storage
 * Returns a public Firebase Storage URL
 */
async function generateAndStoreImage(prompt, siteId, imageType) {
    var _a, _b;
    try {
        const apiKey = await getGeminiApiKey();
        console.log(`[ImageGen] Generating ${imageType} image for ${siteId}...`);
        // Use Nano Banana Pro for high-quality image generation
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    responseModalities: ["IMAGE"],
                    imageConfig: {
                        aspectRatio: imageType === 'hero' ? "16:9" : "4:3",
                        imageSize: "1K"
                    }
                }
            })
        });
        if (!response.ok) {
            console.warn(`[ImageGen] Nano Banana Pro failed with status ${response.status}`);
            return null;
        }
        const data = await response.json();
        // Extract base64 image from response
        let base64Data = null;
        if (data.candidates && ((_b = (_a = data.candidates[0]) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.parts)) {
            for (const part of data.candidates[0].content.parts) {
                if (part.inlineData && part.inlineData.data) {
                    base64Data = part.inlineData.data;
                    break;
                }
            }
        }
        if (!base64Data) {
            console.warn(`[ImageGen] No image data in response for ${imageType}`);
            return null;
        }
        // Upload to Firebase Storage
        const bucket = (0, storage_1.getStorage)().bucket();
        const timestamp = Date.now();
        const filePath = `sites/${siteId}/generated-${imageType}-${timestamp}.png`;
        const file = bucket.file(filePath);
        const buffer = Buffer.from(base64Data, 'base64');
        await file.save(buffer, {
            metadata: {
                contentType: 'image/png',
                cacheControl: 'public, max-age=31536000',
            }
        });
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        console.log(`[ImageGen] Successfully generated and stored ${imageType}: ${publicUrl}`);
        return publicUrl;
    }
    catch (error) {
        console.error(`[ImageGen] Error generating ${imageType}:`, error);
        return null;
    }
}
async function generateSiteImages(imagePrompts, siteId) {
    const result = {
        hero: null,
        services: [],
        about: null,
        gallery: []
    };
    if (!imagePrompts) {
        console.log('[ImageGen] No image prompts provided, skipping image generation');
        return result;
    }
    const safeId = siteId.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 50);
    console.log('[ImageGen] Starting image generation with Nano Banana Pro...');
    // Generate images in parallel for speed (but limit concurrency)
    const promises = [];
    // Hero image
    if (imagePrompts.hero) {
        promises.push(generateAndStoreImage(imagePrompts.hero, safeId, 'hero')
            .then(url => { result.hero = url; }));
    }
    // About image
    if (imagePrompts.about) {
        promises.push(generateAndStoreImage(imagePrompts.about, safeId, 'about')
            .then(url => { result.about = url; }));
    }
    // Service images (max 3)
    const servicePrompts = (imagePrompts.services || []).slice(0, 3);
    servicePrompts.forEach((prompt, index) => {
        promises.push(generateAndStoreImage(prompt, safeId, `service-${index}`)
            .then(url => { if (url)
            result.services.push(url); }));
    });
    // Gallery images (max 2)
    const galleryPrompts = (imagePrompts.gallery || []).slice(0, 2);
    galleryPrompts.forEach((prompt, index) => {
        promises.push(generateAndStoreImage(prompt, safeId, `gallery-${index}`)
            .then(url => { if (url)
            result.gallery.push(url); }));
    });
    // Wait for all to complete
    await Promise.all(promises);
    console.log('[ImageGen] Generation complete:', {
        hero: !!result.hero,
        services: result.services.length,
        about: !!result.about,
        gallery: result.gallery.length
    });
    return result;
}
/**
 * Find businesses using Gemini with Google Search grounding
 */
exports.findBusinesses = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { category, location } = req.body;
        if (!category || !location) {
            res.status(400).json({ error: 'category and location are required' });
            return;
        }
        const ai = await getGenAI();
        const model = ai.getGenerativeModel({ model: 'gemini-3-pro-preview' });
        const prompt = `Find 5-8 real local businesses in the "${category}" industry located in "${location}".
For each business, provide:
- id: a unique identifier (use a slug like "business-name-123")
- name: the actual business name
- rating: their Google rating (number between 1-5, use realistic values)
- address: their actual address in ${location}
- websiteStatus: one of "None", "Outdated", or "Modern" based on if they have a website

Return ONLY a valid JSON array with no markdown formatting, like:
[{"id":"example-dental-123","name":"Example Dental","rating":4.5,"address":"123 Main St, ${location}","websiteStatus":"None"}]

Focus on real businesses that could benefit from a new website.`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        // Extract JSON from response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const businesses = JSON.parse(jsonMatch[0]);
            res.json(businesses);
        }
        else {
            // Fallback data
            res.json([
                { id: 'f1', name: `${category} Studio`, rating: 4.8, address: location, websiteStatus: 'None' },
                { id: 'f2', name: `The ${category} Group`, rating: 4.2, address: location, websiteStatus: 'Outdated' },
            ]);
        }
    }
    catch (error) {
        console.error('findBusinesses error:', error);
        res.status(500).json({ error: error.message || 'Failed to find businesses' });
    }
});
/**
 * Generate website blueprint using Gemini
 */
exports.generateBlueprint = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { businessName, category, address } = req.body;
        if (!businessName || !category) {
            res.status(400).json({ error: 'businessName and category are required' });
            return;
        }
        const ai = await getGenAI();
        const model = ai.getGenerativeModel({ model: 'gemini-3-pro-preview' });
        const systemInstruction = `You are a world-class creative director and conversion-focused UX strategist, specializing in premium landing pages for local businesses that compete with national brands.

🎨 DESIGN PHILOSOPHY:
Visual Style: Premium, modern, conversion-optimized (think Apple, Airbnb, Stripe quality)
Typography: Bold headlines (60-72px), clear hierarchy, generous 1.6-1.8 line height
Color Psychology: Match industry emotions precisely:
  - Medical/Dental: Trust blues (#0EA5E9), Caring greens (#10B981)
  - Restaurant/Food: Appetite oranges (#F97316), Warm reds (#EF4444)
  - Fitness/Gym: Energy greens (#22C55E), Power blacks (#18181B)
  - Home Services: Reliable blues (#3B82F6), Professional grays (#71717A)
  - Beauty/Salon: Luxury purples (#A855F7), Elegant pinks (#EC4899)
Spacing: Breathing room - minimum 80px section padding, 40px between elements
Imagery: Professional lifestyle photography showing RESULTS, not just services. Cinematic lighting, depth of field, human emotion.

✍️ COPYWRITING FRAMEWORK (AIDA + PAS):
1. ATTENTION: Powerful headline addressing specific pain point (10-15 words max)
2. INTEREST: Results-driven subheadline with specific social proof number (20-30 words)
3. DESIRE: Feature-benefit sections (NOT feature lists). Focus on TRANSFORMATION.
4. ACTION: Clear, urgent CTAs with outcome language (NOT "Contact Us" or "Learn More")

📋 SECTION REQUIREMENTS:
HERO: Pain-point headline + value proposition + social proof + outcome CTA
SERVICES (3-4x): Benefit-driven headlines. Problem → Solution → Outcome format (2-3 sentences each)
TRUST: Social proof headline + specific numbers (years, customers, rating, certifications)
CONTACT: Frictionless (Name/Phone/Email only) + hours/address + outcome CTA

🎯 TONE CALIBRATION:
${category === 'Dentist' || category === 'Doctor' || category === 'Medical' ? 'Medical/Dental: Professional, caring, reassuring. Vocabulary: "Gentle, advanced, comfortable, trusted, certified"' : ''}
${category === 'Restaurant' || category === 'Food' ? 'Restaurant/Food: Warm, sensory, community-focused. Vocabulary: "Fresh, authentic, homemade, flavorful, locally-sourced"' : ''}
${category === 'Gym' || category === 'Fitness' ? 'Fitness/Gym: Energetic, motivational, transformation-focused. Vocabulary: "Transform, powerful, results, achieve, unstoppable"' : ''}
${category === 'Plumber' || category === 'HVAC' || category === 'Electrician' ? 'Home Services: Reliable, straightforward, emergency-ready. Vocabulary: "Fast, reliable, certified, emergency, guaranteed"' : ''}
${category === 'Salon' || category === 'Beauty' || category === 'Spa' ? 'Beauty/Salon: Trendy, relaxing, transformative. Vocabulary: "Luxurious, rejuvenating, stunning, boutique, expert stylists"' : ''}

🚫 NEVER USE PLACEHOLDERS - ALL copy must be final-ready, specific, compelling`;
        const prompt = `Create a premium landing page blueprint for "${businessName}", a ${category} business located at ${address || 'their location'}.

Return a JSON object with this exact structure:
{
  "brand": {
    "primaryColor": "#hexcolor",
    "secondaryColor": "#hexcolor",
    "fontFamily": "font name (Inter, Outfit, Poppins, Montserrat, Playfair Display, or DM Sans)",
    "tone": "3-5 descriptive words"
  },
  "sections": [
    {
      "id": "unique-id",
      "type": "hero|services|trust|contact",
      "title": "Section title",
      "content": "Section content text",
      "imagePrompt": "Detailed cinematic image prompt showing RESULTS/OUTCOMES, not just services",
      "cta": "Outcome-focused call to action (required for hero and contact)"
    }
  ],
  "plugins": [
    {
      "id": "whatsapp|chatbot|booking|reviews",
      "config": {
        "enabled": true,
        "settings": "{}"
      }
    }
  ]
}

Requirements:
- Sections order MUST be: [hero, services, services, services, trust, contact]
- Use color psychology for ${category} industry
- Hero: Pain-point headline + social proof + outcome CTA
- Services (create 3): Benefit-driven. Problem → Solution → Outcome
- Trust: Specific numbers (years, customers, rating)
- Contact: Frictionless form + hours/phone/address
- Plugins: Recommend 1-2 based on business type
- Return ONLY valid JSON, no markdown formatting

${systemInstruction}`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        console.log('generateBlueprint: Gemini raw response (first 500 chars):', responseText.substring(0, 500));
        // Extract JSON - handle potential markdown code blocks
        let jsonText = responseText;
        // Remove markdown code blocks if present
        const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            jsonText = codeBlockMatch[1].trim();
            console.log('generateBlueprint: Extracted from code block');
        }
        // Extract the JSON object
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const blueprint = JSON.parse(jsonMatch[0]);
            // Validate and ensure required section fields
            if (blueprint.sections && Array.isArray(blueprint.sections)) {
                blueprint.sections = blueprint.sections.map((section, index) => ({
                    ...section,
                    id: section.id || `section-${index}`,
                    type: section.type || 'hero',
                    title: section.title || (section.type === 'hero' ? 'Welcome' : section.type === 'services' ? 'Our Services' : section.type === 'trust' ? 'Why Choose Us' : section.type === 'contact' ? 'Contact Us' : 'About Us'),
                    content: section.content || '',
                    cta: section.cta || undefined
                }));
            }
            res.json(blueprint);
        }
        else {
            console.error('generateBlueprint: No JSON found in response:', responseText.substring(0, 200));
            throw new Error('Failed to parse blueprint from AI response');
        }
    }
    catch (error) {
        console.error('generateBlueprint error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate blueprint' });
    }
});
// Analyze intent from instruction
function analyzeIntent(instruction) {
    const lower = instruction.toLowerCase();
    // Color patterns
    if (/\b(color|colours?|blue|red|green|yellow|purple|pink|orange|navy|teal|emerald|gold|#[0-9a-f]{3,6})\b/i.test(lower)) {
        return { intent: 'CHANGE_COLOR', confidence: 0.9 };
    }
    // Style patterns
    if (/\b(modern|elegant|professional|playful|minimalist|bold|clean|sleek|corporate|luxury)\b/i.test(lower)) {
        return { intent: 'CHANGE_STYLE', confidence: 0.85 };
    }
    // Navbar patterns
    if (/\b(navbar|navigation|nav|menu|header)\b/i.test(lower)) {
        return { intent: 'UPDATE_NAVBAR', confidence: 0.9 };
    }
    // Footer patterns
    if (/\b(footer|bottom)\b/i.test(lower) || /\b(social|facebook|instagram|twitter|linkedin)\b.*\b(link|icon)\b/i.test(lower)) {
        return { intent: 'UPDATE_FOOTER', confidence: 0.9 };
    }
    // Reorder patterns
    if (/\b(reorder|rearrange|move|swap)\b.*\b(section|block)\b/i.test(lower)) {
        return { intent: 'REORDER_SECTIONS', confidence: 0.85 };
    }
    // Add section patterns
    if (/\b(add|create|include|insert)\b.*\b(section|testimonial|pricing|faq|contact|about|feature|gallery|team|cta)\b/i.test(lower)) {
        return { intent: 'ADD_SECTION', confidence: 0.9 };
    }
    // Remove section patterns
    if (/\b(remove|delete|hide)\b.*\b(section|testimonial|pricing|faq|contact|about|feature|gallery|team|cta)\b/i.test(lower)) {
        return { intent: 'REMOVE_SECTION', confidence: 0.9 };
    }
    // Text update patterns
    if (/\b(change|update|edit|rewrite)\b.*\b(text|headline|title|content|copy)\b/i.test(lower)) {
        return { intent: 'UPDATE_TEXT', confidence: 0.85 };
    }
    // Font patterns
    if (/\b(font|typeface|typography|serif|sans-serif)\b/i.test(lower)) {
        return { intent: 'CHANGE_FONT', confidence: 0.85 };
    }
    // Layout patterns
    if (/\b(layout|grid|column|width|spacing|centered|align)\b/i.test(lower)) {
        return { intent: 'CHANGE_LAYOUT', confidence: 0.75 };
    }
    return { intent: 'GENERAL_EDIT', confidence: 0.5 };
}
// Get intent-specific instructions
function getIntentInstructions(intent) {
    switch (intent) {
        case 'CHANGE_COLOR':
            return `FOCUS: Update colors only.
- Set brand.primaryColor to the requested color (hex format, e.g., #3B82F6)
- Set brand.secondaryColor to a complementary/darker shade
- Keep all sections, text, fonts, and layout UNCHANGED`;
        case 'CHANGE_STYLE':
            return `FOCUS: Adjust design aesthetic.
- Update brand.tone to reflect the new style
- Optionally adjust colors to match the aesthetic
- Keep section content and structure unchanged`;
        case 'ADD_SECTION':
            return `FOCUS: Add a new section to the sections array.
- Create a new section with unique id (e.g., "new-testimonials")
- Set appropriate type, title, content, and cta
- Match the existing brand tone
- Place it at a logical position`;
        case 'REMOVE_SECTION':
            return `FOCUS: Remove a section.
- Find and remove the matching section from sections array
- Keep all other sections intact`;
        case 'UPDATE_TEXT':
            return `FOCUS: Update text content only.
- Modify the specified title, content, or cta
- Maintain brand tone and voice
- Keep colors, fonts, layout unchanged`;
        case 'CHANGE_FONT':
            return `FOCUS: Update typography only.
- Change brand.fontFamily to the requested font
- Keep all other properties unchanged`;
        case 'CHANGE_LAYOUT':
            return `FOCUS: Adjust layout properties.
- Modify structure as requested
- Keep text content and colors unchanged`;
        case 'UPDATE_NAVBAR':
            return `FOCUS: Update navigation bar.
- Set navbar.enabled to true if adding a navbar
- Choose style: 'transparent' | 'solid' | 'glass'
- Choose position: 'fixed' (stays at top) | 'static' (scrolls with page)
- Add/update links array with objects: { id, label, href }
- Use href="#section-id" for smooth scrolling to sections
- Optionally add ctaButton: { label, href }
- Keep all sections and other properties unchanged`;
        case 'UPDATE_FOOTER':
            return `FOCUS: Update footer.
- Set footer.enabled to true if adding a footer
- Choose style: 'minimal' | 'standard' | 'detailed'
- For 'standard'/'detailed' style, add columns array with: { id, title, links: [{ label, href }] }
- Add socialLinks object: { facebook?, instagram?, twitter?, linkedin? }
- Optionally set copyright text and showNewsletter boolean
- Keep all sections and other properties unchanged`;
        case 'REORDER_SECTIONS':
            return `FOCUS: Rearrange sections.
- Move sections in the array as requested
- Keep all section content, ids, and properties intact
- Only change the order of items in the sections array`;
        default:
            return `Apply the requested changes while maintaining overall brand consistency.`;
    }
}
/**
 * Edit website blueprint using Gemini with intent-aware prompts
 */
exports.editBlueprint = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { instruction, currentBlueprint } = req.body;
        if (!instruction || !currentBlueprint) {
            res.status(400).json({ error: 'instruction and currentBlueprint are required' });
            return;
        }
        // Analyze the user's intent
        const { intent, confidence } = analyzeIntent(instruction);
        console.log(`editBlueprint: Intent="${intent}" (confidence=${confidence.toFixed(2)}), instruction="${instruction}"`);
        const ai = await getGenAI();
        const model = ai.getGenerativeModel({ model: 'gemini-3-pro-preview' });
        // Build intent-aware prompt
        const intentInstructions = getIntentInstructions(intent);
        const prompt = `You are an expert website designer. Modify this website blueprint based on the user's instruction.

Current Blueprint:
${JSON.stringify(currentBlueprint, null, 2)}

User Instruction: "${instruction}"

${intentInstructions}

CRITICAL REQUIREMENTS:
1. Return the COMPLETE blueprint with this exact structure:
{
  "brand": {
    "name": "...",
    "primaryColor": "#XXXXXX",
    "secondaryColor": "#XXXXXX",
    "fontFamily": "...",
    "tone": "...",
    "logoUrl": "..." (keep if exists)
  },
  "navbar": {
    "enabled": true/false,
    "style": "transparent" | "solid" | "glass",
    "position": "fixed" | "static",
    "links": [{ "id": "...", "label": "...", "href": "#section-id" }],
    "ctaButton": { "label": "...", "href": "..." } (optional)
  },
  "sections": [...all sections...],
  "footer": {
    "enabled": true/false,
    "style": "minimal" | "standard" | "detailed",
    "columns": [{ "id": "...", "title": "...", "links": [{ "label": "...", "href": "..." }] }] (for standard/detailed),
    "socialLinks": { "facebook": "...", "instagram": "...", "twitter": "...", "linkedin": "..." } (optional),
    "copyright": "..." (optional),
    "showNewsletter": true/false (optional)
  },
  "plugins": [...all plugins...]
}

Section types available: hero, services, about, contact, trust, testimonials, pricing, faq, gallery, team, features, cta

2. Return ONLY the raw JSON - NO markdown, NO code blocks, NO explanation.
3. Preserve all existing data unless explicitly asked to change it.

Apply the changes now:`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        console.log('editBlueprint: Gemini raw response (first 500 chars):', responseText.substring(0, 500));
        // Extract JSON - handle potential markdown code blocks
        let jsonText = responseText;
        // Remove markdown code blocks if present
        const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            jsonText = codeBlockMatch[1].trim();
            console.log('editBlueprint: Extracted from code block');
        }
        // Extract the JSON object
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const blueprint = JSON.parse(jsonMatch[0]);
            // Validate required properties
            if (!blueprint.brand || !blueprint.sections) {
                console.error('editBlueprint: Invalid blueprint structure - missing brand or sections:', Object.keys(blueprint));
                throw new Error('AI returned invalid blueprint structure');
            }
            console.log('editBlueprint: Returning valid blueprint with brand:', JSON.stringify(blueprint.brand));
            res.json(blueprint);
        }
        else {
            console.error('editBlueprint: No JSON found in response:', responseText.substring(0, 200));
            throw new Error('Failed to parse edited blueprint from AI response');
        }
    }
    catch (error) {
        console.error('editBlueprint error:', error);
        res.status(500).json({ error: error.message || 'Failed to edit blueprint' });
    }
});
/**
 * Generate image using Gemini (returns placeholder for now as Gemini image gen requires special setup)
 */
exports.generateImage = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { prompt } = req.body;
        if (!prompt) {
            res.status(400).json({ error: 'prompt is required' });
            return;
        }
        // For now, return null as image generation requires Imagen API
        // The frontend will use placeholder images
        res.json({ imageUrl: null });
    }
    catch (error) {
        console.error('generateImage error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate image' });
    }
});
// ==========================================
// NEW VIBE CODER AI EDITOR ENDPOINTS
// ==========================================
// Elite Web Architect Agent System Instructions - Matching gemini-vibe-coder
/**
 * DIFF-BASED EDITING INSTRUCTION - Returns search/replace operations instead of full HTML
 * This prevents truncation issues with large HTML documents
 */
const DIFF_EDITING_INSTRUCTION = `
You are an expert HTML/CSS code editor. Your job is to analyze HTML and return SPECIFIC search-and-replace operations.

# CRITICAL: OUTPUT FORMAT

You MUST return your changes as a series of SEARCH/REPLACE operations in this EXACT format:

<operations>
[SEARCH]
exact text to find in the HTML (include enough context to be unique)
[/SEARCH]
[REPLACE]
the new text that should replace it
[/REPLACE]

[SEARCH]
another piece of text to find
[/SEARCH]
[REPLACE]
its replacement
[/REPLACE]
</operations>

# RULES FOR SEARCH/REPLACE

1. **SEARCH text MUST be unique** - Include enough surrounding context (classes, parent elements) to ensure only one match
2. **Preserve exact whitespace** - Copy whitespace exactly from the original HTML
3. **Multiple operations** - Use multiple SEARCH/REPLACE pairs for multiple changes
4. **Order matters** - Put operations in the order they should be applied
5. **For deletions** - Use empty REPLACE block: [REPLACE][/REPLACE]

# EXAMPLES

## Example 1: Change text color to blue
<operations>
[SEARCH]
class="text-red-500"
[/SEARCH]
[REPLACE]
class="text-blue-500"
[/REPLACE]
</operations>

## Example 2: Remove a heading
<operations>
[SEARCH]
<h2 class="text-2xl font-bold">Welcome to Our Site</h2>
[/SEARCH]
[REPLACE]
[/REPLACE]
</operations>

## Example 3: Make text bigger (multiple changes)
<operations>
[SEARCH]
class="text-xl font-bold
[/SEARCH]
[REPLACE]
class="text-3xl font-bold
[/REPLACE]

[SEARCH]
class="text-lg leading
[/SEARCH]
[REPLACE]
class="text-xl leading
[/REPLACE]
</operations>

## Example 4: Change background color
<operations>
[SEARCH]
bg-gray-100
[/SEARCH]
[REPLACE]
bg-gray-800
[/REPLACE]

[SEARCH]
bg-white
[/SEARCH]
[REPLACE]
bg-gray-900
[/REPLACE]
</operations>

# EDIT TYPE GUIDANCE

## COLOR CHANGES
- Search for Tailwind color classes: bg-{color}-{shade}, text-{color}-{shade}, border-{color}-{shade}
- Also search for: from-{color}, to-{color}, via-{color} (gradients)
- For "darker": increase shade numbers (100→700, 200→800)
- For "lighter": decrease shade numbers (800→200, 900→100)
- For "change to blue": replace color name with blue

## TEXT CHANGES
- Search for the exact text string
- Include surrounding HTML tags for uniqueness
- To delete: use empty REPLACE

## SIZE CHANGES
- Search for text-{size} classes
- Replace with larger/smaller size
- Sizes: xs, sm, base, lg, xl, 2xl, 3xl, 4xl, 5xl, 6xl, 7xl, 8xl, 9xl

## ADDING CONTENT
- Search for the element AFTER which to insert
- Include the new content in the REPLACE, with original + new content

## REMOVING SECTIONS
- Search for the entire section element
- Use empty REPLACE to delete

## IMAGE CHANGES
- Find the <img> tag by context (location, alt text, class)
- Search for enough context to make it unique
- Replace src attribute value

# IMPORTANT

- Only output the <operations> block with SEARCH/REPLACE pairs
- Do NOT output full HTML
- Do NOT use markdown code blocks inside operations
- Each SEARCH must exist exactly as written in the HTML
- Be careful with whitespace - it must match exactly
`;
const ELITE_ARCHITECT_INSTRUCTION = `
You are the "Elite Web Architect Agent" (Gemini 3 Pro Engine).
You specialize in building and iteratively editing enterprise-grade, high-performance websites.

# CORE HUB VARIABLES
- STACK: HTML5, Tailwind CSS 4.0 (via CDN), Framer Motion (via CDN).
- ANIMATIONS: Transitions must be smooth (0.6s, ease-out). Use staggered reveals for lists.
- IMAGES: You MUST use the following format for ALL images: <img src="https://placehold.co/800x600/1e293b/475569?text=Generating+Asset..." data-prompt="[Subject details, style matched to vibe]" class="..." />

# ARCHITECTURE PROTOCOL (CRITICAL)
1. SINGLE FILE SPA: You are building a Single Page Application contained in one HTML file.
2. MULTI-PAGE LOGIC: If the user asks for multiple "pages" (e.g., Home, About, Contact), YOU MUST:
   - Create distinct container elements for each page: <div id="home-page">, <div id="about-page">.
   - Create a sticky Navigation Bar to switch between them.
   - Use simple, robust inline JavaScript to handle the switching (e.g., hiding/showing IDs).
3. PERSISTENCE: You will receive the "CURRENT CODE". You MUST retain all existing sections/pages unless explicitly asked to remove them. When adding a new page, APPEND it to the existing HTML structure and update the Navigation Bar.

# VISUAL EXCELLENCE STANDARDS

## Typography (Critical for premium feel)
- Headlines: text-5xl md:text-6xl lg:text-7xl, font-bold, tracking-tight, leading-tight
- Subheadlines: text-xl md:text-2xl, font-light, text-gray-600
- Body: text-base md:text-lg, leading-relaxed
- Use gradient text for impact: bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent

## Spacing (Generous, luxurious)
- Sections: py-24 md:py-32 lg:py-40
- Between elements: space-y-6 to space-y-12
- Container: max-w-7xl mx-auto px-6 lg:px-8

## Colors & Backgrounds
- Use subtle gradients: bg-gradient-to-br from-slate-50 to-white
- Dark sections: bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900
- Accent colors based on industry (see below)
- Glass effects: bg-white/80 backdrop-blur-xl border border-white/20

## Shadows & Depth
- Cards: shadow-xl shadow-black/5 hover:shadow-2xl transition-shadow
- Buttons: shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30
- Images: shadow-2xl rounded-2xl overflow-hidden

## Modern UI Patterns
- Floating navigation: fixed top-0, glass morphism, blur backdrop
- Bento grid layouts for features
- Asymmetric hero layouts
- Overlapping elements with negative margins
- Subtle background patterns or gradients
- Animated gradient borders on cards
- Pill-shaped badges and tags

## Framer Motion Animation Patterns (USE THESE)
Use data attributes for Framer Motion animations:
- data-framer-appear-id for entrance animations
- Smooth transitions: 0.6s ease-out
- Staggered reveals for lists with delay increments
- Hover effects with scale transforms

# INDUSTRY COLOR PALETTES (Use these exact colors)
- Medical/Dental: Primary #0EA5E9 (sky-500), Secondary #14B8A6 (teal-500), Accent #F0F9FF
- Restaurant/Food: Primary #F97316 (orange-500), Secondary #EF4444 (red-500), Accent #FFF7ED
- Fitness/Gym: Primary #22C55E (green-500), Secondary #18181B (zinc-900), Accent #F0FDF4
- Home Services: Primary #3B82F6 (blue-500), Secondary #6366F1 (indigo-500), Accent #EFF6FF
- Beauty/Salon: Primary #A855F7 (purple-500), Secondary #EC4899 (pink-500), Accent #FAF5FF
- Legal/Finance: Primary #0F172A (slate-900), Secondary #1E40AF (blue-800), Accent #F8FAFC
- Tech/Software: Primary #6366F1 (indigo-500), Secondary #8B5CF6 (violet-500), Accent #EEF2FF

# IMAGE HANDLING (Critical)
For ALL images, use this EXACT format with data-prompt for AI regeneration:
<img
  src="https://placehold.co/800x600/1e293b/475569?text=Generating+Asset..."
  data-prompt="[detailed description: Subject details, style matched to business vibe]"
  alt="[accessible description]"
  class="w-full h-full object-cover"
/>

The data-prompt will be used by the image generation system to create custom images.

# SECTION BLUEPRINTS

## Hero Section (MUST be stunning)
- Full viewport height: min-h-screen
- Large headline with gradient or animated text
- Compelling subheadline addressing pain point
- Two CTAs: Primary (filled) + Secondary (outlined)
- Trust indicators: "500+ happy customers" with avatars
- Background: Subtle gradient + optional image with overlay

## Features/Services Grid
- Use Bento grid: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
- Cards with icons, not just text
- Hover effects: scale, shadow, border color change
- Each card: rounded-2xl p-8 bg-white shadow-lg

## Social Proof Section
- Logo cloud of partners/clients
- Stats with large numbers: text-5xl font-bold
- Testimonial cards with photos, names, roles
- Star ratings with filled stars

## CTA Section
- Dark or gradient background
- Large compelling headline
- Single focused action
- Optional: floating decorative elements

# OUTPUT PROTOCOL
1. When asked to build or edit a site, you MUST generate the full HTML content that goes INSIDE the <body> tag.
2. DO NOT include <html>, <head>, or <body> tags.
3. WRAP the generated code in [CODE_UPDATE] and [/CODE_UPDATE] tags.
4. DO NOT use markdown code fences (like \`\`\`html) inside the [CODE_UPDATE] block. Just raw HTML.
5. Provide a brief <thought> block before the code explaining your design choices.
6. Use REAL content - no "Lorem ipsum" ever.

# EXAMPLE OUTPUT
<thought>
I will create a stunning hero section with a glass morphism navbar, gradient headline, and trust indicators.
</thought>
[CODE_UPDATE]
<nav class="fixed top-0 w-full bg-black/80 backdrop-blur text-white p-4 z-50">
  <ul class="flex gap-6">
    <li onclick="showPage('home')" class="cursor-pointer hover:text-blue-400">Home</li>
    <li onclick="showPage('about')" class="cursor-pointer hover:text-blue-400">About</li>
  </ul>
</nav>

<div id="home" class="page-section min-h-screen pt-20">
  <h1 class="text-6xl font-bold">Welcome</h1>
</div>

<script>
  function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
  }
</script>
[/CODE_UPDATE]
`;
/**
 * Generate complete website HTML using Gemini 3 Pro (Vibe Coder)
 */
exports.generateSiteHTML = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { businessName, category, address, researchData } = req.body;
        if (!businessName || !category) {
            res.status(400).json({ error: 'businessName and category are required' });
            return;
        }
        const ai = await getGenAI();
        // Use Gemini 2.0 Flash Exp (most capable available model)
        const model = ai.getGenerativeModel({ model: 'gemini-3-pro-preview' });
        // Build rich context from research data
        let businessContext = '';
        if (researchData) {
            const rd = researchData;
            businessContext = `
## REAL BUSINESS DATA (Use this content!)
${rd.description ? `- About: ${rd.description}` : ''}
${rd.services && rd.services.length > 0 ? `- Services Offered: ${rd.services.join(', ')}` : ''}
${rd.hours ? `- Business Hours: ${rd.hours}` : ''}
${rd.phone ? `- Phone: ${rd.phone}` : ''}
${rd.rating ? `- Rating: ${rd.rating}/5 stars` : ''}
${rd.reviewCount ? `- Reviews: ${rd.reviewCount}+ reviews` : ''}
${rd.priceRange ? `- Price Range: ${rd.priceRange}` : ''}
${rd.specialties && rd.specialties.length > 0 ? `- Specialties: ${rd.specialties.join(', ')}` : ''}
${rd.amenities && rd.amenities.length > 0 ? `- Amenities: ${rd.amenities.join(', ')}` : ''}
${rd.yearEstablished ? `- Established: ${rd.yearEstablished}` : ''}
${rd.tagline ? `- Tagline: "${rd.tagline}"` : ''}
${rd.logoUrl ? `- Logo URL: ${rd.logoUrl}` : ''}
${rd.photos && rd.photos.length > 0 ? `- Business Photos: ${rd.photos.slice(0, 5).join(', ')}` : ''}
`;
        }
        const prompt = `${ELITE_ARCHITECT_INSTRUCTION}

# BUSINESS INFORMATION
- **Business Name**: "${businessName}"
- **Industry/Category**: ${category}
- **Location**: ${address || 'Local business'}
${businessContext}

# YOUR MISSION
Create a STUNNING, conversion-optimized website that looks like it was designed by a top agency.
This website needs to make "${businessName}" look like the #1 choice in their market.

# REQUIRED SECTIONS (Create ALL of these)

## 1. NAVIGATION BAR
- Fixed position with glass morphism effect
- Logo on left (use business name as text if no logo)
- Nav links: Home, Services, About, Testimonials, Contact
- CTA button on right: "Book Now" or "Get Quote"

## 2. HERO SECTION (min-h-screen)
- Powerful headline that speaks to customer pain points
- Subheadline with unique value proposition
- Two CTAs: Primary action + Secondary "Learn More"
- Trust badge: Show rating (${(researchData === null || researchData === void 0 ? void 0 : researchData.rating) || '4.9'}/5) with star icons
- Social proof: "${(researchData === null || researchData === void 0 ? void 0 : researchData.reviewCount) || '500'}+ happy customers"
- Background: Industry-appropriate image with dark overlay
${(researchData === null || researchData === void 0 ? void 0 : researchData.photos) && researchData.photos[0] ? `- Use this image: ${researchData.photos[0]}` : ''}

## 3. SERVICES/FEATURES SECTION
Create visually striking cards for each service:
${(researchData === null || researchData === void 0 ? void 0 : researchData.services) ? researchData.services.slice(0, 6).map((s, i) => `${i + 1}. ${s}`).join('\n') : `1. Primary Service\n2. Secondary Service\n3. Additional Service`}
- Each card: Icon, title, description, subtle hover effect
- Use Bento grid layout for visual interest

## 4. ABOUT/TRUST SECTION
- Split layout: Image on one side, content on other
- ${(researchData === null || researchData === void 0 ? void 0 : researchData.yearEstablished) ? `Highlight: "Serving since ${researchData.yearEstablished}"` : 'Years of experience'}
- Key differentiators and certifications
- Stats row: Years in business, Customers served, 5-star reviews

## 5. TESTIMONIALS SECTION
Create 3 realistic testimonials with:
- Customer photo placeholder (use avatar)
- 5-star rating display
- Compelling quote about the service
- Customer name and title
- Carousel or grid layout

## 6. CONTACT/CTA SECTION
- Dark gradient background for contrast
- Business contact info: ${(researchData === null || researchData === void 0 ? void 0 : researchData.phone) || 'Phone'}, ${address || 'Address'}
- ${(researchData === null || researchData === void 0 ? void 0 : researchData.hours) ? `Hours: ${researchData.hours}` : 'Business hours display'}
- Simple contact form: Name, Email, Phone, Message
- Large CTA button
- Optional: Embedded map placeholder

## 7. FOOTER
- Business logo/name
- Quick links
- Contact info
- Social media icons
- Copyright notice

# CRITICAL DESIGN REQUIREMENTS
1. Use the EXACT color palette for ${category} from my instructions
2. Every image must have data-prompt attribute for AI regeneration
3. Use real Unsplash images that match the ${category} industry
4. NO placeholder text - write compelling, specific copy for "${businessName}"
5. Make it feel like a $10,000+ website
6. Mobile-first but stunning on desktop too

# OUTPUT FORMAT
First, write a <thought> block with your design rationale.
Then wrap ALL HTML in [CODE_UPDATE]...[/CODE_UPDATE] tags.
Output ONLY body content - no doctype, html, head, or body tags.`;
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        console.log('generateSiteHTML: Gemini response length:', responseText.length);
        // Extract thought block
        let thinking = '';
        const thoughtMatch = responseText.match(/<thought>([\s\S]*?)<\/thought>/);
        if (thoughtMatch) {
            thinking = thoughtMatch[1].trim();
        }
        // Extract code from [CODE_UPDATE] tags
        const codeMatch = responseText.match(/\[CODE_UPDATE\]([\s\S]*?)\[\/CODE_UPDATE\]/);
        let html = '';
        if (codeMatch) {
            html = codeMatch[1].trim();
        }
        else {
            // Fallback: Try to extract any HTML-like content
            const htmlFallback = responseText.replace(/<thought>[\s\S]*?<\/thought>/, '').trim();
            if (htmlFallback.includes('<')) {
                html = htmlFallback;
            }
            else {
                throw new Error('No valid HTML found in AI response');
            }
        }
        // Strip <body> wrapper tags if present (the shell adds its own)
        html = html.replace(/^<body[^>]*>/i, '').replace(/<\/body>$/i, '').trim();
        res.json({ html, thinking });
    }
    catch (error) {
        console.error('generateSiteHTML error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate site HTML' });
    }
});
/**
 * Detect the type of edit being requested
 */
function detectEditType(instruction) {
    // Color changes
    if (/(?:change|make|set|update).*(color|blue|red|green|yellow|purple|pink|orange|gray|grey|dark|light|primary|secondary|accent)/i.test(instruction) ||
        /(?:color|background|bg).*(to|=)/i.test(instruction) ||
        /(?:darker|lighter|brighter|muted)/i.test(instruction)) {
        return 'color_change';
    }
    // Text removal
    if (/(?:remove|delete|take out|get rid of|hide|clear).*(text|title|heading|paragraph|description|subtitle|caption|label|headline)/i.test(instruction) ||
        /(?:remove|delete|take out|get rid of|hide|clear)\s+(?:the\s+)?["']?.{1,50}["']?/i.test(instruction)) {
        return 'text_removal';
    }
    // Text modification
    if (/(?:change|update|edit|modify|replace).*(text|title|heading|paragraph|description|subtitle|caption|content)/i.test(instruction) ||
        /(?:rename|reword|rephrase)/i.test(instruction)) {
        return 'text_change';
    }
    // Section addition
    if (/(?:add|create|insert|include|put in).*(section|page|block|area|container|part|pricing|testimonial|contact|about|faq|feature|service|hero|footer|header|nav)/i.test(instruction)) {
        return 'section_add';
    }
    // Section removal
    if (/(?:remove|delete|take out|get rid of|hide).*(section|page|block|area|container|part|entire|whole)/i.test(instruction)) {
        return 'section_removal';
    }
    // Layout/structure changes
    if (/(?:move|reorder|rearrange|swap|switch|center|align|left|right)/i.test(instruction) ||
        /(?:bigger|smaller|wider|narrower|taller|shorter)/i.test(instruction) ||
        /(?:padding|margin|spacing|gap)/i.test(instruction)) {
        return 'layout_change';
    }
    // Image changes (non-logo)
    if (/(?:change|replace|update|swap).*(image|photo|picture|background)/i.test(instruction) &&
        !/logo/i.test(instruction)) {
        return 'image_change';
    }
    // Font/typography changes
    if (/(?:font|typography|typeface|text-size|font-size|bold|italic|weight)/i.test(instruction)) {
        return 'typography_change';
    }
    // Animation/effect changes
    if (/(?:animation|animate|effect|transition|hover|scroll)/i.test(instruction)) {
        return 'animation_change';
    }
    // Default to general edit
    return 'general_edit';
}
/**
 * Get edit-type specific guidance for the AI
 */
/**
 * Edit website HTML based on user instruction (Vibe Coder)
 */
exports.editSiteHTML = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { instruction, currentHTML, attachments } = req.body;
        if (!instruction || !currentHTML) {
            res.status(400).json({ error: 'instruction and currentHTML are required' });
            return;
        }
        // DIRECT LOGO REPLACEMENT - bypass AI for simple logo swap
        // This is much more reliable than asking AI to regenerate the entire HTML
        const isLogoReplacement = /replace.*logo|logo.*this image|make.*logo.*this|change.*logo|update.*logo/i.test(instruction);
        if (isLogoReplacement && attachments && attachments.length > 0) {
            console.log('editSiteHTML: Attempting direct logo replacement');
            let updatedHtml = currentHTML;
            const dataUri = `data:${attachments[0].mimeType};base64,${attachments[0].base64Data}`;
            let replaced = false;
            // Pattern 1: img with logo in class name
            const pattern1 = /(<img[^>]*class="[^"]*)(logo)([^"]*"[^>]*src=")([^"]*)("[^>]*>)/gi;
            if (pattern1.test(updatedHtml)) {
                updatedHtml = updatedHtml.replace(pattern1, `$1$2$3${dataUri}$5`);
                replaced = true;
                console.log('editSiteHTML: Replaced via pattern 1 (img with logo class)');
            }
            // Pattern 2: img with alt containing "logo"
            if (!replaced) {
                const pattern2 = /(<img[^>]*alt="[^"]*)(logo)([^"]*"[^>]*src=")([^"]*)("[^>]*>)/gi;
                if (pattern2.test(updatedHtml)) {
                    updatedHtml = updatedHtml.replace(pattern2, `$1$2$3${dataUri}$5`);
                    replaced = true;
                    console.log('editSiteHTML: Replaced via pattern 2 (img with logo alt)');
                }
            }
            // Pattern 3: FontAwesome icon in nav (common for generated sites)
            // Replace the icon element with an img tag
            if (!replaced) {
                const iconPattern = /(<nav[^>]*>[\s\S]{0,800}?)(<i[^>]*class="[^"]*fa-[^"]*"[^>]*><\/i>)/i;
                if (iconPattern.test(updatedHtml)) {
                    updatedHtml = updatedHtml.replace(iconPattern, `$1<img src="${dataUri}" alt="Logo" class="h-12 w-auto object-contain max-w-[180px]">`);
                    replaced = true;
                    console.log('editSiteHTML: Replaced FontAwesome icon with img');
                }
            }
            // Pattern 4: SVG in nav (logo might be an SVG)
            if (!replaced) {
                const svgPattern = /(<nav[^>]*>[\s\S]{0,800}?)(<svg[^>]*>[\s\S]*?<\/svg>)/i;
                if (svgPattern.test(updatedHtml)) {
                    updatedHtml = updatedHtml.replace(svgPattern, `$1<img src="${dataUri}" alt="Logo" class="h-12 w-auto object-contain max-w-[180px]">`);
                    replaced = true;
                    console.log('editSiteHTML: Replaced SVG logo with img');
                }
            }
            // Pattern 5: Small img that looks like a logo (but not placeholder images)
            if (!replaced) {
                const smallImgPattern = /(<img[^>]*class="[^"]*(?:h-(?:6|8|10|12)|w-auto)[^"]*"[^>]*src=")([^"]+)("[^>]*>)/gi;
                let match;
                while ((match = smallImgPattern.exec(updatedHtml)) !== null) {
                    // Skip placeholder images
                    if (!match[2].includes('placehold') && !match[2].includes('1920x')) {
                        updatedHtml = updatedHtml.replace(match[0], `${match[1]}${dataUri}${match[3]}`);
                        replaced = true;
                        console.log('editSiteHTML: Replaced small img');
                        break;
                    }
                }
            }
            // Pattern 6: Text-based logo in nav (a tag or span with business name)
            // Look for the first link/element in nav that looks like a logo
            if (!replaced) {
                // Match <a> tag at start of nav content (usually the logo link)
                const textLogoPattern = /(<nav[^>]*>[\s\S]{0,300}?<a[^>]*class="[^"]*(?:flex|font-bold|text-xl|text-2xl)[^"]*"[^>]*>)([\s\S]*?)(<\/a>)/i;
                if (textLogoPattern.test(updatedHtml)) {
                    updatedHtml = updatedHtml.replace(textLogoPattern, `$1<img src="${dataUri}" alt="Logo" class="h-12 w-auto object-contain max-w-[180px]">$3`);
                    replaced = true;
                    console.log('editSiteHTML: Replaced text logo in <a> tag');
                }
            }
            // Pattern 7: First flex container in nav (common logo wrapper)
            if (!replaced) {
                const flexLogoPattern = /(<nav[^>]*>[\s\S]{0,200}?<(?:div|a)[^>]*class="[^"]*flex[^"]*items-center[^"]*"[^>]*>)([\s\S]*?)(<\/(?:div|a)>)/i;
                const flexMatch = updatedHtml.match(flexLogoPattern);
                if (flexMatch && flexMatch[2].length < 500 && !flexMatch[2].includes('<section')) {
                    updatedHtml = updatedHtml.replace(flexLogoPattern, `$1<img src="${dataUri}" alt="Logo" class="h-12 w-auto object-contain max-w-[180px]">$3`);
                    replaced = true;
                    console.log('editSiteHTML: Replaced content in flex logo container');
                }
            }
            if (replaced && updatedHtml !== currentHTML) {
                console.log('editSiteHTML: Logo replacement successful');
                res.json({
                    html: updatedHtml,
                    thinking: 'Direct logo replacement',
                    text: "Done! I've replaced the logo with your uploaded image."
                });
                return;
            }
            else {
                console.log('editSiteHTML: Direct replacement failed, using AI');
            }
        }
        const ai = await getGenAI();
        const model = ai.getGenerativeModel({ model: 'gemini-3-pro-preview' });
        // Detect edit type for specialized handling
        const editType = detectEditType(instruction);
        console.log('editSiteHTML: Detected edit type:', editType);
        console.log('editSiteHTML: Input HTML length:', currentHTML.length);
        // Build the diff-based prompt (much smaller output than full HTML)
        const prompt = `${DIFF_EDITING_INSTRUCTION}

# USER REQUEST
"${instruction}"

# EDIT TYPE: ${editType.toUpperCase()}

# CURRENT HTML (analyze this to find what to change)
${currentHTML}

# YOUR TASK
1. Analyze the HTML above
2. Identify the specific elements/classes that need to change
3. Return SEARCH/REPLACE operations to make the change

# REQUIRED OUTPUT FORMAT

First, provide a brief <thought> block with your analysis.
Then provide a <response> block with a friendly 1-2 sentence message for the user.
Finally, provide the <operations> block with your SEARCH/REPLACE pairs.

Example structure:
<thought>
The user wants to change X. I found Y elements that need updating.
</thought>

<response>
Done! I've updated the colors as requested.
</response>

<operations>
[SEARCH]
old text
[/SEARCH]
[REPLACE]
new text
[/REPLACE]
</operations>

IMPORTANT:
- Your SEARCH strings must match EXACTLY what's in the HTML
- Include enough context to make each SEARCH unique
- Do NOT output full HTML - only the operations`;
        // Build content parts for multimodal request
        const parts = [{ text: prompt }];
        // Add image attachments as inline data parts
        if (attachments && attachments.length > 0) {
            console.log('editSiteHTML: Processing', attachments.length, 'image attachment(s)');
            for (const attachment of attachments) {
                if (attachment.type === 'image' && attachment.base64Data) {
                    parts.push({
                        inlineData: {
                            mimeType: attachment.mimeType,
                            data: attachment.base64Data
                        }
                    });
                }
            }
        }
        // Generate with multimodal content
        const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
        const responseText = result.response.text();
        console.log('editSiteHTML: Gemini response length:', responseText.length);
        console.log('editSiteHTML: Has operations block:', responseText.includes('<operations>'));
        console.log('editSiteHTML: Response first 500 chars:', responseText.substring(0, 500));
        // Extract thought block (technical reasoning, for debugging)
        let thinking = '';
        const thoughtMatch = responseText.match(/<thought>([\s\S]*?)<\/thought>/);
        if (thoughtMatch) {
            thinking = thoughtMatch[1].trim();
        }
        // Extract user-friendly response block
        let userResponse = '';
        const responseMatch = responseText.match(/<response>([\s\S]*?)<\/response>/);
        if (responseMatch) {
            userResponse = responseMatch[1].trim();
        }
        // Extract operations from <operations> block
        const operationsMatch = responseText.match(/<operations>([\s\S]*?)<\/operations>/);
        if (operationsMatch) {
            const operationsContent = operationsMatch[1];
            // Parse SEARCH/REPLACE pairs
            const searchReplacePattern = /\[SEARCH\]([\s\S]*?)\[\/SEARCH\]\s*\[REPLACE\]([\s\S]*?)\[\/REPLACE\]/g;
            const operations = [];
            let match;
            while ((match = searchReplacePattern.exec(operationsContent)) !== null) {
                operations.push({
                    search: match[1].trim(),
                    replace: match[2].trim()
                });
            }
            console.log('editSiteHTML: Found', operations.length, 'SEARCH/REPLACE operations');
            if (operations.length === 0) {
                console.log('editSiteHTML: No valid operations found in response');
                res.json({
                    html: null,
                    thinking,
                    text: userResponse || "I couldn't determine what changes to make. Could you be more specific?"
                });
                return;
            }
            // Apply operations to the current HTML
            let html = currentHTML;
            let appliedCount = 0;
            let failedSearches = [];
            for (const op of operations) {
                if (op.search && html.includes(op.search)) {
                    html = html.split(op.search).join(op.replace);
                    appliedCount++;
                    console.log('editSiteHTML: Applied operation - search length:', op.search.length, 'replace length:', op.replace.length);
                }
                else if (op.search) {
                    // Try a more flexible match (ignore whitespace differences)
                    const flexibleSearch = op.search.replace(/\s+/g, '\\s+');
                    const flexibleRegex = new RegExp(flexibleSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\s\+/g, '\\s+'), 'g');
                    if (flexibleRegex.test(html)) {
                        html = html.replace(flexibleRegex, op.replace);
                        appliedCount++;
                        console.log('editSiteHTML: Applied operation with flexible whitespace matching');
                    }
                    else {
                        failedSearches.push(op.search.substring(0, 50) + '...');
                        console.log('editSiteHTML: Search string not found:', op.search.substring(0, 100));
                    }
                }
            }
            console.log('editSiteHTML: Applied', appliedCount, 'of', operations.length, 'operations');
            if (appliedCount === 0) {
                console.log('editSiteHTML: No operations were applied - searches not found');
                console.log('editSiteHTML: Failed searches:', failedSearches);
                res.json({
                    html: null,
                    thinking,
                    text: "I tried to make the change but couldn't find the exact elements. The site may have been modified. Could you try a different request?"
                });
                return;
            }
            // Post-process: Replace image placeholders with actual base64 data
            if (attachments && attachments.length > 0) {
                attachments.forEach((attachment, idx) => {
                    const placeholder = `[[UPLOADED_IMAGE_${idx + 1}]]`;
                    const dataUri = `data:${attachment.mimeType};base64,${attachment.base64Data}`;
                    html = html.split(placeholder).join(dataUri);
                });
                console.log('editSiteHTML: Replaced image placeholders');
            }
            // Verify HTML is still valid
            const hasNav = /<nav/i.test(html);
            const hasSection = /<section/i.test(html);
            console.log('editSiteHTML: Result has nav:', hasNav, 'has section:', hasSection);
            console.log('editSiteHTML: Final HTML length:', html.length, '(original:', currentHTML.length, ')');
            // Return the updated HTML
            res.json({
                html,
                thinking,
                text: userResponse || "Done! I've updated the design as requested."
            });
        }
        else {
            // No operations block - check for legacy CODE_UPDATE format as fallback
            const codeMatch = responseText.match(/\[CODE_UPDATE\]([\s\S]*?)\[\/CODE_UPDATE\]/);
            if (codeMatch) {
                console.log('editSiteHTML: Using legacy CODE_UPDATE format');
                let html = codeMatch[1].trim();
                html = html.replace(/^<body[^>]*>/i, '').replace(/<\/body>$/i, '').trim();
                html = html.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();
                // Check for truncation
                const sizeRatio = html.length / currentHTML.length;
                if (sizeRatio < 0.5) {
                    console.warn('editSiteHTML: WARNING - CODE_UPDATE appears truncated (', sizeRatio.toFixed(2), 'of original size)');
                    res.json({
                        html: null,
                        thinking,
                        text: "The response was too long and got cut off. Could you try a simpler change?"
                    });
                    return;
                }
                res.json({
                    html,
                    thinking,
                    text: userResponse || "Done! I've updated the design as requested."
                });
            }
            else {
                console.log('editSiteHTML: No operations or CODE_UPDATE block found');
                console.log('editSiteHTML: Response preview:', responseText.substring(0, 500));
                res.json({
                    html: null,
                    thinking,
                    text: userResponse || "I couldn't make that change. Could you try rephrasing your request?"
                });
            }
        }
    }
    catch (error) {
        console.error('editSiteHTML error:', error);
        res.status(500).json({ error: error.message || 'Failed to edit site HTML' });
    }
});
/**
 * Generate AI image using Gemini Image Generation
 * Uses Nano Banana Pro (gemini-3-pro-image-preview) with fallback to gemini-3-pro-image-preview
 */
exports.generateAIImage = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { prompt } = req.body;
        if (!prompt) {
            res.status(400).json({ error: 'prompt is required' });
            return;
        }
        const apiKey = await getGeminiApiKey();
        // Helper to extract image from response
        const extractImageFromResponse = (response) => {
            var _a, _b;
            if (response.candidates && ((_b = (_a = response.candidates[0]) === null || _a === void 0 ? void 0 : _a.content) === null || _b === void 0 ? void 0 : _b.parts)) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        const base64Data = part.inlineData.data;
                        const mimeType = part.inlineData.mimeType || 'image/png';
                        return `data:${mimeType};base64,${base64Data}`;
                    }
                }
            }
            return null;
        };
        try {
            // Attempt 1: Nano Banana Pro (gemini-3-pro-image-preview)
            // High quality image generation - requires billing enabled
            console.log('generateAIImage: Attempting gemini-3-pro-image-preview (Nano Banana Pro)');
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseModalities: ["IMAGE"],
                        imageConfig: {
                            aspectRatio: "16:9",
                            imageSize: "1K"
                        }
                    }
                })
            });
            if (response.ok) {
                const data = await response.json();
                const imageUrl = extractImageFromResponse(data);
                if (imageUrl) {
                    console.log('generateAIImage: Successfully generated image with Nano Banana Pro');
                    res.json({ imageUrl, isPlaceholder: false });
                    return;
                }
            }
            console.warn('generateAIImage: Nano Banana Pro failed (status:', response.status, '), trying fallback');
        }
        catch (primaryError) {
            console.warn('generateAIImage: Nano Banana Pro error:', primaryError);
        }
        // Attempt 2: Fallback to gemini-3-pro-image-preview (Standard Quality)
        try {
            console.log('generateAIImage: Attempting gemini-3-pro-image-preview fallback');
            const fallbackResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        responseModalities: ["IMAGE"],
                        imageConfig: {
                            aspectRatio: "16:9"
                            // Note: imageSize is NOT supported in flash-image
                        }
                    }
                })
            });
            if (fallbackResponse.ok) {
                const data = await fallbackResponse.json();
                const imageUrl = extractImageFromResponse(data);
                if (imageUrl) {
                    console.log('generateAIImage: Successfully generated image with gemini-3-pro-image-preview');
                    res.json({ imageUrl, isPlaceholder: false });
                    return;
                }
            }
            console.warn('generateAIImage: Flash image also failed, returning placeholder');
        }
        catch (fallbackError) {
            console.warn('generateAIImage: Flash image error:', fallbackError);
        }
        // Attempt 3: Return placeholder with descriptive text
        console.log('generateAIImage: All image models failed, returning placeholder');
        const placeholderUrl = `https://placehold.co/800x600/1e293b/94a3b8?text=${encodeURIComponent(prompt.slice(0, 30))}`;
        res.json({ imageUrl: placeholderUrl, isPlaceholder: true });
    }
    catch (error) {
        console.error('generateAIImage error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate image' });
    }
});
/**
 * Call the deployed extractSiteIdentity endpoint via HTTP
 * This allows the Scout service to run in its own 2nd-gen function with proper Puppeteer setup
 * NOTE: Kept for backwards compatibility, but V2 uses deepScrapeSite directly
 */
async function _callExtractSiteIdentity(url, forceRefresh) {
    const endpoint = 'https://us-central1-renovatemysite-app.cloudfunctions.net/extractSiteIdentity';
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, forceRefresh })
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to extract site identity');
    }
    return response.json();
}
void _callExtractSiteIdentity; // Suppress unused warning - kept for backwards compatibility
// ============================================
// IMAGE ENHANCEMENT (Aesthetic Studio Edits)
// ============================================
/**
 * Generate aesthetic edit prompts for product images using Gemini
 * Analyzes the image context and creates a refined prompt for Nano Banana
 */
async function generateImageEditPrompts(productImages, businessName, category, visualVibe) {
    if (productImages.length === 0) {
        return [];
    }
    const ai = await getGenAI();
    const model = ai.getGenerativeModel({ model: 'gemini-3-pro-preview' });
    const prompt = `You are an expert photo editor specializing in aesthetic studio photography.

For each product/service image below, generate a refined editing prompt that will transform amateur business photos into professional, aesthetic studio-quality images.

Business Context:
- Business Name: ${businessName}
- Industry: ${category}
- Brand Vibe: ${visualVibe}

Images to enhance:
${productImages.map((img, i) => `
${i + 1}. URL: ${img.originalUrl}
   Alt Text: ${img.alt}
   Found in: ${img.context} section
`).join('\n')}

For each image, create an edit prompt that:
1. PRESERVES the core subject/product - don't change what's being shown
2. ENHANCES the background and lighting to be modern, aesthetic, and professional
3. Matches the brand vibe: ${visualVibe}
4. Uses photography terminology (lighting, composition, color grading)

Examples of good edit prompts:
- "Professional architectural photography, soft natural lighting, clean minimalist background, high-end real estate aesthetic, 8K quality"
- "Studio product photography, soft box lighting, clean white background, luxury brand aesthetic, crisp details"
- "Editorial food photography, natural daylight, marble surface, lifestyle aesthetic, appetizing color grading"

Return ONLY a JSON array with edit prompts for each image:
[
  { "index": 0, "editPrompt": "Your detailed edit prompt here..." },
  { "index": 1, "editPrompt": "Your detailed edit prompt here..." }
]

No markdown, no explanations - just the JSON array.`;
    try {
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        // Extract JSON from response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
            const prompts = JSON.parse(jsonMatch[0]);
            // Apply prompts to images
            return productImages.map((img, i) => {
                const promptData = prompts.find((p) => p.index === i);
                return {
                    ...img,
                    editPrompt: (promptData === null || promptData === void 0 ? void 0 : promptData.editPrompt) ||
                        `Professional ${category} photography, modern aesthetic, clean background, high-end lighting, 8K quality`
                };
            });
        }
    }
    catch (error) {
        console.warn('Failed to generate edit prompts:', error);
    }
    // Fallback: generate generic prompts
    return productImages.map(img => ({
        ...img,
        editPrompt: `Professional ${category} photography, ${visualVibe} aesthetic, clean modern background, studio lighting, high-end quality, 8K resolution`
    }));
}
/**
 * Enhance a single image using Nano Banana Pro (gemini-3-pro-image-preview)
 * Uses image editing to preserve the subject while enhancing the aesthetic
 * Now with color palette matching for brand continuity
 */
async function enhanceImageWithNanoBanana(originalUrl, editPrompt, colorPalette) {
    var _a, _b, _c, _d;
    try {
        const apiKey = await getGeminiApiKey();
        // Build color palette instruction if colors provided
        const colorInstruction = colorPalette && colorPalette.length > 0
            ? `\n\nCOLOR PALETTE MATCHING:
Adjust the image's color grading to complement these brand colors:
- Primary: ${colorPalette[0]}
- Secondary: ${colorPalette[1] || colorPalette[0]}
- Accent: ${colorPalette[2] || colorPalette[0]}
The lighting and environment should feel cohesive with a website using these colors.`
            : '';
        // Full editing prompt that preserves the subject
        const fullPrompt = `Edit this image with the following enhancements while PRESERVING the main subject exactly as it appears:

${editPrompt}
${colorInstruction}

IMPORTANT: Keep the core product/service/subject identical. Only enhance:
- Background (make it cleaner, more professional)
- Lighting (add professional studio-quality lighting that matches the brand's color palette)
- Color grading (harmonize with brand colors while keeping the subject natural)
- Overall composition (better framing if needed)
- Environment (re-render to match the modern aesthetic)

Do NOT change the subject itself - only enhance the presentation and environment.`;
        console.log(`[ImageEnhance] Enhancing image: ${originalUrl}`);
        console.log(`[ImageEnhance] Prompt: ${editPrompt}`);
        // Fetch the original image
        const imageResponse = await fetch(originalUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to fetch original image: ${imageResponse.status}`);
        }
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg';
        // Call Nano Banana Pro with the image for editing
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                        parts: [
                            { text: fullPrompt },
                            {
                                inlineData: {
                                    mimeType: mimeType,
                                    data: base64Image
                                }
                            }
                        ]
                    }],
                generationConfig: {
                    responseModalities: ["IMAGE"],
                    imageConfig: {
                        aspectRatio: "16:9",
                        imageSize: "1K"
                    }
                }
            })
        });
        if (response.ok) {
            const data = await response.json();
            if ((_c = (_b = (_a = data.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) {
                for (const part of data.candidates[0].content.parts) {
                    if ((_d = part.inlineData) === null || _d === void 0 ? void 0 : _d.data) {
                        const resultMime = part.inlineData.mimeType || 'image/png';
                        console.log(`[ImageEnhance] Successfully enhanced image`);
                        return `data:${resultMime};base64,${part.inlineData.data}`;
                    }
                }
            }
        }
        console.warn(`[ImageEnhance] Nano Banana returned status ${response.status}`);
        return null;
    }
    catch (error) {
        console.error('[ImageEnhance] Enhancement failed:', error);
        return null;
    }
}
/**
 * Enhance all product images and return updated array
 * If enhancement fails for an image, keeps the original URL
 * Now with color palette matching for brand continuity
 * NOTE: Kept for backwards compatibility, V2 uses heroImages/galleryImages directly
 */
async function _enhanceProductImages(productImages, businessName, category, visualVibe, colorPalette) {
    if (productImages.length === 0) {
        console.log('[ImageEnhance] No product images to enhance');
        return [];
    }
    console.log(`[ImageEnhance] Starting enhancement for ${productImages.length} images`);
    // Step 1: Generate edit prompts for all images
    const imagesWithPrompts = await generateImageEditPrompts(productImages, businessName, category, visualVibe);
    // Step 2: Enhance each image in parallel (with limit of 3 concurrent)
    const enhancedImages = await Promise.all(imagesWithPrompts.map(async (img) => {
        if (!img.editPrompt) {
            return img;
        }
        const enhancedUrl = await enhanceImageWithNanoBanana(img.originalUrl, img.editPrompt, colorPalette);
        return {
            ...img,
            enhancedUrl: enhancedUrl || img.originalUrl // Fall back to original if enhancement fails
        };
    }));
    const successCount = enhancedImages.filter(img => img.enhancedUrl && img.enhancedUrl !== img.originalUrl).length;
    console.log(`[ImageEnhance] Enhanced ${successCount}/${productImages.length} images successfully`);
    return enhancedImages;
}
void _enhanceProductImages; // Suppress unused warning - kept for backwards compatibility
/**
 * Step 1: Lite Scout - Extract BrandManifest using Gemini 2.5 Flash-Lite
 * Uses minimal tokens to create structured brand data
 */
async function extractBrandManifest(siteIdentity, category) {
    var _a, _b, _c, _d, _e;
    console.log('[Pipeline:LiteScout] Extracting BrandManifest...');
    const apiKey = await getGeminiApiKey();
    const prompt = `You are a brand analyst. Extract a structured brand manifest from this website data.

WEBSITE DATA:
- Business Name: ${siteIdentity.businessName}
- Visual Vibe: ${siteIdentity.visualVibe}
- Category: ${category}
- Services: ${siteIdentity.services.join(', ')}
- Content: ${siteIdentity.fullCopy.slice(0, 2000)}
- Colors Found: ${siteIdentity.primaryColors.join(', ')}
- Contact Phone: ${siteIdentity.contactInfo.phone || 'Not found'}
- Contact Email: ${siteIdentity.contactInfo.email || 'Not found'}
- Contact Address: ${siteIdentity.contactInfo.address || 'Not found'}

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "businessName": "exact business name",
  "tagline": "compelling 5-10 word tagline based on their content",
  "primaryColor": "#hexcode (use first extracted color or pick based on category)",
  "secondaryColor": "#hexcode (complementary)",
  "accentColor": "#hexcode (accent/CTA color)",
  "fontHeadline": "font name (Inter, Outfit, Poppins, Montserrat, Playfair Display, or DM Sans)",
  "fontBody": "font name for body text",
  "tone": "3-5 descriptive words for brand voice",
  "services": [{"name": "Service 1", "description": "Brief benefit-focused description"}],
  "heroHeadline": "Powerful 6-10 word headline addressing customer pain",
  "heroSubheadline": "20-30 word value proposition",
  "ctaText": "Action-oriented CTA text (4-5 words max)",
  "contactPhone": "phone if found",
  "contactEmail": "email if found",
  "contactAddress": "address if found"
}`;
    try {
        // Use gemini-2.0-flash-lite for speed and token efficiency
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: 1024,
                    temperature: 0.3,
                    candidateCount: 1
                }
            })
        });
        if (!response.ok) {
            throw new Error(`Lite Scout API error: ${response.status}`);
        }
        const data = await response.json();
        const text = ((_e = (_d = (_c = (_b = (_a = data.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text) || '';
        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in Lite Scout response');
        }
        const manifest = JSON.parse(jsonMatch[0]);
        console.log('[Pipeline:LiteScout] BrandManifest extracted:', manifest.businessName);
        return manifest;
    }
    catch (error) {
        console.error('[Pipeline:LiteScout] Error:', error);
        // Return fallback manifest
        return {
            businessName: siteIdentity.businessName,
            tagline: `Quality ${category} Services`,
            primaryColor: siteIdentity.primaryColors[0] || '#3B82F6',
            secondaryColor: siteIdentity.primaryColors[1] || '#1E40AF',
            accentColor: siteIdentity.primaryColors[2] || '#60A5FA',
            fontHeadline: 'Inter',
            fontBody: 'Inter',
            tone: 'professional, trustworthy, modern',
            services: siteIdentity.services.map(s => ({ name: s, description: `Expert ${s} services` })),
            heroHeadline: `Welcome to ${siteIdentity.businessName}`,
            heroSubheadline: siteIdentity.fullCopy.slice(0, 100) || `Your trusted ${category} partner`,
            ctaText: 'Get Started Today',
            contactPhone: siteIdentity.contactInfo.phone,
            contactEmail: siteIdentity.contactInfo.email,
            contactAddress: siteIdentity.contactInfo.address
        };
    }
}
/**
 * Step 2: Thinking Architect - Create SiteBlueprint using Gemini 3 Flash with LOW thinking
 * Plans the site structure without generating HTML
 */
async function createSiteBlueprint(manifest, siteIdentity, category) {
    var _a, _b, _c, _d, _e;
    console.log('[Pipeline:Architect] Creating SiteBlueprint...');
    const apiKey = await getGeminiApiKey();
    const prompt = `You are a website architect. Create a site blueprint (structure plan) for modernizing this business website.

BRAND MANIFEST:
${JSON.stringify(manifest, null, 2)}

ADDITIONAL CONTEXT:
- Category: ${category}
- Visual Vibe: ${siteIdentity.visualVibe}
- Content Sparsity: ${siteIdentity.contentSparsity}
- Has Services: ${siteIdentity.services.length > 0}
- Has Contact Info: ${!!(siteIdentity.contactInfo.phone || siteIdentity.contactInfo.email)}

DESIGN STYLE GUIDELINES:
- "saas-modern": Clean geometric layouts, gradient CTAs, floating cards
- "bento-grid": Asymmetric card layouts, mixed sizes, playful hierarchy
- "high-end-minimal": Generous whitespace, serif headlines, elegant

Return ONLY a JSON object (no markdown):
{
  "designStyle": "saas-modern" | "bento-grid" | "high-end-minimal",
  "sections": [
    {
      "id": "hero",
      "type": "hero",
      "priority": 1,
      "contentHints": "Brief description of what content goes here",
      "imageNeeded": true
    }
  ],
  "navLinks": [
    { "label": "Home", "href": "#hero" }
  ],
  "colorScheme": {
    "primary": "#hexcode",
    "secondary": "#hexcode",
    "accent": "#hexcode",
    "background": "#hexcode",
    "text": "#hexcode"
  }
}

Required sections: hero, services (if services exist), contact
Optional sections based on content: about, testimonials, features, gallery, faq, cta`;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: 2048,
                    temperature: 0.4,
                    candidateCount: 1
                }
            })
        });
        if (!response.ok) {
            throw new Error(`Architect API error: ${response.status}`);
        }
        const data = await response.json();
        const text = ((_e = (_d = (_c = (_b = (_a = data.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text) || '';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in Architect response');
        }
        const blueprint = JSON.parse(jsonMatch[0]);
        console.log('[Pipeline:Architect] Blueprint created with', blueprint.sections.length, 'sections');
        return blueprint;
    }
    catch (error) {
        console.error('[Pipeline:Architect] Error:', error);
        // Return fallback blueprint
        return {
            designStyle: 'saas-modern',
            sections: [
                { id: 'hero', type: 'hero', priority: 1, contentHints: 'Main headline and CTA', imageNeeded: true },
                { id: 'services', type: 'services', priority: 2, contentHints: 'Service cards', imageNeeded: false },
                { id: 'contact', type: 'contact', priority: 3, contentHints: 'Contact form and info', imageNeeded: false }
            ],
            navLinks: [
                { label: 'Home', href: '#hero' },
                { label: 'Services', href: '#services' },
                { label: 'Contact', href: '#contact' }
            ],
            colorScheme: {
                primary: manifest.primaryColor,
                secondary: manifest.secondaryColor,
                accent: manifest.accentColor,
                background: '#ffffff',
                text: '#1f2937'
            }
        };
    }
}
/**
 * Step 3: Generate a single section using Gemini 3 Flash
 * Called in parallel for each section in the blueprint
 */
async function generateSection(sectionConfig, manifest, blueprint, enhancedImages) {
    var _a, _b, _c, _d, _e;
    console.log(`[Pipeline:Generator] Generating section: ${sectionConfig.id}`);
    const apiKey = await getGeminiApiKey();
    // Find relevant image for this section
    const sectionImage = enhancedImages.find(img => img.context === sectionConfig.type ||
        (sectionConfig.type === 'hero' && img.context === 'hero') ||
        (sectionConfig.type === 'services' && img.context === 'services'));
    const prompt = `Generate HTML for a single website section. Use Tailwind CSS 4.0 classes.

SECTION TYPE: ${sectionConfig.type}
SECTION ID: ${sectionConfig.id}
DESIGN STYLE: ${blueprint.designStyle}
CONTENT HINTS: ${sectionConfig.contentHints}

BRAND DATA:
- Business: ${manifest.businessName}
- Headline: ${manifest.heroHeadline}
- Subheadline: ${manifest.heroSubheadline}
- CTA: ${manifest.ctaText}
- Services: ${JSON.stringify(manifest.services)}
- Phone: ${manifest.contactPhone || 'Not available'}
- Email: ${manifest.contactEmail || 'Not available'}
- Address: ${manifest.contactAddress || 'Not available'}

COLOR SCHEME:
- Primary: ${blueprint.colorScheme.primary}
- Secondary: ${blueprint.colorScheme.secondary}
- Accent: ${blueprint.colorScheme.accent}

FONTS:
- Headlines: ${manifest.fontHeadline}
- Body: ${manifest.fontBody}

${sectionImage ? `IMAGE TO USE: ${sectionImage.enhancedUrl || sectionImage.originalUrl}` : 'Use placeholder: https://placehold.co/800x600/1e293b/475569?text=Image'}

SECTION-SPECIFIC REQUIREMENTS:
${sectionConfig.type === 'hero' ? `
- Full height section (min-h-screen)
- Large headline with gradient or bold text
- Subheadline addressing customer pain
- Primary CTA button + optional secondary
- Trust indicators if available
` : ''}
${sectionConfig.type === 'services' ? `
- Card grid layout (responsive)
- Icon or image for each service
- Service name and brief description
- Hover effects on cards
` : ''}
${sectionConfig.type === 'contact' ? `
- Contact form (name, email, phone, message)
- Display phone/email/address
- Business hours if known
- Map placeholder optional
` : ''}
${sectionConfig.type === 'about' ? `
- Split layout (text + image)
- Company story/mission
- Trust indicators
` : ''}
${sectionConfig.type === 'cta' ? `
- Dark or gradient background
- Compelling headline
- Single focused CTA
` : ''}

OUTPUT: Return ONLY the HTML for this section wrapped in a <section id="${sectionConfig.id}"> tag.
No explanation, no markdown code blocks - just raw HTML.`;
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    maxOutputTokens: 4096,
                    temperature: 0.6,
                    candidateCount: 1
                }
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            // Check for rate limit
            if (response.status === 429) {
                console.warn(`[Pipeline:Generator] Rate limited on ${sectionConfig.id}: ${errorText}`);
                throw new Error(`RATE_LIMIT:${sectionConfig.id}`);
            }
            throw new Error(`Section generation error: ${response.status} - ${errorText}`);
        }
        const data = await response.json();
        let html = ((_e = (_d = (_c = (_b = (_a = data.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.text) || '';
        // Clean up the HTML - remove markdown code blocks if present
        html = html.replace(/```html?\s*/gi, '').replace(/```\s*/gi, '').trim();
        // Ensure it has a section wrapper
        if (!html.includes(`id="${sectionConfig.id}"`)) {
            html = `<section id="${sectionConfig.id}" class="py-20">\n${html}\n</section>`;
        }
        console.log(`[Pipeline:Generator] Section ${sectionConfig.id} generated (${html.length} chars)`);
        return {
            id: sectionConfig.id,
            type: sectionConfig.type,
            html,
            success: true
        };
    }
    catch (error) {
        console.error(`[Pipeline:Generator] Error generating ${sectionConfig.id}:`, error);
        return {
            id: sectionConfig.id,
            type: sectionConfig.type,
            html: `<section id="${sectionConfig.id}" class="py-20 bg-gray-100"><div class="max-w-4xl mx-auto text-center"><p class="text-gray-500">Section: ${sectionConfig.type}</p></div></section>`,
            success: false,
            error: error.message
        };
    }
}
/**
 * Step 4: Generate sections in parallel with concurrency control
 * Limits concurrent requests to avoid rate limits
 */
async function generateSectionsParallel(blueprint, manifest, enhancedImages, maxConcurrency = 2) {
    console.log(`[Pipeline:Parallel] Generating ${blueprint.sections.length} sections (concurrency: ${maxConcurrency})`);
    const results = [];
    const queue = [...blueprint.sections].sort((a, b) => a.priority - b.priority);
    // Process in batches
    while (queue.length > 0) {
        const batch = queue.splice(0, maxConcurrency);
        const batchPromises = batch.map(section => generateSection(section, manifest, blueprint, enhancedImages));
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        // Small delay between batches to respect rate limits
        if (queue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }
    const successCount = results.filter(r => r.success).length;
    console.log(`[Pipeline:Parallel] Generated ${successCount}/${results.length} sections successfully`);
    return results;
}
/**
 * Step 5: Global Orchestrator - Assemble final HTML from components
 */
function assembleHTML(manifest, blueprint, sections) {
    console.log('[Pipeline:Orchestrator] Assembling final HTML...');
    // Sort sections by their original priority
    const sortedSections = [...sections].sort((a, b) => {
        const aConfig = blueprint.sections.find(s => s.id === a.id);
        const bConfig = blueprint.sections.find(s => s.id === b.id);
        return ((aConfig === null || aConfig === void 0 ? void 0 : aConfig.priority) || 99) - ((bConfig === null || bConfig === void 0 ? void 0 : bConfig.priority) || 99);
    });
    // Generate navbar HTML
    const navHTML = `
<nav class="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="flex justify-between items-center h-16">
      <a href="#" class="text-xl font-bold" style="color: ${blueprint.colorScheme.primary}">${manifest.businessName}</a>
      <div class="hidden md:flex items-center gap-8">
        ${blueprint.navLinks.map(link => `
          <a href="${link.href}" class="text-gray-600 hover:text-gray-900 transition-colors">${link.label}</a>
        `).join('')}
        <a href="#contact" class="px-4 py-2 rounded-lg text-white transition-all hover:opacity-90" style="background: ${blueprint.colorScheme.primary}">${manifest.ctaText}</a>
      </div>
      <button class="md:hidden p-2" onclick="document.getElementById('mobile-menu').classList.toggle('hidden')">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
      </button>
    </div>
    <div id="mobile-menu" class="hidden md:hidden pb-4">
      ${blueprint.navLinks.map(link => `
        <a href="${link.href}" class="block py-2 text-gray-600">${link.label}</a>
      `).join('')}
    </div>
  </div>
</nav>`;
    // Generate footer HTML
    const footerHTML = `
<footer class="bg-gray-900 text-white py-12">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="grid md:grid-cols-3 gap-8">
      <div>
        <h3 class="text-xl font-bold mb-4">${manifest.businessName}</h3>
        <p class="text-gray-400">${manifest.tagline}</p>
      </div>
      <div>
        <h4 class="font-semibold mb-4">Quick Links</h4>
        <ul class="space-y-2">
          ${blueprint.navLinks.map(link => `
            <li><a href="${link.href}" class="text-gray-400 hover:text-white transition-colors">${link.label}</a></li>
          `).join('')}
        </ul>
      </div>
      <div>
        <h4 class="font-semibold mb-4">Contact</h4>
        <ul class="space-y-2 text-gray-400">
          ${manifest.contactPhone ? `<li>${manifest.contactPhone}</li>` : ''}
          ${manifest.contactEmail ? `<li>${manifest.contactEmail}</li>` : ''}
          ${manifest.contactAddress ? `<li>${manifest.contactAddress}</li>` : ''}
        </ul>
      </div>
    </div>
    <div class="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
      <p>&copy; ${new Date().getFullYear()} ${manifest.businessName}. All rights reserved.</p>
    </div>
  </div>
</footer>`;
    // Tailwind config script with custom colors
    const tailwindConfig = `
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          primary: '${blueprint.colorScheme.primary}',
          secondary: '${blueprint.colorScheme.secondary}',
          accent: '${blueprint.colorScheme.accent}'
        },
        fontFamily: {
          headline: ['${manifest.fontHeadline}', 'sans-serif'],
          body: ['${manifest.fontBody}', 'sans-serif']
        }
      }
    }
  }
</script>`;
    // Assemble the final HTML
    const finalHTML = `
<!-- Tailwind Config -->
${tailwindConfig}

<!-- Navigation -->
${navHTML}

<!-- Main Content -->
<main class="pt-16">
${sortedSections.map(s => s.html).join('\n\n')}
</main>

<!-- Footer -->
${footerHTML}

<!-- Smooth Scroll Script -->
<script>
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
</script>
`.trim();
    console.log(`[Pipeline:Orchestrator] Final HTML assembled (${finalHTML.length} chars)`);
    return finalHTML;
}
/**
 * Master Pipeline Orchestrator - Runs the full modular pipeline
 * Coordinates all steps and handles errors gracefully
 * NOTE: Kept for backwards compatibility - V2 uses premium monolithic generation
 */
async function _runModularPipeline(siteIdentity, category, enhancedImages) {
    console.log('[Pipeline] Starting modular generation pipeline...');
    const startTime = Date.now();
    const thinkingLog = [];
    // Step 1: Lite Scout - Extract BrandManifest
    thinkingLog.push('Step 1: Extracting brand identity with Lite Scout...');
    const manifest = await extractBrandManifest(siteIdentity, category);
    thinkingLog.push(`Brand: ${manifest.businessName}, Colors: ${manifest.primaryColor}`);
    // Step 2: Thinking Architect - Create Blueprint
    thinkingLog.push('Step 2: Planning site structure with Architect...');
    const blueprint = await createSiteBlueprint(manifest, siteIdentity, category);
    thinkingLog.push(`Blueprint: ${blueprint.designStyle} style, ${blueprint.sections.length} sections planned`);
    // Step 3 & 4: Parallel Section Generation
    thinkingLog.push('Step 3: Generating sections in parallel...');
    const sections = await generateSectionsParallel(blueprint, manifest, enhancedImages, 2);
    const successSections = sections.filter(s => s.success).length;
    thinkingLog.push(`Generated ${successSections}/${sections.length} sections successfully`);
    // Step 5: Assemble Final HTML
    thinkingLog.push('Step 4: Assembling final HTML...');
    const html = assembleHTML(manifest, blueprint, sections);
    const duration = Date.now() - startTime;
    thinkingLog.push(`Pipeline completed in ${duration}ms`);
    console.log(`[Pipeline] Completed in ${duration}ms`);
    return {
        html,
        manifest,
        blueprint,
        thinking: thinkingLog.join('\n')
    };
}
void _runModularPipeline; // Suppress unused warning - kept for backwards compatibility
// Site Modernization Prompt - Preserves real content, no hallucination
// Updated for Gemini 3 Flash with multimodal analysis and adaptive thinking
// NOTE: This is kept for reference but the modular pipeline now uses smaller, focused prompts
const _SITE_MODERNIZATION_INSTRUCTION_REFERENCE = `
You are the "Site Modernization Agent" powered by Gemini 3 Flash - a premium web designer who creates stunning modern versions of existing websites while preserving their authentic content.

# MULTIMODAL ANALYSIS MODE
If a screenshot of the original site is provided, analyze it carefully:
- Study the original layout structure and navigation patterns
- Note the visual hierarchy and how sections are organized
- Identify the color usage and contrast patterns
- Observe typography choices and spacing
- Your goal is to KEEP THE STRUCTURAL FAMILIARITY but UPGRADE the visual language to a 2026 modern aesthetic

The modernized site should feel like a natural evolution of the original, not a jarring departure.
Business owners should immediately recognize their website's "DNA" - just elevated.

# CRITICAL CONSTRAINT: NO HALLUCINATION
You will receive a SiteIdentity object containing REAL content from the client's existing website.

## SOURCE OF TRUTH
You MUST ONLY use text from:
- siteIdentity.fullCopy (the actual page content)
- siteIdentity.services (their real service names)
- siteIdentity.businessName (their actual business name)
- siteIdentity.contactInfo (their real contact details)

## VISUAL VIBE ALIGNMENT
The siteIdentity.visualVibe describes the brand's personality (e.g., "rugged and industrial" or "soft and feminine").
- Choose fonts that match this vibe
- Choose imagery prompts that align with this mood
- The modernized site should feel like a natural evolution, not a jarring rebrand

## CONTENT SPARSITY HANDLING
Check siteIdentity.contentSparsity:

### If "sparse" (< 500 chars of content):
You MAY expand the existing text using sales psychology while keeping ALL original facts intact.
- Use AIDA framework: Attention, Interest, Desire, Action
- Expand service descriptions with benefit-focused language
- Add compelling CTAs based on the business type
- DO NOT invent specific facts (numbers, awards, team names)
- Mark expanded sections with a subtle "✏️ Customize this" indicator

### If "moderate" or "rich":
Strictly use only the extracted text. No expansion.

## FORBIDDEN (DO NOT INVENT)
- Statistics or specific numbers (unless in fullCopy)
- Testimonials with names (unless in fullCopy)
- Team member names (unless in fullCopy)
- Awards or certifications (unless in fullCopy)
- Specific pricing (unless in fullCopy)

# CSS VARIABLES (Brand Continuity)
Create CSS custom properties from siteIdentity.primaryColors:
\`\`\`css
:root {
  --color-primary: [primaryColors[0]];
  --color-secondary: [primaryColors[1] || slightly darker primary];
  --color-accent: [primaryColors[2] || lighter variant];
}
\`\`\`

# FUNCTIONAL NAVIGATION (No Broken Links)
Build navigation using siteIdentity.navigation array:
- Each nav link MUST use the exact href from the array
- Each href must correspond to a section id in your HTML
- Example: { label: "Services", href: "#services" } requires <section id="services">
- Render as glass-morphism fixed navbar

# DESIGN STYLES

## saas-modern
- Clean geometric layouts with ample whitespace
- Gradient CTAs (primary to secondary): bg-gradient-to-r from-[--color-primary] to-[--color-secondary]
- Metric/stat counters where data exists in fullCopy
- Subtle dot-grid or gradient mesh backgrounds
- Inter or SF Pro typography (unless vibe suggests otherwise)
- Floating cards with soft shadows

## bento-grid
- Asymmetric card layouts using CSS Grid
- Mixed card sizes: col-span-2, row-span-2 variations
- Large rounded corners: rounded-3xl (24px)
- Cards with subtle borders and hover:shadow-2xl
- Proportional spacing system (8px base)
- Playful but organized visual hierarchy

## high-end-minimal
- Generous whitespace: py-32 md:py-48 for sections
- Serif headlines: Playfair Display or similar
- Very thin borders and hairlines
- Muted, desaturated color palette
- Elegant micro-interactions
- Photography-forward with subtle overlays

# STACK
- HTML5 semantic markup
- Tailwind CSS 4.0 via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Framer Motion via CDN for animations
- All images use data-prompt for later AI generation

# OUTPUT FORMAT
1. <thought> block explaining:
   - How you interpreted the visualVibe
   - Which fonts you chose and why
   - How you handled content sparsity (if applicable)
   - How you used the SiteIdentity content
2. [CODE_UPDATE] ... [/CODE_UPDATE] containing full HTML body content
3. NO <html>, <head>, or <body> tags - only body inner content
4. Include Tailwind config with custom colors in a <script> block

# REQUIRED SECTIONS (Using extracted content)
1. **Hero** - Use h1/tagline from fullCopy, businessName prominently displayed
2. **Services** - Use siteIdentity.services with descriptions mined from fullCopy
3. **About** - Extract from fullCopy sections containing "about", "story", "mission"
4. **Contact** - Use siteIdentity.contactInfo for phone/email/address
5. **Footer** - Use siteIdentity.socialLinks, copyright with businessName

# OPTIONAL SECTIONS (Only if content exists in fullCopy)
- Testimonials (if quotes/reviews found)
- Team (if staff names found)
- Gallery/Portfolio (if project names found)
- FAQ (if Q&A patterns found)
`;
void _SITE_MODERNIZATION_INSTRUCTION_REFERENCE; // Suppress unused warning
/**
 * Determine design style based on visual vibe and category
 * NOTE: Kept for reference, but the modular pipeline has Gemini determine style in createSiteBlueprint
 */
function _determineStyleFromVibeAndCategory(vibe, category) {
    const vibeLower = vibe.toLowerCase();
    const categoryLower = category.toLowerCase();
    // Vibe-based selection (takes priority)
    if (vibeLower.includes('minimal') || vibeLower.includes('elegant') || vibeLower.includes('luxury') || vibeLower.includes('sophisticated')) {
        return 'high-end-minimal';
    }
    if (vibeLower.includes('modern') || vibeLower.includes('tech') || vibeLower.includes('clean') || vibeLower.includes('geometric')) {
        return 'saas-modern';
    }
    if (vibeLower.includes('playful') || vibeLower.includes('creative') || vibeLower.includes('bold') || vibeLower.includes('dynamic')) {
        return 'bento-grid';
    }
    // Category fallback
    if (['tech', 'software', 'saas', 'startup'].some(k => categoryLower.includes(k))) {
        return 'saas-modern';
    }
    if (['luxury', 'spa', 'hotel', 'real estate', 'law', 'finance'].some(k => categoryLower.includes(k))) {
        return 'high-end-minimal';
    }
    // Default to bento-grid for most service businesses
    return 'bento-grid';
}
void _determineStyleFromVibeAndCategory; // Suppress unused warning
/**
 * Extract thought block from response
 * NOTE: Kept for backwards compatibility, but modular pipeline builds thinking log differently
 */
function _extractThought(text) {
    const match = text.match(/<thought>([\s\S]*?)<\/thought>/);
    return match ? match[1].trim() : '';
}
void _extractThought; // Suppress unused warning
/**
 * Extract code from [CODE_UPDATE] tags or markdown code blocks
 * NOTE: Kept for backwards compatibility, but modular pipeline assembles HTML directly
 */
function _extractCodeUpdate(text) {
    // Try [CODE_UPDATE] tags first
    const codeUpdateMatch = text.match(/\[CODE_UPDATE\]([\s\S]*?)\[\/CODE_UPDATE\]/);
    if (codeUpdateMatch) {
        let html = codeUpdateMatch[1].trim();
        // Strip <body> wrapper tags if present
        html = html.replace(/^<body[^>]*>/i, '').replace(/<\/body>$/i, '').trim();
        return html;
    }
    // Fallback: Try markdown code blocks (```html ... ``` or ``` ... ```)
    const markdownMatch = text.match(/```(?:html)?\s*([\s\S]*?)```/);
    if (markdownMatch) {
        let html = markdownMatch[1].trim();
        // Strip <body> wrapper tags if present
        html = html.replace(/^<body[^>]*>/i, '').replace(/<\/body>$/i, '').trim();
        return html;
    }
    return '';
}
void _extractCodeUpdate; // Suppress unused warning
// ============================================
// PREMIUM SITE MODERNIZATION V3.0 (Deep-Multimodal Pipeline)
// Uses Deep Scraper + Vision API + Gemini 2.5 Flash with Thinking
// ============================================
// Import post-processor for placeholder injection
const postProcessor_1 = require("../processing/postProcessor");
/**
 * Premium modernization prompt V3.0 - Deep-Multimodal with placeholder system
 * Uses Tailwind 4.0, glassmorphism, and intelligent image placement
 */
const PREMIUM_MODERNIZATION_PROMPT = `
You are an elite web designer creating a stunning, modern website redesign using the Deep-Multimodal Pipeline.

# CRITICAL: ZERO HALLUCINATION POLICY
You have been given REAL content extracted from the client's existing website via Vision API and multi-page crawling.
- EVERY piece of text must come from the provided data
- DO NOT invent testimonials, team members, statistics, awards, or any content
- If data is missing for a section, OMIT that section entirely - do not make things up
- Use EXACT names from testimonials (like "Olivia Conetta", "Kaitlin Marie") - NEVER generic names like "Jane Doe"
- The extractedFacts[] contain OCR-verified text from images - these are REAL and can be used

# PLACEHOLDER SYSTEM (CRITICAL)
Instead of embedding image URLs directly, use these EXACT placeholders:

## Logo
- Use: [[ID_REAL_LOGO_HERE]] for the logo src attribute
- Example: <img src="[[ID_REAL_LOGO_HERE]]" alt="Logo" class="h-10">

## Hero Images
- Use: [[ID_HERO_1_HERE]], [[ID_HERO_2_HERE]], etc.
- Example: <img src="[[ID_HERO_1_HERE]]" alt="Hero" class="w-full h-96 object-cover">

## Service Images
- Use: [[ID_SERVICE_IMG_1_HERE]], [[ID_SERVICE_IMG_2_HERE]], etc.
- Maps to images with service-related semantic captions

## Gallery Images
- Use: [[ID_GALLERY_1_HERE]], [[ID_GALLERY_2_HERE]], etc.
- For portfolio/work samples

## Team/About Images
- Use: [[ID_TEAM_1_HERE]], [[ID_TEAM_2_HERE]], etc.

## Color Variables
- Use CSS variables: var(--color-primary), var(--color-secondary), var(--color-accent)
- These will be injected with real extracted colors (including Vision API accent)

### PLACEHOLDER RULES
- NEVER use placeholder.com, example.com, or unsplash URLs
- NEVER embed data:image URLs directly - use the [[ID_*]] placeholders
- If an image category doesn't exist, omit the image entirely
- Post-processing will replace all [[ID_*]] with real assets

# DESIGN REQUIREMENTS: SaaS-GLOSSY AESTHETIC

## Tailwind 4.0 Setup
Include this at the start:
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
      },
      backdropBlur: { xl: '24px' },
      borderRadius: { '3xl': '24px', '4xl': '32px' }
    }
  }
}
</script>

## Glassmorphism Components
- Navigation: fixed top-0 z-50 backdrop-blur-xl bg-white/5 border-b border-white/10
- Floating Cards: rounded-3xl shadow-2xl bg-white/5 backdrop-blur-xl border border-white/10
- Gradient CTAs: bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] shadow-xl shadow-primary/25

## CSS Animations (REQUIRED)
Include this exact <style> block:

<style>
:root {
  --color-primary: #3B82F6;
  --color-secondary: #1E40AF;
  --color-accent: #60A5FA;
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
}
.animate-fade-in-up { animation: fadeInUp 0.8s ease-out forwards; }
.animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
.animate-slide-in-left { animation: slideInLeft 0.8s ease-out forwards; }
.animate-float { animation: float 3s ease-in-out infinite; }
.animation-delay-100 { animation-delay: 100ms; opacity: 0; }
.animation-delay-200 { animation-delay: 200ms; opacity: 0; }
.animation-delay-300 { animation-delay: 300ms; opacity: 0; }
.animation-delay-400 { animation-delay: 400ms; opacity: 0; }
.animation-delay-500 { animation-delay: 500ms; opacity: 0; }
.animation-delay-600 { animation-delay: 600ms; opacity: 0; }
.glass { backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
.gradient-text {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
html { scroll-behavior: smooth; }
</style>

Apply staggered animation delays (100ms, 200ms, 300ms) to section children for fluid premium reveals.

## Design Polish
- rounded-3xl corners on cards and images
- shadow-2xl with hover:shadow-3xl transitions
- Generous whitespace: py-24 md:py-32 for sections
- Subtle dot-grid or gradient mesh backgrounds
- smooth-scroll navigation

## Semantic Image Placement
Use the semanticCaption from images to place them appropriately:
- Images with "hero"/"banner" captions → Hero section
- Images with "service"/"work"/"equipment" captions → Services section
- Images with "team"/"staff" captions → About/Team section
- Images with "customer"/"review" captions → Testimonials section

## Required Sections (ONLY if data exists)
1. **Hero**: [[ID_HERO_1_HERE]], businessName, tagline with gradient-text
2. **Services**: services[] with [[ID_SERVICE_IMG_N_HERE]] - modern cards with hover effects
3. **About**: coreValues[], pages[] content - use [[ID_TEAM_1_HERE]] if available
4. **Testimonials**: testimonials[] with REAL names - NEVER make up names
5. **Team**: ONLY if teamMembers[] has data
6. **Contact**: contactInfo (phone, email, address)
7. **Footer**: socialLinks, businessHours, copyright with businessName

## Use Extracted Facts
If extractedFacts[] contains data like "Est. 2005" or "Award Winner", incorporate these into the hero or about sections as trust signals.

# OUTPUT FORMAT
Return ONLY the HTML body content wrapped in [CODE_UPDATE]...[/CODE_UPDATE]
- Start with Tailwind CDN script
- Include tailwind.config customization
- Include <style> block with CSS variables and animations
- Use Tailwind CSS classes throughout (Tailwind 4.0 compatible)
- Apply animation classes with staggered delays
- NO <html>, <head>, or <body> tags - only body inner content
- End with smooth scroll enhancement script
`;
/**
 * Generate premium modernized site HTML using Gemini 2.5 Flash with Thinking
 * Uses placeholder system for reliable asset injection
 */
async function generatePremiumModernizedSite(siteIdentity, category, generatedImages) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
    const apiKey = await getGeminiApiKey();
    // Build content summary for the prompt
    const testimonialNames = ((_a = siteIdentity.testimonials) === null || _a === void 0 ? void 0 : _a.map(t => t.author).join(', ')) || 'none';
    const serviceNames = ((_b = siteIdentity.services) === null || _b === void 0 ? void 0 : _b.map(s => typeof s === 'string' ? s : s).join(', ')) || 'none';
    // Get semantic image map info if available
    const semanticMap = siteIdentity.semanticImageMap;
    const heroImageCount = ((_c = semanticMap === null || semanticMap === void 0 ? void 0 : semanticMap.hero) === null || _c === void 0 ? void 0 : _c.length) || ((_d = siteIdentity.heroImages) === null || _d === void 0 ? void 0 : _d.length) || 0;
    const serviceImageCount = ((_e = semanticMap === null || semanticMap === void 0 ? void 0 : semanticMap.services) === null || _e === void 0 ? void 0 : _e.length) || 0;
    const galleryImageCount = ((_f = semanticMap === null || semanticMap === void 0 ? void 0 : semanticMap.gallery) === null || _f === void 0 ? void 0 : _f.length) || ((_g = siteIdentity.galleryImages) === null || _g === void 0 ? void 0 : _g.length) || 0;
    const teamImageCount = ((_h = semanticMap === null || semanticMap === void 0 ? void 0 : semanticMap.about) === null || _h === void 0 ? void 0 : _h.length) || 0;
    // Build AI-generated images section if available
    const hasGeneratedImages = generatedImages && (generatedImages.hero ||
        generatedImages.services.length > 0 ||
        generatedImages.about ||
        generatedImages.gallery.length > 0);
    const generatedImagesSection = hasGeneratedImages ? `
## AI-GENERATED IMAGES (USE THESE EXACT URLs - DO NOT USE PLACEHOLDERS)
CRITICAL: These are real, AI-generated images. Use these EXACT URLs in img src attributes.
DO NOT use placehold.co, placeholder.com, or any other placeholder service.

${(generatedImages === null || generatedImages === void 0 ? void 0 : generatedImages.hero) ? `- Hero Image: ${generatedImages.hero}` : ''}
${((_j = generatedImages === null || generatedImages === void 0 ? void 0 : generatedImages.services) === null || _j === void 0 ? void 0 : _j.length) ? generatedImages.services.map((url, i) => `- Service Image ${i + 1}: ${url}`).join('\n') : ''}
${(generatedImages === null || generatedImages === void 0 ? void 0 : generatedImages.about) ? `- About/Team Image: ${generatedImages.about}` : ''}
${((_k = generatedImages === null || generatedImages === void 0 ? void 0 : generatedImages.gallery) === null || _k === void 0 ? void 0 : _k.length) ? generatedImages.gallery.map((url, i) => `- Gallery Image ${i + 1}: ${url}`).join('\n') : ''}

IMPORTANT: Use the above Firebase Storage URLs directly in <img src="..."> tags.
` : '';
    // Build placeholder availability section (fallback if no generated images)
    const availablePlaceholders = hasGeneratedImages ? '' : `
## Available Image Placeholders (ONLY use these)
- Logo: [[ID_REAL_LOGO_HERE]] ${siteIdentity.logoUrl || siteIdentity.logoBase64 ? '✓ AVAILABLE' : '✗ NOT AVAILABLE'}
- Hero Images: [[ID_HERO_1_HERE]] through [[ID_HERO_${heroImageCount}_HERE]] (${heroImageCount} available)
- Service Images: [[ID_SERVICE_IMG_1_HERE]] through [[ID_SERVICE_IMG_${serviceImageCount}_HERE]] (${serviceImageCount} available)
- Gallery Images: [[ID_GALLERY_1_HERE]] through [[ID_GALLERY_${galleryImageCount}_HERE]] (${galleryImageCount} available)
- Team Images: [[ID_TEAM_1_HERE]] through [[ID_TEAM_${teamImageCount}_HERE]] (${teamImageCount} available)
`;
    // Build extracted facts section
    const extractedFacts = siteIdentity.extractedFacts || [];
    const factsSection = extractedFacts.length > 0
        ? `\n## Extracted Facts (OCR-verified from images - USE THESE)\n${JSON.stringify(extractedFacts, null, 2)}`
        : '';
    // Build semantic captions section for intelligent image placement
    const semanticCaptions = [
        ...(((_l = semanticMap === null || semanticMap === void 0 ? void 0 : semanticMap.hero) === null || _l === void 0 ? void 0 : _l.map((img, i) => `[[ID_HERO_${i + 1}_HERE]]: ${img.semanticCaption || img.alt || 'Hero image'}`)) || []),
        ...(((_m = semanticMap === null || semanticMap === void 0 ? void 0 : semanticMap.services) === null || _m === void 0 ? void 0 : _m.map((img, i) => `[[ID_SERVICE_IMG_${i + 1}_HERE]]: ${img.semanticCaption || img.alt || 'Service image'}`)) || []),
        ...(((_o = semanticMap === null || semanticMap === void 0 ? void 0 : semanticMap.gallery) === null || _o === void 0 ? void 0 : _o.map((img, i) => `[[ID_GALLERY_${i + 1}_HERE]]: ${img.semanticCaption || img.alt || 'Gallery image'}`)) || []),
    ].join('\n');
    const captionsSection = semanticCaptions
        ? `\n## Semantic Image Captions (for intelligent placement)\n${semanticCaptions}`
        : '';
    // Build the full prompt with site identity
    const siteDataSection = `
# SITE IDENTITY DATA (Your ONLY source of content)

## Basic Info
- Business Name: ${siteIdentity.businessName}
- Tagline: ${siteIdentity.tagline || 'No tagline available'}
- Category: ${category}
- Visual Vibe: ${siteIdentity.visualVibe || 'professional and modern'}
- Accent Color: ${siteIdentity.accentColor || 'use primaryColors[2]'}

## Brand Colors (USE ALL via CSS variables)
Primary: ${((_p = siteIdentity.primaryColors) === null || _p === void 0 ? void 0 : _p[0]) || '#3B82F6'}
Secondary: ${((_q = siteIdentity.primaryColors) === null || _q === void 0 ? void 0 : _q[1]) || '#1E40AF'}
Accent: ${siteIdentity.accentColor || ((_r = siteIdentity.primaryColors) === null || _r === void 0 ? void 0 : _r[2]) || '#60A5FA'}

${generatedImagesSection}
${availablePlaceholders}

## Navigation Links
${JSON.stringify(siteIdentity.navigation, null, 2)}
${factsSection}
${captionsSection}

## Services (REAL services from the site)
${JSON.stringify(siteIdentity.services || [], null, 2)}

## Testimonials (REAL testimonials - use these EXACT names: ${testimonialNames})
${JSON.stringify(siteIdentity.testimonials || [], null, 2)}

## Team Members
${JSON.stringify(siteIdentity.teamMembers || [], null, 2)}

## Core Values/Mission
${JSON.stringify(siteIdentity.coreValues || [], null, 2)}

## Contact Information
${JSON.stringify(siteIdentity.contactInfo || {}, null, 2)}

## Social Links
${JSON.stringify(siteIdentity.socialLinks || {}, null, 2)}

## Business Hours
${siteIdentity.businessHours || 'Not specified'}

## Full Page Content (for additional text if needed)
${((_s = siteIdentity.fullCopy) === null || _s === void 0 ? void 0 : _s.slice(0, 3000)) || 'No additional content'}

---

# FINAL REMINDERS
1. ${hasGeneratedImages ? 'USE THE AI-GENERATED IMAGE URLs provided above - DO NOT use placeholders or placeholder services' : 'Use [[ID_*_HERE]] placeholders for ALL images - they will be replaced with real URLs'}
2. Use REAL testimonials with names: ${testimonialNames}
3. Use REAL services: ${serviceNames}
4. Include ALL CSS animations with staggered delays
5. Use CSS variables for colors: var(--color-primary), var(--color-secondary), var(--color-accent)
6. Apply rounded-3xl, shadow-2xl, backdrop-blur-xl for SaaS-glossy look
7. If extractedFacts has "Est." dates or awards, use them as trust signals
8. ${hasGeneratedImages ? 'CRITICAL: The hero section MUST use the AI-generated hero image URL. Service sections MUST use service image URLs.' : 'Use placeholder images that will be injected later'}`;
    const fullPrompt = PREMIUM_MODERNIZATION_PROMPT + siteDataSection;
    console.log('[PremiumGen v3.0] Generating with Gemini 2.5 Flash + Thinking...');
    // Try Gemini 2.5 Flash with thinking first, fall back to 2.0 Flash
    let responseText = '';
    let thinkingOutput = '';
    try {
        // Call Gemini 2.5 Flash API with thinking
        const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=' + apiKey;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    maxOutputTokens: 65536,
                    temperature: 0.7,
                    candidateCount: 1,
                    thinkingConfig: {
                        thinkingBudget: 8192
                    }
                }
            })
        });
        if (!response.ok) {
            throw new Error(`Gemini 2.5 Flash API error: ${response.status}`);
        }
        const data = await response.json();
        // Extract thinking and response parts
        const parts = ((_v = (_u = (_t = data.candidates) === null || _t === void 0 ? void 0 : _t[0]) === null || _u === void 0 ? void 0 : _u.content) === null || _v === void 0 ? void 0 : _v.parts) || [];
        for (const part of parts) {
            if (part.thought) {
                thinkingOutput += part.text + '\n';
            }
            else if (part.text) {
                responseText += part.text;
            }
        }
        console.log('[PremiumGen v3.0] Gemini 2.5 Flash response received, thinking:', thinkingOutput.length > 0);
    }
    catch (error) {
        console.warn('[PremiumGen v3.0] Gemini 2.5 Flash failed, falling back to 2.0 Flash:', error);
        // Fallback to Gemini 2.0 Flash
        const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=' + apiKey;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    maxOutputTokens: 32768,
                    temperature: 0.7,
                    candidateCount: 1
                }
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[PremiumGen] Gemini 2.0 Flash API error:', errorText);
            throw new Error('Gemini API error: ' + response.status + ' - ' + errorText);
        }
        const data = await response.json();
        responseText = ((_0 = (_z = (_y = (_x = (_w = data.candidates) === null || _w === void 0 ? void 0 : _w[0]) === null || _x === void 0 ? void 0 : _x.content) === null || _y === void 0 ? void 0 : _y.parts) === null || _z === void 0 ? void 0 : _z[0]) === null || _0 === void 0 ? void 0 : _0.text) || '';
        thinkingOutput = 'Fallback to Gemini 2.0 Flash (no thinking mode)';
    }
    console.log('[PremiumGen v3.0] Response length:', responseText.length);
    console.log('[PremiumGen v3.0] Response preview (first 500 chars):', responseText.substring(0, 500));
    // Extract HTML from [CODE_UPDATE] tags
    let html = '';
    const codeMatch = responseText.match(/\[CODE_UPDATE\]([\s\S]*?)\[\/CODE_UPDATE\]/);
    if (codeMatch) {
        html = codeMatch[1].trim();
        console.log('[PremiumGen v3.0] Extracted from [CODE_UPDATE] tags, length:', html.length);
    }
    else {
        // Fallback: try markdown code blocks - use GREEDY match to get all content
        // First try to find all code blocks
        const allCodeBlocks = responseText.match(/```(?:html)?\s*([\s\S]*?)```/g);
        console.log('[PremiumGen v3.0] Found code blocks:', (allCodeBlocks === null || allCodeBlocks === void 0 ? void 0 : allCodeBlocks.length) || 0);
        if (allCodeBlocks && allCodeBlocks.length > 0) {
            // Combine all code blocks - some might be CSS, some HTML
            const combinedContent = [];
            for (const block of allCodeBlocks) {
                const content = block.replace(/```(?:html)?\s*/, '').replace(/```$/, '').trim();
                console.log('[PremiumGen v3.0] Code block preview:', content.substring(0, 100));
                combinedContent.push(content);
            }
            html = combinedContent.join('\n\n');
            console.log('[PremiumGen v3.0] Combined all code blocks, total length:', html.length);
        }
        else {
            // Last resort: use the whole response if it looks like HTML
            if (responseText.includes('<section') || responseText.includes('<div') || responseText.includes('<nav')) {
                // Try to extract just the HTML part - everything from first < to end
                const htmlStart = responseText.indexOf('<');
                if (htmlStart >= 0) {
                    html = responseText.substring(htmlStart).trim();
                    console.log('[PremiumGen v3.0] Extracted raw HTML from response, length:', html.length);
                }
                else {
                    html = responseText.trim();
                }
            }
        }
    }
    // Validate that we have actual HTML content (not just CSS)
    const hasVisibleContent = html.includes('<section') || html.includes('<div') || html.includes('<nav') || html.includes('<main');
    console.log('[PremiumGen v3.0] Has visible HTML content:', hasVisibleContent);
    console.log('[PremiumGen v3.0] HTML starts with:', html.substring(0, 200));
    if (!html || html.length < 500) {
        console.error('[PremiumGen v3.0] Invalid HTML output, length:', html.length);
        console.error('[PremiumGen v3.0] Full response for debugging:', responseText.substring(0, 2000));
        throw new Error('Generated HTML is too short or invalid');
    }
    if (!hasVisibleContent) {
        console.error('[PremiumGen v3.0] HTML has no visible content (only CSS/style)');
        console.error('[PremiumGen v3.0] Full response for debugging:', responseText.substring(0, 3000));
        throw new Error('Generated HTML contains only styles, no visible content');
    }
    // Run post-processing pipeline to inject real assets
    console.log('[PremiumGen v3.0] Running post-processing pipeline...');
    const { html: processedHtml, validation } = (0, postProcessor_1.runPostProcessingPipeline)(html, siteIdentity);
    if (!validation.valid) {
        console.warn('[PremiumGen v3.0] Some placeholders could not be resolved:', validation.remaining);
    }
    console.log('[PremiumGen v3.0] Generation complete, HTML length:', processedHtml.length);
    return {
        html: processedHtml,
        thinking: thinkingOutput || 'Deep-Multimodal Pipeline v3.0 with Vision API enrichment'
    };
}
/**
 * Generate a modernized website from an existing URL (V2.0 - Premium Quality)
 *
 * This function:
 * 1. Uses Deep Scraper to extract comprehensive SiteIdentity (multi-page, testimonials, etc.)
 * 2. Passes the full identity to Gemini with the premium modernization prompt
 * 3. Returns modernized HTML that preserves ALL original content (zero hallucination)
 */
// Handler function for 2nd Gen Functions (called from minimalExports.ts)
async function generateModernizedSiteHandler(req, res) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    // CORS headers already set by wrapper, but ensure they're present
    res.set(corsHeaders);
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { sourceUrl, businessName, category, forceRefresh = false } = req.body;
        // Note: forceRefresh reserved for future caching implementation in deep scraper
        void forceRefresh;
        if (!sourceUrl) {
            res.status(400).json({ error: 'sourceUrl is required' });
            return;
        }
        console.log('[ModernizeSite v3.0] Starting deep-multimodal scrape for:', sourceUrl);
        // 1. Deep scrape the site with Vision API enrichment (v3.0)
        const siteIdentity = await (0, visionOnlyScraper_1.deepScrapeSite)(sourceUrl, {
            maxPages: 8, // Reduced for modernization focus
            maxDepth: 2,
            timeout: 120000,
            // Deep-Multimodal options
            enableVisionOCR: true, // Extract text from logos/images
            enableVisionColors: true, // Extract colors via IMAGE_PROPERTIES
            enableSemanticCaptions: true, // Generate semantic captions
            maxImagesForVision: 15 // Cost control
        });
        // Override business name if provided
        if (businessName) {
            siteIdentity.businessName = businessName;
        }
        console.log('[ModernizeSite v3.0] Deep-multimodal scrape complete:', {
            businessName: siteIdentity.businessName,
            pages: ((_a = siteIdentity.pages) === null || _a === void 0 ? void 0 : _a.length) || 0,
            services: ((_b = siteIdentity.services) === null || _b === void 0 ? void 0 : _b.length) || 0,
            testimonials: ((_c = siteIdentity.testimonials) === null || _c === void 0 ? void 0 : _c.length) || 0,
            teamMembers: ((_d = siteIdentity.teamMembers) === null || _d === void 0 ? void 0 : _d.length) || 0,
            colors: siteIdentity.primaryColors,
            accentColor: siteIdentity.accentColor,
            hasLogo: !!siteIdentity.logoUrl || !!siteIdentity.logoBase64,
            heroImages: ((_e = siteIdentity.heroImages) === null || _e === void 0 ? void 0 : _e.length) || 0,
            galleryImages: ((_f = siteIdentity.galleryImages) === null || _f === void 0 ? void 0 : _f.length) || 0,
            extractedFacts: ((_g = siteIdentity.extractedFacts) === null || _g === void 0 ? void 0 : _g.length) || 0,
            visionAnalysisComplete: siteIdentity.visionAnalysisComplete,
            hasSemanticMap: !!siteIdentity.semanticImageMap,
            hasImagePrompts: !!siteIdentity.imagePrompts
        });
        // 2. Generate AI images using Nano Banana Pro (if image prompts available)
        let generatedImages = { hero: null, services: [], about: null, gallery: [] };
        if (siteIdentity.imagePrompts) {
            console.log('[ModernizeSite v3.0] Generating images with Nano Banana Pro...');
            generatedImages = await generateSiteImages(siteIdentity.imagePrompts, siteIdentity.businessName || 'site');
            // Inject generated images into siteIdentity for HTML generation
            if (generatedImages.hero) {
                siteIdentity.heroImages = [{ url: generatedImages.hero, alt: `${siteIdentity.businessName} hero` }];
            }
            if (generatedImages.services.length > 0) {
                // Add service images to gallery for now (can be used in services section)
                siteIdentity.galleryImages = generatedImages.services.map((url, i) => {
                    var _a;
                    return ({
                        url,
                        alt: `${((_a = siteIdentity.services) === null || _a === void 0 ? void 0 : _a[i]) || 'Service'}`
                    });
                });
            }
            if (generatedImages.about) {
                // Store about image in teamMembers as a generic placeholder
                if (!siteIdentity.teamMembers || siteIdentity.teamMembers.length === 0) {
                    siteIdentity.teamMembers = [{
                            name: 'Our Team',
                            role: siteIdentity.businessName || 'Team',
                            imageUrl: generatedImages.about
                        }];
                }
            }
            console.log('[ModernizeSite v3.0] Images generated:', {
                hero: !!generatedImages.hero,
                services: generatedImages.services.length,
                about: !!generatedImages.about,
                gallery: generatedImages.gallery.length
            });
        }
        // 3. Generate premium modernized site with Gemini 3 Pro + Thinking
        console.log('[ModernizeSite v3.0] Starting Gemini 3 Pro generation with thinking...');
        const { html, thinking } = await generatePremiumModernizedSite(siteIdentity, category || 'general', generatedImages);
        console.log('[ModernizeSite v3.0] Generation complete, HTML length:', html.length);
        // Prepare response (exclude large base64 data)
        const identityForResponse = {
            ...siteIdentity,
            screenshotBase64: undefined,
            logoBase64: undefined,
            pages: (_h = siteIdentity.pages) === null || _h === void 0 ? void 0 : _h.map(p => ({
                url: p.url,
                title: p.title,
                path: p.path
            })),
            // Include v3.0 metadata
            extractedFacts: siteIdentity.extractedFacts,
            accentColor: siteIdentity.accentColor,
            visionAnalysisComplete: siteIdentity.visionAnalysisComplete
        };
        res.json({
            html,
            siteIdentity: identityForResponse,
            designStyle: 'premium-modern',
            thinking,
            pipelineVersion: '3.0-deep-multimodal'
        });
    }
    catch (error) {
        console.error('[ModernizeSite v3.0] Error:', error);
        res.status(500).json({
            error: error.message || 'Failed to modernize site'
        });
    }
}
// ============================================
// TOTAL CONTENT MODERNIZATION V4.0
// Complete Digital Presence Migration
// ============================================
const exhaustiveScraper_1 = require("../scraping/exhaustiveScraper");
/**
 * Total Content Modernization Prompt V4.0
 * Zero-Waste Policy: Migrates 100% of business content into a premium experience
 */
const TOTAL_CONTENT_PROMPT = `
You are an ELITE web designer performing a TOTAL CONTENT MIGRATION. You have been given the COMPLETE digital presence of a business - every page, every fact, every image description.

# ABSOLUTE ZERO-WASTE POLICY
You MUST incorporate 100% of the provided content. This is NOT a redesign - it is a MIGRATION.
- Every service must appear in the Services section
- Every team member must appear in the Team section
- Every testimonial must appear in the Testimonials section (with EXACT names)
- Every FAQ must appear in the FAQ section
- Every hidden gem (awards, founding dates, certifications) must be prominently displayed
- NEVER use "Lorem ipsum" or placeholder text
- NEVER invent content - ONLY use what is provided

# CONTENT MIGRATION RULES

## If the source has a Staff/Team page:
Build a premium "Meet the Team" section with:
- Professional photo placeholders [[ID_TEAM_N_HERE]]
- Name, role, and bio for each person
- Staggered fade-in animations
- Glassmorphism cards

## If the source has an FAQ page:
Build an interactive FAQ accordion with:
- All questions and answers
- Smooth expand/collapse animations
- Grouped by category if possible

## If the source has Equipment/Facility content:
Build a glossy feature showcase with:
- Image gallery with [[ID_GALLERY_N_HERE]] placeholders
- Feature cards with icons
- Hover effects and micro-interactions

## If the source has Reviews/Testimonials:
Build a social proof section with:
- EXACT customer names (like "Olivia Conetta" not "Jane Doe")
- Star ratings if available
- Source attribution (Google, Yelp, etc.)

## If the source has Pricing information:
Build a pricing comparison section with:
- Tier cards with glassmorphism
- Feature lists
- Highlighted "Most Popular" option
- CTA buttons with brand gradient

## If the source has a Blog/News section:
Build a content preview section with:
- Article cards with excerpts
- Publication dates
- "Read More" links

# HIDDEN GEMS INTEGRATION (CRITICAL)
The hiddenGems[] array contains REAL facts discovered via Vision API OCR.
These MUST be prominently displayed:

- type: "founding_date" → Hero badge: "Est. [YEAR]" or "Since [YEAR]"
- type: "award" → Trust section: Award badge with gold styling
- type: "certification" → Footer or Trust section: Certification logos
- type: "statistic" → Stats counter section with animated numbers
- type: "slogan" → Hero subtitle or brand tagline
- type: "location_detail" → Hero or Contact section

# DESIGN SYSTEM: GLASS & GLOW

## Tailwind 4.0 Configuration
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        accent: 'var(--color-accent)',
      },
      backdropBlur: { xl: '24px', '2xl': '40px' },
      borderRadius: { '3xl': '24px', '4xl': '32px' },
      boxShadow: {
        'glow': '0 0 30px rgba(var(--color-accent-rgb), 0.3)',
        'glow-lg': '0 0 60px rgba(var(--color-accent-rgb), 0.4)',
      }
    }
  }
}
</script>

## Glass & Glow Aesthetic
- Backgrounds: backdrop-blur-2xl saturate-150 bg-white/5
- Cards: rounded-3xl shadow-glow bg-gradient-to-br from-white/10 to-white/5 border border-white/10
- Buttons: bg-gradient-to-r from-primary to-accent shadow-glow hover:shadow-glow-lg
- Text glow: drop-shadow-[0_0_20px_var(--color-accent)]
- Mesh gradient backgrounds for sections

## Staggered Scroll Animations
<style>
:root {
  --color-primary: #3B82F6;
  --color-secondary: #1E40AF;
  --color-accent: #60A5FA;
  --color-accent-rgb: 96, 165, 250;
}

/* Entrance Animations */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(40px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeInLeft {
  from { opacity: 0; transform: translateX(-40px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes fadeInRight {
  from { opacity: 0; transform: translateX(40px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes glowPulse {
  0%, 100% { box-shadow: 0 0 20px rgba(var(--color-accent-rgb), 0.3); }
  50% { box-shadow: 0 0 40px rgba(var(--color-accent-rgb), 0.6); }
}

/* Animation Classes */
.animate-fade-in-up { animation: fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
.animate-fade-in-left { animation: fadeInLeft 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
.animate-fade-in-right { animation: fadeInRight 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
.animate-scale-in { animation: scaleIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
.animate-glow-pulse { animation: glowPulse 2s ease-in-out infinite; }

/* Staggered Delays */
.delay-100 { animation-delay: 100ms; opacity: 0; }
.delay-200 { animation-delay: 200ms; opacity: 0; }
.delay-300 { animation-delay: 300ms; opacity: 0; }
.delay-400 { animation-delay: 400ms; opacity: 0; }
.delay-500 { animation-delay: 500ms; opacity: 0; }
.delay-600 { animation-delay: 600ms; opacity: 0; }
.delay-700 { animation-delay: 700ms; opacity: 0; }
.delay-800 { animation-delay: 800ms; opacity: 0; }

/* Glassmorphism */
.glass {
  backdrop-filter: blur(24px) saturate(150%);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.glass-dark {
  backdrop-filter: blur(24px) saturate(150%);
  -webkit-backdrop-filter: blur(24px) saturate(150%);
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Gradient Text */
.gradient-text {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Mesh Background */
.mesh-bg {
  background-image:
    radial-gradient(at 40% 20%, rgba(var(--color-accent-rgb), 0.3) 0px, transparent 50%),
    radial-gradient(at 80% 0%, rgba(var(--color-primary-rgb), 0.2) 0px, transparent 50%),
    radial-gradient(at 0% 50%, rgba(var(--color-accent-rgb), 0.2) 0px, transparent 50%);
}

html { scroll-behavior: smooth; }
</style>

## Section Animations Pattern
- Hero: animate-fade-in-up
- Services: Cards animate-fade-in-up with delay-100, delay-200, delay-300
- About: Left column animate-fade-in-left, Right column animate-fade-in-right
- Team: Cards animate-scale-in with staggered delays
- Testimonials: animate-fade-in-up with delays
- FAQ: Accordion items animate-fade-in-up
- CTA: animate-scale-in with glow-pulse
- Footer: animate-fade-in-up

# PLACEHOLDER SYSTEM

## Images
- Logo: [[ID_REAL_LOGO_HERE]]
- Hero: [[ID_HERO_1_HERE]], [[ID_HERO_2_HERE]], etc.
- Services: [[ID_SERVICE_IMG_1_HERE]], [[ID_SERVICE_IMG_2_HERE]], etc.
- Gallery: [[ID_GALLERY_1_HERE]], [[ID_GALLERY_2_HERE]], etc.
- Team: [[ID_TEAM_1_HERE]], [[ID_TEAM_2_HERE]], etc.

## Colors (CSS Variables)
- var(--color-primary) - Main brand color
- var(--color-secondary) - Supporting color
- var(--color-accent) - Vibrant accent (Vision API extracted)

# REQUIRED SECTIONS (Build ALL that have data)

1. **Navigation Bar** (Fixed, Glassmorphism)
   - Logo, nav links, CTA button
   - Use consolidatedHeader data

2. **Hero Section** (Full viewport, Mesh background)
   - Business name with gradient-text
   - Tagline/slogan (use hiddenGems slogan if available)
   - Founding badge if hiddenGems has founding_date
   - [[ID_HERO_1_HERE]] with parallax effect
   - Primary CTA with glow

3. **Stats/Trust Section** (If hiddenGems has statistics)
   - Animated counter numbers
   - Awards and certifications badges

4. **Services Section** (Glass cards)
   - ALL services from services[]
   - Service images [[ID_SERVICE_IMG_N_HERE]]
   - Hover effects with scale and glow

5. **About Section** (Two-column layout)
   - Vision/Mission statements
   - Core values list
   - Founding story if available
   - [[ID_TEAM_1_HERE]] or office image

6. **Team Section** (If teamMembers[] has data)
   - ALL team members with photos
   - Glass cards with hover effects
   - Names, roles, bios

7. **Gallery/Portfolio** (If enrichedImages has gallery items)
   - Masonry or grid layout
   - Lightbox functionality
   - [[ID_GALLERY_N_HERE]] images

8. **Testimonials Section** (If testimonials[] has data)
   - EXACT customer names
   - Star ratings
   - Platform attribution
   - Glass cards with quotation marks

9. **FAQ Section** (If faqs[] has data)
   - Accordion with smooth animations
   - ALL questions and answers

10. **Pricing Section** (If pricingInfo[] has data)
    - Tier comparison cards
    - Feature lists with checkmarks
    - Highlighted popular tier

11. **CTA Section** (Gradient background with glow)
    - Strong call to action
    - Contact info

12. **Footer** (Comprehensive)
    - ALL contact info from consolidatedFooter
    - ALL social links
    - Business hours
    - Certifications
    - Legal links (Privacy, Terms)
    - Copyright with business name

# OUTPUT FORMAT
Return ONLY the HTML body content wrapped in [CODE_UPDATE]...[/CODE_UPDATE]
- Start with Tailwind CDN script and config
- Include complete <style> block
- NO <html>, <head>, or <body> tags
- Apply all animations with staggered delays
- Ensure every piece of provided content is included
`;
/**
 * Build the complete data section for Total Content prompt
 */
function buildTotalContentDataSection(dna) {
    var _a;
    // Build hidden gems section
    const hiddenGemsSection = dna.hiddenGems.length > 0
        ? `## Hidden Gems (OCR-Verified - MUST USE)\n${JSON.stringify(dna.hiddenGems, null, 2)}`
        : '## Hidden Gems: None found';
    // Build image availability
    const heroCount = dna.semanticImageMap.hero.length;
    const serviceCount = dna.semanticImageMap.services.length;
    const galleryCount = dna.semanticImageMap.gallery.length;
    const teamCount = dna.semanticImageMap.about.length;
    const imageAvailability = `
## Available Image Placeholders
- Logo: [[ID_REAL_LOGO_HERE]] ${dna.consolidatedHeader.logoUrl ? '✓ AVAILABLE' : '✗ NOT AVAILABLE'}
- Hero Images: ${heroCount} available (use [[ID_HERO_1_HERE]] through [[ID_HERO_${heroCount}_HERE]])
- Service Images: ${serviceCount} available (use [[ID_SERVICE_IMG_1_HERE]] through [[ID_SERVICE_IMG_${serviceCount}_HERE]])
- Gallery Images: ${galleryCount} available (use [[ID_GALLERY_1_HERE]] through [[ID_GALLERY_${galleryCount}_HERE]])
- Team Images: ${teamCount} available (use [[ID_TEAM_1_HERE]] through [[ID_TEAM_${teamCount}_HERE]])
`;
    // Build semantic captions for image placement guidance
    const semanticCaptions = [
        ...dna.semanticImageMap.hero.map((img, i) => `[[ID_HERO_${i + 1}_HERE]]: ${img.semanticCaption || img.alt || 'Hero image'}`),
        ...dna.semanticImageMap.services.map((img, i) => `[[ID_SERVICE_IMG_${i + 1}_HERE]]: ${img.semanticCaption || img.alt || 'Service image'}`),
        ...dna.semanticImageMap.gallery.slice(0, 10).map((img, i) => `[[ID_GALLERY_${i + 1}_HERE]]: ${img.semanticCaption || img.alt || 'Gallery image'}`),
    ].join('\n');
    return `
# UNIVERSAL BUSINESS DNA (Your COMPLETE Source of Truth)

## Identity
- Business Name: ${dna.businessName}
- Tagline: ${dna.tagline || 'No tagline'}
- Brand Personality: ${dna.brandPersonality}
- Visual Vibe: ${dna.visualVibe}

## Brand Colors (MUST USE via CSS variables)
- Primary: ${dna.brandColors.primary}
- Secondary: ${dna.brandColors.secondary}
- Accent (Vision-Extracted): ${dna.brandColors.accent}

${imageAvailability}

## Semantic Image Captions (Use for intelligent placement)
${semanticCaptions}

${hiddenGemsSection}

## Soul (Vision/Mission/Values)
- Vision Statement: ${dna.visionStatement || 'Not available'}
- Mission Statement: ${dna.missionStatement || 'Not available'}
- Core Values: ${JSON.stringify(dna.coreValues)}
- Unique Selling Points: ${JSON.stringify(dna.uniqueSellingPoints)}
- Founding Story: ${dna.foundingStory || 'Not available'}
- Achievements: ${JSON.stringify(dna.achievements)}

## Services (MUST include ALL)
${JSON.stringify(dna.services, null, 2)}

## Pricing Information
${JSON.stringify(dna.pricingInfo, null, 2)}

## Team Members (MUST include ALL with EXACT names)
${JSON.stringify(dna.teamMembers, null, 2)}
Team Culture: ${dna.teamCulture || 'Not specified'}

## Testimonials (MUST include ALL with EXACT customer names)
${JSON.stringify(dna.testimonials, null, 2)}
Review Summary: ${JSON.stringify(dna.reviewSummary)}

## FAQs (MUST include ALL)
${JSON.stringify(dna.faqs, null, 2)}

## Blog/Educational Content
${JSON.stringify(dna.blogPosts)}
Educational Snippets: ${JSON.stringify(dna.educationalContent)}

## Navigation (From consolidated header)
${JSON.stringify(dna.consolidatedHeader.primaryNavigation, null, 2)}
CTA Button: ${JSON.stringify(dna.consolidatedHeader.ctaButton)}

## Contact & Operations
${JSON.stringify(dna.consolidatedFooter.contactInfo, null, 2)}

## Social Links
${JSON.stringify(dna.consolidatedFooter.socialLinks, null, 2)}

## Business Hours
${((_a = dna.consolidatedFooter.businessHours) === null || _a === void 0 ? void 0 : _a.formatted) || 'Not specified'}

## Locations
${JSON.stringify(dna.locations, null, 2)}

## Certifications & Trust Signals
${JSON.stringify(dna.consolidatedFooter.certifications)}

## Legal Pages (Available for linking)
${dna.consolidatedFooter.legalLinks.map(l => `- ${l.label}`).join('\n')}

## Content Statistics
- Total Pages Scraped: ${dna.totalPagesScraped}
- Content Sparsity: ${dna.contentSparsity}
- Vision Analysis Complete: ${dna.visionAnalysisComplete}
- Pipeline Version: ${dna.pipelineVersion}

---

# FINAL CHECKLIST
Before outputting, verify you have included:
□ ALL services from services[]
□ ALL team members with EXACT names
□ ALL testimonials with EXACT customer names
□ ALL FAQs
□ ALL hidden gems (founding dates, awards, certifications)
□ ALL contact information
□ ALL social links
□ Business hours
□ Proper animations with staggered delays
□ Glass & Glow aesthetic throughout
□ No placeholder text or Lorem ipsum
`;
}
/**
 * Generate Total Content Modernized Site
 * Uses Gemini 2.5 Flash with thinking for comprehensive content migration
 */
async function generateTotalContentSite(dna) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const apiKey = await getGeminiApiKey();
    // Build complete prompt
    const dataSection = buildTotalContentDataSection(dna);
    const fullPrompt = TOTAL_CONTENT_PROMPT + dataSection;
    console.log('[TotalContent v4.0] Generating with Gemini 2.5 Flash + Thinking...');
    console.log('[TotalContent v4.0] DNA Summary:', {
        businessName: dna.businessName,
        pagesScraped: dna.totalPagesScraped,
        services: dna.services.length,
        testimonials: dna.testimonials.length,
        teamMembers: dna.teamMembers.length,
        faqs: dna.faqs.length,
        hiddenGems: dna.hiddenGems.length,
        images: dna.enrichedImages.length,
    });
    let responseText = '';
    let thinkingOutput = '';
    try {
        // Call Gemini 2.5 Flash API with thinking
        const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=' + apiKey;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    maxOutputTokens: 65536,
                    temperature: 0.7,
                    candidateCount: 1,
                    thinkingConfig: {
                        thinkingBudget: 12288 // More thinking for comprehensive migration
                    }
                }
            })
        });
        if (!response.ok) {
            throw new Error(`Gemini 2.5 Flash API error: ${response.status}`);
        }
        const data = await response.json();
        // Extract thinking and response parts
        const parts = ((_c = (_b = (_a = data.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) || [];
        for (const part of parts) {
            if (part.thought) {
                thinkingOutput += part.text + '\n';
            }
            else if (part.text) {
                responseText += part.text;
            }
        }
        console.log('[TotalContent v4.0] Response received, thinking length:', thinkingOutput.length);
    }
    catch (error) {
        console.warn('[TotalContent v4.0] Gemini 2.5 Flash failed, falling back to 2.0 Flash:', error);
        // Fallback to Gemini 2.0 Flash
        const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=' + apiKey;
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }],
                generationConfig: {
                    maxOutputTokens: 32768,
                    temperature: 0.7,
                    candidateCount: 1
                }
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[TotalContent] Gemini 2.0 Flash API error:', errorText);
            throw new Error('Gemini API error: ' + response.status + ' - ' + errorText);
        }
        const data = await response.json();
        responseText = ((_h = (_g = (_f = (_e = (_d = data.candidates) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.content) === null || _f === void 0 ? void 0 : _f.parts) === null || _g === void 0 ? void 0 : _g[0]) === null || _h === void 0 ? void 0 : _h.text) || '';
        thinkingOutput = 'Fallback to Gemini 2.0 Flash (no thinking mode)';
    }
    // Extract HTML from [CODE_UPDATE] tags
    let html = '';
    const codeMatch = responseText.match(/\[CODE_UPDATE\]([\s\S]*?)\[\/CODE_UPDATE\]/);
    if (codeMatch) {
        html = codeMatch[1].trim();
    }
    else {
        const mdMatch = responseText.match(/```(?:html)?\s*([\s\S]*?)```/);
        if (mdMatch) {
            html = mdMatch[1].trim();
        }
        else if (responseText.includes('<section') || responseText.includes('<div')) {
            html = responseText.trim();
        }
    }
    if (!html || html.length < 500) {
        console.error('[TotalContent v4.0] Invalid HTML output, length:', html.length);
        throw new Error('Generated HTML is too short or invalid');
    }
    // Convert DNA to SiteIdentity format for post-processor
    const siteIdentity = {
        businessName: dna.businessName,
        tagline: dna.tagline,
        sourceUrl: dna.sourceUrl,
        extractedAt: dna.extractedAt,
        logoUrl: dna.consolidatedHeader.logoUrl,
        logoBase64: dna.consolidatedHeader.logoBase64,
        heroImages: dna.semanticImageMap.hero,
        galleryImages: dna.semanticImageMap.gallery,
        primaryColors: [dna.brandColors.primary, dna.brandColors.secondary],
        accentColor: dna.brandColors.accent,
        navigation: dna.consolidatedHeader.primaryNavigation.map(n => ({
            label: n.label,
            href: n.href,
            isExternal: false
        })),
        pages: dna.semanticPages,
        services: dna.services,
        testimonials: dna.testimonials,
        teamMembers: dna.teamMembers,
        faqs: dna.faqs,
        coreValues: dna.coreValues,
        contactInfo: dna.consolidatedFooter.contactInfo,
        socialLinks: dna.consolidatedFooter.socialLinks,
        businessHours: (_j = dna.consolidatedFooter.businessHours) === null || _j === void 0 ? void 0 : _j.formatted,
        visualVibe: dna.visualVibe,
        contentSparsity: dna.contentSparsity,
        extractedFacts: dna.hiddenGems.map(g => ({
            source: g.type === 'founding_date' ? 'logo' :
                g.type === 'award' ? 'flyer' :
                    g.type === 'slogan' ? 'hero' : 'signage',
            text: g.text,
            confidence: g.confidence,
            imageUrl: g.source
        })),
        visionAnalysisComplete: dna.visionAnalysisComplete,
        semanticImageMap: dna.semanticImageMap,
    };
    // Run post-processing pipeline
    console.log('[TotalContent v4.0] Running post-processing pipeline...');
    const { html: processedHtml, validation } = (0, postProcessor_1.runPostProcessingPipeline)(html, siteIdentity);
    if (!validation.valid) {
        console.warn('[TotalContent v4.0] Unresolved placeholders:', validation.remaining);
    }
    console.log('[TotalContent v4.0] Generation complete, HTML length:', processedHtml.length);
    return {
        html: processedHtml,
        thinking: thinkingOutput || 'Total Content Pipeline v4.0 - Complete Digital Presence Migration'
    };
}
/**
 * Total Content Modernization Endpoint V4.0
 * Exhaustive crawl + Vision API + Complete content migration
 */
exports.generateTotalContentModernizedSite = functions
    .runWith({
    timeoutSeconds: 540, // 9 minutes for exhaustive processing
    memory: '8GB',
})
    .https.onRequest(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { sourceUrl, businessName, category, config } = req.body;
        if (!sourceUrl) {
            res.status(400).json({ error: 'sourceUrl is required' });
            return;
        }
        console.log('[TotalContent v4.0] Starting exhaustive scrape for:', sourceUrl);
        // 1. Run exhaustive scrape to build UniversalBusinessDNA
        const dna = await (0, exhaustiveScraper_1.exhaustiveScrapeSite)(sourceUrl, config);
        // Override business name if provided
        if (businessName) {
            dna.businessName = businessName;
        }
        // Override industry category if provided
        if (category) {
            dna.industryCategory = category;
        }
        console.log('[TotalContent v4.0] Exhaustive scrape complete:', {
            businessName: dna.businessName,
            totalPages: dna.totalPagesScraped,
            services: dna.services.length,
            testimonials: dna.testimonials.length,
            teamMembers: dna.teamMembers.length,
            faqs: dna.faqs.length,
            hiddenGems: dna.hiddenGems.length,
            enrichedImages: dna.enrichedImages.length,
            brandColors: dna.brandColors,
            visionComplete: dna.visionAnalysisComplete,
        });
        // 2. Generate Total Content modernized site
        console.log('[TotalContent v4.0] Starting Total Content generation...');
        const { html, thinking } = await generateTotalContentSite(dna);
        console.log('[TotalContent v4.0] Generation complete, HTML length:', html.length);
        // Prepare response (exclude large data)
        const dnaForResponse = {
            ...dna,
            enrichedImages: dna.enrichedImages.map(img => ({
                url: img.url,
                alt: img.alt,
                semanticCaption: img.semanticCaption,
                suggestedSection: img.suggestedSection,
            })),
            semanticPages: dna.semanticPages.map(p => ({
                url: p.url,
                title: p.title,
                path: p.path,
                semanticIntent: p.semanticIntent,
                contentPriority: p.contentPriority,
            })),
        };
        res.json({
            html,
            dna: dnaForResponse,
            designStyle: 'glass-glow-premium',
            thinking,
            pipelineVersion: '4.0-total-content'
        });
    }
    catch (error) {
        console.error('[TotalContent v4.0] Error:', error);
        res.status(500).json({
            error: error.message || 'Failed to generate total content modernized site'
        });
    }
});
// ============================================
// VIBE CODER FUNCTIONS (from gemini-vibe-coder-22-Jan)
// ============================================
/**
 * Vibe Coder System Instruction - Simple ~55 line prompt focused on architecture
 */
const VIBE_CODER_SYSTEM_INSTRUCTION = `
You are the "Elite Web Architect Agent" (Gemini Pro Engine).
You specialize in building and iteratively editing enterprise-grade, high-performance websites.

# CORE HUB VARIABLES
- STACK: HTML5, Tailwind CSS 4.0 (via CDN), Framer Motion (via CDN).
- ANIMATIONS: Transitions must be smooth (0.6s, ease-out). Use staggered reveals for lists.
- IMAGES: You MUST use the following format for ALL images: <img src="https://placehold.co/800x600/1e293b/475569?text=Generating+Asset..." data-prompt="[Subject details, style matched to vibe]" class="..." />
- NOTE: The image generation engine is capable of photorealistic 4K imagery. Write detailed prompts in the 'data-prompt' attribute to utilize this.

# ARCHITECTURE PROTOCOL (CRITICAL)
1. SINGLE FILE SPA: You are building a Single Page Application contained in one HTML file.
2. MULTI-PAGE LOGIC: If the user asks for multiple "pages" (e.g., Home, About, Contact), YOU MUST:
   - Create distinct container elements for each page: <div id="home-page">, <div id="about-page">.
   - Create a sticky Navigation Bar to switch between them.
   - Use simple, robust inline JavaScript to handle the switching (e.g., hiding/showing IDs).
3. PERSISTENCE: You will receive the "CURRENT CODE". You MUST retain all existing sections/pages unless explicitly asked to remove them. When adding a new page, APPEND it to the existing HTML structure and update the Navigation Bar.

# OUTPUT PROTOCOL
1. When asked to build or edit a site, you MUST generate the full HTML content that goes INSIDE the <body> tag.
2. DO NOT include <html>, <head>, or <body> tags.
3. WRAP the generated code in [CODE_UPDATE] and [/CODE_UPDATE] tags.
4. DO NOT use markdown code fences (like \`\`\`html) inside the [CODE_UPDATE] block. Just raw HTML.
5. Provide a brief <thought> block before the code explaining your design choices.

# EXAMPLE OUTPUT
<thought>
I will add an "About Us" section to the existing site. I will wrap the previous content in a "home" section and create a new "about" section, adding a nav bar to toggle visibility.
</thought>
[CODE_UPDATE]
<nav class="fixed top-0 w-full bg-black/80 backdrop-blur text-white p-4 z-50">
  <ul class="flex gap-6">
    <li onclick="showPage('home')" class="cursor-pointer hover:text-blue-400">Home</li>
    <li onclick="showPage('about')" class="cursor-pointer hover:text-blue-400">About</li>
  </ul>
</nav>

<div id="home" class="page-section min-h-screen pt-20">
  <!-- Existing Home Content -->
  <h1 class="text-6xl">Welcome</h1>
</div>

<div id="about" class="page-section hidden min-h-screen pt-20">
  <!-- New About Content -->
  <h2 class="text-4xl">About Us</h2>
</div>

<script>
  function showPage(pageId) {
    document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
  }
</script>
[/CODE_UPDATE]
`;
/**
 * Analyze brand using Google Search grounding
 * Produces a structured "Design Brief" with VIBE & AESTHETICS + CONTENT DATA SHEET
 */
exports.analyzeBrand = functions.runWith({
    timeoutSeconds: 540,
    memory: '1GB'
}).https.onRequest(async (req, res) => {
    var _a, _b, _c, _d;
    // Set CORS headers FIRST for ALL responses (success, error, validation failures)
    res.set(corsHeaders);
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { businessInfo, logoBase64, websiteUrl } = req.body;
        const apiKey = await getGeminiApiKey();
        console.log('[VibeCoder] Analyzing brand for:', businessInfo === null || businessInfo === void 0 ? void 0 : businessInfo.substring(0, 100));
        const promptText = `
Role: Elite Brand Strategist & Web Architect with expertise in visual design systems.
Task: Analyze this business to create a comprehensive "Vibe Design System" for their new website.

--- INPUTS ---
Business Research: ${businessInfo}
${websiteUrl ? `Existing Website to Audit: ${websiteUrl}` : 'NOTE: This business currently has NO WEBSITE. You must invent a high-end digital identity for them.'}
${logoBase64 ? '(Logo Image Attached below - ANALYZE THIS FOR BRAND COLORS)' : ''}

--- CRITICAL ACTIONS ---
1. USE GOOGLE SEARCH to find their official website and extract their EXACT brand colors from it.
2. USE GOOGLE SEARCH to find their specific MENU ITEMS, SERVICE LIST, PRICING, and OPENING HOURS.
3. USE GOOGLE SEARCH to find customer reviews, testimonials, and reputation data.
4. Analyze the business type and location to determine the appropriate visual "Atmosphere".
${logoBase64 ? '5. ANALYZE THE LOGO IMAGE to extract the PRIMARY brand colors.' : ''}

--- OUTPUT FORMAT (MUST FOLLOW EXACTLY) ---
Produce a detailed "Design Brief" with ALL of the following sections:

## SECTION 1: BRAND COLORS (CRITICAL - USE EXACT HEX CODES)
- Primary Color: #XXXXXX (main brand color - extracted from logo/website)
- Secondary Color: #XXXXXX (accent color)
- Background Color: #XXXXXX (page background - usually light or dark)
- Text Color: #XXXXXX (main body text color)
- Accent Color: #XXXXXX (for buttons, links, highlights)

## SECTION 2: TYPOGRAPHY & VIBE
- Core Vibe: [3-5 adjectives describing brand personality, e.g., "Modern, Professional, Welcoming"]
- Primary Font: [Font recommendation, e.g., "Inter" or "Playfair Display"]
- Font Style: [Clean/Bold/Elegant/Playful]
- Overall Atmosphere: [Description of the visual mood]

## SECTION 3: CONTENT DATA SHEET (USE REAL DATA FROM GOOGLE SEARCH)
- Official Business Name: [Exact name]
- Full Address: [Street, City, State ZIP]
- Phone Number: [Format: (XXX) XXX-XXXX]
- Email: [If found]
- Opening Hours: [Day-by-day schedule if found, or inferred for business type]
- Services/Products List: [DETAILED list with descriptions - at least 5 items]
- Price Examples: [Specific prices if found]
- Tagline/Slogan: [If found, or suggest one]

## SECTION 4: WEBSITE SECTIONS TO GENERATE
Create these sections with SPECIFIC content ideas:
1. Hero Section: [Describe the hero - headline, subheadline, CTA, background image concept]
2. Services/Products: [How to display the services with cards/grid/list]
3. About Us: [Company story concept]
4. Testimonials: [Include any real reviews found via search]
5. Contact/Location: [Include map, hours, contact form]
6. Footer: [What to include]

## SECTION 5: IMAGE PROMPTS
Suggest 4-5 detailed image prompts for AI generation that match this business:
1. Hero background: [Detailed prompt for hero image]
2. Service images: [Prompts for service-related images]
3. About/team: [Prompt for about section image]
4. Atmosphere: [Prompt for ambient/mood images]

IMPORTANT: All colors MUST be in hex format (#XXXXXX). All content should be REAL data found via Google Search, not generic placeholders.
`;
        const parts = [{ text: promptText }];
        // Add logo image if present
        if (logoBase64) {
            const matches = logoBase64.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
                parts.push({
                    inlineData: { mimeType: matches[1], data: matches[2] }
                });
            }
        }
        // Use Gemini 3 Pro with Google Search grounding for best reasoning and multimodal analysis
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts }],
                tools: [{ googleSearch: {} }]
            })
        });
        const data = await response.json();
        if (!response.ok) {
            console.error('[VibeCoder] analyzeBrand API error:', data);
            throw new Error(((_a = data.error) === null || _a === void 0 ? void 0 : _a.message) || 'Brand analysis API failed');
        }
        // Google Search grounded responses may have multiple parts
        // Concatenate ALL text parts from the response
        const responseParts = ((_d = (_c = (_b = data.candidates) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.parts) || [];
        console.log('[VibeCoder] Response has', responseParts.length, 'parts');
        let analysis = '';
        for (const part of responseParts) {
            if (part.text) {
                analysis += part.text + '\n';
            }
        }
        analysis = analysis.trim() || 'Could not generate analysis.';
        console.log('[VibeCoder] Brand analysis complete, length:', analysis.length);
        res.json({ analysis });
    }
    catch (error) {
        console.error('[VibeCoder] analyzeBrand error:', error);
        res.status(500).json({ error: error.message || 'Failed to analyze brand' });
    }
});
/**
 * Generate site HTML from Design Brief using Vibe Coder methodology
 * Uses [CODE_UPDATE] tags for extraction
 */
exports.generateSiteFromBrief = functions.runWith({
    timeoutSeconds: 540,
    memory: '1GB'
}).https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e, _f;
    // Set CORS headers FIRST for ALL responses (success, error, validation failures)
    res.set(corsHeaders);
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { designBrief, currentCode } = req.body;
        const apiKey = await getGeminiApiKey();
        console.log('[VibeCoder] Generating site from Design Brief, length:', designBrief === null || designBrief === void 0 ? void 0 : designBrief.length);
        const contextPrompt = `
USER REQUEST: Create a stunning, high-end website based on this Design Brief:

${designBrief}

=== CRITICAL REQUIREMENTS ===
1. USE THE EXACT HEX COLORS from the Design Brief for ALL styling (backgrounds, text, buttons, accents)
2. Generate a MINIMUM of 6 distinct sections: Hero, Services/Products, About, Testimonials, Contact, Footer
3. Use REAL business data from the Content Data Sheet (services, hours, pricing, address, phone)
4. Write DETAILED data-prompt attributes for ALL images describing photorealistic 4K imagery
5. Create smooth animations using Framer Motion patterns
6. Include the business's ACTUAL services/products with real descriptions
7. Add a sticky navigation bar with smooth scroll to sections
8. Make the site MOBILE-RESPONSIVE with proper Tailwind breakpoints

=== COLOR APPLICATION ===
- Hero section background: Use Primary Color or gradient
- Section backgrounds: Alternate between Background Color and subtle variations
- Headings: Use Text Color
- Buttons: Use Accent Color with hover states
- Footer: Use darker shade of Primary Color

=== CONTENT REQUIREMENTS ===
- Hero: Business name, tagline, CTA button, stunning background image
- Services: Display EACH service from the Design Brief with icons/images
- About: Tell the company story (can be inferred from business type)
- Testimonials: Include real reviews if found, or create believable ones
- Contact: Full address, phone, hours, contact form, embedded map placeholder
- Footer: Links, social icons, copyright

${currentCode ? `\n\nCURRENT CODE STATE (Do not lose this context):\n${currentCode}` : ''}
`;
        // Use Gemini 3 Pro with system instruction and thinking for best reasoning
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: contextPrompt }] }],
                systemInstruction: { parts: [{ text: VIBE_CODER_SYSTEM_INSTRUCTION }] },
                generationConfig: {
                    temperature: 0.7,
                    thinkingConfig: { thinkingBudget: 2048 }
                }
            })
        });
        const data = await response.json();
        if (!response.ok) {
            console.error('[VibeCoder] generateSiteFromBrief API error:', data);
            throw new Error(((_a = data.error) === null || _a === void 0 ? void 0 : _a.message) || 'Site generation API failed');
        }
        const outputText = ((_f = (_e = (_d = (_c = (_b = data.candidates) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.content) === null || _d === void 0 ? void 0 : _d.parts) === null || _e === void 0 ? void 0 : _e[0]) === null || _f === void 0 ? void 0 : _f.text) || '';
        console.log('[VibeCoder] Raw output length:', outputText.length);
        console.log('[VibeCoder] Raw output preview:', outputText.substring(0, 500));
        // Extract code from [CODE_UPDATE] tags
        let codeMatch = outputText.match(/\[CODE_UPDATE\]([\s\S]*?)\[\/CODE_UPDATE\]/);
        let code = codeMatch ? codeMatch[1].trim() : null;
        // Clean up markdown fences if present
        if (code) {
            code = code.replace(/^```(html|xml)?/i, '').replace(/```$/, '').trim();
        }
        // FALLBACK: If no [CODE_UPDATE] tags, try to extract HTML directly
        if (!code) {
            console.log('[VibeCoder] No [CODE_UPDATE] tags found, attempting fallback extraction');
            // Try markdown code block
            const markdownMatch = outputText.match(/```(?:html)?\s*([\s\S]*?)```/);
            if (markdownMatch) {
                code = markdownMatch[1].trim();
                console.log('[VibeCoder] Fallback: Extracted from markdown code block');
            }
            // Try raw HTML detection (starts with common HTML tags)
            if (!code && (outputText.includes('<nav') || outputText.includes('<section') || outputText.includes('<div') || outputText.includes('<header'))) {
                // Extract from first HTML tag to end
                const htmlStart = outputText.search(/<(?:nav|section|div|header|main|!DOCTYPE)/i);
                if (htmlStart !== -1) {
                    code = outputText.substring(htmlStart).trim();
                    console.log('[VibeCoder] Fallback: Extracted raw HTML starting at position', htmlStart);
                }
            }
        }
        const cleanText = outputText.replace(/\[CODE_UPDATE\][\s\S]*?\[\/CODE_UPDATE\]/, '').trim();
        console.log('[VibeCoder] Extracted code length:', (code === null || code === void 0 ? void 0 : code.length) || 0);
        res.json({ text: cleanText, code });
    }
    catch (error) {
        console.error('[VibeCoder] generateSiteFromBrief error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate site from brief' });
    }
});
/**
 * Generate image using Gemini image models (for data-prompt hydration)
 */
exports.generateVibeImage = functions.runWith({
    timeoutSeconds: 540,
    memory: '1GB'
}).https.onRequest(async (req, res) => {
    var _a, _b, _c, _d;
    // Set CORS headers FIRST for ALL responses (success, error, validation failures)
    res.set(corsHeaders);
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const { prompt } = req.body;
        const apiKey = await getGeminiApiKey();
        // Enhance prompt for photorealistic 4K quality
        const enhancedPrompt = `${prompt}, photorealistic, 4k, high fidelity, professional photography, no text overlays`;
        console.log('[VibeCoder] Generating image for prompt:', enhancedPrompt === null || enhancedPrompt === void 0 ? void 0 : enhancedPrompt.substring(0, 100));
        // Use Gemini 3 Pro Image model for highest quality
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: enhancedPrompt }] }],
                generationConfig: {
                    responseModalities: ['image', 'text'],
                }
            })
        });
        const data = await response.json();
        if (!response.ok) {
            console.error('[VibeCoder] generateVibeImage API error:', data);
            res.json({ imageUrl: null });
            return;
        }
        // Extract image from response
        for (const part of ((_c = (_b = (_a = data.candidates) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.content) === null || _c === void 0 ? void 0 : _c.parts) || []) {
            if ((_d = part.inlineData) === null || _d === void 0 ? void 0 : _d.data) {
                const mimeType = part.inlineData.mimeType || 'image/png';
                console.log('[VibeCoder] Image generated successfully');
                res.json({ imageUrl: `data:${mimeType};base64,${part.inlineData.data}` });
                return;
            }
        }
        console.log('[VibeCoder] No image in response');
        res.json({ imageUrl: null });
    }
    catch (error) {
        console.error('[VibeCoder] generateVibeImage error:', error);
        res.json({ imageUrl: null });
    }
});
//# sourceMappingURL=index.js.map