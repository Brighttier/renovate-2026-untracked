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
exports.editSiteHTML = void 0;
/**
 * Standalone editSiteHTML function with lazy imports
 * Optimized for fast deployment initialization
 */
const functions = __importStar(require("firebase-functions"));
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};
// Lazy-loaded dependencies (only load when function is called)
let GoogleGenerativeAI = null;
let SecretManagerServiceClient = null;
async function loadDependencies() {
    if (!GoogleGenerativeAI) {
        const { GoogleGenerativeAI: GAI } = await Promise.resolve().then(() => __importStar(require('@google/generative-ai')));
        GoogleGenerativeAI = GAI;
    }
    if (!SecretManagerServiceClient) {
        const { SecretManagerServiceClient: SMSC } = await Promise.resolve().then(() => __importStar(require('@google-cloud/secret-manager')));
        SecretManagerServiceClient = SMSC;
    }
}
async function getGenAI() {
    var _a, _b;
    await loadDependencies();
    const client = new SecretManagerServiceClient();
    const [version] = await client.accessSecretVersion({
        name: 'projects/renovatemysite-vibe/secrets/gemini-api-key/versions/latest',
    });
    const apiKey = ((_b = (_a = version.payload) === null || _a === void 0 ? void 0 : _a.data) === null || _b === void 0 ? void 0 : _b.toString()) || '';
    return new GoogleGenerativeAI(apiKey);
}
const DIFF_EDITING_INSTRUCTION = `You are an expert web developer editing HTML code.

CRITICAL RULES:
1. Return ONLY the modified HTML sections (not the full document)
2. Include enough context (parent elements) for precise replacement
3. Preserve all existing Tailwind classes unless explicitly changing them
4. Make minimal, surgical changes - don't refactor unnecessarily
5. Keep responsive design patterns (mobile-first, breakpoints)

RESPONSE FORMAT:
Return a JSON object:
{
  "thinking": "brief explanation of changes",
  "changes": [
    {
      "original": "<exact HTML to find>",
      "replacement": "<new HTML>"
    }
  ]
}`;
function detectEditType(instruction) {
    const lower = instruction.toLowerCase();
    if (/color|colour|theme|palette/i.test(lower))
        return 'color';
    if (/text|wording|copy|heading|title|paragraph/i.test(lower))
        return 'text';
    if (/layout|position|spacing|margin|padding|grid|flex/i.test(lower))
        return 'layout';
    if (/logo|image|photo|picture|icon/i.test(lower))
        return 'image';
    if (/font|typography|size|weight/i.test(lower))
        return 'typography';
    return 'general';
}
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
        // Load dependencies only when function is called
        const ai = await getGenAI();
        const model = ai.getGenerativeModel({ model: 'gemini-3-pro-preview' });
        const editType = detectEditType(instruction);
        console.log('editSiteHTML: Detected edit type:', editType);
        console.log('editSiteHTML: Input HTML length:', currentHTML.length);
        // Build the diff-based prompt
        const prompt = `${DIFF_EDITING_INSTRUCTION}

# USER REQUEST
${instruction}

# CURRENT HTML
\`\`\`html
${currentHTML.substring(0, 20000)}
\`\`\`

Return the changes as JSON.`;
        const parts = [{ text: prompt }];
        // Add attachments if present (for logo/image edits)
        if (attachments && attachments.length > 0) {
            for (const att of attachments) {
                parts.push({
                    inlineData: {
                        mimeType: att.mimeType,
                        data: att.base64Data,
                    },
                });
            }
        }
        const result = await model.generateContent(parts);
        const responseText = result.response.text();
        console.log('editSiteHTML: AI response length:', responseText.length);
        // Try to extract JSON
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('AI did not return valid JSON');
        }
        const aiResponse = JSON.parse(jsonMatch[0]);
        let updatedHtml = currentHTML;
        // Apply changes
        if (aiResponse.changes && Array.isArray(aiResponse.changes)) {
            for (const change of aiResponse.changes) {
                if (change.original && change.replacement) {
                    updatedHtml = updatedHtml.replace(change.original, change.replacement);
                }
            }
        }
        // Fallback: if AI returned full HTML instead of changes
        if (!aiResponse.changes && responseText.includes('<!DOCTYPE html>')) {
            const htmlMatch = responseText.match(/<!DOCTYPE html>[\s\S]*<\/html>/i);
            if (htmlMatch) {
                updatedHtml = htmlMatch[0];
            }
        }
        res.json({
            html: updatedHtml,
            thinking: aiResponse.thinking || 'Updated the website',
            text: aiResponse.thinking || 'Done! Changes applied.',
        });
    }
    catch (error) {
        console.error('editSiteHTML error:', error);
        res.status(500).json({
            error: error.message || 'Failed to edit HTML',
        });
    }
});
//# sourceMappingURL=editSiteHTMLStandalone.js.map