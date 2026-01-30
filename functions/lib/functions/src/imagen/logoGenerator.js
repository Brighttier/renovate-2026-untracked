"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateLogo = generateLogo;
exports.uploadGeneratedLogo = uploadGeneratedLogo;
const generative_ai_1 = require("@google/generative-ai");
const secret_manager_1 = require("@google-cloud/secret-manager");
const storage_1 = require("@google-cloud/storage");
// Use node-fetch type to ensure compatibility
const _nodeFetchType = undefined;
void _nodeFetchType;
const secretClient = new secret_manager_1.SecretManagerServiceClient();
const storage = new storage_1.Storage();
// Get API key from Secret Manager
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
/**
 * Generate logo using Imagen 3 via Gemini API
 */
async function generateLogo(params) {
    try {
        const { businessName, category, brandArchetype, colorScheme, style } = params;
        const apiKey = await getGeminiApiKey();
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        // Step 1: Use Gemini 2.0 Flash to craft optimal Imagen prompt
        const promptDesigner = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        const promptDesignRequest = `You are a professional logo design expert specializing in ${style} brand identities.

Create a detailed image generation prompt for a professional business logo with these specifications:

Business Details:
- Name: ${businessName}
- Industry: ${category}
- Brand Personality: ${brandArchetype || 'Professional and trustworthy'}
- Style: ${style}
- Primary Color: ${colorScheme[0]}
- Secondary Color: ${colorScheme[1] || colorScheme[0]}

Logo Requirements:
1. Clean, scalable vector aesthetic (suitable for any size)
2. Include the business name "${businessName}" in clean, readable typography
3. Include a simple, memorable symbol/icon representing the ${category} industry
4. Solid background in ${colorScheme[0]} or white
5. Professional composition with balanced negative space
6. Modern, high-quality design that looks premium

Style Guidelines:
${style === 'minimal' ? '- Ultra-simple, clean lines, maximum 2 colors, lots of white space' : ''}
${style === 'modern' ? '- Contemporary sans-serif fonts, geometric shapes, bold and confident' : ''}
${style === 'classic' ? '- Timeless elegance, serif fonts, traditional symbols, sophisticated' : ''}
${style === 'playful' ? '- Friendly, rounded shapes, vibrant colors, approachable and fun' : ''}

Output Format:
Write ONLY the image generation prompt (no explanations, no additional text).
The prompt should be 2-3 sentences describing the exact visual composition.

Example for a dental clinic:
"Professional dental clinic logo featuring a stylized tooth icon in trust blue (#0EA5E9) with the text 'Smith Family Dentistry' in clean sans-serif typography. Minimalist design on white background with ample negative space, modern and approachable aesthetic."`;
        const promptResponse = await promptDesigner.generateContent(promptDesignRequest);
        const imagenPrompt = promptResponse.response.text().trim();
        console.log('Generated Imagen prompt:', imagenPrompt);
        // Step 2: Generate logo using Imagen 3 (currently via Gemini API)
        // Note: As of Jan 2026, direct Imagen 3 access requires Vertex AI
        // For now, we'll use a placeholder approach and document the integration point
        // TODO: Replace with actual Imagen 3 API call when available
        // const imagenModel = genAI.getGenerativeModel({ model: 'imagen-3.0-generate-001' });
        // const logoResult = await imagenModel.generateImages({
        //   prompt: imagenPrompt,
        //   numberOfImages: 3,
        //   aspectRatio: '1:1',
        //   safetyFilterLevel: 'block_low_and_above'
        // });
        // For now, return placeholder data that the client can use
        // Once Imagen 3 is set up, replace this with actual image generation
        const placeholderLogos = [
            {
                prompt: imagenPrompt,
                option: 1,
                placeholder: true,
                backgroundColor: colorScheme[0],
                style: style,
                businessName: businessName
            },
            {
                prompt: imagenPrompt,
                option: 2,
                placeholder: true,
                backgroundColor: colorScheme[1] || colorScheme[0],
                style: style,
                businessName: businessName
            },
            {
                prompt: imagenPrompt,
                option: 3,
                placeholder: true,
                backgroundColor: '#FFFFFF',
                style: style,
                businessName: businessName
            }
        ];
        return {
            logos: placeholderLogos,
            imagenPrompt: imagenPrompt,
            generationMethod: 'imagen-3-ready', // Will be 'imagen-3' when API is integrated
            note: 'Imagen 3 integration ready. Replace placeholder with actual API call.',
            suggestedColors: colorScheme
        };
    }
    catch (error) {
        console.error('Logo generation error:', error);
        throw new Error(`Failed to generate logo: ${error.message}`);
    }
}
/**
 * Upload generated logo to Firebase Storage
 */
async function uploadGeneratedLogo(imageDataUrl, businessName, option) {
    try {
        const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET || 'renovatemysite-app.appspot.com');
        const timestamp = Date.now();
        const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const filename = `logos/generated/${slug}-${option}-${timestamp}.png`;
        // Extract base64 data
        const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        // Upload to Firebase Storage
        const file = bucket.file(filename);
        await file.save(buffer, {
            metadata: {
                contentType: 'image/png',
                metadata: {
                    businessName: businessName,
                    generatedAt: new Date().toISOString(),
                    option: option.toString()
                }
            }
        });
        // Make the file publicly accessible
        await file.makePublic();
        // Return public URL
        return `https://storage.googleapis.com/${bucket.name}/${filename}`;
    }
    catch (error) {
        console.error('Logo upload error:', error);
        throw new Error(`Failed to upload generated logo: ${error.message}`);
    }
}
//# sourceMappingURL=logoGenerator.js.map