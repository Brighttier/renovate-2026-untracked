"use strict";
/**
 * Project Indexer (Minimal - No Cheerio)
 *
 * Stores HTML sections as strings in Firestore.
 * Per newlogic.md: No complex parsing, just section extraction via regex.
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
exports.buildProjectIndex = buildProjectIndex;
exports.saveProjectIndex = saveProjectIndex;
exports.getProjectIndex = getProjectIndex;
const admin = __importStar(require("firebase-admin"));
const getDb = () => admin.firestore();
// ============================================================================
// MINIMAL INDEXER (Regex-based section extraction)
// ============================================================================
async function buildProjectIndex(html, projectId) {
    const components = {};
    // Extract common sections using simple regex (no parsing)
    const sections = [
        { name: 'Navbar', regex: /<nav[\s\S]*?<\/nav>/i },
        { name: 'Hero', regex: /<section[^>]*class="[^"]*hero[^"]*"[^>]*>[\s\S]*?<\/section>/i },
        { name: 'Footer', regex: /<footer[\s\S]*?<\/footer>/i },
    ];
    for (const section of sections) {
        const match = html.match(section.regex);
        if (match) {
            components[section.name] = {
                name: section.name,
                html: match[0],
            };
        }
    }
    const styleSystem = html.includes('tailwindcss') || html.includes('class="') ? 'tailwind' : 'css';
    return {
        projectId,
        html,
        components,
        styleSystem,
        lastIndexedAt: new Date().toISOString(),
    };
}
async function saveProjectIndex(index) {
    await getDb()
        .collection('projects')
        .doc(index.projectId)
        .collection('vibe')
        .doc('index')
        .set(index);
}
async function getProjectIndex(projectId) {
    const doc = await getDb()
        .collection('projects')
        .doc(projectId)
        .collection('vibe')
        .doc('index')
        .get();
    if (!doc.exists) {
        return null;
    }
    return doc.data();
}
//# sourceMappingURL=projectIndexer.js.map