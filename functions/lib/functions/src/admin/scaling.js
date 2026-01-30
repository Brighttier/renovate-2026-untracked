"use strict";
/**
 * Scaling Configuration Cloud Functions
 *
 * Provides CRUD operations for scaling configuration:
 * - Rate limits per endpoint
 * - Caching settings
 * - Scraping metrics
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
exports.getRateLimitStats = exports.clearScrapingCache = exports.getScrapingMetrics = exports.updateScalingConfig = exports.getScalingConfig = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const rateLimiter_1 = require("../utils/rateLimiter");
// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
// ============================================
// SCALING CONFIG FUNCTIONS
// ============================================
/**
 * Get current scaling configuration
 */
exports.getScalingConfig = (0, https_1.onCall)({
    region: 'us-central1',
    memory: '256MiB'
}, async (request) => {
    var _a, _b, _c;
    try {
        const doc = await db.doc('config/scalingConfig').get();
        if (doc.exists) {
            const data = doc.data();
            return {
                ...data,
                updatedAt: ((_c = (_b = (_a = data.updatedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.toISOString()) || null
            };
        }
        // Return default config if none exists
        return {
            rateLimits: (0, rateLimiter_1.getDefaultRateLimits)(),
            cacheEnabled: true,
            cacheTTLDays: 7,
            updatedAt: null,
            updatedBy: null
        };
    }
    catch (error) {
        console.error('getScalingConfig error:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to get scaling config');
    }
});
/**
 * Update scaling configuration
 */
exports.updateScalingConfig = (0, https_1.onCall)({
    region: 'us-central1',
    memory: '256MiB'
}, async (request) => {
    // Verify user is authenticated
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
    }
    const { rateLimits, cacheEnabled, cacheTTLDays } = request.data;
    try {
        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid
        };
        // Validate and add rate limits if provided
        if (rateLimits) {
            // Validate rate limit structure
            for (const [endpoint, config] of Object.entries(rateLimits)) {
                const c = config;
                if (typeof c.maxRequests !== 'number' || c.maxRequests < 1) {
                    throw new https_1.HttpsError('invalid-argument', `Invalid maxRequests for ${endpoint}`);
                }
                if (typeof c.windowMs !== 'number' || c.windowMs < 1000) {
                    throw new https_1.HttpsError('invalid-argument', `Invalid windowMs for ${endpoint}`);
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
        (0, rateLimiter_1.clearRateLimitsCache)();
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
    }
    catch (error) {
        console.error('updateScalingConfig error:', error);
        if (error instanceof https_1.HttpsError)
            throw error;
        throw new https_1.HttpsError('internal', error.message || 'Failed to update scaling config');
    }
});
/**
 * Get scraping metrics for dashboard
 */
exports.getScrapingMetrics = (0, https_1.onCall)({
    region: 'us-central1',
    memory: '256MiB'
}, async (request) => {
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
                    if (data.cached === true)
                        hits++;
                    total++;
                });
                cacheHitRate = total > 0 ? Math.round((hits / total) * 100) : 0;
            }
        }
        catch (_a) {
            // Performance logs collection may not exist yet
            cacheHitRate = 0;
        }
        const metrics = {
            cachedUrls,
            requestsLastHour,
            requestsToday,
            cacheHitRate
        };
        return metrics;
    }
    catch (error) {
        console.error('getScrapingMetrics error:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to get scraping metrics');
    }
});
/**
 * Clear scraping cache (admin action)
 */
exports.clearScrapingCache = (0, https_1.onCall)({
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 120
}, async (request) => {
    // Verify user is authenticated
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required');
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
    }
    catch (error) {
        console.error('clearScrapingCache error:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to clear cache');
    }
});
/**
 * Get rate limit usage stats per endpoint
 */
exports.getRateLimitStats = (0, https_1.onCall)({
    region: 'us-central1',
    memory: '256MiB'
}, async (request) => {
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
        const stats = {};
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
    }
    catch (error) {
        console.error('getRateLimitStats error:', error);
        throw new https_1.HttpsError('internal', error.message || 'Failed to get rate limit stats');
    }
});
//# sourceMappingURL=scaling.js.map