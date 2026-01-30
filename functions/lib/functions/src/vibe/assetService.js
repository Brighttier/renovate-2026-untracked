"use strict";
/**
 * Asset Service - Nano Banana Pro integration
 *
 * Handles asset upload and AI image generation.
 * Per ENTERPRISE_ARCHITECTURE.md: High-quality logos, hero images.
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
exports.uploadAsset = uploadAsset;
exports.generateImage = generateImage;
const admin = __importStar(require("firebase-admin"));
const getStorage = () => admin.storage();
const NANO_BANANA_PRO_API_URL = process.env.NANO_BANANA_PRO_API_URL || '';
const NANO_BANANA_PRO_API_KEY = process.env.NANO_BANANA_PRO_API_KEY || '';
async function uploadAsset(request) {
    try {
        // Convert base64 to buffer
        const base64Data = request.base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        // Validate size (max 5MB)
        if (buffer.length > 5 * 1024 * 1024) {
            return { success: false, error: 'File size exceeds 5MB limit' };
        }
        // Upload to Cloud Storage
        const filename = `${request.projectId}/${Date.now()}-${request.type}.${getExtension(request.mimeType)}`;
        const bucket = getStorage().bucket();
        const file = bucket.file(`assets/${filename}`);
        await file.save(buffer, {
            metadata: {
                contentType: request.mimeType,
                metadata: {
                    uploadedBy: request.userId,
                    projectId: request.projectId,
                    assetType: request.type,
                },
            },
        });
        // Make file publicly accessible
        await file.makePublic();
        const url = `https://storage.googleapis.com/${bucket.name}/assets/${filename}`;
        return { success: true, url };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
async function generateImage(request) {
    try {
        // Call Nano Banana Pro API (placeholder - replace with actual API)
        if (!NANO_BANANA_PRO_API_KEY) {
            return { success: false, error: 'Nano Banana Pro API key not configured' };
        }
        const response = await fetch(NANO_BANANA_PRO_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${NANO_BANANA_PRO_API_KEY}`,
            },
            body: JSON.stringify({
                prompt: request.prompt,
                type: request.type,
                format: 'png',
                quality: 'high',
            }),
        });
        if (!response.ok) {
            return { success: false, error: `API error: ${response.statusText}` };
        }
        const data = await response.json();
        // Upload generated image to Cloud Storage
        let imageBuffer;
        if (data.image && data.image.startsWith('data:image')) {
            const base64 = data.image.split(',')[1];
            imageBuffer = Buffer.from(base64, 'base64');
        }
        else if (data.url) {
            const imageResponse = await fetch(data.url);
            const arrayBuffer = await imageResponse.arrayBuffer();
            imageBuffer = Buffer.from(arrayBuffer);
        }
        else {
            return { success: false, error: 'Invalid API response format' };
        }
        // Upload to storage
        const filename = `${request.projectId}/${Date.now()}-generated-${request.type}.png`;
        const bucket = getStorage().bucket();
        const file = bucket.file(`assets/${filename}`);
        await file.save(imageBuffer, {
            metadata: {
                contentType: 'image/png',
                metadata: {
                    generatedBy: 'nano-banana-pro',
                    projectId: request.projectId,
                    userId: request.userId,
                    assetType: request.type,
                    prompt: request.prompt,
                },
            },
        });
        await file.makePublic();
        const url = `https://storage.googleapis.com/${bucket.name}/assets/${filename}`;
        return { success: true, url };
    }
    catch (error) {
        return { success: false, error: error.message };
    }
}
function getExtension(mimeType) {
    const map = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/webp': 'webp',
        'image/svg+xml': 'svg',
    };
    return map[mimeType] || 'png';
}
//# sourceMappingURL=assetService.js.map