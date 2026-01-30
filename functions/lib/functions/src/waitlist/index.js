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
exports.markWaitlistConverted = exports.updateWaitlistSettings = exports.getWaitlistEntries = exports.inviteFromWaitlist = exports.getWaitlistPosition = exports.getWaitlistStats = exports.joinWaitlist = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const db = admin.firestore();
// Default settings if not configured
const DEFAULT_TOTAL_SLOTS = 500;
// Counter document path for atomic position assignment
const WAITLIST_COUNTER_PATH = 'counters/waitlist';
/**
 * Get the next waitlist position using atomic counter
 * This replaces the O(n) collection scan with O(1) counter increment
 */
async function getNextPosition() {
    const counterRef = db.doc(WAITLIST_COUNTER_PATH);
    return db.runTransaction(async (transaction) => {
        const counterDoc = await transaction.get(counterRef);
        let currentPosition;
        if (!counterDoc.exists) {
            // Initialize counter - this should only happen once
            // First, check if there are existing waitlist entries to sync the counter
            const maxPositionQuery = await db.collection('waitlist')
                .orderBy('position', 'desc')
                .limit(1)
                .get();
            currentPosition = maxPositionQuery.empty ? 1 : (maxPositionQuery.docs[0].data().position + 1);
            transaction.set(counterRef, { nextPosition: currentPosition + 1, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        else {
            currentPosition = counterDoc.data().nextPosition;
            transaction.update(counterRef, {
                nextPosition: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        return currentPosition;
    });
}
// ==========================================
// JOIN WAITLIST
// ==========================================
exports.joinWaitlist = functions.https.onCall(async (data, context) => {
    const { email, source, referredBy } = data;
    // Validate email
    if (!email || typeof email !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Email is required');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid email format');
    }
    const normalizedEmail = email.toLowerCase().trim();
    // Check if waitlist is open
    const settingsDoc = await db.doc('config/waitlistSettings').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : { isOpen: true, totalSlots: DEFAULT_TOTAL_SLOTS };
    if ((settings === null || settings === void 0 ? void 0 : settings.isOpen) === false) {
        throw new functions.https.HttpsError('unavailable', 'Waitlist is currently closed');
    }
    // Check if email already exists
    const existingQuery = await db.collection('waitlist')
        .where('email', '==', normalizedEmail)
        .limit(1)
        .get();
    if (!existingQuery.empty) {
        const existing = existingQuery.docs[0].data();
        throw new functions.https.HttpsError('already-exists', 'Email already on waitlist', {
            position: existing.position,
            status: existing.status
        });
    }
    // Get the next position using atomic counter (O(1) instead of O(n))
    const nextPosition = await getNextPosition();
    // Create waitlist entry
    const entry = {
        email: normalizedEmail,
        position: nextPosition,
        status: 'waiting',
        source: source || 'landing_page',
        referredBy: referredBy || null,
        inviteCode: null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        invitedAt: null,
        convertedAt: null
    };
    const docRef = await db.collection('waitlist').add(entry);
    // Get current stats
    const totalEntries = nextPosition;
    const totalSlots = (settings === null || settings === void 0 ? void 0 : settings.totalSlots) || DEFAULT_TOTAL_SLOTS;
    const spotsRemaining = Math.max(0, totalSlots - totalEntries);
    return {
        success: true,
        id: docRef.id,
        position: nextPosition,
        stats: {
            totalEntries,
            spotsRemaining,
            totalSlots
        }
    };
});
// ==========================================
// GET WAITLIST STATS
// ==========================================
exports.getWaitlistStats = functions.https.onCall(async () => {
    // Get settings
    const settingsDoc = await db.doc('config/waitlistSettings').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : { totalSlots: DEFAULT_TOTAL_SLOTS };
    const totalSlots = (settings === null || settings === void 0 ? void 0 : settings.totalSlots) || DEFAULT_TOTAL_SLOTS;
    // Count entries by status
    const waitlistSnapshot = await db.collection('waitlist').get();
    let totalEntries = 0;
    let invitedCount = 0;
    let convertedCount = 0;
    waitlistSnapshot.docs.forEach(doc => {
        const data = doc.data();
        totalEntries++;
        if (data.status === 'invited')
            invitedCount++;
        if (data.status === 'converted')
            convertedCount++;
    });
    const spotsRemaining = Math.max(0, totalSlots - totalEntries);
    return {
        totalEntries,
        spotsRemaining,
        totalSlots,
        invitedCount,
        convertedCount,
        isOpen: (settings === null || settings === void 0 ? void 0 : settings.isOpen) !== false
    };
});
// ==========================================
// GET WAITLIST POSITION
// ==========================================
exports.getWaitlistPosition = functions.https.onCall(async (data) => {
    const { email } = data;
    if (!email || typeof email !== 'string') {
        throw new functions.https.HttpsError('invalid-argument', 'Email is required');
    }
    const normalizedEmail = email.toLowerCase().trim();
    const query = await db.collection('waitlist')
        .where('email', '==', normalizedEmail)
        .limit(1)
        .get();
    if (query.empty) {
        return {
            found: false,
            position: null,
            status: null
        };
    }
    const doc = query.docs[0];
    const data_result = doc.data();
    return {
        found: true,
        id: doc.id,
        position: data_result.position,
        status: data_result.status,
        inviteCode: data_result.inviteCode || null
    };
});
// ==========================================
// INVITE FROM WAITLIST (Admin only)
// ==========================================
exports.inviteFromWaitlist = functions.https.onCall(async (data, context) => {
    // Check if user is admin (you may want to add proper auth check)
    const { entryId } = data;
    if (!entryId) {
        throw new functions.https.HttpsError('invalid-argument', 'Entry ID is required');
    }
    const entryRef = db.collection('waitlist').doc(entryId);
    const entryDoc = await entryRef.get();
    if (!entryDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Waitlist entry not found');
    }
    const entryData = entryDoc.data();
    if ((entryData === null || entryData === void 0 ? void 0 : entryData.status) !== 'waiting') {
        throw new functions.https.HttpsError('failed-precondition', 'Entry has already been invited or converted');
    }
    // Generate unique invite code
    const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    // Update entry
    await entryRef.update({
        status: 'invited',
        inviteCode,
        invitedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return {
        success: true,
        inviteCode,
        email: entryData.email
    };
});
// ==========================================
// GET WAITLIST ENTRIES (Admin only)
// ==========================================
exports.getWaitlistEntries = functions.https.onCall(async (data) => {
    const { status, limit: queryLimit = 50, offset = 0, search } = data || {};
    let query = db.collection('waitlist')
        .orderBy('position', 'asc');
    if (status) {
        query = query.where('status', '==', status);
    }
    const snapshot = await query.limit(queryLimit + offset).get();
    let entries = snapshot.docs.slice(offset).map(doc => {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const data = doc.data();
        return {
            id: doc.id,
            email: data.email,
            position: data.position,
            status: data.status,
            source: data.source,
            referredBy: data.referredBy,
            inviteCode: data.inviteCode,
            createdAt: ((_c = (_b = (_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) === null || _c === void 0 ? void 0 : _c.toISOString()) || null,
            invitedAt: ((_f = (_e = (_d = data.invitedAt) === null || _d === void 0 ? void 0 : _d.toDate) === null || _e === void 0 ? void 0 : _e.call(_d)) === null || _f === void 0 ? void 0 : _f.toISOString()) || null,
            convertedAt: ((_j = (_h = (_g = data.convertedAt) === null || _g === void 0 ? void 0 : _g.toDate) === null || _h === void 0 ? void 0 : _h.call(_g)) === null || _j === void 0 ? void 0 : _j.toISOString()) || null
        };
    });
    // Filter by search if provided
    if (search) {
        const searchLower = search.toLowerCase();
        entries = entries.filter(e => { var _a; return (_a = e.email) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(searchLower); });
    }
    // Get total count
    const totalSnapshot = await db.collection('waitlist').count().get();
    const total = totalSnapshot.data().count;
    return {
        entries,
        total,
        hasMore: offset + entries.length < total
    };
});
// ==========================================
// UPDATE WAITLIST SETTINGS (Admin only)
// ==========================================
exports.updateWaitlistSettings = functions.https.onCall(async (data) => {
    const { totalSlots, isOpen, autoInviteEnabled } = data;
    const updates = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (typeof totalSlots === 'number' && totalSlots > 0) {
        updates.totalSlots = totalSlots;
    }
    if (typeof isOpen === 'boolean') {
        updates.isOpen = isOpen;
    }
    if (typeof autoInviteEnabled === 'boolean') {
        updates.autoInviteEnabled = autoInviteEnabled;
    }
    await db.doc('config/waitlistSettings').set(updates, { merge: true });
    return { success: true };
});
// ==========================================
// MARK WAITLIST ENTRY AS CONVERTED (Called when user signs up)
// ==========================================
exports.markWaitlistConverted = functions.https.onCall(async (data) => {
    const { email, inviteCode } = data;
    if (!email) {
        throw new functions.https.HttpsError('invalid-argument', 'Email is required');
    }
    const normalizedEmail = email.toLowerCase().trim();
    // Find entry by email or invite code
    let query = db.collection('waitlist')
        .where('email', '==', normalizedEmail)
        .limit(1);
    let snapshot = await query.get();
    // If not found by email, try invite code
    if (snapshot.empty && inviteCode) {
        query = db.collection('waitlist')
            .where('inviteCode', '==', inviteCode.toUpperCase())
            .limit(1);
        snapshot = await query.get();
    }
    if (snapshot.empty) {
        return { success: false, message: 'Entry not found' };
    }
    const doc = snapshot.docs[0];
    const entryData = doc.data();
    if (entryData.status === 'converted') {
        return { success: true, message: 'Already converted' };
    }
    await doc.ref.update({
        status: 'converted',
        convertedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
});
//# sourceMappingURL=index.js.map