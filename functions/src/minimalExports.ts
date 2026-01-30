/**
 * Minimal export file with lazy loading to avoid deployment timeouts
 * Only exports the most essential functions with optimized loading
 */

// Export only editSiteHTML with lazy imports
export { editSiteHTML } from './gemini/editSiteHTMLStandalone';

// Lazy wrapper for generateModernizedSite
import * as functions from 'firebase-functions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export const generateModernizedSite = functions
  .runWith({
    timeoutSeconds: 540, // 9 minutes max for deep scraping + image generation + HTML generation
    memory: '8GB',       // Maximum memory for 1st gen functions
    // Note: With 8GB memory, you automatically get 2 vCPU
  })
  .https.onRequest(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.set(corsHeaders).status(204).send('');
    return;
  }
  res.set(corsHeaders);

  // Lazy load the actual implementation only when called
  const { generateModernizedSite: actualFunction } = await import('./gemini/index');
  return actualFunction(req, res);
});

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
