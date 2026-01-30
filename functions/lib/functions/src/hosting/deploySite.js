"use strict";
/**
 * Firebase Hosting Site Deployment
 * Deploys HTML content to Firebase Hosting sites
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
exports.deployToFirebaseHostingSiteHTTP = exports.deployToFirebaseHostingSite = void 0;
exports.deployToSite = deployToSite;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const google_auth_library_1 = require("google-auth-library");
const crypto = __importStar(require("crypto"));
const zlib = __importStar(require("zlib"));
const util_1 = require("util");
const types_1 = require("./types");
const createSite_1 = require("./createSite");
const gzip = (0, util_1.promisify)(zlib.gzip);
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
 * Calculate SHA256 hash of gzipped content
 */
function calculateHash(content) {
    return crypto.createHash('sha256').update(content).digest('hex');
}
/**
 * Create a new version for a site
 */
async function createVersion(projectId, siteId, config = types_1.DEFAULT_HOSTING_CONFIG) {
    const token = await getAccessToken();
    const response = await fetch(`${types_1.FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites/${siteId}/versions`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ config })
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[createVersion] API error: ${response.status}`, errorText);
        throw new Error(`Failed to create version: ${response.status}`);
    }
    const version = await response.json();
    console.log(`[createVersion] Created version: ${version.name}`);
    return version;
}
/**
 * Populate files for a version
 */
async function populateFiles(versionName, files) {
    const token = await getAccessToken();
    const response = await fetch(`${types_1.FIREBASE_HOSTING_API_BASE}/${versionName}:populateFiles`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ files })
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[populateFiles] API error: ${response.status}`, errorText);
        throw new Error(`Failed to populate files: ${response.status}`);
    }
    return response.json();
}
/**
 * Upload file content to Firebase Hosting
 */
async function uploadFile(uploadUrl, hash, gzippedContent) {
    const token = await getAccessToken();
    const response = await fetch(`${uploadUrl}/${hash}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/octet-stream'
        },
        body: new Uint8Array(gzippedContent)
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[uploadFile] API error: ${response.status}`, errorText);
        throw new Error(`Failed to upload file: ${response.status}`);
    }
    console.log(`[uploadFile] Uploaded file with hash: ${hash}`);
}
/**
 * Finalize a version (set status to FINALIZED)
 */
async function finalizeVersion(versionName) {
    const token = await getAccessToken();
    const response = await fetch(`${types_1.FIREBASE_HOSTING_API_BASE}/${versionName}?update_mask=status`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'FINALIZED' })
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[finalizeVersion] API error: ${response.status}`, errorText);
        throw new Error(`Failed to finalize version: ${response.status}`);
    }
    const version = await response.json();
    console.log(`[finalizeVersion] Finalized version: ${version.name}`);
    return version;
}
/**
 * Create a release (deploy the version)
 */
async function createRelease(projectId, siteId, versionName, message) {
    const token = await getAccessToken();
    const body = {};
    if (message) {
        body.message = message;
    }
    const response = await fetch(`${types_1.FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites/${siteId}/releases?versionName=${encodeURIComponent(versionName)}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[createRelease] API error: ${response.status}`, errorText);
        throw new Error(`Failed to create release: ${response.status}`);
    }
    const release = await response.json();
    console.log(`[createRelease] Created release: ${release.name}`);
    return release;
}
/**
 * Deploy HTML content to a Firebase Hosting site
 * Full deployment workflow: create version -> populate files -> upload -> finalize -> release
 */
async function deployToSite(projectId, siteId, htmlContent, deployMessage) {
    try {
        console.log(`[deployToSite] Starting deployment to site: ${siteId}`);
        // Step 1: Create new version
        const version = await createVersion(projectId, siteId, types_1.DEFAULT_HOSTING_CONFIG);
        const versionId = version.name.split('/').pop();
        // Step 2: Prepare file content (gzip and hash)
        const htmlBuffer = Buffer.from(htmlContent, 'utf-8');
        const gzippedHtml = await gzip(htmlBuffer);
        const htmlHash = calculateHash(gzippedHtml);
        // Create additional files
        const robotsTxt = `User-agent: *\nAllow: /`;
        const robotsBuffer = Buffer.from(robotsTxt, 'utf-8');
        const gzippedRobots = await gzip(robotsBuffer);
        const robotsHash = calculateHash(gzippedRobots);
        // File manifest: path -> SHA256 hash
        const files = {
            '/index.html': htmlHash,
            '/robots.txt': robotsHash
        };
        // Step 3: Populate files and get upload URL
        const populateResponse = await populateFiles(version.name, files);
        // Step 4: Upload files that need uploading
        if (populateResponse.uploadRequiredHashes && populateResponse.uploadUrl) {
            const hashToContent = {
                [htmlHash]: gzippedHtml,
                [robotsHash]: gzippedRobots
            };
            for (const hash of populateResponse.uploadRequiredHashes) {
                const content = hashToContent[hash];
                if (content) {
                    await uploadFile(populateResponse.uploadUrl, hash, content);
                }
            }
        }
        // Step 5: Finalize version
        await finalizeVersion(version.name);
        // Step 6: Create release
        const release = await createRelease(projectId, siteId, version.name, deployMessage || 'Deployed via RenovateMySite');
        const releaseId = release.name.split('/').pop();
        const siteUrl = `https://${siteId}.web.app`;
        console.log(`[deployToSite] Successfully deployed to: ${siteUrl}`);
        return {
            success: true,
            siteUrl,
            versionId,
            releaseId
        };
    }
    catch (error) {
        console.error('[deployToSite] Deployment failed:', error);
        return {
            success: false,
            error: error.message || 'Deployment failed'
        };
    }
}
/**
 * Deploy with retry logic
 */
