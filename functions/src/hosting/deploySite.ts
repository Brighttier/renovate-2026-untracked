/**
 * Firebase Hosting Site Deployment
 * Deploys HTML content to Firebase Hosting sites
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleAuth } from 'google-auth-library';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';
import {
    HostingVersion,
    HostingRelease,
    PopulateFilesResponse,
    DeploymentResponse,
    ClientSite,
    FIREBASE_HOSTING_API_BASE,
    DEFAULT_HOSTING_CONFIG,
    MAX_RETRY_ATTEMPTS
} from './types';
import { updateClientSiteStatus } from './createSite';

const gzip = promisify(zlib.gzip);
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
 * Calculate SHA256 hash of gzipped content
 */
function calculateHash(content: Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Create a new version for a site
 */
async function createVersion(
    projectId: string,
    siteId: string,
    config: typeof DEFAULT_HOSTING_CONFIG = DEFAULT_HOSTING_CONFIG
): Promise<HostingVersion> {
    const token = await getAccessToken();

    const response = await fetch(
        `${FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites/${siteId}/versions`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ config })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[createVersion] API error: ${response.status}`, errorText);
        throw new Error(`Failed to create version: ${response.status}`);
    }

    const version: HostingVersion = await response.json();
    console.log(`[createVersion] Created version: ${version.name}`);
    return version;
}

/**
 * Populate files for a version
 */
async function populateFiles(
    versionName: string,
    files: Record<string, string>
): Promise<PopulateFilesResponse> {
    const token = await getAccessToken();

    const response = await fetch(
        `${FIREBASE_HOSTING_API_BASE}/${versionName}:populateFiles`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ files })
        }
    );

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
async function uploadFile(
    uploadUrl: string,
    hash: string,
    gzippedContent: Buffer
): Promise<void> {
    const token = await getAccessToken();

    const response = await fetch(
        `${uploadUrl}/${hash}`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/octet-stream'
            },
            body: new Uint8Array(gzippedContent)
        }
    );

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
async function finalizeVersion(versionName: string): Promise<HostingVersion> {
    const token = await getAccessToken();

    const response = await fetch(
        `${FIREBASE_HOSTING_API_BASE}/${versionName}?update_mask=status`,
        {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'FINALIZED' })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[finalizeVersion] API error: ${response.status}`, errorText);
        throw new Error(`Failed to finalize version: ${response.status}`);
    }

    const version: HostingVersion = await response.json();
    console.log(`[finalizeVersion] Finalized version: ${version.name}`);
    return version;
}

/**
 * Create a release (deploy the version)
 */
async function createRelease(
    projectId: string,
    siteId: string,
    versionName: string,
    message?: string
): Promise<HostingRelease> {
    const token = await getAccessToken();

    const body: any = {};
    if (message) {
        body.message = message;
    }

    const response = await fetch(
        `${FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites/${siteId}/releases?versionName=${encodeURIComponent(versionName)}`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`[createRelease] API error: ${response.status}`, errorText);
        throw new Error(`Failed to create release: ${response.status}`);
    }

    const release: HostingRelease = await response.json();
    console.log(`[createRelease] Created release: ${release.name}`);
    return release;
}

/**
 * Deploy HTML content to a Firebase Hosting site
 * Full deployment workflow: create version -> populate files -> upload -> finalize -> release
 */
export async function deployToSite(
    projectId: string,
    siteId: string,
    htmlContent: string,
    deployMessage?: string
): Promise<DeploymentResponse> {
    try {
        console.log(`[deployToSite] Starting deployment to site: ${siteId}`);

        // Step 1: Create new version
        const version = await createVersion(projectId, siteId, DEFAULT_HOSTING_CONFIG);
        const versionId = version.name.split('/').pop()!;

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
        const files: Record<string, string> = {
            '/index.html': htmlHash,
            '/robots.txt': robotsHash
        };

        // Step 3: Populate files and get upload URL
        const populateResponse = await populateFiles(version.name, files);

        // Step 4: Upload files that need uploading
        if (populateResponse.uploadRequiredHashes && populateResponse.uploadUrl) {
            const hashToContent: Record<string, Buffer> = {
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
        const release = await createRelease(
            projectId,
            siteId,
            version.name,
            deployMessage || 'Deployed via RenovateMySite'
        );
        const releaseId = release.name.split('/').pop()!;

        const siteUrl = `https://${siteId}.web.app`;
        console.log(`[deployToSite] Successfully deployed to: ${siteUrl}`);

        return {
            success: true,
            siteUrl,
            versionId,
            releaseId
        };

    } catch (error: any) {
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
async function deployWithRetry(
    projectId: string,
    siteId: string,
    htmlContent: string,
    maxRetries: number = MAX_RETRY_ATTEMPTS.DEPLOYMENT
): Promise<DeploymentResponse> {
    let lastError: string = '';

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[deployWithRetry] Attempt ${attempt}/${maxRetries}`);

        const result = await deployToSite(
            projectId,
            siteId,
            htmlContent,
            `Deployment attempt ${attempt}`
        );

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
export const deployToFirebaseHostingSite = functions
    .runWith({
        timeoutSeconds: 120,
        memory: '512MB'
    })
    .https.onCall(async (data, context) => {
        // Verify authentication
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'You must be logged in to deploy'
            );
        }

        const { siteId, htmlContent } = data;
        const userId = context.auth.uid;

        if (!siteId || !htmlContent) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'siteId and htmlContent are required'
            );
        }

        // Verify user owns the site
        const siteDoc = await db.collection('client_sites').doc(siteId).get();
        if (!siteDoc.exists) {
            throw new functions.https.HttpsError(
                'not-found',
                'Site not found'
            );
        }

        const site = siteDoc.data() as ClientSite;
        if (site.userId !== userId && site.agencyId !== userId) {
            throw new functions.https.HttpsError(
                'permission-denied',
                'You do not have permission to deploy to this site'
            );
        }

        const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';

        try {
            // Update status to deploying
            await updateClientSiteStatus(siteId, { status: 'deploying' });

            // Deploy with retry
            const result = await deployWithRetry(projectId, siteId, htmlContent);

            if (result.success) {
                // Update site record
                await updateClientSiteStatus(siteId, {
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
            } else {
                // Update status to error
                await updateClientSiteStatus(siteId, {
                    status: 'error'
                });

                throw new functions.https.HttpsError(
                    'internal',
                    result.error || 'Deployment failed'
                );
            }

        } catch (error: any) {
            console.error('[deployToFirebaseHostingSite] Error:', error);

            await updateClientSiteStatus(siteId, {
                status: 'error'
            });

            throw new functions.https.HttpsError(
                'internal',
                error.message || 'Deployment failed'
            );
        }
    });

/**
 * HTTP endpoint version
 */
export const deployToFirebaseHostingSiteHTTP = functions
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

        const site = siteDoc.data() as ClientSite;
        if (site.userId !== userId && site.agencyId !== userId) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }

        const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';

        try {
            await updateClientSiteStatus(siteId, { status: 'deploying' });

            const result = await deployWithRetry(projectId, siteId, htmlContent);

            if (result.success) {
                await updateClientSiteStatus(siteId, {
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
            } else {
                await updateClientSiteStatus(siteId, { status: 'error' });
                res.status(500).json({
                    success: false,
                    error: result.error
                });
            }

        } catch (error: any) {
            await updateClientSiteStatus(siteId, { status: 'error' });
            res.status(500).json({
                success: false,
                error: error.message || 'Deployment failed'
            });
        }
    });
