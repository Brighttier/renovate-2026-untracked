import { AIConfig, AIUsageRecord } from '../types';
import { getFirebaseDb, doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where, orderBy, limit as firestoreLimit, Timestamp } from './firebase';
import { DEFAULT_AI_CONFIG } from '../constants';

const CONFIG_DOC = 'aiConfig';
const USAGE_COLLECTION = 'aiUsage';

// Get current AI configuration
export const getAIConfig = async (): Promise<AIConfig> => {
  const db = getFirebaseDb();
  if (!db) {
    // Return default config if Firebase not initialized
    return {
      ...DEFAULT_AI_CONFIG,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system'
    };
  }

  const docRef = doc(db, 'config', CONFIG_DOC);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    // Initialize with defaults
    const defaultConfig: AIConfig = {
      ...DEFAULT_AI_CONFIG,
      updatedAt: new Date().toISOString(),
      updatedBy: 'system'
    };
    await setDoc(docRef, defaultConfig);
    return defaultConfig;
  }

  return snapshot.data() as AIConfig;
};

// Update AI configuration
export const updateAIConfig = async (updates: Partial<AIConfig>, adminId: string): Promise<AIConfig> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, 'config', CONFIG_DOC);
  const current = await getAIConfig();

  const updated: AIConfig = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
    updatedBy: adminId
  };

  await setDoc(docRef, updated);
  return updated;
};

// Update specific config field
export const updateAIConfigField = async <K extends keyof AIConfig>(
  field: K,
  value: AIConfig[K],
  adminId: string
): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, 'config', CONFIG_DOC);
  await updateDoc(docRef, {
    [field]: value,
    updatedAt: new Date().toISOString(),
    updatedBy: adminId
  });
};

// Log AI usage
export const logAIUsage = async (params: {
  userId: string;
  model: string;
  operation: AIUsageRecord['operation'];
  tokensUsed: number;
  cost: number;
  success: boolean;
  errorMessage?: string;
}): Promise<AIUsageRecord> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const record: AIUsageRecord = {
    id: `usage-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    userId: params.userId,
    model: params.model,
    operation: params.operation,
    tokensUsed: params.tokensUsed,
    cost: params.cost,
    success: params.success,
    errorMessage: params.errorMessage,
    createdAt: new Date().toISOString()
  };

  const docRef = doc(db, USAGE_COLLECTION, record.id);
  await setDoc(docRef, record);

  return record;
};

// Get AI usage records
export const getAIUsageRecords = async (params?: {
  userId?: string;
  model?: string;
  operation?: AIUsageRecord['operation'];
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<AIUsageRecord[]> => {
  const db = getFirebaseDb();
  if (!db) return [];

  const constraints: any[] = [orderBy('createdAt', 'desc')];

  if (params?.userId) {
    constraints.push(where('userId', '==', params.userId));
  }

  if (params?.model) {
    constraints.push(where('model', '==', params.model));
  }

  if (params?.operation) {
    constraints.push(where('operation', '==', params.operation));
  }

  if (params?.limit) {
    constraints.push(firestoreLimit(params.limit));
  }

  const q = query(collection(db, USAGE_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  let records = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as AIUsageRecord[];

  // Client-side date filtering
  if (params?.startDate) {
    const start = new Date(params.startDate);
    records = records.filter(r => new Date(r.createdAt) >= start);
  }

  if (params?.endDate) {
    const end = new Date(params.endDate);
    records = records.filter(r => new Date(r.createdAt) <= end);
  }

  return records;
};

// Get total AI cost for a period
export const getAICostForPeriod = async (startDate: string, endDate: string): Promise<number> => {
  const records = await getAIUsageRecords({ startDate, endDate });
  return records.reduce((sum, r) => sum + r.cost, 0);
};

// Get AI cost by agency
export const getAICostByAgency = async (userId: string, startDate?: string, endDate?: string): Promise<number> => {
  const records = await getAIUsageRecords({ userId, startDate, endDate });
  return records.reduce((sum, r) => sum + r.cost, 0);
};

// Get AI usage stats
export const getAIUsageStats = async (startDate?: string, endDate?: string): Promise<{
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalCost: number;
  totalTokens: number;
  byModel: Record<string, { calls: number; cost: number; tokens: number }>;
  byOperation: Record<string, { calls: number; cost: number; tokens: number }>;
}> => {
  const records = await getAIUsageRecords({ startDate, endDate, limit: 10000 });

  const stats = {
    totalCalls: records.length,
    successfulCalls: records.filter(r => r.success).length,
    failedCalls: records.filter(r => !r.success).length,
    totalCost: 0,
    totalTokens: 0,
    byModel: {} as Record<string, { calls: number; cost: number; tokens: number }>,
    byOperation: {} as Record<string, { calls: number; cost: number; tokens: number }>
  };

  for (const record of records) {
    stats.totalCost += record.cost;
    stats.totalTokens += record.tokensUsed;

    // By model
    if (!stats.byModel[record.model]) {
      stats.byModel[record.model] = { calls: 0, cost: 0, tokens: 0 };
    }
    stats.byModel[record.model].calls++;
    stats.byModel[record.model].cost += record.cost;
    stats.byModel[record.model].tokens += record.tokensUsed;

    // By operation
    if (!stats.byOperation[record.operation]) {
      stats.byOperation[record.operation] = { calls: 0, cost: 0, tokens: 0 };
    }
    stats.byOperation[record.operation].calls++;
    stats.byOperation[record.operation].cost += record.cost;
    stats.byOperation[record.operation].tokens += record.tokensUsed;
  }

  return stats;
};

// Reset rate limit counter (for testing/admin)
export const resetRateLimits = async (adminId: string): Promise<void> => {
  // In production, this would reset rate limit counters in Redis or similar
  console.log(`Rate limits reset by admin: ${adminId}`);
};
