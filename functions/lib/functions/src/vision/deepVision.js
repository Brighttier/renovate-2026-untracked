"use strict";
/**
 * Deep Vision Module v3.0 - Google Cloud Vision API Integration
 *
 * Provides OCR (TEXT_DETECTION), color extraction (IMAGE_PROPERTIES),
 * and Gemini-based image captioning for the Deep-Multimodal Pipeline.
 *
 * Features:
 * - Firestore caching for Vision API results (24h TTL)
 * - Retry logic with exponential backoff
 * - Gemini multimodal image captioning
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.rgbToHex = rgbToHex;
exports.isGrayscale = isGrayscale;
exports.getColorSaturation = getColorSaturation;
exports.findAccentColor = findAccentColor;
exports.generateSemanticCaption = generateSemanticCaption;
exports.batchGenerateCaptions = batchGenerateCaptions;
exports.detectTextInImage = detectTextInImage;
exports.extractDominantColors = extractDominantColors;
exports.analyzeImage = analyzeImage;
exports.batchAnalyzeImages = batchAnalyzeImages;
exports.extractFactsFromOCR = extractFactsFromOCR;
const vision_1 = require("@google-cloud/vision");
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const secret_manager_1 = require("@google-cloud/secret-manager");
const generative_ai_1 = require("@google/generative-ai");
// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const visionClient = new vision_1.ImageAnnotatorClient();
const secretClient = new secret_manager_1.SecretManagerServiceClient();
let genAI = null;
// ============================================
// CONFIGURATION
// ============================================
const VISION_CACHE_COLLECTION = 'visionApiCache';
const VISION_CACHE_TTL_HOURS = 24;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 500;
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
// CACHING FUNCTIONS
// ============================================
function getUrlHash(url) {
    return crypto.createHash('sha256').update(url.toLowerCase().trim()).digest('hex').substring(0, 32);
}
async function getCachedVisionResult(imageUrl) {
    var _a, _b;
    try {
        const hash = getUrlHash(imageUrl);
        const doc = await db.collection(VISION_CACHE_COLLECTION).doc(hash).get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        const cachedAt = ((_b = (_a = data.cachedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date(0);
        const ageInHours = (Date.now() - cachedAt.getTime()) / (1000 * 60 * 60);
        if (ageInHours > VISION_CACHE_TTL_HOURS) {
            // Cache expired, delete it
            await db.collection(VISION_CACHE_COLLECTION).doc(hash).delete();
            return null;
        }
        console.log(`[DeepVision] Cache hit for: ${imageUrl.substring(0, 50)}...`);
        return {
            textDetection: data.textDetection || null,
            colorExtraction: data.colorExtraction || null,
            semanticCaption: data.semanticCaption || null,
            cachedAt,
        };
    }
    catch (error) {
        console.warn('[DeepVision] Cache read error:', error);
        return null;
    }
}
async function setCachedVisionResult(imageUrl, result) {
    try {
        const hash = getUrlHash(imageUrl);
        await db.collection(VISION_CACHE_COLLECTION).doc(hash).set({
            imageUrl,
            urlHash: hash,
            textDetection: result.textDetection || null,
            colorExtraction: result.colorExtraction || null,
            semanticCaption: result.semanticCaption || null,
            cachedAt: admin.firestore.FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + VISION_CACHE_TTL_HOURS * 60 * 60 * 1000),
        });
    }
    catch (error) {
        console.warn('[DeepVision] Cache write error:', error);
    }
}
// ============================================
// RETRY LOGIC
// ============================================
async function withRetry(operation, operationName, maxRetries = MAX_RETRIES) {
    let lastError = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            const isRetryable = isRetryableError(error);
            if (!isRetryable || attempt === maxRetries) {
                console.error(`[DeepVision] ${operationName} failed after ${attempt} attempts:`, error.message);
                throw error;
            }
            const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            console.warn(`[DeepVision] ${operationName} attempt ${attempt} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    throw lastError;
}
function isRetryableError(error) {
    // Retry on rate limits, timeouts, and temporary failures
    const retryableCodes = [429, 500, 502, 503, 504];
    const retryableMessages = ['DEADLINE_EXCEEDED', 'RESOURCE_EXHAUSTED', 'UNAVAILABLE', 'timeout', 'ECONNRESET'];
    if (error.code && retryableCodes.includes(error.code))
        return true;
    if (error.message) {
        return retryableMessages.some(msg => error.message.includes(msg));
    }
    return false;
}
// ============================================
// HELPER FUNCTIONS
// ============================================
/**
 * Convert RGB values to hex color string
 */
