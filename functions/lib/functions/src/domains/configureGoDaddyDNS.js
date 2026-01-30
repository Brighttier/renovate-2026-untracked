"use strict";
/**
 * configureGoDaddyDNS Cloud Function
 *
 * One-click DNS configuration using the platform's GoDaddy API credentials.
 * This function automatically configures all required DNS records for Firebase Hosting.
 *
 * Flow:
 * 1. Verify authentication and domain connection exists
 * 2. Get platform GoDaddy credentials from Firestore
 * 3. Build DNS records (TXT verification + A records + CNAME)
 * 4. Update DNS via GoDaddy API
 * 5. Update domain connection status
 * 6. Create audit log
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureGoDaddyDNS = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const types_1 = require("./types");
const db = admin.firestore();
const GODADDY_API_BASE = 'https://api.godaddy.com/v1';
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Retrieves GoDaddy platform credentials from Firestore
 * These are stored server-side only and never exposed to clients
 */
async function getGoDaddyCredentials() {
    const credentialsDoc = await db.collection('config').doc('godaddyCredentials').get();
    if (!credentialsDoc.exists) {
        throw new functions.https.HttpsError('failed-precondition', 'GoDaddy credentials not configured. Please contact administrator.');
    }
    const credentials = credentialsDoc.data();
    if (!(credentials === null || credentials === void 0 ? void 0 : credentials.apiKey) || !(credentials === null || credentials === void 0 ? void 0 : credentials.apiSecret)) {
        throw new functions.https.HttpsError('failed-precondition', 'GoDaddy credentials are incomplete. Please contact administrator.');
    }
    return credentials;
}
/**
 * Gets the domain connection record from Firestore
 */
async function getDomainConnection(domainConnectionId) {
    const docRef = db.collection('domain_connections').doc(domainConnectionId);
    const doc = await docRef.get();
    if (!doc.exists) {
        throw new functions.https.HttpsError('not-found', 'Domain connection not found');
    }
    return {
        ...doc.data(),
        id: doc.id,
        docRef
    };
}
/**
 * Checks if domain exists on GoDaddy account
 */
async function checkDomainOnGoDaddy(domain, credentials) {
    try {
        const response = await fetch(`${GODADDY_API_BASE}/domains/${domain}`, {
            method: 'GET',
            headers: {
                'Authorization': `sso-key ${credentials.apiKey}:${credentials.apiSecret}`,
                'Content-Type': 'application/json'
            }
        });
        return response.ok;
    }
    catch (error) {
        console.error('Error checking domain on GoDaddy:', error);
        return false;
    }
}
/**
 * Updates DNS records via GoDaddy API
 * Uses PATCH to add/update records without removing existing ones
 */
