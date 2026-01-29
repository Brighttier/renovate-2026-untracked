/**
 * Scaling Configuration Cloud Functions
 *
 * Provides CRUD operations for scaling configuration:
 * - Rate limits per endpoint
 * - Caching settings
 * - Scraping metrics
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getDefaultRateLimits, clearRateLimitsCache } from '../utils/rateLimiter';

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// ============================================
// TYPE DEFINITIONS
// ============================================

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    enabled?: boolean;
}

interface ScalingConfig {
    rateLimits: Record<string, RateLimitConfig>;
    cacheEnabled: boolean;
    cacheTTLDays: number;
    updatedAt?: admin.firestore.Timestamp;
    updatedBy?: string;
}

interface ScrapingMetrics {
    cachedUrls: number;
    requestsLastHour: number;
    requestsToday: number;
    cacheHitRate: number;
}

// ============================================
// SCALING CONFIG FUNCTIONS
// ============================================

/**
 * Get current scaling configuration
 */
export const getScalingConfig = onCall(
    {
        region: 'us-central1',
        memory: '256MiB'
    },
    async (request) => {
        try {
            const doc = await db.doc('config/scalingConfig').get();

            if (doc.exists) {
                const data = doc.data() as ScalingConfig;
                return {
                    ...data,
                    updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null
                };
            }

            // Return default config if none exists
            return {
                rateLimits: getDefaultRateLimits(),
                cacheEnabled: true,
                cacheTTLDays: 7,
                updatedAt: null,
                updatedBy: null
            };
        } catch (error: any) {
            console.error('getScalingConfig error:', error);
            throw new HttpsError('internal', error.message || 'Failed to get scaling config');
        }
    }
);

/**
 * Update scaling configuration
 */
export const updateScalingConfig = onCall(
    {
        region: 'us-central1',
        memory: '256MiB'
    },
    async (request) => {
        // Verify user is authenticated
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }

        const { rateLimits, cacheEnabled, cacheTTLDays } = request.data;

        try {
            const updateData: Partial<ScalingConfig> = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp() as any,
                updatedBy: request.auth.uid
            };

            // Validate and add rate limits if provided
            if (rateLimits) {
                // Validate rate limit structure
                for (const [endpoint, config] of Object.entries(rateLimits)) {
                    const c = config as RateLimitConfig;
                    if (typeof c.maxRequests !== 'number' || c.maxRequests < 1) {
                        throw new HttpsError('invalid-argument', `Invalid maxRequests for ${endpoint}`);
                    }
                    if (typeof c.windowMs !== 'number' || c.windowMs < 1000) {
                        throw new HttpsError('invalid-argument', `Invalid windowMs for ${endpoint}`);
                    }
                }
                updateData.rateLimits = rateLimits;
            }

            // Add cache settings if provided
            if (typeof cacheEnabled === 'boolean') {
                updateData.cacheEnabled = cacheEnabled;
            }

            if (typeof cacheTTLDays === 'number' && cacheTTLDays >= 1 && cacheTTLDays <= 30) {
                updateData.cacheTTLDays = cacheTTLDays;
            }

            // Update config
            await db.doc('config/scalingConfig').set(updateData, { merge: true });

            // Clear the rate limits cache so new limits take effect immediately
            clearRateLimitsCache();

            // Log to audit
            await db.collection('auditLogs').add({
                action: 'update_scaling_config',
                actor: request.auth.uid,
                actorEmail: request.auth.token.email || null,
                details: {
                    rateLimitsUpdated: !!rateLimits,
                    cacheEnabled: updateData.cacheEnabled,
                    cacheTTLDays: updateData.cacheTTLDays
                },
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            return { success: true };
        } catch (error: any) {
            console.error('updateScalingConfig error:', error);
            if (error instanceof HttpsError) throw error;
            throw new HttpsError('internal', error.message || 'Failed to update scaling config');
        }
    }
);

/**
 * Get scraping metrics for dashboard
 */
