/**
 * Rate Limiter using Firestore
 * Protects against API abuse and ensures fair usage
 *
 * Now supports dynamic configuration from Firestore config/scalingConfig
 */

import * as admin from 'firebase-admin';

interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    enabled?: boolean;
}

// ============================================
// DYNAMIC CONFIGURATION FROM FIRESTORE
// ============================================

// Default rate limits (used if no Firestore config exists)
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
    'generateBlueprint': { maxRequests: 10, windowMs: 60000 },    // 10/min
    'editBlueprint': { maxRequests: 15, windowMs: 60000 },        // 15/min
    'scrapeWebsite': { maxRequests: 30, windowMs: 60000 },        // 30/min (increased for scale)
    'generateImage': { maxRequests: 20, windowMs: 60000 },        // 20/min
    'findBusinesses': { maxRequests: 30, windowMs: 60000 },       // 30/min
    'researchBusiness': { maxRequests: 10, windowMs: 60000 },     // 10/min
    'storeImage': { maxRequests: 50, windowMs: 60000 },           // 50/min
    'generateProposalEmail': { maxRequests: 20, windowMs: 60000 }, // 20/min
    'default': { maxRequests: 100, windowMs: 60000 }              // 100/min fallback
};

// Cache for rate limit configuration (refreshed every minute)
let cachedRateLimits: Record<string, RateLimitConfig> | null = null;
let rateLimitsCacheExpiry: number = 0;
const RATE_LIMITS_CACHE_TTL = 60000; // 1 minute cache

/**
 * Get rate limits from Firestore config with caching
 * Falls back to defaults if config doesn't exist
 */
async function getRateLimits(): Promise<Record<string, RateLimitConfig>> {
    const now = Date.now();

    // Return cached config if still valid
    if (cachedRateLimits && now < rateLimitsCacheExpiry) {
        return cachedRateLimits;
    }

    try {
        const db = admin.firestore();
        const configDoc = await db.doc('config/scalingConfig').get();

        if (configDoc.exists) {
            const data = configDoc.data();
            if (data?.rateLimits) {
                // Merge with defaults to ensure all endpoints have limits
                cachedRateLimits = {
                    ...DEFAULT_RATE_LIMITS,
                    ...data.rateLimits
                };
            } else {
                cachedRateLimits = DEFAULT_RATE_LIMITS;
            }
        } else {
            cachedRateLimits = DEFAULT_RATE_LIMITS;
        }
    } catch (error) {
        console.error('Failed to fetch rate limit config:', error);
        cachedRateLimits = DEFAULT_RATE_LIMITS;
    }

    rateLimitsCacheExpiry = now + RATE_LIMITS_CACHE_TTL;
    return cachedRateLimits!;
}

/**
 * Clear the rate limits cache (useful after config updates)
 */
export function clearRateLimitsCache(): void {
    cachedRateLimits = null;
    rateLimitsCacheExpiry = 0;
}

// ============================================
// RATE LIMITING LOGIC
// ============================================

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfter?: number;
    limit?: number;
}

/**
 * Check if a request should be rate limited
 * @param identifier - IP address or user ID
 * @param endpoint - The endpoint being called
 * @returns Rate limit result with allowed status and remaining requests
 */
export async function checkRateLimit(
    identifier: string,
    endpoint: string
): Promise<RateLimitResult> {
    const rateLimits = await getRateLimits();
    const config = rateLimits[endpoint] || rateLimits['default'];

    // Check if rate limiting is disabled for this endpoint
    if (config.enabled === false) {
        return { allowed: true, remaining: -1, limit: config.maxRequests };
    }

    const db = admin.firestore();
    const docPath = `rateLimits/${endpoint}/${identifier.replace(/[.:/]/g, '_')}`;
    const now = Date.now();

    try {
        const docRef = db.doc(docPath);
        const doc = await docRef.get();

        if (!doc.exists) {
            // First request in window
            await docRef.set({
                count: 1,
                windowStart: now,
                lastRequest: now
            });
            return { allowed: true, remaining: config.maxRequests - 1, limit: config.maxRequests };
        }

        const data = doc.data()!;
        const windowStart = data.windowStart;

        // Check if window has expired
        if (now - windowStart > config.windowMs) {
            // Reset window
            await docRef.set({
                count: 1,
                windowStart: now,
                lastRequest: now
            });
            return { allowed: true, remaining: config.maxRequests - 1, limit: config.maxRequests };
        }

        // Check if limit exceeded
        if (data.count >= config.maxRequests) {
            const retryAfter = Math.ceil((windowStart + config.windowMs - now) / 1000);
            return {
                allowed: false,
                remaining: 0,
                retryAfter,
                limit: config.maxRequests
            };
        }

        // Increment counter
        await docRef.update({
            count: admin.firestore.FieldValue.increment(1),
            lastRequest: now
        });

        return {
            allowed: true,
            remaining: config.maxRequests - data.count - 1,
            limit: config.maxRequests
        };
    } catch (error) {
        // On error, allow the request (fail open for availability)
        console.error('Rate limit check failed:', error);
        return { allowed: true, remaining: -1, limit: config.maxRequests };
    }
}

/**
 * Get client identifier from request
 * Uses X-Forwarded-For header or falls back to IP
 */
export function getClientIdentifier(req: any): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // Get first IP if multiple
        return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
    }
    return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Rate limit middleware response helper
 */
export function rateLimitResponse(res: any, result: RateLimitResult): void {
    res.status(429).json({
        error: 'Too many requests',
        retryAfter: result.retryAfter,
        limit: result.limit,
        message: `Rate limit exceeded. Please retry after ${result.retryAfter} seconds.`
    });
}

/**
 * Get the current rate limits configuration (for admin UI)
 */
export async function getCurrentRateLimits(): Promise<Record<string, RateLimitConfig>> {
    return getRateLimits();
}

/**
 * Get default rate limits (for initializing config)
 */
export function getDefaultRateLimits(): Record<string, RateLimitConfig> {
    return { ...DEFAULT_RATE_LIMITS };
}