async function deployWithRetry(projectId, siteId, htmlContent, maxRetries = types_1.MAX_RETRY_ATTEMPTS.DEPLOYMENT) {
    let lastError = '';
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[deployWithRetry] Attempt ${attempt}/${maxRetries}`);
        const result = await deployToSite(projectId, siteId, htmlContent, `Deployment attempt ${attempt}`);
        if (result.success) {
            return result;
        }
        lastError = result.error || 'Unknown error';
        console.error(`[deployWithRetry] Attempt ${attempt} failed:`, lastError);
        if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    return {
        success: false,
        error: `Deployment failed after ${maxRetries} attempts: ${lastError}`
    };
}
/**
 * Cloud Function: Deploy HTML to Firebase Hosting Site
 */
exports.deployToFirebaseHostingSite = functions
    .runWith({
    timeoutSeconds: 120,
    memory: '512MB'
})
    .https.onCall(async (data, context) => {
    // Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to deploy');
    }
    const { siteId, htmlContent } = data;
    const userId = context.auth.uid;
    if (!siteId || !htmlContent) {
        throw new functions.https.HttpsError('invalid-argument', 'siteId and htmlContent are required');
    }
    // Verify user owns the site
    const siteDoc = await db.collection('client_sites').doc(siteId).get();
    if (!siteDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Site not found');
    }
    const site = siteDoc.data();
    if (site.userId !== userId && site.agencyId !== userId) {
        throw new functions.https.HttpsError('permission-denied', 'You do not have permission to deploy to this site');
    }
    const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';
    try {
        // Update status to deploying
        await (0, createSite_1.updateClientSiteStatus)(siteId, { status: 'deploying' });
        // Deploy with retry
        const result = await deployWithRetry(projectId, siteId, htmlContent);
        if (result.success) {
            // Update site record
            await (0, createSite_1.updateClientSiteStatus)(siteId, {
                status: 'active',
                lastDeployedAt: new Date().toISOString(),
                currentVersionId: result.versionId,
                currentReleaseId: result.releaseId
            });
            // Create audit log
            await db.collection('auditLogs').add({
                actorId: userId,
                actorType: 'user',
                actorEmail: context.auth.token.email || '',
                action: 'deploy',
                resource: 'hosting_site',
                resourceId: siteId,
                details: {
                    versionId: result.versionId,
                    releaseId: result.releaseId,
                    siteUrl: result.siteUrl
                },
                createdAt: new Date().toISOString()
            });
            return {
                success: true,
                siteUrl: result.siteUrl,
                versionId: result.versionId
            };
        }
        else {
            // Update status to error
            await (0, createSite_1.updateClientSiteStatus)(siteId, {
                status: 'error'
            });
            throw new functions.https.HttpsError('internal', result.error || 'Deployment failed');
        }
    }
    catch (error) {
        console.error('[deployToFirebaseHostingSite] Error:', error);
        await (0, createSite_1.updateClientSiteStatus)(siteId, {
            status: 'error'
        });
        throw new functions.https.HttpsError('internal', error.message || 'Deployment failed');
    }
});
/**
 * HTTP endpoint version
 */
exports.deployToFirebaseHostingSiteHTTP = functions
    .runWith({
    timeoutSeconds: 120,
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
    const { siteId, htmlContent, userId } = req.body;
    if (!siteId || !htmlContent || !userId) {
        res.status(400).json({
            error: 'siteId, htmlContent, and userId are required'
        });
        return;
    }
    // Verify user owns the site
    const siteDoc = await db.collection('client_sites').doc(siteId).get();
    if (!siteDoc.exists) {
        res.status(404).json({ error: 'Site not found' });
        return;
    }
    const site = siteDoc.data();
    if (site.userId !== userId && site.agencyId !== userId) {
        res.status(403).json({ error: 'Permission denied' });
        return;
    }
    const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';
    try {
        await (0, createSite_1.updateClientSiteStatus)(siteId, { status: 'deploying' });
        const result = await deployWithRetry(projectId, siteId, htmlContent);
        if (result.success) {
            await (0, createSite_1.updateClientSiteStatus)(siteId, {
                status: 'active',
                lastDeployedAt: new Date().toISOString(),
                currentVersionId: result.versionId,
                currentReleaseId: result.releaseId
            });
            res.json({
                success: true,
                siteUrl: result.siteUrl,
                versionId: result.versionId
            });
        }
        else {
            await (0, createSite_1.updateClientSiteStatus)(siteId, { status: 'error' });
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    }
    catch (error) {
        await (0, createSite_1.updateClientSiteStatus)(siteId, { status: 'error' });
        res.status(500).json({
            success: false,
            error: error.message || 'Deployment failed'
        });
    }
});
//# sourceMappingURL=deploySite.js.map