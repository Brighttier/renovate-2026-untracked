"use strict";
/**
 * addCustomDomain Cloud Function
 *
 * Registers a custom domain with Firebase Hosting and creates a tracking record.
 * This is the first step in the domain connection flow.
 *
 * Flow:
 * 1. Validate domain format
 * 2. Check user's plan limit for custom domains
 * 3. Generate verification token
 * 4. Create Firebase Hosting custom domain (optional - can be done later)
 * 5. Store connection record in Firestore
 * 6. Return DNS requirements
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
exports.addCustomDomain = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const types_1 = require("./types");
const db = admin.firestore();
// ============================================================================
// Utility Functions
// ============================================================================
/**
 * Validates and sanitizes a domain name
 */
function validateDomain(input) {
    if (!input || input.trim() === '') {
        return { valid: false, sanitized: '', message: 'Domain name is required' };
    }
    // Clean the domain
    const sanitized = input
        .toLowerCase()
        .replace(/^(https?:\/\/)?(www\.)?/, '') // Remove protocol and www
        .replace(/\/.*$/, '') // Remove path
        .replace(/:\d+$/, '') // Remove port
        .trim();
    // Validate format
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]?\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(sanitized)) {
        return {
            valid: false,
            sanitized,
            message: 'Please enter a valid domain name (e.g., example.com)'
        };
    }
    // Check for reserved/invalid domains
    const invalidDomains = ['localhost', 'example.com', 'test.com'];
    if (invalidDomains.includes(sanitized)) {
        return {
            valid: false,
            sanitized,
            message: 'This domain cannot be used'
        };
    }
    return { valid: true, sanitized };
}
/**
 * Generates a secure verification token
 */
function generateVerificationToken() {
    return crypto.randomBytes(16).toString('hex');
}
/**
 * Gets the user's current plan and domain limit
 */
async function getUserPlanLimit(userId) {
    var _a;
    try {
        // Check for active subscription
        const subscriptionsSnapshot = await db
            .collection('subscriptions')
            .where('userId', '==', userId)
            .where('status', '==', 'active')
            .limit(1)
            .get();
        if (subscriptionsSnapshot.empty) {
            return types_1.PLAN_DOMAIN_LIMITS.free;
        }
        const subscription = subscriptionsSnapshot.docs[0].data();
        const planId = ((_a = subscription.planId) === null || _a === void 0 ? void 0 : _a.toLowerCase()) || 'free';
        if (planId.includes('enterprise'))
            return types_1.PLAN_DOMAIN_LIMITS.enterprise;
        if (planId.includes('growth'))
            return types_1.PLAN_DOMAIN_LIMITS.growth;
        if (planId.includes('starter'))
            return types_1.PLAN_DOMAIN_LIMITS.starter;
        return types_1.PLAN_DOMAIN_LIMITS.free;
    }
    catch (error) {
        console.error('Error getting user plan:', error);
        return types_1.PLAN_DOMAIN_LIMITS.free;
    }
}
/**
 * Gets the user's current domain count
 */
async function getUserDomainCount(userId) {
    try {
        const domainsSnapshot = await db
            .collection('domain_connections')
            .where('userId', '==', userId)
            .where('status', 'not-in', ['disconnected', 'error'])
            .get();
        return domainsSnapshot.size;
    }
    catch (error) {
        console.error('Error getting domain count:', error);
        return 0;
    }
}
/**
 * Checks if domain is already connected
 */
