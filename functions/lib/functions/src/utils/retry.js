"use strict";
/**
 * Retry utility with exponential backoff
 * Handles transient failures gracefully
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RETRY_CONFIGS = void 0;
exports.withRetry = withRetry;
const defaultRetryableErrors = (error) => {
    // Don't retry on client errors (4xx) except 429 (rate limit)
    if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        return false;
    }
    // Retry on network errors, server errors, and rate limits
    return true;
};
async function withRetry(fn, options = {}) {
    const { maxRetries = 3, baseDelayMs = 1000, maxDelayMs = 30000, retryableErrors = defaultRetryableErrors } = options;
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            // Check if error is retryable
            if (!retryableErrors(error)) {
                throw error;
            }
            // Don't wait after last attempt
            if (attempt < maxRetries) {
                // Exponential backoff with jitter
                const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
                const jitter = Math.random() * 0.3 * delay;
                const totalDelay = delay + jitter;
                console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${Math.round(totalDelay)}ms`);
                await new Promise(resolve => setTimeout(resolve, totalDelay));
            }
        }
    }
    throw lastError;
}
// Pre-configured retry options for different scenarios
exports.RETRY_CONFIGS = {
    GEMINI: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000 },
    IMAGE_GENERATION: { maxRetries: 2, baseDelayMs: 2000, maxDelayMs: 15000 },
    STRIPE: { maxRetries: 3, baseDelayMs: 500, maxDelayMs: 5000 },
    DATABASE: { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 2000 }
};
//# sourceMappingURL=retry.js.map