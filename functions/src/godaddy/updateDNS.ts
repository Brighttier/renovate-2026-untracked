import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const GODADDY_API_BASE = 'https://api.godaddy.com/v1';

interface DNSRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS';
  name: string;
  data: string;
  ttl: number;
}

interface PropagateRequest {
  domain: string;
  firebaseIps?: string[];
}

interface PropagateResult {
  success: boolean;
  message: string;
}

/**
 * Updates DNS records for a domain to point to Firebase Hosting
 * Uses platform-wide GoDaddy credentials
 */
export const propagateFirebaseDNS = functions.https.onCall(
  async (data: PropagateRequest, context: functions.https.CallableContext): Promise<PropagateResult> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to update DNS'
      );
    }

    const { domain, firebaseIps = ['199.36.158.100', '151.101.1.195'] } = data;

    if (!domain) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Domain is required'
      );
    }

    // Get credentials from Firestore
    const db = admin.firestore();
    const credentialsDoc = await db.collection('config').doc('godaddyCredentials').get();

    if (!credentialsDoc.exists) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'GoDaddy credentials not configured. Please contact administrator.'
      );
    }

    const credentials = credentialsDoc.data();
    if (!credentials?.apiKey || !credentials?.apiSecret) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'GoDaddy credentials are incomplete. Please contact administrator.'
      );
    }

    try {
      // Prepare DNS records
      const records: DNSRecord[] = [
        ...firebaseIps.map(ip => ({
          type: 'A' as const,
          name: '@',
          data: ip,
          ttl: 600
        })),
        {
          type: 'CNAME' as const,
          name: 'www',
          data: '@',
          ttl: 600
        }
      ];

      // Update DNS via GoDaddy API
      const response = await fetch(`${GODADDY_API_BASE}/domains/${domain}/records`, {
        method: 'PATCH',
        headers: {
          'Authorization': `sso-key ${credentials.apiKey}:${credentials.apiSecret}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(records)
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('GoDaddy DNS Update Error:', error);
        return {
          success: false,
          message: error.message || 'Failed to update DNS records'
        };
      }

      // Log successful DNS update
      await db.collection('auditLogs').add({
        actorId: context.auth.uid,
        actorType: 'user',
        actorEmail: context.auth.token.email || '',
        action: 'update',
        resource: 'site',
        resourceId: domain,
        details: { action: 'dns_propagation', domain, records },
        createdAt: new Date().toISOString()
      });

      return {
        success: true,
        message: `Successfully connected ${domain} to Firebase Hosting`
      };
    } catch (error: unknown) {
      console.error('GoDaddy DNS Error:', error);
      return {
        success: false,
        message: 'An unexpected error occurred during DNS propagation'
      };
    }
  }
);
