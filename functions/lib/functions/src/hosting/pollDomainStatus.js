"use strict";
/**
 * Domain Status Polling Worker
 * Monitors domain verification and SSL provisioning status
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
exports.getDomainConnectionStatusHTTP = exports.getDomainConnectionStatus = exports.scheduledDomainPolling = exports.pollDomainStatusHTTP = exports.pollDomainStatus = void 0;
exports.pollDomainStatusOnce = pollDomainStatusOnce;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const google_auth_library_1 = require("google-auth-library");
const types_1 = require("./types");
const db = admin.firestore();
// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
// Google Auth
let authClient = null;
async function getAuthClient() {
    if (!authClient) {
        authClient = new google_auth_library_1.GoogleAuth({
            scopes: [
                'https://www.googleapis.com/auth/firebase',
                'https://www.googleapis.com/auth/cloud-platform'
            ]
        });
    }
    return authClient;
}
async function getAccessToken() {
    const auth = await getAuthClient();
    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    if (!tokenResponse.token) {
        throw new Error('Failed to get access token');
    }
    return tokenResponse.token;
}
/**
 * Get domain status from Firebase Hosting API
 */
async function getDomainStatus(projectId, siteId, domain) {
    const token = await getAccessToken();
    const response = await fetch(`${types_1.FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites/${siteId}/customDomains/${domain}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    if (response.status === 404) {
        return null;
    }
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[getDomainStatus] API error: ${response.status}`, errorText);
        throw new Error(`Failed to get domain status: ${response.status}`);
    }
    return response.json();
}
/**
 * Determine connection status from domain state
 */
function determineConnectionStatus(hostState, ownershipStatus, certState) {
    // Check ownership first
    if (ownershipStatus === 'OWNERSHIP_MISSING' || ownershipStatus === 'OWNERSHIP_UNREACHABLE') {
        return 'pending_dns';
    }
    if (ownershipStatus === 'OWNERSHIP_PENDING') {
        return 'dns_propagating';
    }
    // Check hosting state
    if (hostState === 'HOST_UNHOSTED' || hostState === 'HOST_UNREACHABLE') {
        return 'pending_dns';
    }
    if (hostState === 'HOST_MISMATCH' || hostState === 'HOST_CONFLICT') {
        return 'error';
    }
    // Check SSL state
    if (certState) {
        if (certState === 'CERT_PREPARING' || certState === 'CERT_VALIDATING') {
            return 'pending_ssl';
        }
        if (certState === 'CERT_PROPAGATING') {
            return 'ssl_provisioning';
        }
        if (certState === 'CERT_ACTIVE') {
            return 'connected';
        }
        if (certState === 'CERT_EXPIRED' || certState === 'CERT_EXPIRING_SOON') {
            return 'connected'; // Still connected, just needs renewal
        }
    }
    // If ownership and hosting are active but no cert info, assume SSL is being provisioned
    if (ownershipStatus === 'OWNERSHIP_ACTIVE' && hostState === 'HOST_ACTIVE') {
        return 'connected';
    }
    return 'dns_propagating';
}
/**
 * Calculate next poll delay based on current state
 */
function calculateNextPollDelay(status) {
    switch (status) {
        case 'pending_dns':
        case 'dns_propagating':
            return types_1.POLL_INTERVALS.DNS_PROPAGATING;
        case 'pending_ssl':
        case 'ssl_provisioning':
            return types_1.POLL_INTERVALS.SSL_PROVISIONING;
        case 'connected':
            return 0; // No more polling needed
        default:
            return types_1.POLL_INTERVALS.INITIAL;
    }
}
/**
 * Check if polling should continue
 */
function shouldContinuePolling(status, startTime, attemptCount) {
    // Stop if connected or error
    if (status === 'connected' || status === 'error' || status === 'rollback') {
        return false;
    }
    // Check max poll duration
    const elapsedMs = Date.now() - startTime.getTime();
    if (elapsedMs > types_1.POLL_INTERVALS.MAX_POLL_DURATION) {
        console.log('[shouldContinuePolling] Max poll duration exceeded');
        return false;
    }
    // Check max attempts for different phases
    if (status === 'pending_dns' || status === 'dns_propagating') {
        if (attemptCount >= types_1.MAX_RETRY_ATTEMPTS.DNS_VERIFICATION) {
            console.log('[shouldContinuePolling] Max DNS verification attempts exceeded');
            return false;
        }
    }
    if (status === 'pending_ssl' || status === 'ssl_provisioning') {
        if (attemptCount >= types_1.MAX_RETRY_ATTEMPTS.SSL_PROVISIONING) {
            console.log('[shouldContinuePolling] Max SSL provisioning attempts exceeded');
            return false;
        }
    }
    return true;
}
/**
 * Update domain connection status in Firestore
 */
