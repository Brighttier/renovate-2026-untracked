/**
 * Standalone editSiteHTML function with lazy imports
 * Optimized for fast deployment initialization
 */
import * as functions from 'firebase-functions';
import { getStorage } from 'firebase-admin/storage';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Lazy-loaded dependencies (only load when function is called)
let GoogleGenerativeAI: any = null;
let SecretManagerServiceClient: any = null;

async function loadDependencies() {
  if (!GoogleGenerativeAI) {
    const { GoogleGenerativeAI: GAI } = await import('@google/generative-ai');
    GoogleGenerativeAI = GAI;
  }
  if (!SecretManagerServiceClient) {
    const { SecretManagerServiceClient: SMSC } = await import('@google-cloud/secret-manager');
    SecretManagerServiceClient = SMSC;
  }
}

async function getGenAI() {
  await loadDependencies();
  const client = new SecretManagerServiceClient();
  const [version] = await client.accessSecretVersion({
    name: 'projects/renovatemysite-vibe/secrets/gemini-api-key/versions/latest',
  });
  const apiKey = version.payload?.data?.toString() || '';
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Upload a base64 image to Firebase Storage and return public URL
 */
async function uploadImageToStorage(
  base64Data: string,
  mimeType: string,
  fileName?: string
): Promise<string> {
  const bucket = getStorage().bucket();
  const timestamp = Date.now();
  const extension = mimeType.split('/')[1] || 'png';
  const safeFileName = (fileName || 'uploaded-image').replace(/[^a-zA-Z0-9.-]/g, '-');
  const filePath = `user-uploads/${timestamp}-${safeFileName}.${extension}`;

  const file = bucket.file(filePath);
  const buffer = Buffer.from(base64Data, 'base64');

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000',
    }
  });

  await file.makePublic();

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
  console.log('editSiteHTML: Uploaded image to:', publicUrl);

  return publicUrl;
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

function detectEditType(instruction: string): string {
  const lower = instruction.toLowerCase();
  if (/color|colour|theme|palette/i.test(lower)) return 'color';
  if (/text|wording|copy|heading|title|paragraph/i.test(lower)) return 'text';
  if (/layout|position|spacing|margin|padding|grid|flex/i.test(lower)) return 'layout';
  if (/logo|image|photo|picture|icon/i.test(lower)) return 'image';
  if (/font|typography|size|weight/i.test(lower)) return 'typography';
  return 'general';
}

export const editSiteHTML = functions
  .runWith({
    timeoutSeconds: 120,
    memory: '1GB',
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
    console.log('editSiteHTML: Attachments count:', attachments?.length || 0);

    // Upload attachments to Firebase Storage and get URLs
    const uploadedImageUrls: string[] = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.base64Data && att.mimeType) {
          try {
            const url = await uploadImageToStorage(
              att.base64Data,
              att.mimeType,
              att.fileName
            );
            uploadedImageUrls.push(url);
          } catch (uploadError) {
            console.error('editSiteHTML: Failed to upload image:', uploadError);
          }
        }
      }
    }

    // Build image instruction if images were uploaded
    let imageInstruction = '';
    if (uploadedImageUrls.length > 0) {
      imageInstruction = `

# UPLOADED IMAGE(S) - USE THESE EXACT URLs
The user has uploaded ${uploadedImageUrls.length} image(s). You MUST use these exact URLs in the HTML:
${uploadedImageUrls.map((url, i) => `- Image ${i + 1}: ${url}`).join('\n')}

CRITICAL FOR LOGO/IMAGE REPLACEMENT:
1. Find the existing logo/image <img> tag in the HTML
2. Replace ONLY the src attribute with the new URL above
3. Keep all other attributes (class, alt, etc.) intact
4. If replacing a logo, look for: <img> tags with "logo" in class/alt/id, or in <nav>/<header> sections

Example change for logo replacement:
{
  "original": "<img src=\"OLD_URL\" class=\"h-8 w-auto\" alt=\"Logo\">",
  "replacement": "<img src=\"${uploadedImageUrls[0]}\" class=\"h-8 w-auto\" alt=\"Logo\">"
}`;
    }

    // Build the diff-based prompt
    const prompt = `${DIFF_EDITING_INSTRUCTION}
${imageInstruction}

# USER REQUEST
${instruction}

# CURRENT HTML
\`\`\`html
${currentHTML.substring(0, 20000)}
\`\`\`

Return the changes as JSON.`;

    const parts: any[] = [{ text: prompt }];

    // Also send the image to AI for visual context (helps AI understand what image is being added)
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.base64Data && att.mimeType) {
          parts.push({
            inlineData: {
              mimeType: att.mimeType,
              data: att.base64Data,
            },
          });
        }
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
      uploadedImages: uploadedImageUrls, // Return URLs so frontend knows what was uploaded
    });
  } catch (error: any) {
    console.error('editSiteHTML error:', error);
    res.status(500).json({
      error: error.message || 'Failed to edit HTML',
    });
  }
});
