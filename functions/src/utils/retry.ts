/**
 * Retry utility with exponential backoff
 * Handles transient failures gracefully
 */

export interface RetryOptions {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    retryableErrors?: (error: any) => boolean;
}

const defaultRetryableErrors = (error: any): boolean => {
    // Don't retry on client errors (4xx) except 429 (rate limit)
    if (error.status >= 400 && error.status < 500 && error.status !== 429) {
        return false;
    }
    // Retry on network errors, server errors, and rate limits
    return true;
};

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const {
        maxRetries = 3,
        baseDelayMs = 1000,
        maxDelayMs = 30000,
        retryableErrors = defaultRetryableErrors
    } = options;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
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

    throw lastError!;
}

// Pre-configured retry options for different scenarios
export const RETRY_CONFIGS = {
    GEMINI: { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000 },
    IMAGE_GENERATION: { maxRetries: 2, baseDelayMs: 2000, maxDelayMs: 15000 },
    STRIPE: { maxRetries: 3, baseDelayMs: 500, maxDelayMs: 5000 },
    DATABASE: { maxRetries: 3, baseDelayMs: 100, maxDelayMs: 2000 }
};