async function isDomainAlreadyConnected(domain) {
    try {
        const existingDomain = await db
            .collection('domain_connections')
            .where('domain', '==', domain)
            .where('status', 'not-in', ['disconnected', 'error'])
            .limit(1)
            .get();
        if (!existingDomain.empty) {
            return existingDomain.docs[0].id;
        }
        return null;
    }
    catch (error) {
        console.error('Error checking existing domain:', error);
        return null;
    }
}
// ============================================================================
// Main Cloud Function
// ============================================================================
exports.addCustomDomain = functions
    .runWith({
    timeoutSeconds: 60,
    memory: '256MB'
})
    .https.onCall(async (data, context) => {
    // 1. Verify authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'You must be logged in to connect a domain');
    }
    const userId = context.auth.uid;
    const userEmail = context.auth.token.email || '';
    // 2. Validate request data
    const { domain, leadId, agencyId, connectionMethod, siteId } = data;
    if (!domain) {
        throw new functions.https.HttpsError('invalid-argument', 'Domain is required');
    }
    if (!leadId || !agencyId) {
        throw new functions.https.HttpsError('invalid-argument', 'Lead ID and Agency ID are required');
    }
    // 3. Validate and sanitize domain
    const validation = validateDomain(domain);
    if (!validation.valid) {
        throw new functions.https.HttpsError('invalid-argument', validation.message || 'Invalid domain format');
    }
    const cleanDomain = validation.sanitized;
    // 4. Check if domain is already connected
    const existingConnectionId = await isDomainAlreadyConnected(cleanDomain);
    if (existingConnectionId) {
        throw new functions.https.HttpsError('already-exists', `Domain ${cleanDomain} is already connected. Connection ID: ${existingConnectionId}`);
    }
    // 5. Check user's plan limit
    const planLimit = await getUserPlanLimit(userId);
    const currentCount = await getUserDomainCount(userId);
    if (currentCount >= planLimit) {
        throw new functions.https.HttpsError('resource-exhausted', `You have reached your plan limit of ${planLimit} custom domain(s). Please upgrade to add more domains.`);
    }
    // 6. Generate verification token
    const token = generateVerificationToken();
    const verificationTxtRecord = `firebase-site-verification=${token}`;
    // 7. Build required DNS records
    const requiredRecords = [
        {
            type: 'TXT',
            name: '@',
            data: verificationTxtRecord,
            ttl: 600
        },
        ...types_1.FIREBASE_HOSTING_IPS.map(ip => ({
            type: 'A',
            name: '@',
            data: ip,
            ttl: 600
        })),
        {
            type: 'CNAME',
            name: 'www',
            data: '@',
            ttl: 600
        }
    ];
    // 8. Create domain connection record in Firestore
    const now = new Date().toISOString();
    const domainConnection = {
        domain: cleanDomain,
        agencyId,
        leadId,
        userId,
        firebaseSiteId: siteId || 'renovatemysite-app',
        connectionMethod: connectionMethod || 'Manual',
        status: 'pending_verification',
        verificationToken: token,
        verificationTxtRecord,
        sslStatus: 'pending',
        createdAt: now,
        updatedAt: now,
        checkCount: 0,
        errorCount: 0
    };
    try {
        const docRef = await db.collection('domain_connections').add(domainConnection);
        // 9. Update the lead's hosting config
        await db
            .collection('agencies')
            .doc(agencyId)
            .collection('leads')
            .doc(leadId)
            .update({
            'hosting.customDomain': cleanDomain,
            'hosting.status': 'Verifying',
            'hosting.domainConnectionId': docRef.id,
            'hosting.connectionMethod': connectionMethod || 'Manual',
            'hosting.verificationStatus': 'pending'
        });
        // 10. Create audit log
        await db.collection('auditLogs').add({
            actorId: userId,
            actorType: 'user',
            actorEmail: userEmail,
            action: 'create',
            resource: 'domain_connection',
            resourceId: docRef.id,
            details: {
                domain: cleanDomain,
                connectionMethod: connectionMethod || 'Manual',
                leadId,
                agencyId
            },
            createdAt: now
        });
        console.log(`Domain connection created: ${docRef.id} for ${cleanDomain}`);
        return {
            success: true,
            domainConnectionId: docRef.id,
            verificationToken: token,
            verificationTxtRecord,
            requiredRecords,
            status: 'pending_verification',
            message: `Domain ${cleanDomain} registered. Please configure your DNS records.`
        };
    }
    catch (error) {
        console.error('Error creating domain connection:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to register domain. Please try again.');
    }
});
//# sourceMappingURL=addCustomDomain.js.map