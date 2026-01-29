import { ImageAnnotatorClient } from '@google-cloud/vision';
import { Storage } from '@google-cloud/storage';

const visionClient = new ImageAnnotatorClient();
const storage = new Storage();

/**
 * RGB to Hex color conversion
 */
function rgbToHex(r: number = 0, g: number = 0, b: number = 0): string {
  const toHex = (n: number) => {
    const hex = Math.round(n).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Extract logo from image URL using Google Vision API
 */
export async function extractLogoFromImage(imageUrl: string) {
  try {
    // Perform logo detection
    const [logoResult] = await visionClient.logoDetection(imageUrl);
    const logos = logoResult.logoAnnotations;

    // Perform color extraction
    const [colorResult] = await visionClient.imageProperties(imageUrl);
    const colors = colorResult.imagePropertiesAnnotation?.dominantColors?.colors || [];

    if (!logos || logos.length === 0) {
      return {
        success: false,
        message: 'No logo detected in the image. Please upload a clearer image with a visible logo.'
      };
    }

    // Get the highest confidence logo
    const bestLogo = logos[0];

    // Extract top 3 dominant colors
    const dominantColors = colors.slice(0, 3).map((c) => ({
      hex: rgbToHex(c.color?.red ?? undefined, c.color?.green ?? undefined, c.color?.blue ?? undefined),
      score: c.score || 0,
      pixelFraction: c.pixelFraction || 0
    }));

    // Filter out near-white and near-black colors for brand colors
    const brandColors = dominantColors.filter((color) => {
      const hex = color.hex.toLowerCase();
      // Exclude colors too close to white (#FFFFFF) or black (#000000)
      return hex !== '#ffffff' && hex !== '#000000' &&
             !hex.match(/^#[f-f][f-f][f-f][f-f][f-f][f-f]$/) &&
             !hex.match(/^#[0-2][0-2][0-2][0-2][0-2][0-2]$/);
    });

    return {
      success: true,
      logo: {
        description: bestLogo.description || 'Business Logo',
        confidence: bestLogo.score || 0,
        boundingBox: bestLogo.boundingPoly
      },
      brandColors: brandColors.length > 0 ? brandColors : dominantColors,
      extractionMethod: 'vision-api'
    };
  } catch (error: any) {
    console.error('Logo extraction error:', error);
    return {
      success: false,
      message: `Failed to extract logo: ${error.message}`
    };
  }
}

/**
 * Upload logo to Firebase Storage
 */
export async function uploadLogoToStorage(
  imageUrl: string,
  businessName: string
): Promise<string> {
  try {
    const bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET || 'renovatemysite-app.appspot.com');
    const timestamp = Date.now();
    const slug = businessName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const filename = `logos/${slug}-${timestamp}.png`;

    // Download image from URL
    const response = await fetch(imageUrl);
    const buffer = Buffer.from(await response.arrayBuffer());

    // Upload to Firebase Storage
    const file = bucket.file(filename);
    await file.save(buffer, {
      metadata: {
        contentType: 'image/png',
        metadata: {
          businessName: businessName,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    // Make the file publicly accessible
    await file.makePublic();

    // Return public URL
    return `https://storage.googleapis.com/${bucket.name}/${filename}`;
  } catch (error: any) {
    console.error('Logo upload error:', error);
    throw new Error(`Failed to upload logo: ${error.message}`);
  }
}

/**
 * Extract brand assets (logo + colors) from business image
 */
export async function extractBrandAssets(params: {
  imageUrl: string;
  businessName: string;
}) {
  const { imageUrl, businessName } = params;

  // Extract logo and colors
  const extractionResult = await extractLogoFromImage(imageUrl);

  if (!extractionResult.success) {
    return extractionResult;
  }

  try {
    // Upload logo to Firebase Storage
    const logoUrl = await uploadLogoToStorage(imageUrl, businessName);

    return {
      success: true,
      logo: {
        url: logoUrl,
        description: extractionResult.logo?.description,
        confidence: extractionResult.logo?.confidence
      },
      brandColors: extractionResult.brandColors,
      extractionMethod: 'vision-api'
    };
  } catch (error: any) {
    // Return extraction result even if upload fails
    return {
      ...extractionResult,
      uploadError: error.message,
      logo: {
        ...extractionResult.logo,
        url: imageUrl // Use original URL as fallback
      }
    };
  }
}
