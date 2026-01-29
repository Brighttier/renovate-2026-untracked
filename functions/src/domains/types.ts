/**
 * Domain Connection Types
 *
 * TypeScript interfaces for the 1-click custom domain connection microservice.
 * These types are used across Cloud Functions for domain management.
 */

import { Timestamp } from 'firebase-admin/firestore';

// ============================================================================
// Domain Connection Status
// ============================================================================

export type DomainConnectionStatus =
  | 'pending_verification'    // Waiting for TXT record verification
  | 'verification_failed'     // TXT record not found after polling
  | 'pending_dns'             // TXT verified, waiting for A records
  | 'dns_propagating'         // A records added, waiting for propagation
  | 'pending_ssl'             // DNS good, waiting for SSL provisioning
  | 'ssl_provisioning'        // SSL certificate being minted
  | 'connected'               // Fully live and operational
  | 'error'                   // Permanent error state
  | 'disconnected';           // Domain was removed/disconnected

export type SSLStatus = 'pending' | 'provisioning' | 'active' | 'failed';

// ============================================================================
// Firestore Document: domain_connections/{id}
// ============================================================================

export interface DomainConnection {
  id: string;
  domain: string;                          // "example.com"
  subdomain?: string;                      // "www" if applicable

  // Ownership
  agencyId: string;
  leadId: string;
  userId: string;

  // Firebase Hosting
  firebaseSiteId: string;                  // "renovatemysite-app"
  firebaseHostingResourceName?: string;    // Full resource name from API

  // Connection Details
  connectionMethod: 'GoDaddy' | 'Manual';
  status: DomainConnectionStatus;

  // Verification
  verificationToken: string;               // TXT record value
  verificationTxtRecord: string;           // Full TXT record (e.g., "firebase-site-verification=xxx")
  ownershipVerifiedAt?: Timestamp | string;

  // DNS Configuration
  dnsConfiguredAt?: Timestamp | string;
  dnsProvider?: string;                    // "godaddy", "cloudflare", etc.

  // SSL Certificate
  sslStatus: SSLStatus;
  sslProvisionedAt?: Timestamp | string;
  sslCertExpiry?: Timestamp | string;
  sslErrorMessage?: string;

  // Timestamps
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
  connectedAt?: Timestamp | string;        // When fully live

  // Retry/Error handling
  lastCheckAt?: Timestamp | string;
  checkCount: number;
  errorMessage?: string;
  errorCount: number;
}

// ============================================================================
// DNS Records
// ============================================================================

export interface DNSRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS';
  name: string;                            // "@" for root, "www" for subdomain
  data: string;                            // IP address or value
  ttl: number;                             // Time to live in seconds
}

// Firebase Hosting IP addresses
export const FIREBASE_HOSTING_IPS = ['199.36.158.100', '151.101.1.195'];

// ============================================================================
// Cloud Function Request/Response Types
// ============================================================================

// --- addCustomDomain ---

export interface AddCustomDomainRequest {
  domain: string;
  siteId?: string;                         // Optional, defaults to main site
  leadId: string;
  agencyId: string;
  connectionMethod: 'GoDaddy' | 'Manual';
}

export interface AddCustomDomainResponse {
  success: boolean;
  domainConnectionId: string;
  verificationToken: string;
  verificationTxtRecord: string;
  requiredRecords: DNSRecord[];
  status: DomainConnectionStatus;
  message: string;
}

// --- configureGoDaddyDNS ---

export interface ConfigureGoDaddyDNSRequest {
  domain: string;
  domainConnectionId: string;
  verificationToken: string;
  includeWww?: boolean;                    // Default true
}

export interface ConfigureGoDaddyDNSResponse {
  success: boolean;
  recordsAdded: DNSRecord[];
  estimatedPropagationMinutes: number;
  message: string;
}

// --- verifyDomainOwnership ---

export interface VerifyDomainOwnershipRequest {
  domainConnectionId: string;
}

export interface VerifyDomainOwnershipResponse {
  verified: boolean;
  status: DomainConnectionStatus;
  message: string;
  retryAfterMs?: number;                   // If not verified, suggest retry time
  currentTxtRecords?: string[];            // What we found
  expectedTxtRecord?: string;              // What we're looking for
}

// --- checkDNSPropagation ---

export interface CheckDNSPropagationRequest {
  domainConnectionId: string;
}

export interface CheckDNSPropagationResponse {
  propagated: boolean;
  currentRecords: string[];
  expectedRecords: string[];
  status: DomainConnectionStatus;
  message: string;
}

// --- getDomainStatus ---

export interface GetDomainStatusRequest {
  domainConnectionId: string;
}

export interface GetDomainStatusResponse {
  domain: string;
  status: DomainConnectionStatus;
  sslStatus: SSLStatus;
  sslCertExpiry?: string;
  lastCheckedAt: string;
  steps: {
    domainRegistered: boolean;
    ownershipVerified: boolean;
    dnsConfigured: boolean;
    sslProvisioned: boolean;
  };
  message: string;
  errorMessage?: string;
}

// --- removeDomain ---

export interface RemoveDomainRequest {
  domainConnectionId: string;
  removeFromGoDaddy?: boolean;             // Also remove DNS records
}

export interface RemoveDomainResponse {
  success: boolean;
  message: string;
}

// ============================================================================
// GoDaddy API Types
// ============================================================================

export interface GoDaddyCredentials {
  apiKey: string;
  apiSecret: string;
  lastFourKey?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface GoDaddyDNSRecord {
  type: string;
  name: string;
  data: string;
  ttl: number;
}

// ============================================================================
// Plan Limits
// ============================================================================

export interface PlanDomainLimits {
  free: number;
  starter: number;
  growth: number;
  enterprise: number;
}

export const PLAN_DOMAIN_LIMITS: PlanDomainLimits = {
  free: 1,
  starter: 3,
  growth: 15,
  enterprise: 999  // Effectively unlimited
};

// ============================================================================
// Utility Types
// ============================================================================

export interface DomainValidationResult {
  valid: boolean;
  sanitized: string;
  message?: string;
}

// DNS lookup result from dns.google.com
export interface DNSLookupResult {
  Status: number;
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: { name: string; type: number }[];
  Answer?: { name: string; type: number; TTL: number; data: string }[];
}