async function updateConnectionStatus(connectionId, updates) {
    await db.collection('domain_connections').doc(connectionId).update({
        ...updates,
        updatedAt: new Date().toISOString()
    });
}
/**
 * Poll domain status once and return result
 */
async function pollDomainStatusOnce(connectionId, siteId, domain) {
    var _a, _b;
    const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';
    try {
        console.log(`[pollDomainStatusOnce] Polling status for ${domain}`);
        // Get current connection record
        const connectionDoc = await db.collection('domain_connections').doc(connectionId).get();
        if (!connectionDoc.exists) {
            return {
                connectionId,
                domain,
                hostState: 'HOST_STATE_UNSPECIFIED',
                ownershipStatus: 'OWNERSHIP_STATUS_UNSPECIFIED',
                isComplete: true,
                requiresRetry: false,
                error: 'Connection not found'
            };
        }
        const connection = connectionDoc.data();
        const pollAttempts = (connection.pollAttempts || 0) + 1;
        const startTime = new Date(connection.createdAt);
        // Get domain status from Firebase
        const domainStatus = await getDomainStatus(projectId, siteId, domain);
        if (!domainStatus) {
            console.log(`[pollDomainStatusOnce] Domain ${domain} not found in Firebase Hosting`);
            return {
                connectionId,
                domain,
                hostState: 'HOST_UNHOSTED',
                ownershipStatus: 'OWNERSHIP_MISSING',
                isComplete: false,
                requiresRetry: true,
                nextCheckDelay: types_1.POLL_INTERVALS.INITIAL,
                error: 'Domain not found in Firebase Hosting'
            };
        }
        const hostState = domainStatus.hostState;
        const ownershipStatus = ((_a = domainStatus.ownershipState) === null || _a === void 0 ? void 0 : _a.status) || 'OWNERSHIP_STATUS_UNSPECIFIED';
        const certState = (_b = domainStatus.cert) === null || _b === void 0 ? void 0 : _b.state;
        // Determine overall status
        const connectionStatus = determineConnectionStatus(hostState, ownershipStatus, certState);
        const isComplete = connectionStatus === 'connected';
        const shouldContinue = shouldContinuePolling(connectionStatus, startTime, pollAttempts);
        // Update Firestore
        await updateConnectionStatus(connectionId, {
            status: connectionStatus,
            hostState,
            ownershipStatus,
            certState,
            lastPolledAt: new Date().toISOString(),
            pollAttempts
        });
        // Also update client_sites if connected
        if (isComplete) {
            await db.collection('client_sites').doc(siteId).update({
                domainConnectionStatus: 'connected',
                sslStatus: certState,
                customDomain: domain,
                updatedAt: new Date().toISOString()
            });
            // Create audit log
            await db.collection('auditLogs').add({
                actorId: 'system',
                actorType: 'system',
                actorEmail: 'system@renovatemysite.com',
                action: 'domain_connected',
                resource: 'domain_connection',
                resourceId: connectionId,
                details: {
                    domain,
                    siteId,
                    hostState,
                    ownershipStatus,
                    certState
                },
                createdAt: new Date().toISOString()
            });
        }
        const nextCheckDelay = calculateNextPollDelay(connectionStatus);
        console.log(`[pollDomainStatusOnce] Status: ${connectionStatus}, Host: ${hostState}, Ownership: ${ownershipStatus}, Cert: ${certState}`);
        return {
            connectionId,
            domain,
            hostState,
            ownershipStatus,
            certState,
            isComplete,
            requiresRetry: !isComplete && shouldContinue,
            nextCheckDelay: shouldContinue ? nextCheckDelay : undefined
        };
    }
    catch (error) {
        console.error('[pollDomainStatusOnce] Error:', error);
        return {
            connectionId,
            domain,
            hostState: 'HOST_STATE_UNSPECIFIED',
            ownershipStatus: 'OWNERSHIP_STATUS_UNSPECIFIED',
            isComplete: false,
            requiresRetry: true,
            nextCheckDelay: types_1.POLL_INTERVALS.INITIAL,
            error: error.message || 'Failed to poll domain status'
        };
    }
}
/**
 * Cloud Function: Poll Domain Status (Callable)
 */
