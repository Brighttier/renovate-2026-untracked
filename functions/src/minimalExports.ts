/**
 * Minimal export file with lazy loading to avoid deployment timeouts
 * Only exports the most essential functions with optimized loading
 */

// Export only editSiteHTML with lazy imports
export { editSiteHTML } from './gemini/editSiteHTMLStandalone';

// 2nd Gen Functions for maximum performance
import { onRequest } from 'firebase-functions/v2/https';

// 1st Gen Functions for legacy compatibility
import * as functions from 'firebase-functions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * generateModernizedSite - 2nd Gen Function (Maximum Performance)
 *
 * Configuration:
 * - 16GB memory (max for 2nd gen)
 * - 4 vCPU (max for 2nd gen)
 * - 540s timeout (9 minutes)
 * - Concurrency: 80 (handle multiple requests per warm instance)
 * - Faster cold starts than 1st gen
 */
export const generateModernizedSite = onRequest(
  {
    timeoutSeconds: 540,    // 9 minutes max
    memory: '16GiB',        // Maximum memory for 2nd gen
    cpu: 4,                 // Maximum CPU for 2nd gen
    concurrency: 80,        // Handle multiple requests per warm instance
    region: 'us-central1',
    cors: true,             // Enable CORS automatically
  },
  async (req, res) => {
    // Handle CORS preflight (backup - cors: true should handle this)
    if (req.method === 'OPTIONS') {
      res.set(corsHeaders).status(204).send('');
      return;
    }
    res.set(corsHeaders);

    // Lazy load the actual implementation only when called
    const { generateModernizedSiteHandler } = await import('./gemini/index');
    return generateModernizedSiteHandler(req, res);
  }
);

// Keep findLeadsWithMaps as 1st gen for now
export const findLeadsWithMaps = functions.https.onRequest(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders).status(204).send('');
    return;
  }
  res.set(corsHeaders);

  // Lazy load the actual implementation only when called
  const { findLeadsWithMaps: actualFunction } = await import('./research/index');
  return actualFunction(req, res);
});
