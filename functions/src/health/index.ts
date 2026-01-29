import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

// CORS configuration
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};

interface HealthCheckResult {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    version: string;
    uptime: number;
    checks: {
        firestore: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
        memory: { status: 'ok' | 'warning'; usedMB: number; limitMB: number };
    };
}

// Track process start time for uptime calculation
const startTime = Date.now();

/**
 * Health check endpoint for monitoring system status
 * Use this to verify all services are operational
 */
export const healthCheck = functions
    .runWith({
        timeoutSeconds: 30,
        memory: '128MB',
        maxInstances: 5
    })
    .https.onRequest(async (req, res) => {
        // Handle CORS preflight
        if (req.method === 'OPTIONS') {
            res.set(corsHeaders).status(204).send('');
            return;
        }

        res.set(corsHeaders);

        const result: HealthCheckResult = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: process.env.K_REVISION || '1.0.0',
            uptime: Math.floor((Date.now() - startTime) / 1000),
            checks: {
                firestore: { status: 'ok' },
                memory: { status: 'ok', usedMB: 0, limitMB: 128 }
            }
        };

        // Check Firestore connectivity
        const firestoreStart = Date.now();
        try {
            await db.collection('_health').doc('ping').set({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                instanceId: process.env.K_REVISION || 'local'
            });
            result.checks.firestore.latencyMs = Date.now() - firestoreStart;
        } catch (error: any) {
            result.checks.firestore.status = 'error';
            result.checks.firestore.error = error.message || 'Firestore connection failed';
            result.status = 'unhealthy';
        }

        // Check memory usage
        const memoryUsage = process.memoryUsage();
        const usedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
        const limitMB = 128; // Based on function config

        result.checks.memory.usedMB = usedMB;
        result.checks.memory.limitMB = limitMB;

        if (usedMB > limitMB * 0.9) {
            result.checks.memory.status = 'warning';
            if (result.status === 'healthy') {
                result.status = 'degraded';
            }
        }

        // Set appropriate status code
        const statusCode = result.status === 'healthy' ? 200 : result.status === 'degraded' ? 200 : 503;

        res.status(statusCode).json(result);
    });

/**
 * Simple liveness probe for load balancer health checks
 * Returns minimal response for fastest possible latency
 */
export const liveness = functions
    .runWith({
        timeoutSeconds: 10,
        memory: '128MB',
        maxInstances: 10
    })
    .https.onRequest(async (req, res) => {
        if (req.method === 'OPTIONS') {
            res.set(corsHeaders).status(204).send('');
            return;
        }

        res.set(corsHeaders);
        res.status(200).json({ status: 'ok', timestamp: Date.now() });
    });

/**
 * Readiness probe - checks if the service is ready to accept traffic
 * More thorough than liveness, includes dependency checks
 */
export const readiness = functions
    .runWith({
        timeoutSeconds: 15,
        memory: '128MB',
        maxInstances: 5
    })
    .https.onRequest(async (req, res) => {
        if (req.method === 'OPTIONS') {
            res.set(corsHeaders).status(204).send('');
            return;
        }

        res.set(corsHeaders);

        try {
            // Quick Firestore check
            await db.collection('_health').doc('ready').get();

            res.status(200).json({
                ready: true,
                timestamp: Date.now()
            });
        } catch (error: any) {
            res.status(503).json({
                ready: false,
                error: error.message || 'Service not ready',
                timestamp: Date.now()
            });
        }
    });
