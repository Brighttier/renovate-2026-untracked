"use strict";
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
exports.getUserReferrals = exports.claimMilestoneReward = exports.processReferralSignup = exports.validateReferralCode = exports.getReferralStats = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
// CORS configuration
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
};
// Generate a unique 8-character referral code
function generateReferralCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
// Tokens awarded per successful referral
const TOKENS_PER_REFERRAL = 20;
/**
 * Get or create referral stats for a user
 * Returns the user's referral code and stats
 */
exports.getReferralStats = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e, _f;
    // Handle CORS preflight
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
        const { userId } = req.body;
        if (!userId) {
            res.status(400).json({ error: 'userId is required' });
            return;
        }
        const statsRef = db.collection('userReferralStats').doc(userId);
        const statsDoc = await statsRef.get();
        if (statsDoc.exists) {
            // Return existing stats
            const data = statsDoc.data();
            res.json({
                referralCode: data === null || data === void 0 ? void 0 : data.referralCode,
                totalReferrals: (data === null || data === void 0 ? void 0 : data.totalReferrals) || 0,
                pendingReferrals: (data === null || data === void 0 ? void 0 : data.pendingReferrals) || 0,
                tokensEarned: (data === null || data === void 0 ? void 0 : data.tokensEarned) || 0,
                milestonesUnlocked: (data === null || data === void 0 ? void 0 : data.milestonesUnlocked) || [],
                createdAt: ((_c = (_b = (_a = data === null || data === void 0 ? void 0 : data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.toISOString()) || new Date().toISOString(),
                updatedAt: ((_f = (_e = (_d = data === null || data === void 0 ? void 0 : data.updatedAt) === null || _d === void 0 ? void 0 : _d.toDate) === null || _e === void 0 ? void 0 : _e.call(_d)) === null || _f === void 0 ? void 0 : _f.toISOString()) || new Date().toISOString()
            });
        }
        else {
            // Create new referral stats with unique code
            let referralCode = generateReferralCode();
            // Ensure code is unique
            let attempts = 0;
            while (attempts < 10) {
                const existing = await db.collection('userReferralStats')
                    .where('referralCode', '==', referralCode)
                    .get();
                if (existing.empty)
                    break;
                referralCode = generateReferralCode();
                attempts++;
            }
            const now = admin.firestore.FieldValue.serverTimestamp();
            const newStats = {
                referralCode,
                totalReferrals: 0,
                pendingReferrals: 0,
                tokensEarned: 0,
                milestonesUnlocked: [],
                createdAt: now,
                updatedAt: now
            };
            await statsRef.set(newStats);
            res.json({
                referralCode,
                totalReferrals: 0,
                pendingReferrals: 0,
                tokensEarned: 0,
                milestonesUnlocked: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
        }
    }
    catch (error) {
        console.error('getReferralStats error:', error);
        res.status(500).json({ error: error.message || 'Failed to get referral stats' });
    }
});
/**
 * Validate a referral code and get the referrer's user ID
 */
exports.validateReferralCode = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight
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
        const { referralCode } = req.body;
        if (!referralCode) {
            res.status(400).json({ error: 'referralCode is required' });
            return;
        }
        // Find user with this referral code
        const statsQuery = await db.collection('userReferralStats')
            .where('referralCode', '==', referralCode.toUpperCase())
            .limit(1)
            .get();
        if (statsQuery.empty) {
            res.json({ valid: false, referrerUserId: null });
        }
        else {
            const referrerUserId = statsQuery.docs[0].id;
            res.json({ valid: true, referrerUserId });
        }
    }
    catch (error) {
        console.error('validateReferralCode error:', error);
        res.status(500).json({ error: error.message || 'Failed to validate referral code' });
    }
});
/**
 * Process a referral when a new user signs up with a referral code
 */
