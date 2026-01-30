/**
 * Branding Service - Vision API & Imagen 3 Integration
 * Handles logo extraction and generation for businesses
 */

const FUNCTIONS_BASE_URL = import.meta.env.VITE_FUNCTIONS_BASE_URL ||
  'https://us-central1-renovatemysite-vibe.cloudfunctions.net';

/**
 * Extract logo and brand colors from an image URL
 */
export async function extractBrandAssets(params: {
  imageUrl: string;
  businessName: string;
}): Promise<{
  success: boolean;
  logo?: {
    url: string;
    description?: string;
    confidence?: number;
  };
  brandColors?: Array<{
    hex: string;
    score: number;
    pixelFraction: number;
  }>;
  extractionMethod?: string;
  message?: string;
}> {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/extractLogo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract brand assets');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Extract brand assets error:', error);
    return {
      success: false,
      message: error.message || 'Failed to extract brand assets'
    };
  }
}

/**
 * Generate logo using Imagen 3
 */
export async function generateLogo(params: {
  businessName: string;
  category: string;
  brandArchetype?: string;
  colorScheme: string[];
  style?: 'minimal' | 'modern' | 'classic' | 'playful';
}): Promise<{
  logos: Array<{
    prompt: string;
    option: number;
    placeholder?: boolean;
    backgroundColor?: string;
    style?: string;
    businessName?: string;
  }>;
  imagenPrompt: string;
  generationMethod: string;
  note?: string;
  suggestedColors: string[];
}> {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/createLogo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        style: params.style || 'modern'
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate logo');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Generate logo error:', error);
    throw error;
  }
}

/**
 * Upload generated logo to Firebase Storage
 */
export async function uploadGeneratedLogo(params: {
  imageDataUrl: string;
  businessName: string;
  option: number;
}): Promise<{
  success: boolean;
  logoUrl: string;
}> {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/uploadLogo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload logo');
    }

    return await response.json();
  } catch (error: any) {
    console.error('Upload logo error:', error);
    throw error;
  }
}
