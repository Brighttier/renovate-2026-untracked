/**
 * Firebase Hosting Site Creation
 * Creates new Firebase Hosting sites for client websites
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleAuth } from 'google-auth-library';
import {
    FirebaseHostingSite,
    ClientSite,
    FIREBASE_HOSTING_API_BASE,
    SITE_ID_MAX_LENGTH,
    SITE_ID_PREFIX,
    MAX_RETRY_ATTEMPTS
} from './types';

const db = admin.firestore();

// CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Google Auth for Firebase Hosting API
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
 * Generate a valid Firebase Hosting site ID
 * Rules: 3-30 chars, lowercase alphanumeric + hyphens, must start with letter
 */
export function generateSiteId(businessName: string, leadId: string): string {
    // Clean business name: lowercase, remove special chars, replace spaces with hyphens
    const cleanName = businessName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 15);

    // Get short ID from leadId
    const shortId = leadId.replace(/[^a-z0-9]/gi, '').substring(0, 8).toLowerCase();

    // Combine with prefix
    let siteId = `${SITE_ID_PREFIX}-${cleanName}-${shortId}`;

    // Ensure it starts with a letter
    if (!/^[a-z]/.test(siteId)) {
        siteId = `${SITE_ID_PREFIX}-site-${shortId}`;
    }

    // Truncate to max length
    siteId = siteId.substring(0, SITE_ID_MAX_LENGTH);

    // Remove trailing hyphen if present
    siteId = siteId.replace(/-$/, '');

    return siteId;
}

/**
 * Check if a site already exists
 */
async function siteExists(projectId: string, siteId: string): Promise<boolean> {
    try {
        const token = await getAccessToken();
        const response = await fetch(
            `${FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites/${siteId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * Create a new Firebase Hosting site
 */
async function createHostingSite(
    projectId: string,
    siteId: string,
    labels?: Record<string, string>
): Promise<FirebaseHostingSite> {
    const token = await getAccessToken();

    const body: any = {};
    if (labels) {
        body.labels = labels;
    }

    const response = await fetch(
        `${FIREBASE_HOSTING_API_BASE}/projects/${projectId}/sites?siteId=${siteId}`,
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
        console.error(`[createHostingSite] API error: ${response.status}`, errorText);

        // Parse error for specific handling
        try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error?.status === 'ALREADY_EXISTS') {
                throw new Error('SITE_EXISTS');
            }
            throw new Error(errorJson.error?.message || `API error: ${response.status}`);
        } catch (parseError) {
            if ((parseError as Error).message === 'SITE_EXISTS') throw parseError;
            throw new Error(`Firebase Hosting API error: ${response.status}`);
        }
    }

    const site: FirebaseHostingSite = await response.json();
    console.log(`[createHostingSite] Created site: ${site.name}`);
    return site;
}

/**
 * Create site with retry logic
 */
async function createSiteWithRetry(
    projectId: string,
    siteId: string,
    labels?: Record<string, string>,
    maxRetries: number = MAX_RETRY_ATTEMPTS.SITE_CREATION
): Promise<FirebaseHostingSite> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`[createSiteWithRetry] Attempt ${attempt}/${maxRetries} for site: ${siteId}`);
            return await createHostingSite(projectId, siteId, labels);
        } catch (error: any) {
            lastError = error;
            console.error(`[createSiteWithRetry] Attempt ${attempt} failed:`, error.message);

            // Don't retry if site already exists
            if (error.message === 'SITE_EXISTS') {
                throw error;
            }

            // Wait before retry (exponential backoff)
            if (attempt < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError || new Error('Failed to create site after retries');
}

/**
 * Cloud Function: Create Firebase Hosting Site
 * Creates a new site for a client's website
 */
export const createFirebaseHostingSite = functions
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
    })
    .https.onCall(async (data, context) => {
        // Verify authentication
        if (!context.auth) {
            throw new functions.https.HttpsError(
                'unauthenticated',
                'You must be logged in to create a hosting site'
            );
        }

        const { businessName, leadId, agencyId } = data;
        const userId = context.auth.uid;

        // Validate required fields
        if (!businessName || !leadId || !agencyId) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'businessName, leadId, and agencyId are required'
            );
        }

        const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';

        try {
            console.log(`[createFirebaseHostingSite] Creating site for: ${businessName}`);

            // Generate site ID
            const siteId = generateSiteId(businessName, leadId);
            console.log(`[createFirebaseHostingSite] Generated siteId: ${siteId}`);

            // Check if site already exists in Firestore
            const existingSite = await db.collection('client_sites').doc(siteId).get();
            if (existingSite.exists) {
                const siteData = existingSite.data() as ClientSite;
                console.log(`[createFirebaseHostingSite] Site already exists in Firestore`);
                return {
                    success: true,
                    siteId: siteData.id,
                    defaultUrl: siteData.defaultUrl,
                    isExisting: true
                };
            }

            // Check if site exists in Firebase Hosting
            const hostingExists = await siteExists(projectId, siteId);
            if (hostingExists) {
                console.log(`[createFirebaseHostingSite] Site exists in Hosting but not Firestore`);
                // Create Firestore record for existing site
                const clientSite: ClientSite = {
                    id: siteId,
                    agencyId,
                    leadId,
                    userId,
                    businessName,
                    siteType: 'production',
                    defaultUrl: `https://${siteId}.web.app`,
                    status: 'active',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                await db.collection('client_sites').doc(siteId).set(clientSite);

                return {
                    success: true,
                    siteId,
                    defaultUrl: clientSite.defaultUrl,
                    isExisting: true
                };
            }

            // Create new site with labels for tracking
            const labels = {
                'agency-id': agencyId.substring(0, 63),
                'lead-id': leadId.substring(0, 63),
                'created-by': 'renovatemysite'
            };

            await createSiteWithRetry(projectId, siteId, labels);

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

            // Create audit log
            await db.collection('auditLogs').add({
                actorId: userId,
                actorType: 'user',
                actorEmail: context.auth.token.email || '',
                action: 'create',
                resource: 'hosting_site',
                resourceId: siteId,
                details: {
                    businessName,
                    leadId,
                    agencyId,
                    defaultUrl: clientSite.defaultUrl
                },
                createdAt: new Date().toISOString()
            });

            console.log(`[createFirebaseHostingSite] Successfully created site: ${siteId}`);

            return {
                success: true,
                siteId,
                defaultUrl: clientSite.defaultUrl,
                isExisting: false
            };

        } catch (error: any) {
            console.error('[createFirebaseHostingSite] Error:', error);

            if (error.message === 'SITE_EXISTS') {
                throw new functions.https.HttpsError(
                    'already-exists',
                    'A site with this ID already exists'
                );
            }

            throw new functions.https.HttpsError(
                'internal',
                error.message || 'Failed to create hosting site'
            );
        }
    });

