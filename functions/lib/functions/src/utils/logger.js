"use strict";
/**
 * Structured logging utility for Cloud Functions
 * Enables better observability and performance monitoring
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.log = log;
exports.logPerformance = logPerformance;
exports.logError = logError;
exports.createTracker = createTracker;
/**
 * Log a structured message
 */
function log(entry) {
    console.log(JSON.stringify({
        timestamp: new Date().toISOString(),
        ...entry
    }));
}
/**
 * Log function performance metrics
 */
function logPerformance(functionName, startTime, metadata) {
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
function logError(functionName, error, metadata) {
    var _a;
    log({
        severity: 'ERROR',
        message: error.message || 'Unknown error',
        functionName,
        errorName: error.name,
        errorStack: (_a = error.stack) === null || _a === void 0 ? void 0 : _a.substring(0, 500),
        ...metadata
    });
}
/**
 * Create a performance tracker for a function
 */
function createTracker(functionName) {
    const startTime = Date.now();
    return {
        success: (metadata) => {
            logPerformance(functionName, startTime, { success: true, ...metadata });
        },
        error: (error, metadata) => {
            logPerformance(functionName, startTime, { success: false, ...metadata });
            logError(functionName, error, metadata);
        }
    };
}
//# sourceMappingURL=logger.js.map