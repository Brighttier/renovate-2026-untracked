"use strict";
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
exports.disconnectCustomDomain = exports.oneClickLaunchHTTP = exports.oneClickLaunch = exports.connectCustomDomainHTTP = exports.connectCustomDomain = void 0;
exports.getDomainFromHosting = getDomainFromHosting;
exports.updateConnectionRecord = updateConnectionRecord;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const google_auth_library_1 = require("google-auth-library");
const types_1 = require("./types");
const createSite_1 = require("./createSite");
const deploySite_1 = require("./deploySite");
const db = admin.firestore();
// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
 * Validate domain format
 */
function validateDomain(domain) {
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
function sanitizeDomain(domain) {
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
async function addDomainToHosting(projectId, siteId, domain) {
    var _a, _b;
    const token = await getAccessToken();
    const response = await fetch(`${types_1.FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites/${siteId}/customDomains?customDomainId=${encodeURIComponent(domain)}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            certPreference: 'GROUPED'
        })
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[addDomainToHosting] API error: ${response.status}`, errorText);
        // Check for specific errors
        try {
            const errorJson = JSON.parse(errorText);
            if (((_a = errorJson.error) === null || _a === void 0 ? void 0 : _a.status) === 'ALREADY_EXISTS') {
                throw new Error('DOMAIN_EXISTS');
            }
            throw new Error(((_b = errorJson.error) === null || _b === void 0 ? void 0 : _b.message) || `API error: ${response.status}`);
        }
        catch (parseError) {
            if (parseError.message === 'DOMAIN_EXISTS')
                throw parseError;
            throw new Error(`Firebase Hosting API error: ${response.status}`);
        }
    }
    const customDomain = await response.json();
    console.log(`[addDomainToHosting] Added domain: ${domain}`);
    return customDomain;
}
/**
 * Get custom domain status from Firebase Hosting
 */
async function getDomainFromHosting(projectId, siteId, domain) {
    const token = await getAccessToken();
    const response = await fetch(`${types_1.FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites/${siteId}/customDomains/${encodeURIComponent(domain)}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
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
async function removeDomainFromHosting(projectId, siteId, domain) {
    const token = await getAccessToken();
    const response = await fetch(`${types_1.FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites/${siteId}/customDomains/${encodeURIComponent(domain)}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
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
function buildRequiredDnsRecords(domain, siteId) {
    const records = [];
    // A records for root domain
    for (const ip of types_1.FIREBASE_HOSTING_IPS.A) {
        records.push({
            type: 'A',
            name: '@',
            value: ip,
            ttl: 3600,
            status: 'pending'
        });
    }
    // AAAA record for IPv6
    for (const ip of types_1.FIREBASE_HOSTING_IPS.AAAA) {
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
function mapDomainStatus(customDomain) {
    var _a, _b;
    const hostState = customDomain.hostState;
    const ownershipStatus = (_a = customDomain.ownershipState) === null || _a === void 0 ? void 0 : _a.status;
    const certState = (_b = customDomain.cert) === null || _b === void 0 ? void 0 : _b.state;
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
async function ensureSiteExists(projectId, businessName, leadId, agencyId, userId) {
    const siteId = (0, createSite_1.generateSiteId)(businessName, leadId);
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
    const response = await fetch(`${types_1.FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites?siteId=${siteId}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ labels })
    });
    if (!response.ok) {
        const errorText = await response.text();
        // If site already exists in Firebase, that's okay
        if (!errorText.includes('ALREADY_EXISTS')) {
            console.error(`[ensureSiteExists] API error: ${response.status}`, errorText);
            throw new Error(`Failed to create site: ${response.status}`);
        }
    }
    // Store in Firestore
    const clientSite = {
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
async function createConnectionRecord(connectionId, domain, siteId, request, status, dnsRecords) {
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
async function updateConnectionRecord(connectionId, updates) {
    await db.collection('domain_connections').doc(connectionId).update({
        ...updates,
        updatedAt: new Date().toISOString()
    });
}
/**
 * Main domain connection orchestrator
 */
async function connectDomainFlow(request, projectId) {
    var _a, _b, _c;
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
        const { siteId } = await ensureSiteExists(projectId, request.businessName, request.leadId, request.agencyId, request.userId);
        // Build DNS records
        const dnsRecords = buildRequiredDnsRecords(domain, siteId);
        // Create initial connection record
        await createConnectionRecord(connectionId, domain, siteId, request, 'creating_site', dnsRecords);
        // Step 2: Deploy content (if provided)
        if (request.htmlContent) {
            console.log(`[connectDomainFlow] Step 2: Deploying content`);
            await updateConnectionRecord(connectionId, { status: 'deploying_content' });
            const deployResult = await (0, deploySite_1.deployToSite)(projectId, siteId, request.htmlContent, `Initial deployment for ${domain}`);
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
            await (0, createSite_1.updateClientSiteStatus)(siteId, {
                status: 'active',
                lastDeployedAt: new Date().toISOString(),
                currentVersionId: deployResult.versionId
            });
        }
        // Step 3: Add custom domain to Firebase Hosting
        console.log(`[connectDomainFlow] Step 3: Adding domain to Firebase Hosting`);
        await updateConnectionRecord(connectionId, { status: 'adding_domain' });
        let customDomain;
        try {
            customDomain = await addDomainToHosting(projectId, siteId, domain);
        }
        catch (error) {
            if (error.message === 'DOMAIN_EXISTS') {
                // Domain already added, get its status
                const existingDomain = await getDomainFromHosting(projectId, siteId, domain);
                if (existingDomain) {
                    customDomain = existingDomain;
                }
                else {
                    throw error;
                }
            }
            else {
                throw error;
            }
        }
        // Map status
        const connectionStatus = mapDomainStatus(customDomain);
        // Update connection record with final status
        await updateConnectionRecord(connectionId, {
            status: connectionStatus,
            hostState: customDomain.hostState,
            ownershipStatus: (_a = customDomain.ownershipState) === null || _a === void 0 ? void 0 : _a.status,
            certState: (_b = customDomain.cert) === null || _b === void 0 ? void 0 : _b.state
        });
        // Update site record
        await (0, createSite_1.updateClientSiteStatus)(siteId, {
            customDomain: domain,
            domainConnectionId: connectionId,
            domainConnectionStatus: connectionStatus,
            sslStatus: (_c = customDomain.cert) === null || _c === void 0 ? void 0 : _c.state,
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
    }
    catch (error) {
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
exports.connectCustomDomain = functions
    .runWith({
    timeoutSeconds: 300,
    memory: '512MB'
})
    .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to connect a domain');
    }
    const { domain, leadId, agencyId, htmlContent, businessName, connectionMethod } = data;
    const userId = context.auth.uid;
    // Validate required fields
    if (!domain || !leadId || !agencyId || !businessName) {
        throw new functions.https.HttpsError('invalid-argument', 'domain, leadId, agencyId, and businessName are required');
    }
    const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';
    const request = {
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
        throw new functions.https.HttpsError('internal', result.error || 'Domain connection failed');
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
exports.connectCustomDomainHTTP = functions
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
    const request = {
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
    }
    else {
        res.status(500).json(result);
    }
});
/**
 * 1-Click Launch Flow (No Custom Domain Required)
 * Creates a Firebase Hosting site and deploys content without requiring a custom domain
 */
async function oneClickLaunchFlow(request, projectId) {
    const connectionId = `launch-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    try {
        // Step 1: Create/get site
        console.log(`[oneClickLaunchFlow] Step 1: Ensuring site exists for ${request.businessName}`);
        const { siteId } = await ensureSiteExists(projectId, request.businessName, request.leadId, request.agencyId, request.userId);
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
            const deployResult = await (0, deploySite_1.deployToSite)(projectId, siteId, request.htmlContent, `1-Click Launch deployment`);
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
            await (0, createSite_1.updateClientSiteStatus)(siteId, {
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
    }
    catch (error) {
        console.error('[oneClickLaunchFlow] Error:', error);
        await db.collection('domain_connections').doc(connectionId).update({
            status: 'error',
            errorMessage: error.message,
            errorCount: 1,
            updatedAt: new Date().toISOString()
        }).catch(() => { });
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
exports.oneClickLaunch = functions
    .runWith({
    timeoutSeconds: 300,
    memory: '512MB'
})
    .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to launch a site');
    }
    const { leadId, agencyId, htmlContent, businessName } = data;
    const userId = context.auth.uid;
    // Validate required fields (NO domain required!)
    if (!leadId || !agencyId || !businessName) {
        throw new functions.https.HttpsError('invalid-argument', 'leadId, agencyId, and businessName are required');
    }
    if (!htmlContent) {
        throw new functions.https.HttpsError('invalid-argument', 'htmlContent is required for deployment');
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
        throw new functions.https.HttpsError('internal', result.error || '1-Click Launch failed');
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
exports.oneClickLaunchHTTP = functions
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
    }
    else {
        res.status(500).json(result);
    }
});
/**
 * Cloud Function: Disconnect Custom Domain
 */
exports.disconnectCustomDomain = functions
    .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in');
    }
    const { connectionId } = data;
    const userId = context.auth.uid;
    if (!connectionId) {
        throw new functions.https.HttpsError('invalid-argument', 'connectionId is required');
    }
    // Get connection record
    const connectionDoc = await db.collection('domain_connections').doc(connectionId).get();
    if (!connectionDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Connection not found');
    }
    const connection = connectionDoc.data();
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
        await (0, createSite_1.updateClientSiteStatus)(connection.siteId, {
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
    }
    catch (error) {
        console.error('[disconnectCustomDomain] Error:', error);
        throw new functions.https.HttpsError('internal', error.message || 'Failed to disconnect domain');
    }
});
//# sourceMappingURL=connectDomain.js.map