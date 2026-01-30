/**
 * Database Service - Firestore operations for vibe editor
 *
 * Stores edits, metrics, and error logs.
 */

import * as admin from 'firebase-admin';
import { EditResult, IntentClassification } from './types';

const getDb = () => admin.firestore();

// ============================================================================
// EDIT HISTORY
// ============================================================================

export interface EditDocument {
  editId: string;
  projectId: string;
  userId: string;
  timestamp: admin.firestore.Timestamp;
  intent: IntentClassification;
  originalPrompt: string;
  diff: string;
  summary: string;
  status: 'pending' | 'applied' | 'reverted' | 'failed';
  retryCount: number;
  tokenCount?: number;
  cost?: number;
  latency?: number;
  error?: string;
}

export async function saveEdit(
  projectId: string,
  userId: string,
  intent: IntentClassification,
  originalPrompt: string,
  result: EditResult
): Promise<string> {
  const editRef = getDb().collection('projects').doc(projectId).collection('edits').doc();

  const editDoc: EditDocument = {
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

export async function getEditHistory(projectId: string, limit: number = 20): Promise<EditDocument[]> {
  const snapshot = await getDb()
    .collection('projects')
    .doc(projectId)
    .collection('edits')
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => doc.data() as EditDocument);
}

export async function updateEditStatus(
  projectId: string,
  editId: string,
  status: 'applied' | 'reverted'
): Promise<void> {
  await getDb()
    .collection('projects')
    .doc(projectId)
    .collection('edits')
    .doc(editId)
    .update({ status });
}

// ============================================================================
// METRICS
// ============================================================================

export interface VibeMetrics {
  totalEdits: number;
  successfulEdits: number;
  failedEdits: number;
  totalCost: number;
  avgLatency: number;
  lastUpdated: admin.firestore.Timestamp;
}

export async function getMetrics(): Promise<VibeMetrics> {
  const doc = await getDb().collection('adminMetrics').doc('vibeEditor').get();

  if (!doc.exists) {
    const defaultMetrics: VibeMetrics = {
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

  return doc.data() as VibeMetrics;
}

export async function updateMetrics(result: EditResult): Promise<void> {
  const metricsRef = getDb().collection('adminMetrics').doc('vibeEditor');

  await getDb().runTransaction(async (transaction) => {
    const doc = await transaction.get(metricsRef);
    const current = doc.exists ? (doc.data() as VibeMetrics) : {
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

// ============================================================================
// ERROR LOGS
// ============================================================================

export interface ErrorLog {
  errorId: string;
  timestamp: admin.firestore.Timestamp;
  projectId: string;
  userId: string;
  errorType: string;
  errorMessage: string;
  originalPrompt: string;
  resolved: boolean;
}

export async function logError(
  projectId: string,
  userId: string,
  errorType: string,
  errorMessage: string,
  originalPrompt: string
): Promise<string> {
  const errorRef = getDb().collection('adminMetrics').doc('vibeEditor').collection('errorLogs').doc();

  const errorDoc: ErrorLog = {
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

export async function getErrorLogs(limit: number = 50): Promise<ErrorLog[]> {
  const snapshot = await getDb()
    .collection('adminMetrics')
    .doc('vibeEditor')
    .collection('errorLogs')
    .where('resolved', '==', false)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => doc.data() as ErrorLog);
}
