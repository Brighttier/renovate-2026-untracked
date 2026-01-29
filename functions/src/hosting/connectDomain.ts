/**
 * Domain Connection Orchestrator
 * Handles the complete flow of connecting a custom domain to a Firebase Hosting site
 *
 * Flow:
 * 1. Create Firebase Hosting site (if not exists)
 * 2. Deploy HTML content to site
 * 3. Add custom domain to Firebase Hosting
 * 4. Configure DNS via GoDaddy (if available)
 * 5. Poll for domain verification and SSL provisioning
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleAuth } from 'google-auth-library';
import {
    CustomDomain,
    DomainConnectionRequest,
    DomainConnectionResponse,
    DomainConnectionStatus,
    RequiredDnsRecord,
    ClientSite,
    FIREBASE_HOSTING_API_BASE,
    FIREBASE_HOSTING_IPS
} from './types';
import { generateSiteId, updateClientSiteStatus } from './createSite';
import { deployToSite } from './deploySite';

const db = admin.firestore();

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
 * Validate domain format
 */
function validateDomain(domain: string): boolean {
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    const blacklist = ['localhost', 'example.com', 'test.com', 'invalid.com'];

    if (!domainRegex.test(domain)) {
        return false;
    }

    for (const blocked of blacklist) {
        if (domain.toLowerCase().includes(blocked)) {
            return false;
        }
    }

    return true;
}

/**
 * Sanitize domain (lowercase, trim, remove protocol)
 */
function sanitizeDomain(domain: string): string {
    return domain
        .toLowerCase()
        .trim()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/.*$/, '');
}

/**
 * Add custom domain to Firebase Hosting site
 */
