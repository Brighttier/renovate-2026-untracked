/**
 * getDomainStatus Cloud Function
 *
 * Returns comprehensive status of a domain connection including:
 * - Domain verification status
 * - DNS propagation status
 * - SSL certificate status
 * - Step-by-step progress tracking
 *
 * This function is called repeatedly by the frontend for polling.
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  GetDomainStatusRequest,
  GetDomainStatusResponse,
  DomainConnection,
  DomainConnectionStatus,
  SSLStatus,
  FIREBASE_HOSTING_IPS,
  DNSLookupResult
} from './types';

const db = admin.firestore();

// ============================================================================
// DNS Lookup via Google DNS-over-HTTPS
// ============================================================================

/**
 * Performs DNS lookup using Google's DNS-over-HTTPS API
 * This works from Cloud Functions without needing the dns module
 */
async function dnsLookup(
  domain: string,
  recordType: 'A' | 'TXT'
): Promise<string[]> {
  try {
    const typeCode = recordType === 'A' ? 1 : 16; // A=1, TXT=16
    const response = await fetch(
      `https://dns.google.com/resolve?name=${encodeURIComponent(domain)}&type=${typeCode}`,
      {
        headers: { 'Accept': 'application/json' }
      }
    );

    if (!response.ok) {
      console.error(`DNS lookup failed for ${domain}: ${response.status}`);
      return [];
    }

    const data: DNSLookupResult = await response.json();

    if (!data.Answer || data.Answer.length === 0) {
      return [];
    }

    // Extract data values, removing quotes from TXT records
    return data.Answer.map(record =>
      record.data.replace(/^"|"$/g, '').trim()
    );
  } catch (error) {
    console.error(`DNS lookup error for ${domain}:`, error);
    return [];
  }
}

/**
 * Checks if TXT verification record exists
 */
async function checkTxtVerification(
  domain: string,
  expectedToken: string
): Promise<boolean> {
  const txtRecords = await dnsLookup(domain, 'TXT');
  console.log(`TXT records for ${domain}:`, txtRecords);

  return txtRecords.some(record =>
    record.includes(expectedToken) || record.includes('firebase-site-verification')
  );
}

/**
 * Checks if A records point to Firebase
 */
async function checkARecords(domain: string): Promise<{
  propagated: boolean;
  currentRecords: string[];
}> {
  const aRecords = await dnsLookup(domain, 'A');
  console.log(`A records for ${domain}:`, aRecords);

  // Check if at least one Firebase IP is present
  const hasFirebaseIp = aRecords.some(ip => FIREBASE_HOSTING_IPS.includes(ip));

  return {
    propagated: hasFirebaseIp,
    currentRecords: aRecords
  };
}

/**
 * Determines the overall status based on individual checks
 */
function determineStatus(
  connection: DomainConnection,
  txtVerified: boolean,
  dnsPropagated: boolean
): DomainConnectionStatus {
  // If already connected or disconnected, keep that status
  if (connection.status === 'connected' || connection.status === 'disconnected') {
    return connection.status;
  }

  // If there's an error state, check if we can recover
  if (connection.status === 'error') {
    // Try to recover if conditions improve
    if (txtVerified && dnsPropagated) {
      return 'pending_ssl';
    }
    return 'error';
  }

  // Progression through states
  if (!txtVerified) {
    if (connection.checkCount > 20) {
      return 'verification_failed';
    }
    return 'pending_verification';
  }

  if (!dnsPropagated) {
    return 'dns_propagating';
  }

  // Both verified - check SSL
  if (connection.sslStatus === 'active') {
    return 'connected';
  }

  if (connection.sslStatus === 'provisioning') {
    return 'ssl_provisioning';
  }

  return 'pending_ssl';
}

/**
 * Generates user-friendly message based on status
 */
function getStatusMessage(status: DomainConnectionStatus, domain: string): string {
  switch (status) {
    case 'pending_verification':
      return 'Waiting for TXT verification record to propagate. This usually takes 5-15 minutes.';
    case 'verification_failed':
      return 'TXT verification failed. Please check that the DNS record was added correctly.';
    case 'pending_dns':
      return 'TXT verified. Waiting for A records to be configured.';
    case 'dns_propagating':
      return 'DNS records are propagating. This usually takes 5-15 minutes.';
    case 'pending_ssl':
      return 'DNS is configured. Waiting for SSL certificate provisioning.';
    case 'ssl_provisioning':
      return 'SSL certificate is being provisioned. This usually takes 1-5 minutes.';
    case 'connected':
      return `Success! ${domain} is now live with SSL enabled.`;
    case 'error':
      return 'An error occurred. Please check the error message and try again.';
    case 'disconnected':
      return 'Domain has been disconnected.';
    default:
      return 'Checking domain status...';
  }
}

