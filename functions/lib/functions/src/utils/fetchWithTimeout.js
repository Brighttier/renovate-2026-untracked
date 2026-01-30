"use strict";
/**
 * Fetch with timeout utility
 * Prevents requests from hanging indefinitely
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIMEOUTS = void 0;
exports.fetchWithTimeout = fetchWithTimeout;
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        return response;
    }
    finally {
        clearTimeout(timeout);
    }
}
// Default timeouts for different operations
exports.TIMEOUTS = {
    GEMINI_API: 30000, // 30 seconds
    IMAGE_GENERATION: 60000, // 60 seconds
    WEB_SCRAPING: 45000, // 45 seconds
    GODADDY_API: 15000, // 15 seconds
    STRIPE_API: 30000, // 30 seconds
    DEFAULT: 30000 // 30 seconds
};
//# sourceMappingURL=fetchWithTimeout.js.map