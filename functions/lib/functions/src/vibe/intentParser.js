"use strict";
/**
 * Intent Parser - Gemini 3 Flash
 *
 * Classifies user prompts into structured intents.
 * Per ENTERPRISE_ARCHITECTURE.md: Fast (<200ms), cheap ($0.00001/call), deterministic
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseIntent = parseIntent;
const generative_ai_1 = require("@google/generative-ai");
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const SYSTEM_PROMPT = `You are an intent classification engine for a website editing platform.

STRICT RULES:
- Output ONLY valid JSON.
- No explanations, no markdown, no code.
- Do not invent assets or file paths.
- If information is missing, set "needs_clarification": true.

Allowed intent_type values:
- add_logo
- replace_logo
- update_styles
- update_layout
- add_section
- content_edit
- fix_bug

Output schema:
{
  "intent_type": string,
  "target": string | null,
  "requires_asset": boolean,
  "asset_type": "logo" | "hero" | "image" | "icon" | null,
  "style_system": "tailwind" | "css" | "unknown",
  "scope": "component" | "page" | "global",
  "risk": "low" | "medium" | "high",
  "needs_clarification": boolean
}`;
async function parseIntent(prompt) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
    }
    const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
        generationConfig: {
            temperature: 0.1, // Low creativity for deterministic output
            candidateCount: 1,
        }
    });
    const result = await model.generateContent([
        { text: SYSTEM_PROMPT },
        { text: `User prompt: "${prompt}"` }
    ]);
    const response = result.response.text();
    // Extract JSON from response (remove markdown if present)
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Invalid response from intent parser');
    }
    const intent = JSON.parse(jsonMatch[0]);
    // Validate intent structure
    if (!intent.intent_type || intent.needs_clarification === undefined) {
        throw new Error('Incomplete intent classification');
    }
    return intent;
}
//# sourceMappingURL=intentParser.js.map