async function addDomainToHosting(
    projectId: string,
    siteId: string,
    domain: string
): Promise<CustomDomain> {
    const token = await getAccessToken();

    const response = await fetch(
        `${FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites/${siteId}/customDomains?customDomainId=${encodeURIComponent(domain)}`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                certPreference: 'GROUPED'
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[addDomainToHosting] API error: ${response.status}`, errorText);

        // Check for specific errors
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error?.status === 'ALREADY_EXISTS') {
                throw new Error('DOMAIN_EXISTS');
            }
            throw new Error(errorJson.error?.message || `API error: ${response.status}`);
        } catch (parseError) {
            if ((parseError as Error).message === 'DOMAIN_EXISTS') throw parseError;
            throw new Error(`Firebase Hosting API error: ${response.status}`);
        }
    }

    const customDomain: CustomDomain = await response.json();
    console.log(`[addDomainToHosting] Added domain: ${domain}`);
    return customDomain;
}

/**
 * Get custom domain status from Firebase Hosting
 */
export async function getDomainFromHosting(
    projectId: string,
    siteId: string,
    domain: string
): Promise<CustomDomain | null> {
    const token = await getAccessToken();

    const response = await fetch(
        `${FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites/${siteId}/customDomains/${encodeURIComponent(domain)}`,
        {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }
    );

    if (!response.ok) {
        if (response.status === 404) {
            return null;
        }
        const errorText = await response.text();
        console.error(`[getDomainFromHosting] API error: ${response.status}`, errorText);
        throw new Error(`Failed to get domain status: ${response.status}`);
    }

    return response.json();
}

/**
 * Remove custom domain from Firebase Hosting
 */
async function removeDomainFromHosting(
    projectId: string,
    siteId: string,
    domain: string
): Promise<void> {
    const token = await getAccessToken();

    const response = await fetch(
        `${FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites/${siteId}/customDomains/${encodeURIComponent(domain)}`,
        {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }
    );

    if (!response.ok && response.status !== 404) {
        const errorText = await response.text();
        console.error(`[removeDomainFromHosting] API error: ${response.status}`, errorText);
        throw new Error(`Failed to remove domain: ${response.status}`);
    }

    console.log(`[removeDomainFromHosting] Removed domain: ${domain}`);
}

/**
 * Build DNS records required for Firebase Hosting
 */
function buildRequiredDnsRecords(domain: string, siteId: string): RequiredDnsRecord[] {
    const records: RequiredDnsRecord[] = [];

    // A records for root domain
    for (const ip of FIREBASE_HOSTING_IPS.A) {
        records.push({
            type: 'A',
            name: '@',
            value: ip,
            ttl: 3600,
            status: 'pending'
        });
    }

    // AAAA record for IPv6
    for (const ip of FIREBASE_HOSTING_IPS.AAAA) {
        records.push({
            type: 'AAAA',
            name: '@',
            value: ip,
            ttl: 3600,
            status: 'pending'
        });
    }

    // CNAME for www subdomain
    records.push({
        type: 'CNAME',
        name: 'www',
        value: `${siteId}.web.app`,
        ttl: 3600,
        status: 'pending'
    });

    return records;
}

/**
 * Map Firebase domain status to our connection status
 */
function mapDomainStatus(customDomain: CustomDomain): DomainConnectionStatus {
    const hostState = customDomain.hostState;
    const ownershipStatus = customDomain.ownershipState?.status;
    const certState = customDomain.cert?.state;

    // Check ownership first
    if (ownershipStatus === 'OWNERSHIP_MISSING' || ownershipStatus === 'OWNERSHIP_PENDING') {
        return 'pending_dns';
    }

    // Check host state
    if (hostState === 'HOST_UNHOSTED' || hostState === 'HOST_UNREACHABLE') {
        return 'dns_propagating';
    }

    if (hostState === 'HOST_MISMATCH') {
        return 'dns_propagating';
    }

    if (hostState === 'HOST_CONFLICT') {
        return 'error';
    }

    // Check SSL status
    if (hostState === 'HOST_ACTIVE') {
        if (certState === 'CERT_ACTIVE') {
            return 'connected';
        }
        if (certState === 'CERT_PREPARING' || certState === 'CERT_VALIDATING' || certState === 'CERT_PROPAGATING') {
            return 'ssl_provisioning';
        }
        return 'pending_ssl';
    }

    return 'pending_dns';
}

/**
 * Create or get existing site for domain connection
 */
async function ensureSiteExists(
    projectId: string,
    businessName: string,
    leadId: string,
    agencyId: string,
    userId: string
): Promise<{ siteId: string; isNew: boolean }> {
    const siteId = generateSiteId(businessName, leadId);

    // Check Firestore first
    const existingSite = await db.collection('client_sites').doc(siteId).get();
    if (existingSite.exists) {
        return { siteId, isNew: false };
    }

    // Create new site via Firebase Hosting API
    const token = await getAccessToken();

    const labels = {
        'agency-id': agencyId.substring(0, 63),
        'lead-id': leadId.substring(0, 63),
        'created-by': 'renovatemysite'
    };

    const response = await fetch(
        `${FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites?siteId=${siteId}`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ labels })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        // If site already exists in Firebase, that's okay
        if (!errorText.includes('ALREADY_EXISTS')) {
            console.error(`[ensureSiteExists] API error: ${response.status}`, errorText);
            throw new Error(`Failed to create site: ${response.status}`);
        }
    }

    // Store in Firestore
    const clientSite: ClientSite = {
        id: siteId,
        agencyId,
        leadId,
        userId,
        businessName,
        siteType: 'production',
        defaultUrl: `https://${siteId}.web.app`,
        status: 'creating',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    await db.collection('client_sites').doc(siteId).set(clientSite);

    return { siteId, isNew: true };
}

/**
 * Store domain connection record in Firestore
 */
async function createConnectionRecord(
    connectionId: string,
    domain: string,
    siteId: string,
    request: DomainConnectionRequest,
    status: DomainConnectionStatus,
    dnsRecords: RequiredDnsRecord[]
): Promise<void> {
    const now = new Date().toISOString();

    await db.collection('domain_connections').doc(connectionId).set({
        id: connectionId,
        domain,
        siteId,
        agencyId: request.agencyId,
        leadId: request.leadId,
        userId: request.userId,
        businessName: request.businessName,
        connectionMethod: request.connectionMethod,
        status,
        dnsRecords,
        createdAt: now,
        updatedAt: now,
        checkCount: 0,
        errorCount: 0
    });
}

/**
 * Update domain connection record
 */
export async function updateConnectionRecord(
    connectionId: string,
    updates: Record<string, any>
): Promise<void> {
    await db.collection('domain_connections').doc(connectionId).update({
        ...updates,
        updatedAt: new Date().toISOString()
    });
}

/**
 * Main domain connection orchestrator
 */
async function connectDomainFlow(
    request: DomainConnectionRequest,
    projectId: string
): Promise<DomainConnectionResponse> {
    const domain = sanitizeDomain(request.domain);

    // Validate domain
    if (!validateDomain(domain)) {
        return {
            success: false,
            error: 'Invalid domain format'
        };
    }

    // Check for existing connection
    const existingConnection = await db.collection('domain_connections')
        .where('domain', '==', domain)
        .where('status', 'not-in', ['disconnected', 'error'])
        .limit(1)
        .get();

    if (!existingConnection.empty) {
        const existing = existingConnection.docs[0].data();
        return {
            success: false,
            error: `Domain ${domain} is already connected to site ${existing.siteId}`
        };
    }

    // Generate connection ID
    const connectionId = `conn-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    try {
        // Step 1: Create/get site
        console.log(`[connectDomainFlow] Step 1: Ensuring site exists`);
        const { siteId } = await ensureSiteExists(
            projectId,
            request.businessName,
            request.leadId,
            request.agencyId,
            request.userId
        );

        // Build DNS records
        const dnsRecords = buildRequiredDnsRecords(domain, siteId);

        // Create initial connection record
        await createConnectionRecord(
            connectionId,
            domain,
            siteId,
            request,
            'creating_site',
            dnsRecords
        );

        // Step 2: Deploy content (if provided)
        if (request.htmlContent) {
            console.log(`[connectDomainFlow] Step 2: Deploying content`);
            await updateConnectionRecord(connectionId, { status: 'deploying_content' });

            const deployResult = await deployToSite(
                projectId,
                siteId,
                request.htmlContent,
                `Initial deployment for ${domain}`
            );

            if (!deployResult.success) {
                await updateConnectionRecord(connectionId, {
                    status: 'error',
                    errorMessage: deployResult.error,
                    errorCount: 1
                });

                return {
                    success: false,
                    connectionId,
                    siteId,
                    error: `Deployment failed: ${deployResult.error}`
                };
            }

            // Update site status
            await updateClientSiteStatus(siteId, {
                status: 'active',
                lastDeployedAt: new Date().toISOString(),
                currentVersionId: deployResult.versionId
            });
        }

        // Step 3: Add custom domain to Firebase Hosting
        console.log(`[connectDomainFlow] Step 3: Adding domain to Firebase Hosting`);
        await updateConnectionRecord(connectionId, { status: 'adding_domain' });

        let customDomain: CustomDomain;
        try {
            customDomain = await addDomainToHosting(projectId, siteId, domain);
        } catch (error: any) {
            if (error.message === 'DOMAIN_EXISTS') {
                // Domain already added, get its status
                const existingDomain = await getDomainFromHosting(projectId, siteId, domain);
                if (existingDomain) {
                    customDomain = existingDomain;
                } else {
                    throw error;
                }
            } else {
                throw error;
            }
        }

        // Map status
        const connectionStatus = mapDomainStatus(customDomain);

        // Update connection record with final status
        await updateConnectionRecord(connectionId, {
            status: connectionStatus,
            hostState: customDomain.hostState,
            ownershipStatus: customDomain.ownershipState?.status,
            certState: customDomain.cert?.state
        });

        // Update site record
        await updateClientSiteStatus(siteId, {
            customDomain: domain,
            domainConnectionId: connectionId,
            domainConnectionStatus: connectionStatus,
            sslStatus: customDomain.cert?.state,
            status: connectionStatus === 'connected' ? 'active' : 'domain_pending'
        });

        console.log(`[connectDomainFlow] Domain connection initiated: ${domain} -> ${siteId}`);

        return {
            success: true,
            connectionId,
            siteId,
            siteUrl: `https://${siteId}.web.app`,
            customDomain: domain,
            status: connectionStatus,
            dnsRecords
        };

    } catch (error: any) {
        console.error('[connectDomainFlow] Error:', error);

        // Update connection record with error
        await updateConnectionRecord(connectionId, {
            status: 'error',
            errorMessage: error.message,
            errorCount: 1
        });

        return {
            success: false,
            connectionId,
            error: error.message || 'Domain connection failed'
        };
    }
}

/**
 * Cloud Function: Connect Custom Domain
 * Main entry point for domain connection
 */
export const connectCustomDomain = functions
    .runWith({
        timeoutSeconds: 300,
        memory: '512MB'
    })
    .https.onCall(async (data, context) => {
        // Verify authentication
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'You must be logged in to connect a domain'
            );
        }

        const { domain, leadId, agencyId, htmlContent, businessName, connectionMethod } = data;
        const userId = context.auth.uid;

        // Validate required fields
        if (!domain || !leadId || !agencyId || !businessName) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'domain, leadId, agencyId, and businessName are required'
            );
        }

        const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';

        const request: DomainConnectionRequest = {
            domain,
            leadId,
            agencyId,
            userId,
            htmlContent: htmlContent || '',
            businessName,
            connectionMethod: connectionMethod || 'firebase_auto'
        };

        const result = await connectDomainFlow(request, projectId);

        if (!result.success) {
            throw new functions.https.HttpsError(
                'internal',
                result.error || 'Domain connection failed'
            );
        }

        // Create audit log
        await db.collection('auditLogs').add({
            actorId: userId,
            actorType: 'user',
            actorEmail: context.auth.token.email || '',
            action: 'connect_domain',
            resource: 'domain_connection',
            resourceId: result.connectionId,
            details: {
                domain,
                siteId: result.siteId,
                businessName,
                connectionMethod
            },
            createdAt: new Date().toISOString()
        });

        return result;
    });

