/**
 * Structured logging utility for Cloud Functions
 * Enables better observability and performance monitoring
 */

type LogSeverity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

interface LogEntry {
    severity: LogSeverity;
    message: string;
    functionName?: string;
    durationMs?: number;
    [key: string]: any;
}

/**
 * Log a structured message
 */
export function log(entry: LogEntry): void {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        ...entry
    }));
}

/**
 * Log function performance metrics
 */
export function logPerformance(
    functionName: string,
    startTime: number,
    metadata?: Record<string, any>
): void {
    const durationMs = Date.now() - startTime;
    log({
        severity: 'INFO',
        message: 'Function execution completed',
        functionName,
        durationMs,
        ...metadata
    });
}

/**
 * Log an error with context
 */
export function logError(
    functionName: string,
    error: Error | any,
    metadata?: Record<string, any>
): void {
    log({
        severity: 'ERROR',
        message: error.message || 'Unknown error',
        functionName,
        errorName: error.name,
        errorStack: error.stack?.substring(0, 500),
        ...metadata
    });
}

/**
 * Create a performance tracker for a function
 */
export function createTracker(functionName: string) {
    const startTime = Date.now();

    return {
        success: (metadata?: Record<string, any>) => {
            logPerformance(functionName, startTime, { success: true, ...metadata });
        },
        error: (error: Error | any, metadata?: Record<string, any>) => {
            logPerformance(functionName, startTime, { success: false, ...metadata });
            logError(functionName, error, metadata);
        }
    };
}
