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
exports.deleteSiteImages = exports.storeBase64Image = exports.storeImages = exports.storeImage = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const sharp_1 = __importDefault(require("sharp"));
// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}
const bucket = admin.storage().bucket();
// CORS configuration
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};
/**
 * Download and store an image from a URL to Firebase Storage
 * Optimizes images with Sharp before storing
 */
async function storeImageToFirebase(imageUrl, path, optimize = true) {
    try {
        // Download the image
        const response = await fetch(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to download image: ${response.status}`);
        }
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const buffer = Buffer.from(await response.arrayBuffer());
        let processedBuffer;
        let finalContentType;
        let extension;
        if (optimize && !contentType.includes('svg')) {
            // Optimize image with Sharp - convert to WebP for better compression
            processedBuffer = await (0, sharp_1.default)(buffer)
                .resize(1200, 800, {
                fit: 'inside',
                withoutEnlargement: true
            })
                .webp({ quality: 85 })
                .toBuffer();
            finalContentType = 'image/webp';
            extension = 'webp';
        }
        else if (contentType.includes('svg')) {
            // Keep SVGs as-is
            processedBuffer = buffer;
            finalContentType = 'image/svg+xml';
            extension = 'svg';
        }
        else {
            // For non-optimized, just resize if too large
            const metadata = await (0, sharp_1.default)(buffer).metadata();
            if (metadata.width && metadata.width > 1920) {
                processedBuffer = await (0, sharp_1.default)(buffer)
                    .resize(1920, null, { withoutEnlargement: true })
                    .toBuffer();
            }
            else {
                processedBuffer = buffer;
            }
            finalContentType = contentType;
            extension = contentType.split('/')[1] || 'jpg';
        }
        // Create the file path
        const filePath = `${path}.${extension}`;
        const file = bucket.file(filePath);
        // Upload to Firebase Storage
        await file.save(processedBuffer, {
            metadata: {
                contentType: finalContentType,
                cacheControl: 'public, max-age=31536000', // 1 year cache
            }
        });
        // Make the file publicly accessible
        await file.makePublic();
        // Return the public URL
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        return publicUrl;
    }
    catch (error) {
        console.error('Error storing image:', error);
        throw error;
    }
}
/**
 * Store a single image to Firebase Storage
 */
exports.storeImage = functions
    .runWith({
    timeoutSeconds: 60,
    memory: '512MB'
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
        const { imageUrl, siteId, imageType, optimize = true } = req.body;
        if (!imageUrl || !siteId) {
            res.status(400).json({ error: 'imageUrl and siteId are required' });
            return;
        }
        const timestamp = Date.now();
        const path = `sites/${siteId}/${imageType || 'image'}-${timestamp}`;
        const storedUrl = await storeImageToFirebase(imageUrl, path, optimize);
        res.json({
            originalUrl: imageUrl,
            storedUrl,
            type: imageType || 'image',
            size: 0 // Could be calculated from the buffer
        });
    }
    catch (error) {
        console.error('storeImage error:', error);
        res.status(500).json({ error: error.message || 'Failed to store image' });
    }
});
/**
 * Store multiple images to Firebase Storage
 */
exports.storeImages = functions
    .runWith({
    timeoutSeconds: 300, // 5 minutes for multiple images
    memory: '1GB'
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
        const { images, siteId, optimize = true } = req.body;
        if (!images || !Array.isArray(images) || !siteId) {
            res.status(400).json({ error: 'images array and siteId are required' });
            return;
        }
        const results = [];
        const errors = [];
        // Process images in parallel with a limit
        const concurrencyLimit = 5;
        for (let i = 0; i < images.length; i += concurrencyLimit) {
            const batch = images.slice(i, i + concurrencyLimit);
            const batchPromises = batch.map(async (img, index) => {
                try {
                    const timestamp = Date.now();
                    const path = `sites/${siteId}/${img.type || 'image'}-${i + index}-${timestamp}`;
                    const storedUrl = await storeImageToFirebase(img.url, path, optimize);
                    return {
                        originalUrl: img.url,
                        storedUrl,
                        type: img.type || 'image',
                        size: 0
                    };
                }
                catch (error) {
                    errors.push({
                        url: img.url,
                        error: error.message || 'Failed to store image'
                    });
                    return null;
                }
            });
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults.filter((r) => r !== null));
        }
        res.json({
            stored: results,
            errors: errors.length > 0 ? errors : undefined,
            totalStored: results.length,
            totalFailed: errors.length
        });
    }
    catch (error) {
        console.error('storeImages error:', error);
        res.status(500).json({ error: error.message || 'Failed to store images' });
    }
});
/**
 * Store a base64 image to Firebase Storage (for AI-generated images)
 */
exports.storeBase64Image = functions
    .runWith({
    timeoutSeconds: 60,
    memory: '512MB'
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
        const { base64Data, siteId, imageType } = req.body;
        if (!base64Data || !siteId) {
            res.status(400).json({ error: 'base64Data and siteId are required' });
            return;
        }
        // Remove data URL prefix if present
        const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Clean, 'base64');
        // Optimize with Sharp
        const processedBuffer = await (0, sharp_1.default)(buffer)
            .resize(1200, 800, {
            fit: 'inside',
            withoutEnlargement: true
        })
            .webp({ quality: 85 })
            .toBuffer();
        const timestamp = Date.now();
        const filePath = `sites/${siteId}/${imageType || 'image'}-${timestamp}.webp`;
        const file = bucket.file(filePath);
        await file.save(processedBuffer, {
            metadata: {
                contentType: 'image/webp',
                cacheControl: 'public, max-age=31536000',
            }
        });
        await file.makePublic();
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
        res.json({
            storedUrl: publicUrl,
            type: imageType || 'image'
        });
    }
    catch (error) {
        console.error('storeBase64Image error:', error);
        res.status(500).json({ error: error.message || 'Failed to store image' });
    }
});
/**
 * Delete all images for a site
 */
exports.deleteSiteImages = functions
    .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
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
        const { siteId } = req.body;
        if (!siteId) {
            res.status(400).json({ error: 'siteId is required' });
            return;
        }
        const prefix = `sites/${siteId}/`;
        const [files] = await bucket.getFiles({ prefix });
        if (files.length === 0) {
            res.json({ deleted: 0, message: 'No files found' });
            return;
        }
        await Promise.all(files.map(file => file.delete()));
        res.json({
            deleted: files.length,
            message: `Deleted ${files.length} files`
        });
    }
    catch (error) {
        console.error('deleteSiteImages error:', error);
        res.status(500).json({ error: error.message || 'Failed to delete images' });
    }
});
//# sourceMappingURL=index.js.map