export const getScrapingMetrics = onCall(
    {
        region: 'us-central1',
        memory: '256MiB'
    },
    async (request) => {
        try {
            const now = Date.now();
            const oneHourAgo = now - 3600000;
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            // Get cached URLs count
            const cacheCountSnapshot = await db.collection('scrapedContent').count().get();
            const cachedUrls = cacheCountSnapshot.data().count;

            // Get rate limit stats for scrapeWebsite endpoint
            // Count documents in the scrapeWebsite rate limit collection
            const rateLimitDocs = await db.collection('rateLimits/scrapeWebsite')
                .where('lastRequest', '>', oneHourAgo)
                .get();

            let requestsLastHour = 0;
            rateLimitDocs.forEach(doc => {
                const data = doc.data();
                if (data.windowStart > oneHourAgo) {
                    requestsLastHour += data.count || 0;
                }
            });

            // Get today's total (approximate from rate limit windows)
            const todayDocs = await db.collection('rateLimits/scrapeWebsite')
                .where('lastRequest', '>', todayStart.getTime())
                .get();

            let requestsToday = 0;
            todayDocs.forEach(doc => {
                const data = doc.data();
                requestsToday += data.count || 0;
            });

            // Calculate cache hit rate from recent logs (if available)
            // This is an approximation - in production you'd track this more precisely
            let cacheHitRate = 0;
            try {
                // Look for recent performance logs
                const recentLogs = await db.collection('performanceLogs')
                    .where('functionName', '==', 'scrapeWebsite')
                    .where('timestamp', '>', new Date(oneHourAgo))
                    .limit(100)
                    .get();

                if (!recentLogs.empty) {
                    let hits = 0;
                    let total = 0;
                    recentLogs.forEach(doc => {
                        const data = doc.data();
                        if (data.cached === true) hits++;
                        total++;
                    });
                    cacheHitRate = total > 0 ? Math.round((hits / total) * 100) : 0;
                }
            } catch {
                // Performance logs collection may not exist yet
                cacheHitRate = 0;
            }

            const metrics: ScrapingMetrics = {
                cachedUrls,
                requestsLastHour,
                requestsToday,
                cacheHitRate
            };

            return metrics;
        } catch (error: any) {
            console.error('getScrapingMetrics error:', error);
            throw new HttpsError('internal', error.message || 'Failed to get scraping metrics');
        }
    }
);

/**
 * Clear scraping cache (admin action)
 */
export const clearScrapingCache = onCall(
    {
        region: 'us-central1',
        memory: '512MiB',
        timeoutSeconds: 120
    },
    async (request) => {
        // Verify user is authenticated
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }

        try {
            // Delete all documents in scrapedContent collection
            const batch = db.batch();
            const snapshot = await db.collection('scrapedContent').limit(500).get();

            if (snapshot.empty) {
                return { deleted: 0 };
            }

            snapshot.docs.forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();

            // Log to audit
            await db.collection('auditLogs').add({
                action: 'clear_scraping_cache',
                actor: request.auth.uid,
                actorEmail: request.auth.token.email || null,
                details: { deletedCount: snapshot.size },
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            });

            // If there are more documents, indicate that another call is needed
            return {
                deleted: snapshot.size,
                hasMore: snapshot.size === 500
            };
        } catch (error: any) {
            console.error('clearScrapingCache error:', error);
            throw new HttpsError('internal', error.message || 'Failed to clear cache');
        }
    }
);

/**
 * Get rate limit usage stats per endpoint
 */
export const getRateLimitStats = onCall(
    {
        region: 'us-central1',
        memory: '256MiB'
    },
    async (request) => {
        try {
            const endpoints = [
                'scrapeWebsite',
                'generateBlueprint',
                'editBlueprint',
                'generateImage',
                'findBusinesses',
                'researchBusiness'
            ];

            const oneHourAgo = Date.now() - 3600000;
            const stats: Record<string, { activeUsers: number; totalRequests: number }> = {};

            for (const endpoint of endpoints) {
                const snapshot = await db.collection(`rateLimits/${endpoint}`)
                    .where('lastRequest', '>', oneHourAgo)
                    .get();

                let totalRequests = 0;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.windowStart > oneHourAgo) {
                        totalRequests += data.count || 0;
                    }
                });

                stats[endpoint] = {
                    activeUsers: snapshot.size,
                    totalRequests
                };
            }

            return stats;
        } catch (error: any) {
            console.error('getRateLimitStats error:', error);
            throw new HttpsError('internal', error.message || 'Failed to get rate limit stats');
        }
    }
);
