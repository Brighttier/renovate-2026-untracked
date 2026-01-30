/**
 * Minimal export file with lazy loading to avoid deployment timeouts
 * Only exports the most essential functions with optimized loading
 */

// Export only editSiteHTML with lazy imports
export { editSiteHTML } from './gemini/editSiteHTMLStandalone';

// Lazy wrapper for generateModernizedSite
import * as functions from 'firebase-functions';

export const generateModernizedSite = functions.https.onRequest(async (req, res) => {
  // Lazy load the actual implementation only when called
  const { generateModernizedSite: actualFunction } = await import('./gemini/index');
  return actualFunction(req, res);
});

export const findLeadsWithMaps = functions.https.onRequest(async (req, res) => {
  // Lazy load the actual implementation only when called
  const { findLeadsWithMaps: actualFunction } = await import('./research/index');
  return actualFunction(req, res);
});
