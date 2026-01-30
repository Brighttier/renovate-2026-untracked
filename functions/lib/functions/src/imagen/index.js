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
exports.uploadLogo = exports.createLogo = void 0;
const functions = __importStar(require("firebase-functions"));
const logoGenerator_1 = require("./logoGenerator");
// CORS configuration
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};
/**
 * Generate brand logo using Imagen 3
 */
exports.createLogo = functions.https.onRequest(async (req, res) => {
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
        const { businessName, category, brandArchetype, colorScheme, style } = req.body;
        if (!businessName || !category || !colorScheme) {
            res.status(400).json({
                error: 'businessName, category, and colorScheme are required'
            });
            return;
        }
        // Validate style
        const validStyles = ['minimal', 'modern', 'classic', 'playful'];
        const logoStyle = validStyles.includes(style) ? style : 'modern';
        // Generate logo
        const result = await (0, logoGenerator_1.generateLogo)({
            businessName,
            category,
            brandArchetype: brandArchetype || 'Professional and trustworthy',
            colorScheme: Array.isArray(colorScheme) ? colorScheme : [colorScheme],
            style: logoStyle
        });
        res.json(result);
    }
    catch (error) {
        console.error('createLogo error:', error);
        res.status(500).json({
            error: error.message || 'Failed to generate logo'
        });
    }
});
/**
 * Upload generated logo to Firebase Storage
 */
exports.uploadLogo = functions.https.onRequest(async (req, res) => {
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
        const { imageDataUrl, businessName, option } = req.body;
        if (!imageDataUrl || !businessName) {
            res.status(400).json({
                error: 'imageDataUrl and businessName are required'
            });
            return;
        }
        // Upload logo
        const logoUrl = await (0, logoGenerator_1.uploadGeneratedLogo)(imageDataUrl, businessName, option || 1);
        res.json({
            success: true,
            logoUrl
        });
    }
    catch (error) {
        console.error('uploadLogo error:', error);
        res.status(500).json({
            error: error.message || 'Failed to upload logo'
        });
    }
});
//# sourceMappingURL=index.js.map