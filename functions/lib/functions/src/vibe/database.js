"use strict";
/**
 * Database Service - Firestore operations for vibe editor
 *
 * Stores edits, metrics, and error logs.
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
exports.saveEdit = saveEdit;
exports.getEditHistory = getEditHistory;
exports.updateEditStatus = updateEditStatus;
exports.getMetrics = getMetrics;
exports.updateMetrics = updateMetrics;
exports.logError = logError;
exports.getErrorLogs = getErrorLogs;
const admin = __importStar(require("firebase-admin"));
const getDb = () => admin.firestore();
async function saveEdit(projectId, userId, intent, originalPrompt, result) {
    const editRef = getDb().collection('projects').doc(projectId).collection('edits').doc();
    const editDoc = {
        editId: editRef.id,
        projectId,
        userId,
        timestamp: admin.firestore.Timestamp.now(),
        intent,
        originalPrompt,
        diff: result.diff,
        summary: result.summary,
        status: result.success ? 'pending' : 'failed',
        retryCount: result.retryCount,
        tokenCount: result.tokenCount,
        cost: result.cost,
        latency: result.latency,
        error: result.error,
    };
    await editRef.set(editDoc);
    return editRef.id;
}
async function getEditHistory(projectId, limit = 20) {
    const snapshot = await getDb()
        .collection('projects')
        .doc(projectId)
        .collection('edits')
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
    return snapshot.docs.map(doc => doc.data());
}
async function updateEditStatus(projectId, editId, status) {
    await getDb()
        .collection('projects')
        .doc(projectId)
        .collection('edits')
        .doc(editId)
        .update({ status });
}
async function getMetrics() {
    const doc = await getDb().collection('adminMetrics').doc('vibeEditor').get();
    if (!doc.exists) {
        const defaultMetrics = {
            totalEdits: 0,
            successfulEdits: 0,
            failedEdits: 0,
            totalCost: 0,
            avgLatency: 0,
            lastUpdated: admin.firestore.Timestamp.now(),
        };
        await getDb().collection('adminMetrics').doc('vibeEditor').set(defaultMetrics);
        return defaultMetrics;
    }
    return doc.data();
}
async function updateMetrics(result) {
    const metricsRef = getDb().collection('adminMetrics').doc('vibeEditor');
    await getDb().runTransaction(async (transaction) => {
        const doc = await transaction.get(metricsRef);
        const current = doc.exists ? doc.data() : {
            totalEdits: 0,
            successfulEdits: 0,
            failedEdits: 0,
            totalCost: 0,
            avgLatency: 0,
            lastUpdated: admin.firestore.Timestamp.now(),
        };
        const newTotal = current.totalEdits + 1;
        const newSuccessful = current.successfulEdits + (result.success ? 1 : 0);
        const newFailed = current.failedEdits + (result.success ? 0 : 1);
        const newCost = current.totalCost + (result.cost || 0);
        const newAvgLatency = (current.avgLatency * current.totalEdits + (result.latency || 0)) / newTotal;
        transaction.set(metricsRef, {
            totalEdits: newTotal,
            successfulEdits: newSuccessful,
            failedEdits: newFailed,
            totalCost: newCost,
            avgLatency: newAvgLatency,
            lastUpdated: admin.firestore.Timestamp.now(),
        });
    });
}
async function logError(projectId, userId, errorType, errorMessage, originalPrompt) {
    const errorRef = getDb().collection('adminMetrics').doc('vibeEditor').collection('errorLogs').doc();
    const errorDoc = {
        errorId: errorRef.id,
        timestamp: admin.firestore.Timestamp.now(),
        projectId,
        userId,
        errorType,
        errorMessage,
        originalPrompt,
        resolved: false,
    };
    await errorRef.set(errorDoc);
    return errorRef.id;
}
async function getErrorLogs(limit = 50) {
    const snapshot = await getDb()
        .collection('adminMetrics')
        .doc('vibeEditor')
        .collection('errorLogs')
        .where('resolved', '==', false)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();
    return snapshot.docs.map(doc => doc.data());
}
//# sourceMappingURL=database.js.map