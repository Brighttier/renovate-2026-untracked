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
exports.extractLogo = void 0;
const functions = __importStar(require("firebase-functions"));
const logoExtractor_1 = require("./logoExtractor");
// CORS configuration
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};
/**
 * Extract brand assets (logo + colors) from business image
 */
exports.extractLogo = functions.https.onRequest(async (req, res) => {
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
        const { imageUrl, businessName } = req.body;
        if (!imageUrl || !businessName) {
            res.status(400).json({
                error: 'imageUrl and businessName are required'
            });
            return;
        }
        // Extract brand assets
        const result = await (0, logoExtractor_1.extractBrandAssets)({
            imageUrl,
            businessName
        });
        if (!result.success) {
            res.status(400).json({
                error: result.message || 'Failed to extract brand assets'
            });
            return;
        }
        res.json(result);
    }
    catch (error) {
        console.error('extractLogo error:', error);
        res.status(500).json({
            error: error.message || 'Failed to extract brand assets'
        });
    }
});
//# sourceMappingURL=index.js.map