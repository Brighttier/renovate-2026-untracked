import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// CORS configuration - restricted to production domain
const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://renovatemysite-app.web.app',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
};

// Cost per model (in dollars)
const MODEL_COSTS: Record<string, number> = {
    'gemini-1.5-flash': 0.005,
    'gemini-2.0-flash': 0.005,
    'gemini-pro': 0.01,
    'gemini-2.5-flash-image': 0.02,
    'default': 0.005
};

/**
 * Log AI usage for analytics tracking
 */
export const logAIUsage = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }

    res.set(corsHeaders);

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { userId, model, operation, tokensUsed, success, errorMessage } = req.body;

        if (!model || !operation) {
            res.status(400).json({ error: 'model and operation are required' });
            return;
        }

        const cost = (MODEL_COSTS[model] || MODEL_COSTS['default']) * (tokensUsed || 1) / 1000;

        const usageRecord = {
            userId: userId || 'platform',
            model,
            operation,
            tokensUsed: tokensUsed || 0,
            cost,
            success: success !== false,
            errorMessage: errorMessage || null,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('aiUsage').add(usageRecord);

        res.json({ success: true, id: docRef.id, cost });
    } catch (error: any) {
        console.error('logAIUsage error:', error);
        res.status(500).json({ error: error.message || 'Failed to log AI usage' });
    }
});

/**
 * Get AI usage statistics for a time period
 */
export const getAIUsageStats = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }

    res.set(corsHeaders);

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { userId, limit: queryLimit } = req.body;

        let q = db.collection('aiUsage')
            .orderBy('createdAt', 'desc')
            .limit(queryLimit || 1000);

        if (userId) {
            q = q.where('userId', '==', userId);
        }

        const snapshot = await q.get();
        const records = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                model: data.model as string,
                operation: data.operation as string,
                tokensUsed: data.tokensUsed as number,
                cost: data.cost as number,
                success: data.success as boolean,
                createdAt: data.createdAt?.toDate?.()?.toISOString()
            };
        });

        // Calculate stats
        const totalCalls = records.length;
        const successfulCalls = records.filter(r => r.success).length;
        const totalCost = records.reduce((sum, r) => sum + (r.cost || 0), 0);
        const totalTokens = records.reduce((sum, r) => sum + (r.tokensUsed || 0), 0);

        // Breakdown by model
        const byModel: Record<string, { calls: number; cost: number; tokens: number }> = {};
        records.forEach(r => {
            const model = r.model || 'unknown';
            if (!byModel[model]) {
                byModel[model] = { calls: 0, cost: 0, tokens: 0 };
            }
            byModel[model].calls++;
            byModel[model].cost += r.cost || 0;
            byModel[model].tokens += r.tokensUsed || 0;
        });

        // Breakdown by operation
        const byOperation: Record<string, { calls: number; cost: number }> = {};
        records.forEach(r => {
            const op = r.operation || 'unknown';
            if (!byOperation[op]) {
                byOperation[op] = { calls: 0, cost: 0 };
            }
            byOperation[op].calls++;
            byOperation[op].cost += r.cost || 0;
        });

        res.json({
            totalCalls,
            successfulCalls,
            successRate: totalCalls > 0 ? (successfulCalls / totalCalls * 100).toFixed(1) : 100,
            totalCost: totalCost.toFixed(4),
            totalTokens,
            avgCostPerCall: totalCalls > 0 ? (totalCost / totalCalls).toFixed(4) : 0,
            byModel,
            byOperation,
            records: records.slice(0, 100) // Return latest 100 records
        });
    } catch (error: any) {
        console.error('getAIUsageStats error:', error);
        res.status(500).json({ error: error.message || 'Failed to get AI usage stats' });
    }
});

/**
 * System health check - checks all services
 */
