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
exports.propagateFirebaseDNS = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const GODADDY_API_BASE = 'https://api.godaddy.com/v1';
/**
 * Updates DNS records for a domain to point to Firebase Hosting
 * Uses platform-wide GoDaddy credentials
 */
exports.propagateFirebaseDNS = functions.https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to update DNS');
    }
    const { domain, firebaseIps = ['199.36.158.100', '151.101.1.195'] } = data;
    if (!domain) {
        throw new functions.https.HttpsError('invalid-argument', 'Domain is required');
    }
    // Get credentials from Firestore
    const db = admin.firestore();
    const credentialsDoc = await db.collection('config').doc('godaddyCredentials').get();
    if (!credentialsDoc.exists) {
        throw new functions.https.HttpsError('failed-precondition', 'GoDaddy credentials not configured. Please contact administrator.');
    }
    const credentials = credentialsDoc.data();
    if (!(credentials === null || credentials === void 0 ? void 0 : credentials.apiKey) || !(credentials === null || credentials === void 0 ? void 0 : credentials.apiSecret)) {
        throw new functions.https.HttpsError('failed-precondition', 'GoDaddy credentials are incomplete. Please contact administrator.');
    }
    try {
        // Prepare DNS records
        const records = [
            ...firebaseIps.map(ip => ({
                type: 'A',
                name: '@',
                data: ip,
                ttl: 600
            })),
            {
                type: 'CNAME',
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
    }
    catch (error) {
        console.error('GoDaddy DNS Error:', error);
        return {
            success: false,
            message: 'An unexpected error occurred during DNS propagation'
        };
    }
});
//# sourceMappingURL=updateDNS.js.map