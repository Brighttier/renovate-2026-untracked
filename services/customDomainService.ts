/**
 * Custom Domain Service
 *
 * Frontend service for managing custom domain connections.
 * Provides Firebase callable function wrappers and polling utilities.
 */

import { getFunctions, httpsCallable, HttpsCallableResult } from 'firebase/functions';
import {
  AddCustomDomainRequest,
  AddCustomDomainResponse,
  ConfigureGoDaddyDNSRequest,
  ConfigureGoDaddyDNSResponse,
  GetDomainStatusResponse,
  VerifyDomainOwnershipResponse,
  DomainConnectionStatus,
  FirebaseHostingConnectionRequest,
  FirebaseHostingConnectionResponse,
  FirebaseHostingPollResponse
} from '../types';

// ============================================================================
// Firebase Functions Setup
// ============================================================================

let functionsInstance: ReturnType<typeof getFunctions> | null = null;

const getFirebaseFunctions = () => {
  if (!functionsInstance) {
    functionsInstance = getFunctions();
  }
  return functionsInstance;
};

// Generic callable function wrapper
function getCallable<T, R>(name: string) {
  return httpsCallable<T, R>(getFirebaseFunctions(), name);
}

// ============================================================================
// Domain Connection Service
// ============================================================================

export const customDomainService = {
  /**
   * Register a custom domain and get DNS requirements
   */
  addCustomDomain: async (request: AddCustomDomainRequest): Promise<AddCustomDomainResponse> => {
    try {
      const fn = getCallable<AddCustomDomainRequest, AddCustomDomainResponse>('addCustomDomain');
      const result: HttpsCallableResult<AddCustomDomainResponse> = await fn(request);
      return result.data;
    } catch (error: unknown) {
      console.error('Error adding custom domain:', error);
      throw error;
    }
  },

  /**
   * Configure DNS via GoDaddy (1-click flow)
   * Uses platform GoDaddy credentials
   */
  configureGoDaddyDNS: async (
    domain: string,
    domainConnectionId: string,
    verificationToken: string,
    includeWww = true
  ): Promise<ConfigureGoDaddyDNSResponse> => {
    try {
      const fn = getCallable<ConfigureGoDaddyDNSRequest, ConfigureGoDaddyDNSResponse>('configureGoDaddyDNS');
      const result = await fn({
        domain,
        domainConnectionId,
        verificationToken,
        includeWww
      });
      return result.data;
    } catch (error: unknown) {
      console.error('Error configuring GoDaddy DNS:', error);
      throw error;
    }
  },

  /**
   * Check domain ownership verification (TXT record)
   */
  verifyDomainOwnership: async (domainConnectionId: string): Promise<VerifyDomainOwnershipResponse> => {
    try {
      const fn = getCallable<{ domainConnectionId: string }, VerifyDomainOwnershipResponse>('verifyDomainOwnership');
      const result = await fn({ domainConnectionId });
      return result.data;
    } catch (error: unknown) {
      console.error('Error verifying domain ownership:', error);
      throw error;
    }
  },

  /**
   * Get comprehensive domain connection status
   */
  getDomainStatus: async (domainConnectionId: string): Promise<GetDomainStatusResponse> => {
    try {
      const fn = getCallable<{ domainConnectionId: string }, GetDomainStatusResponse>('getDomainStatus');
      const result = await fn({ domainConnectionId });
      return result.data;
    } catch (error: unknown) {
      console.error('Error getting domain status:', error);
      throw error;
    }
  },

  /**
   * Remove/disconnect a custom domain
   */
  removeDomain: async (
    domainConnectionId: string,
    removeFromGoDaddy = false
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const fn = getCallable<
        { domainConnectionId: string; removeFromGoDaddy: boolean },
        { success: boolean; message: string }
      >('removeDomain');
      const result = await fn({ domainConnectionId, removeFromGoDaddy });
      return result.data;
    } catch (error: unknown) {
      console.error('Error removing domain:', error);
      throw error;
    }
  },

  /**
   * Poll domain status until connected or error
   * Returns a cleanup function to stop polling
   */
  pollDomainStatus: (
    domainConnectionId: string,
    onStatusChange: (status: GetDomainStatusResponse) => void,
    options: {
      intervalMs?: number;
      maxAttempts?: number;
      onError?: (error: unknown) => void;
    } = {}
  ): (() => void) => {
    const { intervalMs = 15000, maxAttempts = 40, onError } = options;
    let attempts = 0;
    let timeoutId: NodeJS.Timeout | null = null;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;

      try {
        const status = await customDomainService.getDomainStatus(domainConnectionId);
        onStatusChange(status);

        // Stop polling if we've reached a terminal state
        const terminalStates: DomainConnectionStatus[] = ['connected', 'disconnected', 'error', 'verification_failed'];
        if (terminalStates.includes(status.status)) {
          return;
        }

        // Continue polling if we haven't exceeded max attempts
        if (++attempts < maxAttempts && !stopped) {
          timeoutId = setTimeout(poll, intervalMs);
        }
      } catch (error) {
        console.error('Polling error:', error);
        if (onError) {
          onError(error);
        }
        // Retry on error unless stopped
        if (++attempts < maxAttempts && !stopped) {
          timeoutId = setTimeout(poll, intervalMs * 2); // Double interval on error
        }
      }
    };

    // Start polling
    poll();

    // Return cleanup function
    return () => {
      stopped = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  },

  /**
   * Get user-friendly step label from status
   */
  getStepLabel: (status: DomainConnectionStatus): string => {
    switch (status) {
      case 'pending_verification':
        return 'Verifying ownership...';
      case 'verification_failed':
        return 'Verification failed';
      case 'pending_dns':
        return 'Waiting for DNS...';
      case 'dns_propagating':
        return 'DNS propagating...';
      case 'pending_ssl':
        return 'Provisioning SSL...';
      case 'ssl_provisioning':
        return 'SSL provisioning...';
      case 'connected':
        return 'Connected!';
      case 'error':
        return 'Error occurred';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Processing...';
    }
  },

  /**
   * Get step progress (0-4) from status
   */
  getStepProgress: (status: DomainConnectionStatus): number => {
    switch (status) {
      case 'pending_verification':
        return 1;
      case 'verification_failed':
        return 1;
      case 'pending_dns':
        return 2;
      case 'dns_propagating':
        return 2;
      case 'pending_ssl':
        return 3;
      case 'ssl_provisioning':
        return 3;
      case 'connected':
        return 4;
      case 'error':
      case 'disconnected':
        return 0;
      default:
        return 0;
    }
  },

  /**
   * Check if status indicates an error state
   */
  isErrorStatus: (status: DomainConnectionStatus): boolean => {
    return ['error', 'verification_failed'].includes(status);
  },

  /**
   * Check if status indicates completion
   */
  isComplete: (status: DomainConnectionStatus): boolean => {
    return status === 'connected';
  },

  // ============================================================================
  // Firebase Hosting 1-Click Connection Methods
  // ============================================================================

  /**
   * Create a new Firebase Hosting site for a client
   */
  createFirebaseHostingSite: async (
    businessName: string,
    leadId: string,
    agencyId: string
  ): Promise<{
    success: boolean;
    siteId?: string;
    defaultUrl?: string;
    isExisting?: boolean;
    error?: string;
  }> => {
    try {
      const fn = getCallable<
        { businessName: string; leadId: string; agencyId: string },
        { success: boolean; siteId?: string; defaultUrl?: string; isExisting?: boolean; error?: string }
      >('createFirebaseHostingSite');
      const result = await fn({ businessName, leadId, agencyId });
      return result.data;
    } catch (error: unknown) {
      console.error('Error creating Firebase Hosting site:', error);
      throw error;
    }
  },

  /**
   * Deploy HTML content to a Firebase Hosting site
   */
  deployToFirebaseHostingSite: async (
    siteId: string,
    htmlContent: string
  ): Promise<{
    success: boolean;
    siteUrl?: string;
    versionId?: string;
    error?: string;
  }> => {
    try {
      const fn = getCallable<
        { siteId: string; htmlContent: string },
        { success: boolean; siteUrl?: string; versionId?: string; error?: string }
      >('deployToFirebaseHostingSite');
      const result = await fn({ siteId, htmlContent });
      return result.data;
    } catch (error: unknown) {
      console.error('Error deploying to Firebase Hosting site:', error);
      throw error;
    }
  },

  /**
   * 1-Click Domain Connection Flow
   * Creates site, deploys content, and connects custom domain in one call
   */
  connectCustomDomainOneClick: async (
    request: FirebaseHostingConnectionRequest
  ): Promise<FirebaseHostingConnectionResponse> => {
    try {
      const fn = getCallable<FirebaseHostingConnectionRequest, FirebaseHostingConnectionResponse>('connectCustomDomain');
      const result = await fn(request);
      return result.data;
    } catch (error: unknown) {
      console.error('Error in 1-click domain connection:', error);
      throw error;
    }
  },

  /**
   * Disconnect a custom domain from Firebase Hosting
   */
  disconnectCustomDomainFromHosting: async (
    connectionId: string,
    removeSite: boolean = false
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const fn = getCallable<
        { connectionId: string; removeSite: boolean },
        { success: boolean; error?: string }
      >('disconnectCustomDomain');
      const result = await fn({ connectionId, removeSite });
      return result.data;
    } catch (error: unknown) {
      console.error('Error disconnecting domain from Firebase Hosting:', error);
      throw error;
    }
  },

  /**
   * Poll Firebase Hosting domain status
   */
  pollFirebaseHostingDomainStatus: async (
    connectionId: string,
    siteId: string,
    domain: string
  ): Promise<FirebaseHostingPollResponse> => {
    try {
      const fn = getCallable<
        { connectionId: string; siteId: string; domain: string },
        FirebaseHostingPollResponse
      >('pollDomainStatus');
      const result = await fn({ connectionId, siteId, domain });
      return result.data;
    } catch (error: unknown) {
      console.error('Error polling Firebase Hosting domain status:', error);
      throw error;
    }
  },

  /**
   * Get Firebase Hosting domain connection status
   */
  getFirebaseHostingConnectionStatus: async (
    connectionId: string
  ): Promise<{
    connectionId: string;
    domain: string;
    siteId: string;
    status: DomainConnectionStatus;
    hostState?: string;
    ownershipStatus?: string;
    certState?: string;
    siteUrl?: string;
    dnsRecords?: Array<{ type: string; name: string; value: string; status: string }>;
    createdAt: string;
    updatedAt: string;
  }> => {
    try {
      const fn = getCallable<
        { connectionId: string },
        {
          connectionId: string;
          domain: string;
          siteId: string;
          status: DomainConnectionStatus;
          hostState?: string;
          ownershipStatus?: string;
          certState?: string;
          siteUrl?: string;
          dnsRecords?: Array<{ type: string; name: string; value: string; status: string }>;
          createdAt: string;
          updatedAt: string;
        }
      >('getDomainConnectionStatus');
      const result = await fn({ connectionId });
      return result.data;
    } catch (error: unknown) {
      console.error('Error getting Firebase Hosting connection status:', error);
      throw error;
    }
  },

  /**
   * Poll Firebase Hosting domain status until connected or error
   * Returns a cleanup function to stop polling
   */
  pollFirebaseHostingUntilComplete: (
    connectionId: string,
    siteId: string,
    domain: string,
    onStatusChange: (status: FirebaseHostingPollResponse) => void,
    options: {
      initialDelayMs?: number;
      maxDurationMs?: number;
      onError?: (error: unknown) => void;
    } = {}
  ): (() => void) => {
    const {
      initialDelayMs = 10000,
      maxDurationMs = 3600000, // 1 hour max
      onError
    } = options;

    let timeoutId: NodeJS.Timeout | null = null;
    let stopped = false;
    const startTime = Date.now();

    const poll = async () => {
      if (stopped) return;

      // Check max duration
      if (Date.now() - startTime > maxDurationMs) {
        console.log('Max polling duration exceeded');
        return;
      }

      try {
        const status = await customDomainService.pollFirebaseHostingDomainStatus(
          connectionId,
          siteId,
          domain
        );
        onStatusChange(status);

        // Stop if complete or error
        if (status.isComplete || !status.requiresRetry) {
          return;
        }

        // Schedule next poll
        const nextDelay = status.nextCheckDelay || initialDelayMs;
        if (!stopped) {
          timeoutId = setTimeout(poll, nextDelay);
        }
      } catch (error) {
        console.error('Firebase Hosting polling error:', error);
        if (onError) {
          onError(error);
        }
        // Retry on error unless stopped
        if (!stopped) {
          timeoutId = setTimeout(poll, initialDelayMs * 2);
        }
      }
    };

    // Start polling after initial delay
    timeoutId = setTimeout(poll, initialDelayMs);

    // Return cleanup function
    return () => {
      stopped = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  },

  /**
   * Get step label for Firebase Hosting connection status
   */
  getFirebaseHostingStepLabel: (status: DomainConnectionStatus): string => {
    switch (status) {
      case 'creating_site':
        return 'Creating hosting site...';
      case 'deploying_content':
        return 'Deploying your website...';
      case 'adding_domain':
        return 'Connecting domain...';
      case 'pending_dns':
        return 'Configuring DNS records...';
      case 'dns_propagating':
        return 'DNS propagating...';
      case 'pending_ssl':
        return 'Requesting SSL certificate...';
      case 'ssl_provisioning':
        return 'Provisioning SSL...';
      case 'connected':
        return 'Site is live!';
      case 'error':
        return 'Error occurred';
      case 'rollback':
        return 'Rolling back changes...';
      default:
        return 'Processing...';
    }
  },

  /**
   * Get step progress (0-6) for Firebase Hosting connection
   */
  getFirebaseHostingStepProgress: (status: DomainConnectionStatus): number => {
    switch (status) {
      case 'creating_site':
        return 1;
      case 'deploying_content':
        return 2;
      case 'adding_domain':
        return 3;
      case 'pending_dns':
      case 'dns_propagating':
        return 4;
      case 'pending_ssl':
      case 'ssl_provisioning':
        return 5;
      case 'connected':
        return 6;
      case 'error':
      case 'rollback':
        return 0;
      default:
        return 0;
    }
  },

  // ============================================================================
  // 1-Click Launch (No Domain Required)
  // ============================================================================

  /**
   * 1-Click Launch - Deploy site instantly without custom domain
   * Returns a .web.app URL immediately
   */
  oneClickLaunch: async (request: {
    leadId: string;
    agencyId: string;
    businessName: string;
    htmlContent: string;
  }): Promise<{
    success: boolean;
    connectionId?: string;
    siteId?: string;
    siteUrl?: string;
    status?: string;
    error?: string;
  }> => {
    try {
      const fn = getCallable<
        { leadId: string; agencyId: string; businessName: string; htmlContent: string },
        {
          success: boolean;
          connectionId?: string;
          siteId?: string;
          siteUrl?: string;
          status?: string;
          error?: string;
        }
      >('oneClickLaunch');
      const result = await fn(request);
      return result.data;
    } catch (error: unknown) {
      console.error('Error in 1-Click Launch:', error);
      throw error;
    }
  },

  /**
   * Connect a custom domain to an existing site (after 1-click launch)
   * This can be used when user wants to add a custom domain later
   */
  addCustomDomainToExistingSite: async (request: {
    siteId: string;
    domain: string;
    connectionMethod?: 'firebase_auto' | 'godaddy_auto' | 'manual';
  }): Promise<FirebaseHostingConnectionResponse> => {
    try {
      const fn = getCallable<
        { siteId: string; domain: string; connectionMethod?: string },
        FirebaseHostingConnectionResponse
      >('connectCustomDomain');
      const result = await fn(request);
      return result.data;
    } catch (error: unknown) {
      console.error('Error adding custom domain to existing site:', error);
      throw error;
    }
  }
};

export default customDomainService;