async function updateGoDaddyDNS(domain, records, credentials) {
    try {
        const response = await fetch(`${GODADDY_API_BASE}/domains/${domain}/records`, {
            method: 'PATCH',
            headers: {
                'Authorization': `sso-key ${credentials.apiKey}:${credentials.apiSecret}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(records)
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('GoDaddy API Error:', response.status, errorData);
            // Handle specific error codes
            if (response.status === 401) {
                return { success: false, error: 'GoDaddy authentication failed. Credentials may be invalid.' };
            }
            if (response.status === 403) {
                return { success: false, error: 'Access denied. This domain may not be in the platform account.' };
            }
            if (response.status === 404) {
                return { success: false, error: 'Domain not found in GoDaddy account.' };
            }
            if (response.status === 422) {
                return { success: false, error: errorData.message || 'Invalid DNS record format.' };
            }
            if (response.status === 429) {
                return { success: false, error: 'Rate limited by GoDaddy. Please try again in a few minutes.' };
            }
            return {
                success: false,
                error: errorData.message || `GoDaddy API error (${response.status})`
            };
        }
        return { success: true };
    }
    catch (error) {
        console.error('GoDaddy DNS Update Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Network error connecting to GoDaddy'
        };
    }
}
// ============================================================================
// Main Cloud Function
// ============================================================================
exports.configureGoDaddyDNS = functions
    .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to configure DNS');
    }
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email || '';
    // 2. Validate request
    const { domain, domainConnectionId, verificationToken, includeWww = true } = data;
    if (!domain || !domainConnectionId || !verificationToken) {
        throw new functions.https.HttpsError('invalid-argument', 'Domain, connection ID, and verification token are required');
    }
    // 3. Get domain connection record
    const connection = await getDomainConnection(domainConnectionId);
    // Verify ownership
    if (connection.userId !== userId) {
        // Check if user is admin
        const adminDoc = await db.collection('admins').doc(userId).get();
        if (!adminDoc.exists) {
            throw new functions.https.HttpsError('permission-denied', 'You do not have permission to configure this domain');
        }
    }
    // Verify token matches
    if (connection.verificationToken !== verificationToken) {
        throw new functions.https.HttpsError('invalid-argument', 'Verification token does not match');
    }
    // 4. Get platform GoDaddy credentials
    const credentials = await getGoDaddyCredentials();
    // 5. Check if domain exists on GoDaddy
    const domainOnGoDaddy = await checkDomainOnGoDaddy(domain, credentials);
    if (!domainOnGoDaddy) {
        throw new functions.https.HttpsError('failed-precondition', `Domain ${domain} is not found in the platform GoDaddy account. Please use manual DNS configuration instead.`);
    }
    // 6. Build DNS records
    const records = [
        // TXT verification record
        {
            type: 'TXT',
            name: '@',
            data: connection.verificationTxtRecord,
            ttl: 600
        },
        // A records for Firebase Hosting
        ...types_1.FIREBASE_HOSTING_IPS.map(ip => ({
            type: 'A',
            name: '@',
            data: ip,
            ttl: 600
        }))
    ];
    // Add www CNAME if requested
    if (includeWww) {
        records.push({
            type: 'CNAME',
            name: 'www',
            data: '@',
            ttl: 600
        });
    }
    // 7. Update DNS via GoDaddy API
    const result = await updateGoDaddyDNS(domain, records, credentials);
    if (!result.success) {
        // Update connection status to error
        await connection.docRef.update({
            status: 'error',
            errorMessage: result.error,
            errorCount: admin.firestore.FieldValue.increment(1),
            updatedAt: new Date().toISOString()
        });
        throw new functions.https.HttpsError('internal', result.error || 'Failed to configure DNS');
    }
    // 8. Update domain connection status
    const now = new Date().toISOString();
    await connection.docRef.update({
        status: 'dns_propagating',
        connectionMethod: 'GoDaddy',
        dnsProvider: 'godaddy',
        dnsConfiguredAt: now,
        updatedAt: now,
        errorMessage: null // Clear any previous errors
    });
    // 9. Update lead's hosting config
    await db
        .collection('agencies')
        .doc(connection.agencyId)
        .collection('leads')
        .doc(connection.leadId)
        .update({
        'hosting.connectionMethod': 'GoDaddy',
        'hosting.dnsStatus': 'propagating',
        'hosting.status': 'Verifying'
    });
    // 10. Create audit log
    await db.collection('auditLogs').add({
        actorId: userId,
        actorType: 'user',
        actorEmail: userEmail,
        action: 'domain_dns_configured',
        resource: 'domain_connection',
        resourceId: domainConnectionId,
        details: {
            domain,
            method: 'godaddy_platform',
            recordsAdded: records.length
        },
        createdAt: now
    });
    console.log(`DNS configured for ${domain} via GoDaddy (${records.length} records)`);
    // Convert to response format
    const responseRecords = records.map(r => ({
        type: r.type,
        name: r.name,
        data: r.data,
        ttl: r.ttl
    }));
    return {
        success: true,
        recordsAdded: responseRecords,
        estimatedPropagationMinutes: 15,
        message: `DNS records configured successfully for ${domain}. Changes typically propagate within 5-15 minutes.`
    };
});
//# sourceMappingURL=configureGoDaddyDNS.js.map