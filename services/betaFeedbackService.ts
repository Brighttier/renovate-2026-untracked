/**
 * Beta Feedback Service
 * Handles submission and management of beta tester feedback with screenshots
 */

import { getFirebaseDb, getFirebaseStorage, doc, setDoc, updateDoc, collection, query, orderBy, getDocs, where, Timestamp, ref, uploadString, getDownloadURL } from './firebase';
import { BetaFeedback, BetaFeedbackStatus, BetaFeedbackCategory } from '../types';

const COLLECTION = 'beta_feedback';

// Generate unique feedback ID
const generateFeedbackId = (): string => {
  return `fb-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Upload screenshot to Firebase Storage
 */
export const uploadScreenshot = async (
  dataUrl: string,
  feedbackId: string
): Promise<{ url: string; path: string }> => {
  const storage = getFirebaseStorage();
  if (!storage) throw new Error('Firebase Storage not initialized');

  const storagePath = `feedback/${feedbackId}/screenshot.png`;
  const storageRef = ref(storage, storagePath);

  await uploadString(storageRef, dataUrl, 'data_url', {
    contentType: 'image/png',
    customMetadata: {
      feedbackId,
      uploadedAt: new Date().toISOString()
    }
  });

  const downloadUrl = await getDownloadURL(storageRef);

  return {
    url: downloadUrl,
    path: storagePath
  };
};

/**
 * Submit new beta feedback
 */
export const submitFeedback = async (params: {
  userId?: string;
  userEmail?: string;
  title: string;
  description: string;
  category: BetaFeedbackCategory;
  screenshotDataUrl?: string;
}): Promise<BetaFeedback> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const feedbackId = generateFeedbackId();
  const now = new Date().toISOString();

  let screenshotUrl: string | undefined;
  let screenshotPath: string | undefined;

  // Upload screenshot if provided
  if (params.screenshotDataUrl) {
    const result = await uploadScreenshot(params.screenshotDataUrl, feedbackId);
    screenshotUrl = result.url;
    screenshotPath = result.path;
  }

  const feedback: BetaFeedback = {
    id: feedbackId,
    userId: params.userId,
    userEmail: params.userEmail,
    title: params.title,
    description: params.description,
    category: params.category,
    screenshotUrl,
    screenshotPath,
    pageUrl: typeof window !== 'undefined' ? window.location.pathname : '',
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    status: 'open',
    createdAt: now,
    updatedAt: now
  };

  await setDoc(doc(db, COLLECTION, feedbackId), feedback);

  console.log('[BetaFeedback] Submitted feedback:', feedbackId);
  return feedback;
};

/**
 * Get all feedback with optional filters
 */
export const getFeedback = async (filters?: {
  status?: BetaFeedbackStatus;
  category?: BetaFeedbackCategory;
}): Promise<BetaFeedback[]> => {
  const db = getFirebaseDb();
  if (!db) {
    console.error('[BetaFeedback] Firebase not initialized');
    return [];
  }

  try {
    const constraints: any[] = [orderBy('createdAt', 'desc')];

    if (filters?.status) {
      constraints.unshift(where('status', '==', filters.status));
    }

    if (filters?.category) {
      constraints.unshift(where('category', '==', filters.category));
    }

    const q = query(collection(db, COLLECTION), ...constraints);
    const snapshot = await getDocs(q);

    console.log('[BetaFeedback] Loaded', snapshot.docs.length, 'feedback entries');
    return snapshot.docs.map(doc => doc.data() as BetaFeedback);
  } catch (err) {
    console.error('[BetaFeedback] Failed to load feedback:', err);
    throw err;
  }
};

/**
 * Update feedback status
 */
export const updateFeedbackStatus = async (
  feedbackId: string,
  status: BetaFeedbackStatus,
  resolution?: string
): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const updates: Partial<BetaFeedback> = {
    status,
    updatedAt: new Date().toISOString()
  };

  if (resolution) {
    updates.resolution = resolution;
  }

  if (status === 'resolved') {
    updates.resolvedAt = new Date().toISOString();
  }

  await updateDoc(doc(db, COLLECTION, feedbackId), updates);
  console.log('[BetaFeedback] Updated status:', feedbackId, status);
};

/**
 * Get feedback statistics
 */
export const getFeedbackStats = async (): Promise<{
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  byCategory: Record<BetaFeedbackCategory, number>;
}> => {
  const feedback = await getFeedback();

  const stats = {
    total: feedback.length,
    open: feedback.filter(f => f.status === 'open').length,
    inProgress: feedback.filter(f => f.status === 'in_progress').length,
    resolved: feedback.filter(f => f.status === 'resolved').length,
    byCategory: {
      bug: feedback.filter(f => f.category === 'bug').length,
      feature: feedback.filter(f => f.category === 'feature').length,
      ux: feedback.filter(f => f.category === 'ux').length,
      other: feedback.filter(f => f.category === 'other').length
    }
  };

  return stats;
};
