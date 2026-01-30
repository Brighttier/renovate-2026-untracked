"use strict";
/**
 * Rate Limiter using Firestore
 * Protects against API abuse and ensures fair usage
 *
 * Now supports dynamic configuration from Firestore config/scalingConfig
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
exports.clearRateLimitsCache = clearRateLimitsCache;
exports.checkRateLimit = checkRateLimit;
exports.getClientIdentifier = getClientIdentifier;
exports.rateLimitResponse = rateLimitResponse;
exports.getCurrentRateLimits = getCurrentRateLimits;
exports.getDefaultRateLimits = getDefaultRateLimits;
const admin = __importStar(require("firebase-admin"));
// ============================================
// DYNAMIC CONFIGURATION FROM FIRESTORE
// ============================================
// Default rate limits (used if no Firestore config exists)
const DEFAULT_RATE_LIMITS = {
    'generateBlueprint': { maxRequests: 10, windowMs: 60000 }, // 10/min
    'editBlueprint': { maxRequests: 15, windowMs: 60000 }, // 15/min
    'scrapeWebsite': { maxRequests: 30, windowMs: 60000 }, // 30/min (increased for scale)
    'generateImage': { maxRequests: 20, windowMs: 60000 }, // 20/min
    'findBusinesses': { maxRequests: 30, windowMs: 60000 }, // 30/min
    'researchBusiness': { maxRequests: 10, windowMs: 60000 }, // 10/min
    'storeImage': { maxRequests: 50, windowMs: 60000 }, // 50/min
    'generateProposalEmail': { maxRequests: 20, windowMs: 60000 }, // 20/min
    'default': { maxRequests: 100, windowMs: 60000 } // 100/min fallback
};
// Cache for rate limit configuration (refreshed every minute)
let cachedRateLimits = null;
let rateLimitsCacheExpiry = 0;
const RATE_LIMITS_CACHE_TTL = 60000; // 1 minute cache
/**
 * Get rate limits from Firestore config with caching
 * Falls back to defaults if config doesn't exist
 */
async function getRateLimits() {
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
            if (data === null || data === void 0 ? void 0 : data.rateLimits) {
                // Merge with defaults to ensure all endpoints have limits
                cachedRateLimits = {
                    ...DEFAULT_RATE_LIMITS,
                    ...data.rateLimits
                };
            }
            else {
                cachedRateLimits = DEFAULT_RATE_LIMITS;
            }
        }
        else {
            cachedRateLimits = DEFAULT_RATE_LIMITS;
        }
    }
    catch (error) {
        console.error('Failed to fetch rate limit config:', error);
        cachedRateLimits = DEFAULT_RATE_LIMITS;
    }
    rateLimitsCacheExpiry = now + RATE_LIMITS_CACHE_TTL;
    return cachedRateLimits;
}
/**
 * Clear the rate limits cache (useful after config updates)
 */
function clearRateLimitsCache() {
    cachedRateLimits = null;
    rateLimitsCacheExpiry = 0;
}
/**
 * Check if a request should be rate limited
 * @param identifier - IP address or user ID
 * @param endpoint - The endpoint being called
 * @returns Rate limit result with allowed status and remaining requests
 */
async function checkRateLimit(identifier, endpoint) {
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
        const data = doc.data();
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
    }
    catch (error) {
        // On error, allow the request (fail open for availability)
        console.error('Rate limit check failed:', error);
        return { allowed: true, remaining: -1, limit: config.maxRequests };
    }
}
/**
 * Get client identifier from request
 * Uses X-Forwarded-For header or falls back to IP
 */
function getClientIdentifier(req) {
    var _a;
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        // Get first IP if multiple
        return (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim();
    }
    return req.ip || ((_a = req.connection) === null || _a === void 0 ? void 0 : _a.remoteAddress) || 'unknown';
}
/**
 * Rate limit middleware response helper
 */
function rateLimitResponse(res, result) {
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
async function getCurrentRateLimits() {
    return getRateLimits();
}
/**
 * Get default rate limits (for initializing config)
 */
function getDefaultRateLimits() {
    return { ...DEFAULT_RATE_LIMITS };
}
//# sourceMappingURL=rateLimiter.js.map