/**
 * HTTP endpoint version for external access
 */
export const createFirebaseHostingSiteHTTP = functions
    .runWith({
        timeoutSeconds: 60,
        memory: '256MB'
    })
    .https.onRequest(async (req, res) => {
        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
            res.set(corsHeaders).status(204).send('');
            return;
        }

        res.set(corsHeaders);

        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        // Note: For HTTP endpoint, you would need to validate auth token from header
        // This is a simplified version - in production, verify Firebase ID token

        const { businessName, leadId, agencyId, userId } = req.body;

        if (!businessName || !leadId || !agencyId || !userId) {
            res.status(400).json({
                error: 'businessName, leadId, agencyId, and userId are required'
            });
            return;
        }

        const projectId = process.env.GCLOUD_PROJECT || 'renovatemysite-app';

        try {
            const siteId = generateSiteId(businessName, leadId);

            // Check existing
            const existingSite = await db.collection('client_sites').doc(siteId).get();
            if (existingSite.exists) {
                const siteData = existingSite.data() as ClientSite;
                res.json({
                    success: true,
                    siteId: siteData.id,
                    defaultUrl: siteData.defaultUrl,
                    isExisting: true
                });
                return;
            }

            // Create site
            const labels = {
                'agency-id': agencyId.substring(0, 63),
                'lead-id': leadId.substring(0, 63),
                'created-by': 'renovatemysite'
            };

            await createSiteWithRetry(projectId, siteId, labels);

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

            res.json({
                success: true,
                siteId,
                defaultUrl: clientSite.defaultUrl,
                isExisting: false
            });

        } catch (error: any) {
            console.error('[createFirebaseHostingSiteHTTP] Error:', error);
            res.status(500).json({
                error: error.message || 'Failed to create hosting site'
            });
        }
    });

/**
 * Get site details from Firestore
 */
export async function getClientSite(siteId: string): Promise<ClientSite | null> {
    const doc = await db.collection('client_sites').doc(siteId).get();
    if (!doc.exists) return null;
    return doc.data() as ClientSite;
}

/**
 * Update site status in Firestore
 */
export async function updateClientSiteStatus(
    siteId: string,
    updates: Partial<ClientSite>
): Promise<void> {
    await db.collection('client_sites').doc(siteId).update({
        ...updates,
        updatedAt: new Date().toISOString()
    });
}
