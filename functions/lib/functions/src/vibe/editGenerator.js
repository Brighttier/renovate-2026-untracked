"use strict";
/**
 * Edit Generator - Gemini 3 Pro (Diff-only mode)
 *
 * Generates surgical diffs for code editing.
 * Per ENTERPRISE_ARCHITECTURE.md: Deep code understanding, structural awareness.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateEdit = generateEdit;
const generative_ai_1 = require("@google/generative-ai");
const GEMINI_MODEL = 'gemini-2.5-pro';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const MAX_RETRIES = 2;
const SYSTEM_PROMPT = `You are a surgical code editor for production websites.

STRICT RULES:
- Output ONLY unified diffs in standard format.
- Modify ONLY the provided code section.
- Do NOT add or delete files.
- Do NOT change exports or function signatures.
- Do NOT change layout unless explicitly requested.
- Respect the existing style system.
- If Tailwind is used, DO NOT write CSS.
- Use asset paths exactly as provided.
- Maintain accessibility (alt text, ARIA labels).
- Make the SMALLEST possible change.

DIFF FORMAT (Standard Unified Diff):
\`\`\`diff
--- a/component.html
+++ b/component.html
@@ -10,7 +10,7 @@
 <div class="hero">
-  <h1 class="text-4xl">Old Title</h1>
+  <h1 class="text-5xl text-blue-500">New Title</h1>
   <p>Description</p>
 </div>
\`\`\`

TAILWIND 4.0 CLASSES (Examples):
- Spacing: p-4, m-2, px-6, py-3, gap-4
- Colors: text-blue-500, bg-emerald-600, border-zinc-800
- Layout: flex, grid, items-center, justify-between
- Typography: text-lg, font-bold, leading-tight

ACCESSIBILITY REQUIREMENTS:
- All images MUST have alt text
- Buttons MUST have aria-label or text content
- Links MUST have descriptive text
- Form inputs MUST have labels`;
async function generateEdit(request) {
    if (!GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY not configured');
    }
    const startTime = Date.now();
    let retryCount = 0;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const genAI = new generative_ai_1.GoogleGenerativeAI(GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({
                model: GEMINI_MODEL,
                generationConfig: {
                    temperature: 0.3,
                    candidateCount: 1,
                }
            });
            // Build prompt
            let prompt = SYSTEM_PROMPT + '\n\n';
            const intentType = request.intent.intent_type.replace(/_/g, ' ');
            prompt += `Intent: ${intentType}\n`;
            prompt += `Target: ${request.intent.target || 'Not specified'}\n`;
            prompt += `Original Prompt: "${request.originalPrompt}"\n\n`;
            // Add constraints
            if (request.context.constraints.length > 0) {
                prompt += `Constraints:\n`;
                request.context.constraints.forEach(c => {
                    prompt += `- ${c.replace(/_/g, ' ')}\n`;
                });
                prompt += '\n';
            }
            // Add asset URLs if provided
            if (request.assetUrls && Object.keys(request.assetUrls).length > 0) {
                prompt += `Assets:\n`;
                for (const [name, url] of Object.entries(request.assetUrls)) {
                    prompt += `- ${name}: ${url}\n`;
                }
                prompt += '\n';
            }
            // Add context (code to edit)
            prompt += `Context (code to edit):\n`;
            for (const component of request.context.components) {
                prompt += `\n### Component: ${component.name}\n`;
                prompt += '```html\n';
                prompt += component.html;
                prompt += '\n```\n';
            }
            prompt += '\nGenerate the unified diff:';
            const result = await model.generateContent(prompt);
            const response = result.response.text();
            // Extract diff
            const diff = extractDiff(response);
            const latency = Date.now() - startTime;
            const tokenCount = Math.ceil((prompt.length + response.length) / 4);
            const cost = (tokenCount / 1000) * 0.01; // Rough estimate
            return {
                success: true,
                diff,
                summary: generateSummary(request.intent, diff),
                retryCount,
                tokenCount,
                cost,
                latency,
            };
        }
        catch (error) {
            retryCount++;
            if (attempt === MAX_RETRIES) {
                return {
                    success: false,
                    diff: '',
                    summary: 'Failed to generate edit',
                    error: error.message,
                    retryCount,
                    latency: Date.now() - startTime,
                };
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
    }
    return {
        success: false,
        diff: '',
        summary: 'Max retries exceeded',
        retryCount,
        latency: Date.now() - startTime,
    };
}
function extractDiff(text) {
    let cleaned = text
        .replace(/```diff\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();
    if (!cleaned.includes('---') || !cleaned.includes('+++')) {
        const lines = cleaned.split('\n');
        const diffLines = lines.filter(line => line.startsWith('-') || line.startsWith('+') || line.startsWith('@@') ||
            line.startsWith('---') || line.startsWith('+++'));
        if (diffLines.length > 0) {
            cleaned = diffLines.join('\n');
        }
    }
    return cleaned;
}
function generateSummary(intent, diff) {
    const lineCount = diff.split('\n').filter(line => line.startsWith('+') || line.startsWith('-')).length;
    const intentDesc = intent.intent_type.replace(/_/g, ' ');
    const target = intent.target ? ` to ${intent.target}` : '';
    return `${intentDesc}${target} (${lineCount} lines changed)`;
}
//# sourceMappingURL=editGenerator.js.map