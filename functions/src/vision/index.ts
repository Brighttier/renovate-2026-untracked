import * as functions from 'firebase-functions';
import { extractBrandAssets } from './logoExtractor';

// CORS configuration
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Extract brand assets (logo + colors) from business image
 */
export const extractLogo = functions.https.onRequest(async (req, res) => {
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
        const { imageUrl, businessName } = req.body;

        if (!imageUrl || !businessName) {
            res.status(400).json({
                error: 'imageUrl and businessName are required'
            });
            return;
        }

        // Extract brand assets
        const result = await extractBrandAssets({
            imageUrl,
            businessName
        });

        if (!result.success) {
            res.status(400).json({
                error: (result as { message?: string }).message || 'Failed to extract brand assets'
            });
            return;
        }

        res.json(result);
    } catch (error: any) {
        console.error('extractLogo error:', error);
        res.status(500).json({
            error: error.message || 'Failed to extract brand assets'
        });
    }
});
