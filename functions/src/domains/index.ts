/**
 * Domain Management Cloud Functions
 *
 * Export all domain-related functions for the 1-click custom domain connection microservice.
 */

// Core domain operations
export { addCustomDomain } from './addCustomDomain';
export { configureGoDaddyDNS } from './configureGoDaddyDNS';
export { getDomainStatus } from './getDomainStatus';
export { verifyDomainOwnership } from './verifyDomainOwnership';
export { removeDomain } from './removeDomain';

// Re-export types for consumers
export * from './types';
