/**
 * Fetch with timeout utility
 * Prevents requests from hanging indefinitely
 */

export async function fetchWithTimeout(
    url: string,
    options: RequestInit = {},
    timeoutMs: number = 30000
): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        return response;
    } finally {
        clearTimeout(timeout);
    }
}

// Default timeouts for different operations
export const TIMEOUTS = {
    GEMINI_API: 30000,      // 30 seconds
    IMAGE_GENERATION: 60000, // 60 seconds
    WEB_SCRAPING: 45000,    // 45 seconds
    GODADDY_API: 15000,     // 15 seconds
    STRIPE_API: 30000,      // 30 seconds
    DEFAULT: 30000          // 30 seconds
};
