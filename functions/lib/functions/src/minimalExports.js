"use strict";
/**
 * Minimal export file with lazy loading to avoid deployment timeouts
 * Only exports the most essential functions with optimized loading
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
exports.findLeadsWithMaps = exports.generateModernizedSite = exports.editSiteHTML = void 0;
// Export only editSiteHTML with lazy imports
var editSiteHTMLStandalone_1 = require("./gemini/editSiteHTMLStandalone");
Object.defineProperty(exports, "editSiteHTML", { enumerable: true, get: function () { return editSiteHTMLStandalone_1.editSiteHTML; } });
// Lazy wrapper for generateModernizedSite
const functions = __importStar(require("firebase-functions"));
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
/**
 * generateModernizedSite - Maximum Performance Configuration
 * - 8GB memory (max for 1st gen, gives 2 vCPU automatically)
 * - 540s timeout (9 minutes max)
 *
 * Note: To upgrade to 2nd Gen (16GB, 4 vCPU), you must first delete
 * the existing function in Firebase Console, then redeploy.
 */
exports.generateModernizedSite = functions
    .runWith({
    timeoutSeconds: 540, // 9 minutes max for deep scraping + image generation + HTML generation
    memory: '8GB', // Maximum memory for 1st gen functions (gives 2 vCPU)
})
    .https.onRequest(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    // Lazy load the actual implementation only when called
    const { generateModernizedSiteHandler } = await Promise.resolve().then(() => __importStar(require('./gemini/index')));
    return generateModernizedSiteHandler(req, res);
});
exports.findLeadsWithMaps = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    // Lazy load the actual implementation only when called
    const { findLeadsWithMaps: actualFunction } = await Promise.resolve().then(() => __importStar(require('./research/index')));
    return actualFunction(req, res);
});
//# sourceMappingURL=minimalExports.js.map