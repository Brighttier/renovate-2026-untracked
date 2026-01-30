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
exports.fetchGoDaddyDomains = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const GODADDY_API_BASE = 'https://api.godaddy.com/v1';
/**
 * Fetches domains from GoDaddy using platform-wide credentials
 * Only authenticated users can call this function
 */
exports.fetchGoDaddyDomains = functions.https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to fetch domains');
    }
    // Get credentials from Firestore (server-side only)
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
            throw new functions.https.HttpsError('internal', error.message || 'Failed to fetch domains from GoDaddy');
        }
        const domains = await response.json();
        return domains;
    }
    catch (error) {
        console.error('GoDaddy Fetch Error:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to connect to GoDaddy API');
    }
});
//# sourceMappingURL=fetchDomains.js.map