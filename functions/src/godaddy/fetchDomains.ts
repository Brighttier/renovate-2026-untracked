import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const GODADDY_API_BASE = 'https://api.godaddy.com/v1';

interface GoDaddyDomain {
  domain: string;
  status: string;
}

/**
 * Fetches domains from GoDaddy using platform-wide credentials
 * Only authenticated users can call this function
 */
export const fetchGoDaddyDomains = functions.https.onCall(
  async (data: unknown, context: functions.https.CallableContext): Promise<GoDaddyDomain[]> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to fetch domains'
      );
    }

    // Get credentials from Firestore (server-side only)
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
      // Call GoDaddy API
      const response = await fetch(`${GODADDY_API_BASE}/domains?statuses=ACTIVE`, {
        headers: {
          'Authorization': `sso-key ${credentials.apiKey}:${credentials.apiSecret}`,
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('GoDaddy API Error:', error);
        throw new functions.https.HttpsError(
          'internal',
          error.message || 'Failed to fetch domains from GoDaddy'
        );
      }

      const domains: GoDaddyDomain[] = await response.json();
      return domains;
    } catch (error: unknown) {
      console.error('GoDaddy Fetch Error:', error);
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      throw new functions.https.HttpsError(
        'internal',
        'Failed to connect to GoDaddy API'
      );
    }
  }
);
