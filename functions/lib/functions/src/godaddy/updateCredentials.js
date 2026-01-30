"use strict";
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
exports.testGoDaddyCredentials = exports.updateGoDaddyCredentials = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const GODADDY_API_BASE = 'https://api.godaddy.com/v1';
/**
 * Updates GoDaddy API credentials (Admin only)
 * Optionally tests credentials before saving
 */
exports.updateGoDaddyCredentials = functions.https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    // Check if user is admin
    const db = admin.firestore();
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
    }
    const { apiKey, apiSecret, testFirst = true } = data;
    if (!apiKey || !apiSecret) {
        throw new functions.https.HttpsError('invalid-argument', 'API Key and Secret are required');
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
                throw new functions.https.HttpsError('invalid-argument', error.message || 'Invalid GoDaddy credentials');
            }
        }
        catch (error) {
            if (error instanceof functions.https.HttpsError) {
                throw error;
            }
            throw new functions.https.HttpsError('internal', 'Failed to verify GoDaddy credentials');
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
});
/**
 * Tests current GoDaddy credentials (Admin only)
 */
exports.testGoDaddyCredentials = functions.https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
    }
    // Check if user is admin
    const db = admin.firestore();
    const adminDoc = await db.collection('admins').doc(context.auth.uid).get();
    if (!adminDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Admin access required');
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
    if (!(credentials === null || credentials === void 0 ? void 0 : credentials.apiKey) || !(credentials === null || credentials === void 0 ? void 0 : credentials.apiSecret)) {
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
    }
    catch (error) {
        return {
            success: false,
            message: 'Failed to connect to GoDaddy API'
        };
    }
});
//# sourceMappingURL=updateCredentials.js.map