/**
 * HTTP endpoint version
 */
export const connectCustomDomainHTTP = functions
    .runWith({
        timeoutSeconds: 300,
        memory: '512MB'
    })
    .https.onRequest(async (req, res) => {
        // Handle CORS
        if (req.method === 'OPTIONS') {
            res.set(corsHeaders).status(204).send('');
            return;
        }

        res.set(corsHeaders);

        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        const { domain, leadId, agencyId, userId, htmlContent, businessName, connectionMethod } = req.body;

        if (!domain || !leadId || !agencyId || !userId || !businessName) {
            res.status(400).json({
                error: 'domain, leadId, agencyId, userId, and businessName are required'
            });
            return;
        }

        const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';

        const request: DomainConnectionRequest = {
            domain,
            leadId,
            agencyId,
            userId,
            htmlContent: htmlContent || '',
            businessName,
            connectionMethod: connectionMethod || 'firebase_auto'
        };

        const result = await connectDomainFlow(request, projectId);

        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    });

/**
 * 1-Click Launch Flow (No Custom Domain Required)
 * Creates a Firebase Hosting site and deploys content without requiring a custom domain
 */
async function oneClickLaunchFlow(
    request: {
        leadId: string;
        agencyId: string;
        userId: string;
        businessName: string;
        htmlContent: string;
    },
    projectId: string
): Promise<DomainConnectionResponse> {
    const connectionId = `launch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    try {
        // Step 1: Create/get site
        console.log(`[oneClickLaunchFlow] Step 1: Ensuring site exists for ${request.businessName}`);
        const { siteId } = await ensureSiteExists(
            projectId,
            request.businessName,
            request.leadId,
            request.agencyId,
            request.userId
        );

        const siteUrl = `https://${siteId}.web.app`;

        // Create connection record for tracking (without domain)
        const now = new Date().toISOString();
        await db.collection('domain_connections').doc(connectionId).set({
            id: connectionId,
            domain: null, // No custom domain for 1-click launch
            siteId,
            agencyId: request.agencyId,
            leadId: request.leadId,
            userId: request.userId,
            businessName: request.businessName,
            connectionMethod: '1click_launch',
            status: 'deploying_content',
            dnsRecords: [],
            createdAt: now,
            updatedAt: now,
            checkCount: 0,
            errorCount: 0
        });

        // Step 2: Deploy content
        if (request.htmlContent) {
            console.log(`[oneClickLaunchFlow] Step 2: Deploying content to ${siteId}`);

            const deployResult = await deployToSite(
                projectId,
                siteId,
                request.htmlContent,
                `1-Click Launch deployment`
            );

            if (!deployResult.success) {
                await updateConnectionRecord(connectionId, {
                    status: 'error',
                    errorMessage: deployResult.error,
                    errorCount: 1
                });

                return {
                    success: false,
                    connectionId,
                    siteId,
                    error: `Deployment failed: ${deployResult.error}`
                };
            }

            // Update site status
            await updateClientSiteStatus(siteId, {
                status: 'active',
                lastDeployedAt: now,
                currentVersionId: deployResult.versionId
            });
        }

        // Update connection status to connected (since no domain verification needed)
        await updateConnectionRecord(connectionId, {
            status: 'connected',
            siteUrl
        });

        console.log(`[oneClickLaunchFlow] Successfully launched site: ${siteUrl}`);

        return {
            success: true,
            connectionId,
            siteId,
            siteUrl,
            status: 'connected'
        };

    } catch (error: any) {
        console.error('[oneClickLaunchFlow] Error:', error);

        await db.collection('domain_connections').doc(connectionId).update({
            status: 'error',
            errorMessage: error.message,
            errorCount: 1,
            updatedAt: new Date().toISOString()
        }).catch(() => {});

        return {
            success: false,
            connectionId,
            error: error.message || '1-Click Launch failed'
        };
    }
}

