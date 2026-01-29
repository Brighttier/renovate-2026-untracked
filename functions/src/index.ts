import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export all GoDaddy functions
export { fetchGoDaddyDomains } from './godaddy/fetchDomains';
export { propagateFirebaseDNS } from './godaddy/updateDNS';
export { updateGoDaddyCredentials, testGoDaddyCredentials } from './godaddy/updateCredentials';

// Export all Gemini AI functions
export { findBusinesses, generateBlueprint, editBlueprint, generateImage, generateSiteHTML, editSiteHTML, generateAIImage, generateModernizedSite, generateTotalContentModernizedSite } from './gemini';

// Export Vibe Coder functions (new site generation flow)
export { analyzeBrand, generateSiteFromBrief, generateVibeImage } from './gemini';

// Export Site Modernization extraction service (Scout)
export { extractSiteIdentity } from './scraping/siteIdentity';

// Export research functions with Google Search grounding
export { researchBusiness, findBusinessesWithSearch, findLeadsWithMaps } from './research';

// Export Vision API functions
export { extractLogo } from './vision';

// Export Imagen functions
export { createLogo, uploadLogo } from './imagen';

// Export Domain Management functions (1-click custom domain connection)
export {
  addCustomDomain,
  configureGoDaddyDNS,
  getDomainStatus,
  verifyDomainOwnership,
  removeDomain
} from './domains';

// Export Firebase Hosting functions (1-click site deployment)
export {
  // Site Creation
  createFirebaseHostingSite,
  createFirebaseHostingSiteHTTP,
  // Site Deployment
  deployToFirebaseHostingSite,
  deployToFirebaseHostingSiteHTTP,
  // Domain Connection
  connectCustomDomain,
  connectCustomDomainHTTP,
  disconnectCustomDomain,
  // 1-Click Launch (no domain required)
  oneClickLaunch,
  oneClickLaunchHTTP,
  // Domain Status Polling
  pollDomainStatus,
  pollDomainStatusHTTP,
  scheduledDomainPolling,
  getDomainConnectionStatus,
  getDomainConnectionStatusHTTP
} from './hosting';
