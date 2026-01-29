import * as functions from 'firebase-functions';
import { generateLogo, uploadGeneratedLogo } from './logoGenerator';

// CORS configuration
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Generate brand logo using Imagen 3
 */
export const createLogo = functions.https.onRequest(async (req, res) => {
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
        const {
            businessName,
            category,
            brandArchetype,
            colorScheme,
            style
        } = req.body;

        if (!businessName || !category || !colorScheme) {
            res.status(400).json({
                error: 'businessName, category, and colorScheme are required'
            });
            return;
        }

        // Validate style
        const validStyles = ['minimal', 'modern', 'classic', 'playful'];
        const logoStyle = validStyles.includes(style) ? style : 'modern';

        // Generate logo
        const result = await generateLogo({
            businessName,
            category,
            brandArchetype: brandArchetype || 'Professional and trustworthy',
            colorScheme: Array.isArray(colorScheme) ? colorScheme : [colorScheme],
            style: logoStyle
        });

        res.json(result);
    } catch (error: any) {
        console.error('createLogo error:', error);
        res.status(500).json({
            error: error.message || 'Failed to generate logo'
        });
    }
});

/**
 * Upload generated logo to Firebase Storage
 */
export const uploadLogo = functions.https.onRequest(async (req, res) => {
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
        const { imageDataUrl, businessName, option } = req.body;

        if (!imageDataUrl || !businessName) {
            res.status(400).json({
                error: 'imageDataUrl and businessName are required'
            });
            return;
        }

        // Upload logo
        const logoUrl = await uploadGeneratedLogo(
            imageDataUrl,
            businessName,
            option || 1
        );

        res.json({
            success: true,
            logoUrl
        });
    } catch (error: any) {
        console.error('uploadLogo error:', error);
        res.status(500).json({
            error: error.message || 'Failed to upload logo'
        });
    }
});
