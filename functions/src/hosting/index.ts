/**
 * Firebase Hosting Module
 * Exports all hosting-related Cloud Functions
 */

// Site Creation
export {
    createFirebaseHostingSite,
    createFirebaseHostingSiteHTTP,
    generateSiteId,
    getClientSite,
    updateClientSiteStatus
} from './createSite';

// Site Deployment
export {
    deployToFirebaseHostingSite,
    deployToFirebaseHostingSiteHTTP,
    deployToSite
} from './deploySite';

// Domain Connection
export {
    connectCustomDomain,
    connectCustomDomainHTTP,
    disconnectCustomDomain,
    // 1-Click Launch (no domain required)
    oneClickLaunch,
    oneClickLaunchHTTP
} from './connectDomain';

// Domain Status Polling
export {
    pollDomainStatus,
    pollDomainStatusHTTP,
    scheduledDomainPolling,
    getDomainConnectionStatus,
    getDomainConnectionStatusHTTP,
    pollDomainStatusOnce
} from './pollDomainStatus';

// Types (re-export for convenience)
export * from './types';