exports.pollDomainStatus = functions
    .runWith({
    timeoutSeconds: 30,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    // Authentication optional for polling (can be called by frontend)
    const { connectionId, siteId, domain } = data;
    if (!connectionId || !siteId || !domain) {
        throw new functions.https.HttpsError('invalid-argument', 'connectionId, siteId, and domain are required');
    }
    return pollDomainStatusOnce(connectionId, siteId, domain);
});
/**
 * HTTP endpoint for polling
 */
exports.pollDomainStatusHTTP = functions
    .runWith({
    timeoutSeconds: 30,
    memory: '256MB'
})
    .https.onRequest(async (req, res) => {
    var _a, _b, _c;
    // Handle CORS
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const connectionId = req.query.connectionId || ((_a = req.body) === null || _a === void 0 ? void 0 : _a.connectionId);
    const siteId = req.query.siteId || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.siteId);
    const domain = req.query.domain || ((_c = req.body) === null || _c === void 0 ? void 0 : _c.domain);
    if (!connectionId || !siteId || !domain) {
        res.status(400).json({
            error: 'connectionId, siteId, and domain are required'
        });
        return;
    }
    try {
        const result = await pollDomainStatusOnce(connectionId, siteId, domain);
        res.json(result);
    }
    catch (error) {
        console.error('[pollDomainStatusHTTP] Error:', error);
        res.status(500).json({
            error: error.message || 'Failed to poll domain status'
        });
    }
});
/**
 * Scheduled polling worker
 * Runs every minute to check pending domain connections
 */
exports.scheduledDomainPolling = functions
    .runWith({
    timeoutSeconds: 300,
    memory: '512MB'
})
    .pubsub.schedule('every 1 minutes')
    .onRun(async (context) => {
    console.log('[scheduledDomainPolling] Starting scheduled poll');
    try {
        // Find all pending connections that need polling
        const pendingStatuses = [
            'adding_domain',
            'pending_dns',
            'dns_propagating',
            'pending_ssl',
            'ssl_provisioning'
        ];
        const snapshot = await db.collection('domain_connections')
            .where('status', 'in', pendingStatuses)
            .limit(50) // Process up to 50 at a time
            .get();
        if (snapshot.empty) {
            console.log('[scheduledDomainPolling] No pending connections to poll');
            return null;
        }
        console.log(`[scheduledDomainPolling] Found ${snapshot.size} pending connections`);
        // Process each connection
        const results = await Promise.allSettled(snapshot.docs.map(async (doc) => {
            const connection = doc.data();
            const connectionId = doc.id;
            // Check if enough time has passed since last poll
            if (connection.lastPolledAt) {
                const lastPoll = new Date(connection.lastPolledAt);
                const minDelay = calculateNextPollDelay(connection.status);
                const elapsed = Date.now() - lastPoll.getTime();
                if (elapsed < minDelay) {
                    console.log(`[scheduledDomainPolling] Skipping ${connectionId}, not enough time elapsed`);
                    return { connectionId, skipped: true };
                }
            }
            // Poll the status
            const result = await pollDomainStatusOnce(connectionId, connection.siteId, connection.domain);
            return { connectionId, result };
        }));
        // Log results
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        console.log(`[scheduledDomainPolling] Completed: ${successful} successful, ${failed} failed`);
        return null;
    }
    catch (error) {
        console.error('[scheduledDomainPolling] Error:', error);
        return null;
    }
});
/**
 * Get connection status for frontend
 */
exports.getDomainConnectionStatus = functions
    .runWith({
    timeoutSeconds: 30,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    const { connectionId } = data;
    if (!connectionId) {
        throw new functions.https.HttpsError('invalid-argument', 'connectionId is required');
    }
    const doc = await db.collection('domain_connections').doc(connectionId).get();
    if (!doc.exists) {
        throw new functions.https.HttpsError('not-found', 'Connection not found');
    }
    return doc.data();
});
/**
 * HTTP endpoint for getting connection status
 */
exports.getDomainConnectionStatusHTTP = functions
    .runWith({
    timeoutSeconds: 30,
    memory: '256MB'
})
    .https.onRequest(async (req, res) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }
    res.set(corsHeaders);
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const connectionId = req.query.connectionId;
    if (!connectionId) {
        res.status(400).json({ error: 'connectionId is required' });
        return;
    }
    try {
        const doc = await db.collection('domain_connections').doc(connectionId).get();
        if (!doc.exists) {
            res.status(404).json({ error: 'Connection not found' });
            return;
        }
        res.json(doc.data());
    }
    catch (error) {
        console.error('[getDomainConnectionStatusHTTP] Error:', error);
        res.status(500).json({
            error: error.message || 'Failed to get connection status'
        });
    }
});
//# sourceMappingURL=pollDomainStatus.js.map