export const checkSystemHealth = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }

    res.set(corsHeaders);

    const now = new Date().toISOString();
    const health: Record<string, { status: string; lastCheck: string; message?: string }> = {};

    // Check Firestore
    try {
        await db.collection('config').doc('healthCheck').set({ lastCheck: now }, { merge: true });
        health.firestore = { status: 'operational', lastCheck: now };
    } catch (error: any) {
        health.firestore = { status: 'degraded', lastCheck: now, message: error.message };
    }

    // Check API Gateway (self-check)
    health.apiGateway = { status: 'operational', lastCheck: now };

    // Check Gemini AI (by looking at recent usage)
    try {
        const recentAI = await db.collection('aiUsage')
            .orderBy('createdAt', 'desc')
            .limit(10)
            .get();

        const recentRecords = recentAI.docs.map(d => d.data());
        const recentFailures = recentRecords.filter(r => !r.success).length;

        if (recentFailures > 5) {
            health.geminiAI = { status: 'degraded', lastCheck: now, message: 'High failure rate' };
        } else {
            health.geminiAI = { status: 'operational', lastCheck: now };
        }
    } catch {
        health.geminiAI = { status: 'operational', lastCheck: now };
    }

    // Check Webhooks (by failure count)
    try {
        const webhooksWithFailures = await db.collection('webhooks')
            .where('failureCount', '>', 3)
            .get();

        if (webhooksWithFailures.size > 0) {
            health.webhookDelivery = {
                status: 'degraded',
                lastCheck: now,
                message: `${webhooksWithFailures.size} webhooks have high failure counts`
            };
        } else {
            health.webhookDelivery = { status: 'operational', lastCheck: now };
        }
    } catch {
        health.webhookDelivery = { status: 'operational', lastCheck: now };
    }

    // Firebase Hosting (assumed operational if functions work)
    health.firebaseHosting = { status: 'operational', lastCheck: now };

    // Determine overall status
    const statuses = Object.values(health).map(h => h.status);
    const overallStatus = statuses.includes('degraded') ? 'degraded' :
                          statuses.includes('outage') ? 'outage' : 'operational';

    // Store in Firestore for real-time access
    const healthDoc = {
        services: health,
        overallStatus,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('config').doc('systemHealth').set(healthDoc);

    res.json({ ...healthDoc, lastUpdated: now });
});

/**
 * Get list of admin users
 */
export const getAdmins = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }

    res.set(corsHeaders);

    try {
        const snapshot = await db.collection('admins')
            .orderBy('createdAt', 'desc')
            .get();

        const admins = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString(),
            lastLoginAt: doc.data().lastLoginAt?.toDate?.()?.toISOString()
        }));

        res.json({ admins });
    } catch (error: any) {
        console.error('getAdmins error:', error);
        res.status(500).json({ error: error.message || 'Failed to get admins' });
    }
});

/**
 * Invite a new admin
 */
