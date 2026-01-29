/**
 * verifyDomainOwnership Cloud Function
 *
 * Explicitly checks if the TXT verification record has propagated.
 * Used when user clicks "Verify" button after configuring DNS manually.
 *
 * Flow:
 * 1. Get domain connection record
 * 2. Query DNS for TXT records
 * 3. Check if verification token is present
 * 4. Update status accordingly
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import {
  VerifyDomainOwnershipRequest,
  VerifyDomainOwnershipResponse,
  DomainConnection,
  DNSLookupResult
} from './types';

const db = admin.firestore();

// ============================================================================
// DNS Lookup
// ============================================================================

/**
 * Performs TXT DNS lookup using Google's DNS-over-HTTPS API
 */
async function lookupTxtRecords(domain: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://dns.google.com/resolve?name=${encodeURIComponent(domain)}&type=16`, // TXT = 16
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

    // Extract and clean TXT record values
    return data.Answer.map(record =>
      record.data.replace(/^"|"$/g, '').trim()
    );
  } catch (error) {
    console.error(`DNS lookup error for ${domain}:`, error);
    return [];
  }
}

// ============================================================================
// Main Cloud Function
// ============================================================================

export const verifyDomainOwnership = functions
  .runWith({
    timeoutSeconds: 30,
    memory: '256MB'
  })
  .https.onCall(
    async (
      data: VerifyDomainOwnershipRequest,
      context: functions.https.CallableContext
    ): Promise<VerifyDomainOwnershipResponse> => {
      // 1. Verify authentication
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          'You must be logged in to verify domain ownership'
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

      // 3. Verify permission
      if (connection.userId !== userId) {
        const adminDoc = await db.collection('admins').doc(userId).get();
        if (!adminDoc.exists) {
          throw new functions.https.HttpsError(
            'permission-denied',
            'You do not have permission to verify this domain'
          );
        }
      }

      // 4. If already verified, return success
      if (connection.ownershipVerifiedAt) {
        return {
          verified: true,
          status: connection.status,
          message: 'Domain ownership was already verified.',
          expectedTxtRecord: connection.verificationTxtRecord
        };
      }

      // 5. Look up TXT records
      const txtRecords = await lookupTxtRecords(connection.domain);
      console.log(`TXT records for ${connection.domain}:`, txtRecords);

      // 6. Check if verification record is present
      const verified = txtRecords.some(record =>
        record.includes(connection.verificationToken) ||
        record === connection.verificationTxtRecord
      );

      const now = new Date().toISOString();

      if (verified) {
        // 7a. Update status to verified
        await docRef.update({
          status: 'dns_propagating',
          ownershipVerifiedAt: now,
          updatedAt: now,
          checkCount: admin.firestore.FieldValue.increment(1)
        });

        // Update lead hosting status
        await db
          .collection('agencies')
          .doc(connection.agencyId)
          .collection('leads')
          .doc(connection.leadId)
          .update({
            'hosting.verificationStatus': 'verified',
            'hosting.status': 'Verifying'
          });

        // Create audit log
        await db.collection('auditLogs').add({
          actorId: userId,
          actorType: 'user',
          actorEmail: context.auth.token.email || '',
          action: 'domain_verified',
          resource: 'domain_connection',
          resourceId: domainConnectionId,
          details: {
            domain: connection.domain,
            method: connection.connectionMethod
          },
          createdAt: now
        });

        console.log(`Domain ownership verified for ${connection.domain}`);

        return {
          verified: true,
          status: 'dns_propagating',
          message: `Ownership of ${connection.domain} has been verified. Now checking A record propagation.`,
          currentTxtRecords: txtRecords,
          expectedTxtRecord: connection.verificationTxtRecord
        };
      } else {
        // 7b. Not verified yet
        const checkCount = (connection.checkCount || 0) + 1;

        await docRef.update({
          status: checkCount > 20 ? 'verification_failed' : 'pending_verification',
          updatedAt: now,
          checkCount
        });

        // Suggest retry time based on check count
        const retryAfterMs = Math.min(30000 * Math.pow(1.5, Math.min(checkCount, 10)), 300000);

        return {
          verified: false,
          status: checkCount > 20 ? 'verification_failed' : 'pending_verification',
          message: `TXT verification record not found for ${connection.domain}. DNS propagation can take up to 48 hours, but typically completes within 5-15 minutes.`,
          retryAfterMs,
          currentTxtRecords: txtRecords,
          expectedTxtRecord: connection.verificationTxtRecord
        };
      }
    }
  );