/**
 * Cloud Function: 1-Click Launch
 * Creates and deploys a site without requiring a custom domain
 */
export const oneClickLaunch = functions
    .runWith({
        timeoutSeconds: 300,
        memory: '512MB'
    })
    .https.onCall(async (data, context) => {
        // Verify authentication
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'You must be logged in to launch a site'
            );
        }

        const { leadId, agencyId, htmlContent, businessName } = data;
        const userId = context.auth.uid;

        // Validate required fields (NO domain required!)
        if (!leadId || !agencyId || !businessName) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'leadId, agencyId, and businessName are required'
            );
        }

        if (!htmlContent) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'htmlContent is required for deployment'
            );
        }

        const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';

        const result = await oneClickLaunchFlow({
            leadId,
            agencyId,
            userId,
            businessName,
            htmlContent
        }, projectId);

        if (!result.success) {
            throw new functions.https.HttpsError(
                'internal',
                result.error || '1-Click Launch failed'
            );
        }

        // Create audit log
        await db.collection('auditLogs').add({
            actorId: userId,
            actorType: 'user',
            actorEmail: context.auth.token.email || '',
            action: '1click_launch',
            resource: 'hosting_site',
            resourceId: result.siteId,
            details: {
                siteId: result.siteId,
                siteUrl: result.siteUrl,
                businessName
            },
            createdAt: new Date().toISOString()
        });

        return result;
    });

