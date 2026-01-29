import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const GODADDY_API_BASE = 'https://api.godaddy.com/v1';

interface UpdateCredentialsRequest {
  apiKey: string;
  apiSecret: string;
  testFirst?: boolean;
}

interface UpdateCredentialsResult {
  success: boolean;
  lastFourKey?: string;
  message?: string;
}

interface TestResult {
  success: boolean;
  message: string;
}

/**
 * Updates GoDaddy API credentials (Admin only)
 * Optionally tests credentials before saving
 */
export const updateGoDaddyCredentials = functions.https.onCall(
  async (data: UpdateCredentialsRequest, context: functions.https.CallableContext): Promise<UpdateCredentialsResult> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated'
      );
    }

    // Check if user is admin
    const db = admin.firestore();
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();

    if (!adminDoc.exists) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    const { apiKey, apiSecret, testFirst = true } = data;

    if (!apiKey || !apiSecret) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'API Key and Secret are required'
      );
    }

    // Test credentials before saving if requested
    if (testFirst) {
      try {
        const testResponse = await fetch(`${GODADDY_API_BASE}/domains?limit=1`, {
          headers: {
            'Authorization': `sso-key ${apiKey}:${apiSecret}`,
            'Accept': 'application/json'
          }
        });

        if (!testResponse.ok) {
          const error = await testResponse.json();
          throw new functions.https.HttpsError(
            'invalid-argument',
            error.message || 'Invalid GoDaddy credentials'
          );
        }
      } catch (error: unknown) {
        if (error instanceof functions.https.HttpsError) {
          throw error;
        }
        throw new functions.https.HttpsError(
          'internal',
          'Failed to verify GoDaddy credentials'
        );
      }
    }

    const lastFourKey = apiKey.slice(-4);

    // Store credentials securely in Firestore
    await db.collection('config').doc('godaddyCredentials').set({
      apiKey,
      apiSecret,
      lastFourKey,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: context.auth.uid
    });

    // Update platform settings (non-sensitive metadata)
    await db.collection('config').doc('platformSettings').set({
      godaddy: {
        isConfigured: true,
        apiKeyLastFour: lastFourKey,
        lastTestedAt: new Date().toISOString(),
        lastTestSuccess: true
      },
      updatedAt: new Date().toISOString(),
      updatedBy: context.auth.uid
    }, { merge: true });

    // Create audit log
    await db.collection('auditLogs').add({
      actorId: context.auth.uid,
      actorType: 'admin',
      actorEmail: context.auth.token.email || '',
      action: 'update',
      resource: 'settings',
      resourceId: 'godaddyCredentials',
      details: { lastFourKey, tested: testFirst },
      createdAt: new Date().toISOString()
    });

    return {
      success: true,
      lastFourKey
    };
  }
);

/**
 * Tests current GoDaddy credentials (Admin only)
 */
export const testGoDaddyCredentials = functions.https.onCall(
  async (data: unknown, context: functions.https.CallableContext): Promise<TestResult> => {
    // Verify user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Must be authenticated'
      );
    }

    // Check if user is admin
    const db = admin.firestore();
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();

    if (!adminDoc.exists) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Admin access required'
      );
    }

    // Get current credentials
    const credentialsDoc = await db.collection('config').doc('godaddyCredentials').get();

    if (!credentialsDoc.exists) {
      return {
        success: false,
        message: 'No GoDaddy credentials configured'
      };
    }

    const credentials = credentialsDoc.data();
    if (!credentials?.apiKey || !credentials?.apiSecret) {
      return {
        success: false,
        message: 'GoDaddy credentials are incomplete'
      };
    }

    try {
      const testResponse = await fetch(`${GODADDY_API_BASE}/domains?limit=1`, {
        headers: {
          'Authorization': `sso-key ${credentials.apiKey}:${credentials.apiSecret}`,
          'Accept': 'application/json'
        }
      });

      const success = testResponse.ok;

      // Update test status
      await db.collection('config').doc('platformSettings').set({
        godaddy: {
          lastTestedAt: new Date().toISOString(),
          lastTestSuccess: success
        }
      }, { merge: true });

      return {
        success,
        message: success ? 'Connection successful' : 'Connection failed'
      };
    } catch (error: unknown) {
      return {
        success: false,
        message: 'Failed to connect to GoDaddy API'
      };
    }
  }
);