function rgbToHex(r = 0, g = 0, b = 0) {
    const toHex = (n) => {
        const hex = Math.round(Math.min(255, Math.max(0, n))).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
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
    // Check for near-white
    const isNearWhite = r > 240 && g > 240 && b > 240;
    // Check for near-black
    const isNearBlack = r < 15 && g < 15 && b < 15;
    // Check for gray (R, G, B values are similar)
    const isGray = Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && Math.abs(r - b) < 20;
    return isNearWhite || isNearBlack || isGray;
}
/**
 * Calculate color saturation (0-1)
 */
function getColorSaturation(hex) {
    if (!hex || !hex.startsWith('#') || hex.length < 7)
        return 0;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min)
        return 0; // achromatic
    const d = max - min;
    return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}
/**
 * Find the most vibrant accent color from a list
 */
function findAccentColor(colors) {
    // Filter out grayscale colors
    const vibrantColors = colors.filter(c => !isGrayscale(c.hex));
    if (vibrantColors.length === 0)
        return null;
    // Sort by saturation (most vibrant first)
    const sorted = vibrantColors.sort((a, b) => {
        const satA = getColorSaturation(a.hex);
        const satB = getColorSaturation(b.hex);
        return satB - satA;
    });
    return sorted[0].hex;
}
// ============================================
// IMAGE FETCHING FOR MULTIMODAL
// ============================================
/**
 * Fetch image and convert to base64 for Gemini multimodal
 */
async function fetchImageAsBase64(imageUrl) {
    try {
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
        });
        if (!response.ok) {
            console.warn(`[DeepVision] Failed to fetch image: ${response.status}`);
            return null;
        }
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        // Determine MIME type
        let mimeType = 'image/jpeg';
        if (contentType.includes('png'))
            mimeType = 'image/png';
        else if (contentType.includes('gif'))
            mimeType = 'image/gif';
        else if (contentType.includes('webp'))
            mimeType = 'image/webp';
        return { base64, mimeType };
    }
    catch (error) {
        console.warn(`[DeepVision] Image fetch error:`, error.message);
        return null;
    }
}
// ============================================
// GEMINI SEMANTIC CAPTIONING
// ============================================
/**
 * Generate a 10-word semantic caption using Gemini multimodal
 */
async function generateSemanticCaption(imageUrl) {
    try {
        // Check cache first
        const cached = await getCachedVisionResult(imageUrl);
        if (cached === null || cached === void 0 ? void 0 : cached.semanticCaption) {
            return cached.semanticCaption;
        }
        // Fetch image as base64
        const imageData = await fetchImageAsBase64(imageUrl);
        if (!imageData) {
            return null;
        }
        const ai = await getGenAI();
        const model = ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const prompt = `Describe this image in EXACTLY 10 words or fewer for a website context.
Be specific about what you see (e.g., "Modern gym equipment in spacious fitness center", "Smiling dental team in clinical office").
Output ONLY the caption, nothing else.`;
        const result = await withRetry(async () => {
            const response = await model.generateContent([
                prompt,
                { inlineData: { mimeType: imageData.mimeType, data: imageData.base64 } },
            ]);
            return response.response.text().trim();
        }, 'Gemini captioning');
        // Update cache with caption
        await setCachedVisionResult(imageUrl, { semanticCaption: result });
        console.log(`[DeepVision] Generated caption: "${result}"`);
        return result;
    }
    catch (error) {
        console.warn(`[DeepVision] Caption generation failed:`, error.message);
        return null;
    }
}
/**
 * Batch generate semantic captions for multiple images
 */