/**
 * HTTP endpoint version of 1-Click Launch
 */
export const oneClickLaunchHTTP = functions
    .runWith({
        timeoutSeconds: 300,
        memory: '512MB'
    })
    .https.onRequest(async (req, res) => {
        // Handle CORS
        if (req.method === 'OPTIONS') {
            res.set(corsHeaders).status(204).send('');
            return;
        }

        res.set(corsHeaders);

        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        const { leadId, agencyId, userId, htmlContent, businessName } = req.body;

        if (!leadId || !agencyId || !userId || !businessName) {
            res.status(400).json({
                error: 'leadId, agencyId, userId, and businessName are required'
            });
            return;
        }

        if (!htmlContent) {
            res.status(400).json({
                error: 'htmlContent is required for deployment'
            });
            return;
        }

        const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';

        const result = await oneClickLaunchFlow({
            leadId,
            agencyId,
            userId,
            businessName,
            htmlContent
        }, projectId);

        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
    });

/**
 * Cloud Function: Disconnect Custom Domain
 */
export const disconnectCustomDomain = functions
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'You must be logged in'
            );
        }

        const { connectionId } = data;
        const userId = context.auth.uid;

        if (!connectionId) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'connectionId is required'
            );
        }

        // Get connection record
        const connectionDoc = await db.collection('domain_connections').doc(connectionId).get();
        if (!connectionDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Connection not found');
        }

        const connection = connectionDoc.data()!;

        // Verify ownership
        if (connection.userId !== userId && connection.agencyId !== userId) {
            throw new functions.https.HttpsError('permission-denied', 'Permission denied');
        }

        const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';

        try {
            // Remove domain from Firebase Hosting
            await removeDomainFromHosting(projectId, connection.siteId, connection.domain);

            // Update connection record
            await updateConnectionRecord(connectionId, {
                status: 'disconnected',
                disconnectedAt: new Date().toISOString()
            });

            // Update site record
            await updateClientSiteStatus(connection.siteId, {
                customDomain: undefined,
                domainConnectionId: undefined,
                domainConnectionStatus: undefined,
                sslStatus: undefined,
                status: 'active'
            });

            // Create audit log
            await db.collection('auditLogs').add({
                actorId: userId,
                actorType: 'user',
                actorEmail: context.auth.token.email || '',
                action: 'disconnect_domain',
                resource: 'domain_connection',
                resourceId: connectionId,
                details: {
                    domain: connection.domain,
                    siteId: connection.siteId
                },
                createdAt: new Date().toISOString()
            });

            return { success: true };

        } catch (error: any) {
            console.error('[disconnectCustomDomain] Error:', error);
            throw new functions.https.HttpsError(
                'internal',
                error.message || 'Failed to disconnect domain'
            );
        }
    });
