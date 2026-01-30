// CRITICAL: Import Firebase initialization FIRST
import './firebaseInit';

// ============================================================================
// OPTIMIZED EXPORTS - Lazy loading to prevent deployment timeouts
// ============================================================================

export {
  editSiteHTML,
  generateModernizedSite,
  findLeadsWithMaps
} from './minimalExports';

// ============================================================================
// GODADDY DOMAIN CONNECT
// ============================================================================

export {
  quickConnectDomain,
  listGoDaddyDomains,
  getDomainDNS
} from './godaddy/quickConnect';

// ============================================================================
// SETUP FUNCTIONS (One-time use)
// ============================================================================

export { setupAdmin } from './setup/createAdmin';