async function batchGenerateCaptions(imageUrls, options = {}) {
    const { maxImages = 10, concurrency = 2 } = options;
    const captions = new Map();
    const urlsToProcess = imageUrls.slice(0, maxImages);
    console.log(`[DeepVision] Batch generating captions for ${urlsToProcess.length} images`);
    // Process in batches
    for (let i = 0; i < urlsToProcess.length; i += concurrency) {
        const batch = urlsToProcess.slice(i, i + concurrency);
        const results = await Promise.allSettled(batch.map(async (url) => {
            const caption = await generateSemanticCaption(url);
            return { url, caption };
        }));
        results.forEach((result) => {
            if (result.status === 'fulfilled' && result.value.caption) {
                captions.set(result.value.url, result.value.caption);
            }
        });
        // Rate limiting delay between batches
        if (i + concurrency < urlsToProcess.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }
    return captions;
}
// ============================================
// VISION API FUNCTIONS WITH CACHING & RETRY
// ============================================
/**
 * Detect text in an image using Google Vision TEXT_DETECTION
 * Extracts "trapped" data like slogans, "Est. Date", awards, etc.
 * Includes caching and retry logic.
 */
async function detectTextInImage(imageUrl, useCache = true) {
    var _a;
    // Check cache first
    if (useCache) {
        const cached = await getCachedVisionResult(imageUrl);
        if (cached === null || cached === void 0 ? void 0 : cached.textDetection) {
            return cached.textDetection;
        }
    }
    try {
        console.log(`[DeepVision] Running TEXT_DETECTION on: ${imageUrl}`);
        const result = await withRetry(async () => {
            const [response] = await visionClient.textDetection(imageUrl);
            return response;
        }, 'TEXT_DETECTION');
        const annotations = result.textAnnotations || [];
        if (annotations.length === 0) {
            const emptyResult = {
                texts: [],
                fullText: '',
                success: true,
            };
            if (useCache) {
                await setCachedVisionResult(imageUrl, { textDetection: emptyResult });
            }
            return emptyResult;
        }
        // First annotation is the full text, rest are individual words/blocks
        const fullText = ((_a = annotations[0]) === null || _a === void 0 ? void 0 : _a.description) || '';
        const individualTexts = annotations.slice(1).map(a => ({
            text: a.description || '',
            confidence: a.confidence || 0.9,
        }));
        console.log(`[DeepVision] Extracted ${individualTexts.length} text blocks`);
        const textResult = {
            texts: individualTexts,
            fullText: fullText.trim(),
            success: true,
        };
        if (useCache) {
            await setCachedVisionResult(imageUrl, { textDetection: textResult });
        }
        return textResult;
    }
    catch (error) {
        console.error(`[DeepVision] TEXT_DETECTION failed:`, error.message);
        return {
            texts: [],
            fullText: '',
            success: false,
            error: error.message,
        };
    }
}
/**
 * Extract dominant colors from an image using Google Vision IMAGE_PROPERTIES
 * Returns up to 5 colors with the most vibrant as the accent color
 * Includes caching and retry logic.
 */
async function extractDominantColors(imageUrl, useCache = true) {
    var _a, _b;
    // Check cache first
    if (useCache) {
        const cached = await getCachedVisionResult(imageUrl);
        if (cached === null || cached === void 0 ? void 0 : cached.colorExtraction) {
            return cached.colorExtraction;
        }
    }
    try {
        console.log(`[DeepVision] Running IMAGE_PROPERTIES on: ${imageUrl}`);
        const result = await withRetry(async () => {
            const [response] = await visionClient.imageProperties(imageUrl);
            return response;
        }, 'IMAGE_PROPERTIES');
        const colors = ((_b = (_a = result.imagePropertiesAnnotation) === null || _a === void 0 ? void 0 : _a.dominantColors) === null || _b === void 0 ? void 0 : _b.colors) || [];
        if (colors.length === 0) {
            const emptyResult = {
                colors: [],
                accentColor: null,
                success: true,
            };
            if (useCache) {
                await setCachedVisionResult(imageUrl, { colorExtraction: emptyResult });
            }
            return emptyResult;
        }
        // Extract top 5 colors with their properties
        const extracted = colors.slice(0, 5).map(c => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                hex: rgbToHex((_b = (_a = c.color) === null || _a === void 0 ? void 0 : _a.red) !== null && _b !== void 0 ? _b : undefined, (_d = (_c = c.color) === null || _c === void 0 ? void 0 : _c.green) !== null && _d !== void 0 ? _d : undefined, (_f = (_e = c.color) === null || _e === void 0 ? void 0 : _e.blue) !== null && _f !== void 0 ? _f : undefined),
                score: c.score || 0,
                pixelFraction: c.pixelFraction || 0,
            });
        });
        // Find the most vibrant non-grayscale color as accent
        const accentColor = findAccentColor(extracted);
        console.log(`[DeepVision] Extracted ${extracted.length} colors, accent: ${accentColor}`);
        const colorResult = {
            colors: extracted,
            accentColor,
            success: true,
        };
        if (useCache) {
            await setCachedVisionResult(imageUrl, { colorExtraction: colorResult });
        }
        return colorResult;
    }
    catch (error) {
        console.error(`[DeepVision] IMAGE_PROPERTIES failed:`, error.message);
        return {
            colors: [],
            accentColor: null,
            success: false,
            error: error.message,
        };
    }
}
/**
 * Run both text detection and color extraction on an image
 */
