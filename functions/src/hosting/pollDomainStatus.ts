/**
 * Domain Status Polling Worker
 * Monitors domain verification and SSL provisioning status
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleAuth } from 'google-auth-library';
import {
    CustomDomain,
    HostState,
    OwnershipStatus,
    CertState,
    PollDomainStatusResponse,
    DomainConnectionStatus,
    FIREBASE_HOSTING_API_BASE,
    POLL_INTERVALS,
    MAX_RETRY_ATTEMPTS
} from './types';

const db = admin.firestore();

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Google Auth
let authClient: GoogleAuth | null = null;

async function getAuthClient(): Promise<GoogleAuth> {
    if (!authClient) {
        authClient = new GoogleAuth({
            scopes: [
                'https://www.googleapis.com/auth/firebase',
                'https://www.googleapis.com/auth/cloud-platform'
            ]
        });
    }
    return authClient;
}

async function getAccessToken(): Promise<string> {
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
async function getDomainStatus(
    projectId: string,
    siteId: string,
    domain: string
): Promise<CustomDomain | null> {
    const token = await getAccessToken();

    const response = await fetch(
        `${FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites/${siteId}/customDomains/${domain}`,
        {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }
    );

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
function determineConnectionStatus(
    hostState: HostState,
    ownershipStatus: OwnershipStatus,
    certState?: CertState
): DomainConnectionStatus {
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
function calculateNextPollDelay(status: DomainConnectionStatus): number {
    switch (status) {
        case 'pending_dns':
        case 'dns_propagating':
            return POLL_INTERVALS.DNS_PROPAGATING;
        case 'pending_ssl':
        case 'ssl_provisioning':
            return POLL_INTERVALS.SSL_PROVISIONING;
        case 'connected':
            return 0; // No more polling needed
        default:
            return POLL_INTERVALS.INITIAL;
    }
}

/**
 * Check if polling should continue
 */
function shouldContinuePolling(
    status: DomainConnectionStatus,
    startTime: Date,
    attemptCount: number
): boolean {
    // Stop if connected or error
    if (status === 'connected' || status === 'error' || status === 'rollback') {
        return false;
    }

    // Check max poll duration
    const elapsedMs = Date.now() - startTime.getTime();
    if (elapsedMs > POLL_INTERVALS.MAX_POLL_DURATION) {
        console.log('[shouldContinuePolling] Max poll duration exceeded');
        return false;
    }

    // Check max attempts for different phases
    if (status === 'pending_dns' || status === 'dns_propagating') {
        if (attemptCount >= MAX_RETRY_ATTEMPTS.DNS_VERIFICATION) {
            console.log('[shouldContinuePolling] Max DNS verification attempts exceeded');
            return false;
        }
    }

    if (status === 'pending_ssl' || status === 'ssl_provisioning') {
        if (attemptCount >= MAX_RETRY_ATTEMPTS.SSL_PROVISIONING) {
            console.log('[shouldContinuePolling] Max SSL provisioning attempts exceeded');
            return false;
        }
    }

    return true;
}

/**
 * Update domain connection status in Firestore
 */
async function updateConnectionStatus(
    connectionId: string,
    updates: {
        status?: DomainConnectionStatus;
        hostState?: HostState;
        ownershipStatus?: OwnershipStatus;
        certState?: CertState;
        lastPolledAt?: string;
        pollAttempts?: number;
        error?: string;
    }
): Promise<void> {
    await db.collection('domain_connections').doc(connectionId).update({
        ...updates,
        updatedAt: new Date().toISOString()
    });
}

/**
 * Poll domain status once and return result
 */
export async function pollDomainStatusOnce(
    connectionId: string,
    siteId: string,
    domain: string
): Promise<PollDomainStatusResponse> {
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

        const connection = connectionDoc.data()!;
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
                nextCheckDelay: POLL_INTERVALS.INITIAL,
                error: 'Domain not found in Firebase Hosting'
            };
        }

        const hostState = domainStatus.hostState;
        const ownershipStatus = domainStatus.ownershipState?.status || 'OWNERSHIP_STATUS_UNSPECIFIED';
        const certState = domainStatus.cert?.state;

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

    } catch (error: any) {
        console.error('[pollDomainStatusOnce] Error:', error);

        return {
            connectionId,
            domain,
            hostState: 'HOST_STATE_UNSPECIFIED',
            ownershipStatus: 'OWNERSHIP_STATUS_UNSPECIFIED',
            isComplete: false,
            requiresRetry: true,
            nextCheckDelay: POLL_INTERVALS.INITIAL,
            error: error.message || 'Failed to poll domain status'
        };
    }
}

/**
 * Cloud Function: Poll Domain Status (Callable)
 */
export const pollDomainStatus = functions
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        // Authentication optional for polling (can be called by frontend)
        const { connectionId, siteId, domain } = data;

        if (!connectionId || !siteId || !domain) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'connectionId, siteId, and domain are required'
            );
        }

        return pollDomainStatusOnce(connectionId, siteId, domain);
    });

/**
 * HTTP endpoint for polling
 */
export const pollDomainStatusHTTP = functions
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

        if (req.method !== 'GET' && req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        const connectionId = req.query.connectionId as string || req.body?.connectionId;
        const siteId = req.query.siteId as string || req.body?.siteId;
        const domain = req.query.domain as string || req.body?.domain;

        if (!connectionId || !siteId || !domain) {
            res.status(400).json({
                error: 'connectionId, siteId, and domain are required'
            });
            return;
        }

        try {
            const result = await pollDomainStatusOnce(connectionId, siteId, domain);
            res.json(result);
        } catch (error: any) {
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
export const scheduledDomainPolling = functions
    .runWith({
        timeoutSeconds: 300,
        memory: '512MB'
    })
    .pubsub.schedule('every 1 minutes')
    .onRun(async (context) => {
        console.log('[scheduledDomainPolling] Starting scheduled poll');

        try {
            // Find all pending connections that need polling
            const pendingStatuses: DomainConnectionStatus[] = [
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
            const results = await Promise.allSettled(
                snapshot.docs.map(async (doc) => {
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
                    const result = await pollDomainStatusOnce(
                        connectionId,
                        connection.siteId,
                        connection.domain
                    );

                    return { connectionId, result };
                })
            );

            // Log results
            const successful = results.filter(r => r.status === 'fulfilled').length;
            const failed = results.filter(r => r.status === 'rejected').length;
            console.log(`[scheduledDomainPolling] Completed: ${successful} successful, ${failed} failed`);

            return null;

        } catch (error) {
            console.error('[scheduledDomainPolling] Error:', error);
            return null;
        }
    });

/**
 * Get connection status for frontend
 */
export const getDomainConnectionStatus = functions
    .runWith({
        timeoutSeconds: 30,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        const { connectionId } = data;

        if (!connectionId) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'connectionId is required'
            );
        }

        const doc = await db.collection('domain_connections').doc(connectionId).get();

        if (!doc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'Connection not found'
            );
        }

        return doc.data();
    });

/**
 * HTTP endpoint for getting connection status
 */
export const getDomainConnectionStatusHTTP = functions
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

        const connectionId = req.query.connectionId as string;

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
        } catch (error: any) {
            console.error('[getDomainConnectionStatusHTTP] Error:', error);
            res.status(500).json({
                error: error.message || 'Failed to get connection status'
            });
        }
    });