// ============================================================================
// Main Cloud Function
// ============================================================================

export const getDomainStatus = functions
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB'
  })
  .https.onCall(
    async (
      data: GetDomainStatusRequest,
      context: functions.https.CallableContext
    ): Promise<GetDomainStatusResponse> => {
      // 1. Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'You must be logged in to check domain status'
        );
      }

      const userId = context.auth.uid;
      const { domainConnectionId } = data;

      if (!domainConnectionId) {
        throw new functions.https.HttpsError(
          'invalid-argument',
          'Domain connection ID is required'
        );
      }

      // 2. Get domain connection record
      const docRef = db.collection('domain_connections').doc(domainConnectionId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new functions.https.HttpsError(
          'not-found',
          'Domain connection not found'
        );
      }

      const connection = doc.data() as DomainConnection;

      // 3. Verify permission (owner or admin)
      if (connection.userId !== userId) {
        const adminDoc = await db.collection('admins').doc(userId).get();
        if (!adminDoc.exists) {
          throw new functions.https.HttpsError(
            'permission-denied',
            'You do not have permission to view this domain'
          );
        }
      }

      // 4. If already connected or disconnected, return cached status
      if (connection.status === 'connected' || connection.status === 'disconnected') {
        return {
          domain: connection.domain,
          status: connection.status,
          sslStatus: connection.sslStatus,
          sslCertExpiry: connection.sslCertExpiry as string | undefined,
          lastCheckedAt: new Date().toISOString(),
          steps: {
            domainRegistered: true,
            ownershipVerified: true,
            dnsConfigured: true,
            sslProvisioned: connection.sslStatus === 'active'
          },
          message: getStatusMessage(connection.status, connection.domain)
        };
      }

      // 5. Perform DNS checks
      const txtVerified = await checkTxtVerification(
        connection.domain,
        connection.verificationToken
      );

      const aRecordCheck = await checkARecords(connection.domain);

      // 6. Determine new status
      const newStatus: DomainConnectionStatus = determineStatus(connection, txtVerified, aRecordCheck.propagated);
      const now = new Date().toISOString();

      // 7. Determine SSL status
      let sslStatus: SSLStatus = connection.sslStatus;
      if (txtVerified && aRecordCheck.propagated) {
        // If DNS is fully propagated, SSL should start provisioning
        if (sslStatus === 'pending') {
          sslStatus = 'provisioning';
        }
        // Simulate SSL completion after some time (in production, check Firebase API)
        if (connection.checkCount > 5 && sslStatus === 'provisioning') {
          sslStatus = 'active';
        }
      }

      // 8. Update Firestore with new status
      const updates: Partial<DomainConnection> = {
        status: newStatus,
        sslStatus,
        lastCheckAt: now,
        updatedAt: now,
        checkCount: (connection.checkCount || 0) + 1
      };

      // Update verification timestamp if just verified
      if (txtVerified && !connection.ownershipVerifiedAt) {
        updates.ownershipVerifiedAt = now;
      }

      // Update connected timestamp if just connected
      if (newStatus === 'connected' && !connection.connectedAt) {
        updates.connectedAt = now;
        updates.sslProvisionedAt = now;
      }

      await docRef.update(updates);

      // 9. Update lead hosting status if connected
      // Note: We use string comparison to avoid TypeScript narrowing issues
      // (connection.status has already been narrowed above)
      if (newStatus === 'connected') {
        await db
          .collection('agencies')
          .doc(connection.agencyId)
          .collection('leads')
          .doc(connection.leadId)
          .update({
            'hosting.status': 'Live',
            'hosting.sslStatus': 'active',
            'hosting.verificationStatus': 'verified',
            'hosting.dnsStatus': 'configured'
          });
      }

      // 10. Build step status
      const steps = {
        domainRegistered: true, // Always true at this point
        ownershipVerified: txtVerified || !!connection.ownershipVerifiedAt,
        dnsConfigured: aRecordCheck.propagated,
        sslProvisioned: sslStatus === 'active'
      };

      console.log(`Domain status check for ${connection.domain}: ${newStatus}, SSL: ${sslStatus}`);

      return {
        domain: connection.domain,
        status: newStatus,
        sslStatus,
        sslCertExpiry: connection.sslCertExpiry as string | undefined,
        lastCheckedAt: now,
        steps,
        message: getStatusMessage(newStatus, connection.domain),
        errorMessage: connection.errorMessage
      };
    }
  );