exports.processReferralSignup = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight
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
        const { referralCode, newUserId, newUserEmail } = req.body;
        if (!referralCode || !newUserId || !newUserEmail) {
            res.status(400).json({ error: 'referralCode, newUserId, and newUserEmail are required' });
            return;
        }
        // Find the referrer by their code
        const statsQuery = await db.collection('userReferralStats')
            .where('referralCode', '==', referralCode.toUpperCase())
            .limit(1)
            .get();
        if (statsQuery.empty) {
            res.status(404).json({ error: 'Invalid referral code' });
            return;
        }
        const referrerDoc = statsQuery.docs[0];
        const referrerUserId = referrerDoc.id;
        // Prevent self-referral
        if (referrerUserId === newUserId) {
            res.status(400).json({ error: 'Cannot refer yourself' });
            return;
        }
        // Check if this user was already referred
        const existingReferral = await db.collection('referrals')
            .where('referredUserId', '==', newUserId)
            .limit(1)
            .get();
        if (!existingReferral.empty) {
            res.status(400).json({ error: 'User was already referred' });
            return;
        }
        const now = admin.firestore.FieldValue.serverTimestamp();
        // Create the referral record
        const referralRef = db.collection('referrals').doc();
        await referralRef.set({
            referrerUserId,
            referredUserId: newUserId,
            referredEmail: newUserEmail,
            status: 'completed',
            tokensAwarded: TOKENS_PER_REFERRAL,
            createdAt: now,
            completedAt: now
        });
        // Update the referrer's stats
        const referrerStats = referrerDoc.data();
        const newTotalReferrals = ((referrerStats === null || referrerStats === void 0 ? void 0 : referrerStats.totalReferrals) || 0) + 1;
        const newTokensEarned = ((referrerStats === null || referrerStats === void 0 ? void 0 : referrerStats.tokensEarned) || 0) + TOKENS_PER_REFERRAL;
        await referrerDoc.ref.update({
            totalReferrals: newTotalReferrals,
            tokensEarned: newTokensEarned,
            updatedAt: now
        });
        res.json({
            success: true,
            referralId: referralRef.id,
            referrerUserId,
            tokensAwarded: TOKENS_PER_REFERRAL
        });
    }
    catch (error) {
        console.error('processReferralSignup error:', error);
        res.status(500).json({ error: error.message || 'Failed to process referral' });
    }
});
/**
 * Claim a milestone reward when user reaches the target
 */
exports.claimMilestoneReward = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight
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
        const { userId, milestoneTarget } = req.body;
        if (!userId || !milestoneTarget) {
            res.status(400).json({ error: 'userId and milestoneTarget are required' });
            return;
        }
        const statsRef = db.collection('userReferralStats').doc(userId);
        const statsDoc = await statsRef.get();
        if (!statsDoc.exists) {
            res.status(404).json({ error: 'User referral stats not found' });
            return;
        }
        const stats = statsDoc.data();
        const totalReferrals = (stats === null || stats === void 0 ? void 0 : stats.totalReferrals) || 0;
        const milestonesUnlocked = (stats === null || stats === void 0 ? void 0 : stats.milestonesUnlocked) || [];
        // Check if milestone target is reached
        if (totalReferrals < milestoneTarget) {
            res.status(400).json({ error: 'Milestone target not yet reached' });
            return;
        }
        // Check if already claimed
        if (milestonesUnlocked.includes(milestoneTarget)) {
            res.status(400).json({ error: 'Milestone already claimed' });
            return;
        }
        // Award the milestone
        const updatedMilestones = [...milestonesUnlocked, milestoneTarget];
        await statsRef.update({
            milestonesUnlocked: updatedMilestones,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // Determine reward based on milestone
        let reward = '';
        let bonusTokens = 0;
        if (milestoneTarget === 5) {
            reward = '1 Site Generation Credit';
        }
        else if (milestoneTarget === 10) {
            reward = 'Agency Partner Status + 100 Tokens';
            bonusTokens = 100;
        }
        // Award bonus tokens if applicable
        if (bonusTokens > 0) {
            await statsRef.update({
                tokensEarned: admin.firestore.FieldValue.increment(bonusTokens)
            });
        }
        res.json({
            success: true,
            milestoneTarget,
            reward,
            bonusTokens,
            milestonesUnlocked: updatedMilestones
        });
    }
    catch (error) {
        console.error('claimMilestoneReward error:', error);
        res.status(500).json({ error: error.message || 'Failed to claim milestone reward' });
    }
});
/**
 * Get list of referrals made by a user
 */
exports.getUserReferrals = functions.https.onRequest(async (req, res) => {
    // Handle CORS preflight
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
        const { userId, limit = 50 } = req.body;
        if (!userId) {
            res.status(400).json({ error: 'userId is required' });
            return;
        }
        const referralsQuery = await db.collection('referrals')
            .where('referrerUserId', '==', userId)
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        const referrals = referralsQuery.docs.map(doc => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                id: doc.id,
                ...doc.data(),
                createdAt: (_c = (_b = (_a = doc.data().createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.toISOString(),
                completedAt: (_f = (_e = (_d = doc.data().completedAt) === null || _d === void 0 ? void 0 : _d.toDate) === null || _e === void 0 ? void 0 : _e.call(_d)) === null || _f === void 0 ? void 0 : _f.toISOString()
            });
        });
        res.json({ referrals });
    }
    catch (error) {
        console.error('getUserReferrals error:', error);
        res.status(500).json({ error: error.message || 'Failed to get user referrals' });
    }
});
//# sourceMappingURL=index.js.map