export const inviteAdmin = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }

    res.set(corsHeaders);

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { email, displayName, role, invitedBy } = req.body;

        if (!email || !role) {
            res.status(400).json({ error: 'email and role are required' });
            return;
        }

        // Check if admin already exists
        const existing = await db.collection('admins').where('email', '==', email).get();
        if (!existing.empty) {
            res.status(400).json({ error: 'Admin with this email already exists' });
            return;
        }

        const adminId = `admin_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const newAdmin = {
            email,
            displayName: displayName || email.split('@')[0],
            role,
            isActive: true,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            invitedBy: invitedBy || 'system'
        };

        await db.collection('admins').doc(adminId).set(newAdmin);

        // Log audit event
        await db.collection('auditLogs').add({
            actorId: invitedBy || 'system',
            actorType: 'admin',
            action: 'create',
            resource: 'admin',
            resourceId: adminId,
            details: { email, role },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, adminId, admin: { id: adminId, ...newAdmin } });
    } catch (error: any) {
        console.error('inviteAdmin error:', error);
        res.status(500).json({ error: error.message || 'Failed to invite admin' });
    }
});

/**
 * Update admin role or status
 */
export const updateAdmin = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }

    res.set(corsHeaders);

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { adminId, updates, updatedBy } = req.body;

        if (!adminId) {
            res.status(400).json({ error: 'adminId is required' });
            return;
        }

        const adminRef = db.collection('admins').doc(adminId);
        const adminDoc = await adminRef.get();

        if (!adminDoc.exists) {
            res.status(404).json({ error: 'Admin not found' });
            return;
        }

        const allowedFields = ['displayName', 'role', 'isActive'];
        const safeUpdates: Record<string, any> = {};
        Object.keys(updates || {}).forEach(key => {
            if (allowedFields.includes(key)) {
                safeUpdates[key] = updates[key];
            }
        });

        await adminRef.update({
            ...safeUpdates,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Log audit event
        await db.collection('auditLogs').add({
            actorId: updatedBy || 'system',
            actorType: 'admin',
            action: 'update',
            resource: 'admin',
            resourceId: adminId,
            details: safeUpdates,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true });
    } catch (error: any) {
        console.error('updateAdmin error:', error);
        res.status(500).json({ error: error.message || 'Failed to update admin' });
    }
});

/**
 * Create admin session (on login)
 */
export const createAdminSession = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }

    res.set(corsHeaders);

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { adminId, adminEmail, userAgent, ipAddress } = req.body;

        if (!adminId || !adminEmail) {
            res.status(400).json({ error: 'adminId and adminEmail are required' });
            return;
        }

        // Detect device from user agent
        const device = userAgent?.includes('Mobile') ? 'Mobile' :
                       userAgent?.includes('Tablet') ? 'Tablet' : 'Desktop';

        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const session = {
            adminId,
            adminEmail,
            userAgent: userAgent || 'Unknown',
            ipAddress: ipAddress || 'Unknown',
            device,
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
            isActive: true
        };

        await db.collection('adminSessions').doc(sessionId).set(session);

        // Update admin's last login
        await db.collection('admins').doc(adminId).update({
            lastLoginAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Log audit event
        await db.collection('auditLogs').add({
            actorId: adminId,
            actorType: 'admin',
            actorEmail: adminEmail,
            action: 'login',
            resource: 'admin',
            resourceId: adminId,
            details: { device, ipAddress },
            ipAddress,
            userAgent,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, sessionId });
    } catch (error: any) {
        console.error('createAdminSession error:', error);
        res.status(500).json({ error: error.message || 'Failed to create session' });
    }
});

/**
 * Terminate admin session(s)
 */
export const terminateAdminSession = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }

    res.set(corsHeaders);

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { sessionId, adminId, terminateAll } = req.body;

        if (terminateAll && adminId) {
            // Terminate all sessions for an admin
            const sessions = await db.collection('adminSessions')
                .where('adminId', '==', adminId)
                .where('isActive', '==', true)
                .get();

            const batch = db.batch();
            sessions.docs.forEach(doc => {
                batch.update(doc.ref, {
                    isActive: false,
                    terminatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
            });
            await batch.commit();

            res.json({ success: true, terminatedCount: sessions.size });
        } else if (sessionId) {
            // Terminate specific session
            await db.collection('adminSessions').doc(sessionId).update({
                isActive: false,
                terminatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'sessionId or (adminId with terminateAll) is required' });
        }
    } catch (error: any) {
        console.error('terminateAdminSession error:', error);
        res.status(500).json({ error: error.message || 'Failed to terminate session' });
    }
});

/**
 * Get active admin sessions
 */
export const getAdminSessions = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }

    res.set(corsHeaders);

    try {
        const { adminId } = req.query;

        let q = db.collection('adminSessions')
            .where('isActive', '==', true)
            .orderBy('startedAt', 'desc');

        if (adminId) {
            q = q.where('adminId', '==', adminId);
        }

        const snapshot = await q.get();
        const sessions = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            startedAt: doc.data().startedAt?.toDate?.()?.toISOString(),
            lastActiveAt: doc.data().lastActiveAt?.toDate?.()?.toISOString()
        }));

        res.json({ sessions });
    } catch (error: any) {
        console.error('getAdminSessions error:', error);
        res.status(500).json({ error: error.message || 'Failed to get sessions' });
    }
});

/**
 * Update security policies
 */
export const updateSecurityPolicies = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }

    res.set(corsHeaders);

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { policies, updatedBy } = req.body;

        if (!policies) {
            res.status(400).json({ error: 'policies is required' });
            return;
        }

        await db.collection('config').doc('platformSettings').set({
            security: policies,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: updatedBy || 'system'
        }, { merge: true });

        // Log audit event
        await db.collection('auditLogs').add({
            actorId: updatedBy || 'system',
            actorType: 'admin',
            action: 'update',
            resource: 'settings',
            details: { securityPolicies: policies },
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true });
    } catch (error: any) {
        console.error('updateSecurityPolicies error:', error);
        res.status(500).json({ error: error.message || 'Failed to update security policies' });
    }
});

/**
 * Snapshot platform metrics (can be called manually or scheduled)
 */
export const snapshotPlatformMetrics = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }

    res.set(corsHeaders);

    try {
        // Get all users
        const usersSnapshot = await db.collection('users').get();
        const users = usersSnapshot.docs.map(doc => doc.data());

        // Calculate metrics
        const activeUsers = users.filter(u => u.status === 'active').length;
        const totalRevenue = users.reduce((sum, u) => sum + (u.stats?.totalRevenue || 0), 0);
        const totalMRR = users.reduce((sum, u) => sum + (u.stats?.monthlyRecurring || 0), 0);
        const totalAICalls = users.reduce((sum, u) => sum + (u.stats?.aiCallsThisMonth || 0), 0);

        // Get AI cost from aiUsage collection for this month
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const aiUsageSnapshot = await db.collection('aiUsage')
            .where('createdAt', '>=', startOfMonth)
            .get();

        const totalAICost = aiUsageSnapshot.docs.reduce((sum, doc) => sum + (doc.data().cost || 0), 0);

        const today = new Date().toISOString().split('T')[0];

        const metrics = {
            date: today,
            totalUsers: users.length,
            activeUsers,
            totalRevenue,
            totalMRR,
            totalAICalls,
            totalAICost,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Store with date as document ID for easy lookup
        await db.collection('platformMetrics').doc(today).set(metrics);

        res.json({ success: true, metrics: { ...metrics, createdAt: new Date().toISOString() } });
    } catch (error: any) {
        console.error('snapshotPlatformMetrics error:', error);
        res.status(500).json({ error: error.message || 'Failed to snapshot metrics' });
    }
});

/**
 * Get historical metrics for period comparison
 */
export const getMetricsHistory = functions.https.onRequest(async (req, res) => {
    if (req.method === 'OPTIONS') {
        res.set(corsHeaders).status(204).send('');
        return;
    }

    res.set(corsHeaders);

    try {
        const { days } = req.query;
        const daysToFetch = parseInt(days as string) || 30;

        const snapshot = await db.collection('platformMetrics')
            .orderBy('date', 'desc')
            .limit(daysToFetch)
            .get();

        interface MetricRecord {
            date: string;
            totalRevenue: number;
            totalMRR: number;
            activeUsers: number;
            totalAICost: number;
            totalAICalls: number;
            createdAt?: string;
        }

        const metrics: MetricRecord[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                date: data.date as string,
                totalRevenue: (data.totalRevenue as number) || 0,
                totalMRR: (data.totalMRR as number) || 0,
                activeUsers: (data.activeUsers as number) || 0,
                totalAICost: (data.totalAICost as number) || 0,
                totalAICalls: (data.totalAICalls as number) || 0,
                createdAt: data.createdAt?.toDate?.()?.toISOString()
            };
        });

        // Calculate changes if we have enough data
        let changes = null;
        if (metrics.length >= 2) {
            const current = metrics[0];
            const previous = metrics[metrics.length - 1];

            changes = {
                revenueChange: previous.totalRevenue > 0
                    ? ((current.totalRevenue - previous.totalRevenue) / previous.totalRevenue * 100).toFixed(1)
                    : '0',
                mrrChange: previous.totalMRR > 0
                    ? ((current.totalMRR - previous.totalMRR) / previous.totalMRR * 100).toFixed(1)
                    : '0',
                usersChange: previous.activeUsers > 0
                    ? ((current.activeUsers - previous.activeUsers) / previous.activeUsers * 100).toFixed(1)
                    : '0',
                aiCostChange: previous.totalAICost > 0
                    ? ((current.totalAICost - previous.totalAICost) / previous.totalAICost * 100).toFixed(1)
                    : '0'
            };
        }

        res.json({ metrics, changes });
    } catch (error: any) {
        console.error('getMetricsHistory error:', error);
        res.status(500).json({ error: error.message || 'Failed to get metrics history' });
    }
});