async function analyzeImage(imageUrl) {
    const [textResult, colorResult] = await Promise.allSettled([
        detectTextInImage(imageUrl),
        extractDominantColors(imageUrl),
    ]);
    return {
        textDetection: textResult.status === 'fulfilled' ? textResult.value : null,
        colorExtraction: colorResult.status === 'fulfilled' ? colorResult.value : null,
        imageUrl,
    };
}
/**
 * Batch analyze multiple images with rate limiting
 * Includes OCR, color extraction, and optional Gemini semantic captioning.
 * @param imageUrls Array of image URLs to analyze
 * @param options Configuration options
 */
async function batchAnalyzeImages(imageUrls, options = {}) {
    const { enableOCR = true, enableColorExtraction = true, enableSemanticCaptions = false, maxImages = 15, concurrency = 3, } = options;
    // Limit to maxImages for cost control
    const urlsToProcess = imageUrls.slice(0, maxImages);
    console.log(`[DeepVision] Batch analyzing ${urlsToProcess.length} images (max: ${maxImages}, captions: ${enableSemanticCaptions})`);
    const results = [];
    // Process in batches of `concurrency` for rate limiting
    for (let i = 0; i < urlsToProcess.length; i += concurrency) {
        const batch = urlsToProcess.slice(i, i + concurrency);
        const batchResults = await Promise.all(batch.map(async (url) => {
            const result = {
                textDetection: null,
                colorExtraction: null,
                semanticCaption: null,
                imageUrl: url,
            };
            // Run Vision API calls in parallel
            const promises = [];
            if (enableOCR) {
                promises.push(detectTextInImage(url).then(res => { result.textDetection = res; }));
            }
            if (enableColorExtraction) {
                promises.push(extractDominantColors(url).then(res => { result.colorExtraction = res; }));
            }
            if (enableSemanticCaptions) {
                promises.push(generateSemanticCaption(url).then(caption => { result.semanticCaption = caption; }));
            }
            await Promise.allSettled(promises);
            return result;
        }));
        results.push(...batchResults);
        // Small delay between batches to avoid rate limiting
        if (i + concurrency < urlsToProcess.length) {
            await new Promise(resolve => setTimeout(resolve, 150));
        }
    }
    console.log(`[DeepVision] Batch analysis complete: ${results.length} images processed`);
    return results;
}
/**
 * Extract facts from OCR results (slogans, dates, awards, etc.)
 */
function extractFactsFromOCR(fullText, imageUrl, source) {
    const facts = [];
    if (!fullText)
        return facts;
    // Patterns to extract meaningful facts
    const patterns = [
        // Establishment dates
        /(?:est\.?|established|since|founded)\s*(?:in\s*)?(\d{4})/gi,
        // Awards and certifications
        /(?:award|certified|voted|best|#1|number one|top\s+\d+)/gi,
        // Phone numbers
        /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
        // Slogans (quoted text or short phrases)
        /"([^"]+)"/g,
        // "Years in business" type claims
        /(\d+)\+?\s*years?\s*(?:of\s+)?(?:experience|service|in\s+business)/gi,
    ];
    patterns.forEach(pattern => {
        const matches = fullText.match(pattern);
        if (matches) {
            matches.forEach(match => {
                // Clean up the match
                const cleanedMatch = match.trim();
                if (cleanedMatch.length > 3 && cleanedMatch.length < 100) {
                    facts.push({
                        source,
                        text: cleanedMatch,
                        confidence: 0.85,
                        imageUrl,
                    });
                }
            });
        }
    });
    // Also extract any standalone short phrases that might be slogans (2-8 words)
    const lines = fullText.split(/[\n\r]+/);
    lines.forEach(line => {
        const trimmed = line.trim();
        const wordCount = trimmed.split(/\s+/).length;
        if (wordCount >= 2 && wordCount <= 8 && trimmed.length > 10 && trimmed.length < 80) {
            // Check it's not already captured and looks like a slogan
            const isAlreadyCaptured = facts.some(f => f.text.includes(trimmed) || trimmed.includes(f.text));
            if (!isAlreadyCaptured && /[A-Z]/.test(trimmed[0])) {
                facts.push({
                    source,
                    text: trimmed,
                    confidence: 0.7,
                    imageUrl,
                });
            }
        }
    });
    // Deduplicate
    const uniqueFacts = facts.filter((fact, index, self) => index === self.findIndex(f => f.text.toLowerCase() === fact.text.toLowerCase()));
    return uniqueFacts.slice(0, 10); // Limit to 10 facts per image
}
//# sourceMappingURL=deepVision.js.map