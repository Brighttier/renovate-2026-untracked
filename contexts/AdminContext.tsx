import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  AdminUser,
  AdminTab,
  User as PlatformUser,
  AccountStatus,
  AIConfig,
  AIUsageRecord,
  APIKey,
  WebhookEndpoint,
  AuditLog,
  AuditLogFilter,
  PlatformSettings,
  AdminSession
} from '../types';
import { DEFAULT_AI_CONFIG } from '../constants';
import {
  onAdminAuthStateChanged,
  User as FirebaseUser,
  getFirebaseDb,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot
} from '../services/firebase';

// System Health type
interface SystemHealth {
  services: Record<string, { status: string; lastCheck: string; message?: string }>;
  overallStatus: string;
  lastUpdated: string;
}

// Metrics changes type
interface MetricsChanges {
  revenueChange: string;
  mrrChange: string;
  usersChange: string;
  aiCostChange: string;
}

interface AdminContextType {
  // Auth state
  currentAdmin: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Navigation
  activeTab: AdminTab;
  setActiveTab: (tab: AdminTab) => void;

  // Users (Platform Users)
  users: PlatformUser[];
  usersLoading: boolean;
  refreshUsers: () => Promise<void>;
  updateUserStatus: (userId: string, status: AccountStatus) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;

  // AI Config
  aiConfig: AIConfig;
  aiConfigLoading: boolean;
  updateAIConfig: (config: Partial<AIConfig>) => Promise<void>;
  aiUsageRecords: AIUsageRecord[];
  aiUsageStats: {
    totalCalls: number;
    successRate: number;
    totalCost: number;
    byModel: Record<string, { calls: number; cost: number }>;
    byOperation: Record<string, { calls: number; cost: number }>;
  };

  // API Keys
  apiKeys: APIKey[];
  apiKeysLoading: boolean;
  createAPIKey: (userId: string, name: string, scopes: string[]) => Promise<{ key: string }>;
  revokeAPIKey: (keyId: string) => Promise<void>;

  // Webhooks
  webhooks: WebhookEndpoint[];
  webhooksLoading: boolean;
  createWebhook: (userId: string, url: string, events: string[]) => Promise<void>;
  deleteWebhook: (webhookId: string) => Promise<void>;

  // Audit Logs
  auditLogs: AuditLog[];
  auditLogsLoading: boolean;
  auditLogFilter: AuditLogFilter;
  setAuditLogFilter: (filter: AuditLogFilter) => void;
  refreshAuditLogs: () => Promise<void>;
  exportAuditLogs: () => Promise<string>;

  // Platform Stats
  platformStats: {
    totalUsers: number;
    activeUsers: number;
    totalRevenue: number;
    totalMRR: number;
    totalAICalls: number;
    totalAICost: number;
  };
  metricsChanges: MetricsChanges | null;

  // System Health
  systemHealth: SystemHealth | null;
  refreshSystemHealth: () => Promise<void>;

  // Admin Management
  admins: AdminUser[];
  adminsLoading: boolean;
  inviteAdmin: (email: string, displayName: string, role: string) => Promise<void>;
  updateAdminRole: (adminId: string, updates: { role?: string; isActive?: boolean }) => Promise<void>;

  // Session Management
  activeSessions: AdminSession[];
  sessionsLoading: boolean;
  terminateSession: (sessionId: string) => Promise<void>;
  terminateAllSessions: (adminId: string) => Promise<void>;

  // Security Policies
  securityPolicies: {
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      expirationDays: number;
    };
    oauthProviders: {
      google: boolean;
      github: boolean;
      microsoft: boolean;
    };
  } | null;
  updateSecurityPolicies: (policies: any) => Promise<void>;

  // Platform Settings (GoDaddy, etc.)
  platformSettings: PlatformSettings | null;
  platformSettingsLoading: boolean;
  updateGoDaddyCredentials: (apiKey: string, apiSecret: string, testFirst?: boolean) => Promise<{ success: boolean; lastFourKey?: string; message?: string }>;
  testGoDaddyCredentials: () => Promise<{ success: boolean; message: string }>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const AdminProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Auth state
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Navigation
  const [activeTab, setActiveTab] = useState<AdminTab>(AdminTab.DASHBOARD);

  // Data state - initialized empty, populated from Firestore
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const [aiConfig, setAIConfig] = useState<AIConfig>({
    ...DEFAULT_AI_CONFIG,
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  });
  const [aiConfigLoading, setAIConfigLoading] = useState(false);
  const [aiUsageRecords, setAIUsageRecords] = useState<AIUsageRecord[]>([]);

  const [apiKeys, setAPIKeys] = useState<APIKey[]>([]);
  const [apiKeysLoading, setAPIKeysLoading] = useState(false);

  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const [auditLogFilter, setAuditLogFilter] = useState<AuditLogFilter>({ limit: 50 });

  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [platformSettingsLoading, setPlatformSettingsLoading] = useState(false);

  // New state for real backend data
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [activeSessions, setActiveSessions] = useState<AdminSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [metricsChanges, setMetricsChanges] = useState<MetricsChanges | null>(null);
  const [securityPolicies, setSecurityPolicies] = useState<{
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
      expirationDays: number;
    };
    oauthProviders: {
      google: boolean;
      github: boolean;
      microsoft: boolean;
    };
  } | null>(null);

  // Calculate platform stats
  const platformStats = React.useMemo(() => {
    const activeUsers = users.filter(u => u.status === AccountStatus.ACTIVE);
    return {
      totalUsers: users.length,
      activeUsers: activeUsers.length,
      totalRevenue: users.reduce((sum, u) => sum + (u.stats?.totalRevenue || 0), 0),
      totalMRR: users.reduce((sum, u) => sum + (u.stats?.monthlyRecurring || 0), 0),
      totalAICalls: aiUsageRecords.length > 0 ? aiUsageRecords.length : users.reduce((sum, u) => sum + (u.stats?.aiCallsThisMonth || 0), 0),
      totalAICost: aiUsageRecords.length > 0
        ? aiUsageRecords.reduce((sum, r) => sum + (r.cost || 0), 0)
        : users.reduce((sum, u) => sum + ((u.stats?.aiCallsThisMonth || 0) * 0.01), 0)
    };
  }, [users, aiUsageRecords]);

  // Calculate AI usage stats from records
  const aiUsageStats = React.useMemo(() => {
    const totalCalls = aiUsageRecords.length;
    const successfulCalls = aiUsageRecords.filter(r => r.success).length;
    const totalCost = aiUsageRecords.reduce((sum, r) => sum + (r.cost || 0), 0);

    const byModel: Record<string, { calls: number; cost: number }> = {};
    const byOperation: Record<string, { calls: number; cost: number }> = {};

    aiUsageRecords.forEach(r => {
      const model = r.model || 'unknown';
      if (!byModel[model]) byModel[model] = { calls: 0, cost: 0 };
      byModel[model].calls++;
      byModel[model].cost += r.cost || 0;

      const op = r.operation || 'unknown';
      if (!byOperation[op]) byOperation[op] = { calls: 0, cost: 0 };
      byOperation[op].calls++;
      byOperation[op].cost += r.cost || 0;
    });

    return {
      totalCalls,
      successRate: totalCalls > 0 ? (successfulCalls / totalCalls * 100) : 100,
      totalCost,
      byModel,
      byOperation
    };
  }, [aiUsageRecords]);

  // Auth listener - fetch admin profile from Firestore
  useEffect(() => {
    const unsubscribe = onAdminAuthStateChanged(async (user: FirebaseUser | null) => {
      if (user) {
        const db = getFirebaseDb();
        if (db) {
          try {
            const adminDoc = await getDoc(doc(db, 'admins', user.uid));
            if (adminDoc.exists()) {
              setCurrentAdmin({
                id: user.uid,
                ...adminDoc.data()
              } as AdminUser);
            } else {
              // User is authenticated but not an admin - create basic profile
              setCurrentAdmin({
                id: user.uid,
                email: user.email || '',
                displayName: user.displayName || 'Admin',
                role: 'admin' as any,
                createdAt: new Date().toISOString(),
                isActive: true
              });
            }
          } catch (error) {
            console.error('Error fetching admin profile:', error);
            setCurrentAdmin({
              id: user.uid,
              email: user.email || '',
              displayName: user.displayName || 'Admin',
              role: 'admin' as any,
              createdAt: new Date().toISOString(),
              isActive: true
            });
          }
        } else {
          // Firebase not initialized - use basic auth info
          setCurrentAdmin({
            id: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'Admin',
            role: 'admin' as any,
            createdAt: new Date().toISOString(),
            isActive: true
          });
        }
      } else {
        setCurrentAdmin(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for users
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;

    setUsersLoading(true);
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlatformUser[];
      setUsers(usersData);
      setUsersLoading(false);
    }, (error) => {
      console.error('Error listening to users:', error);
      setUsersLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for API keys
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;

    const q = query(collection(db, 'apiKeys'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const keysData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as APIKey[];
      setAPIKeys(keysData);
    }, (error) => {
      console.error('Error listening to API keys:', error);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for webhooks
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;

    const q = query(collection(db, 'webhooks'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const webhooksData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WebhookEndpoint[];
      setWebhooks(webhooksData);
    }, (error) => {
      console.error('Error listening to webhooks:', error);
    });

    return () => unsubscribe();
  }, []);

  // Load AI config
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;

    const unsubscribe = onSnapshot(doc(db, 'config', 'aiConfig'), (snapshot) => {
      if (snapshot.exists()) {
        setAIConfig(snapshot.data() as AIConfig);
      }
    }, (error) => {
      console.error('Error listening to AI config:', error);
    });

    return () => unsubscribe();
  }, []);

  // Load platform settings (GoDaddy config, etc.)
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;

    const unsubscribe = onSnapshot(doc(db, 'config', 'platformSettings'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setPlatformSettings(data as PlatformSettings);
        // Also extract security policies if present
        if (data?.security) {
          setSecurityPolicies(data.security);
        }
      }
    }, (error) => {
      console.error('Error listening to platform settings:', error);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for AI usage records
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;

    const q = query(
      collection(db, 'aiUsage'),
      orderBy('createdAt', 'desc'),
      limit(1000)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      })) as AIUsageRecord[];
      setAIUsageRecords(records);
    }, (error) => {
      console.error('Error listening to AI usage:', error);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for system health
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;

    const unsubscribe = onSnapshot(doc(db, 'config', 'systemHealth'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setSystemHealth({
          services: data.services || {},
          overallStatus: data.overallStatus || 'operational',
          lastUpdated: data.lastUpdated?.toDate?.()?.toISOString() || new Date().toISOString()
        });
      }
    }, (error) => {
      console.error('Error listening to system health:', error);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for admin users
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;

    setAdminsLoading(true);
    const q = query(collection(db, 'admins'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const adminsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        lastLoginAt: doc.data().lastLoginAt?.toDate?.()?.toISOString()
      })) as AdminUser[];
      setAdmins(adminsData);
      setAdminsLoading(false);
    }, (error) => {
      console.error('Error listening to admins:', error);
      setAdminsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listener for active sessions
  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) return;

    setSessionsLoading(true);
    const q = query(
      collection(db, 'adminSessions'),
      where('isActive', '==', true),
      orderBy('startedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startedAt: doc.data().startedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        lastActiveAt: doc.data().lastActiveAt?.toDate?.()?.toISOString()
      })) as AdminSession[];
      setActiveSessions(sessionsData);
      setSessionsLoading(false);
    }, (error) => {
      console.error('Error listening to sessions:', error);
      setSessionsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // User operations
  const refreshUsers = useCallback(async () => {
    const db = getFirebaseDb();
    if (!db) return;

    setUsersLoading(true);
    try {
      const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PlatformUser[];
      setUsers(usersData);
    } catch (error) {
      console.error('Error refreshing users:', error);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  const updateUserStatus = useCallback(async (userId: string, status: AccountStatus) => {
    const db = getFirebaseDb();
    if (!db) return;

    try {
      await updateDoc(doc(db, 'users', userId), {
        status,
        updatedAt: new Date().toISOString()
      });

      // Log audit event
      await setDoc(doc(collection(db, 'auditLogs')), {
        actorId: currentAdmin?.id || 'unknown',
        actorType: 'admin',
        actorEmail: currentAdmin?.email,
        action: status === AccountStatus.SUSPENDED ? 'suspend' : 'activate',
        resource: 'user',
        resourceId: userId,
        details: { newStatus: status },
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      throw error;
    }
  }, [currentAdmin]);

  const deleteUser = useCallback(async (userId: string) => {
    const db = getFirebaseDb();
    if (!db) return;

    try {
      // Soft delete by updating status
      await updateDoc(doc(db, 'users', userId), {
        status: AccountStatus.DELETED,
        updatedAt: new Date().toISOString()
      });

      // Log audit event
      await setDoc(doc(collection(db, 'auditLogs')), {
        actorId: currentAdmin?.id || 'unknown',
        actorType: 'admin',
        actorEmail: currentAdmin?.email,
        action: 'delete',
        resource: 'user',
        resourceId: userId,
        details: {},
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }, [currentAdmin]);

  // AI Config operations
  const updateAIConfig = useCallback(async (config: Partial<AIConfig>) => {
    const db = getFirebaseDb();
    if (!db) return;

    setAIConfigLoading(true);
    try {
      const newConfig = {
        ...aiConfig,
        ...config,
        updatedAt: new Date().toISOString(),
        updatedBy: currentAdmin?.id || 'unknown'
      };
      await setDoc(doc(db, 'config', 'aiConfig'), newConfig);
      setAIConfig(newConfig);

      // Log audit event
      await setDoc(doc(collection(db, 'auditLogs')), {
        actorId: currentAdmin?.id || 'unknown',
        actorType: 'admin',
        actorEmail: currentAdmin?.email,
        action: 'ai_config_changed',
        resource: 'ai_config',
        details: { changes: config },
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error updating AI config:', error);
      throw error;
    } finally {
      setAIConfigLoading(false);
    }
  }, [currentAdmin, aiConfig]);

  // API Key operations
  const createAPIKey = useCallback(async (userId: string, name: string, scopes: string[]) => {
    const db = getFirebaseDb();
    if (!db) throw new Error('Firebase not initialized');

    setAPIKeysLoading(true);
    try {
      // Generate a secure random key
      const rawKey = `rmsk_${crypto.randomUUID().replace(/-/g, '')}`;
      const keyId = `key-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      const newKey: APIKey = {
        id: keyId,
        name,
        keyHash: btoa(rawKey), // In production: use proper hashing like bcrypt
        keyPrefix: rawKey.substring(0, 12),
        userId,
        scopes: scopes as any[],
        createdAt: new Date().toISOString(),
        isActive: true,
        createdBy: currentAdmin?.id || 'unknown'
      };

      await setDoc(doc(db, 'apiKeys', keyId), newKey);

      // Log audit event
      await setDoc(doc(collection(db, 'auditLogs')), {
        actorId: currentAdmin?.id || 'unknown',
        actorType: 'admin',
        actorEmail: currentAdmin?.email,
        action: 'api_key_created',
        resource: 'api_key',
        resourceId: keyId,
        details: { name, userId, scopes },
        createdAt: new Date().toISOString()
      });

      return { key: rawKey };
    } finally {
      setAPIKeysLoading(false);
    }
  }, [currentAdmin]);

  const revokeAPIKey = useCallback(async (keyId: string) => {
    const db = getFirebaseDb();
    if (!db) return;

    try {
      await updateDoc(doc(db, 'apiKeys', keyId), {
        isActive: false
      });

      // Log audit event
      await setDoc(doc(collection(db, 'auditLogs')), {
        actorId: currentAdmin?.id || 'unknown',
        actorType: 'admin',
        actorEmail: currentAdmin?.email,
        action: 'api_key_revoked',
        resource: 'api_key',
        resourceId: keyId,
        details: {},
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error revoking API key:', error);
      throw error;
    }
  }, [currentAdmin]);

  // Webhook operations
  const createWebhook = useCallback(async (userId: string, url: string, events: string[]) => {
    const db = getFirebaseDb();
    if (!db) throw new Error('Firebase not initialized');

    const webhookId = `webhook-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newWebhook: WebhookEndpoint = {
      id: webhookId,
      userId,
      url,
      secret: `whsec_${crypto.randomUUID().replace(/-/g, '')}`,
      events: events as any[],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      failureCount: 0
    };

    await setDoc(doc(db, 'webhooks', webhookId), newWebhook);
  }, []);

  const deleteWebhook = useCallback(async (webhookId: string) => {
    const db = getFirebaseDb();
    if (!db) return;

    await deleteDoc(doc(db, 'webhooks', webhookId));
  }, []);

  // GoDaddy credential operations (calls Cloud Functions)
  const updateGoDaddyCredentials = useCallback(async (
    apiKey: string,
    apiSecret: string,
    testFirst: boolean = true
  ): Promise<{ success: boolean; lastFourKey?: string; message?: string }> => {
    setPlatformSettingsLoading(true);
    try {
      // Import Firebase functions dynamically
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const updateCredentials = httpsCallable(functions, 'updateGoDaddyCredentials');

      const result = await updateCredentials({ apiKey, apiSecret, testFirst });
      return result.data as { success: boolean; lastFourKey?: string; message?: string };
    } catch (error: any) {
      console.error('Error updating GoDaddy credentials:', error);
      return {
        success: false,
        message: error.message || 'Failed to update credentials'
      };
    } finally {
      setPlatformSettingsLoading(false);
    }
  }, []);

  const testGoDaddyCredentials = useCallback(async (): Promise<{ success: boolean; message: string }> => {
    setPlatformSettingsLoading(true);
    try {
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const testCredentials = httpsCallable(functions, 'testGoDaddyCredentials');

      const result = await testCredentials({});
      return result.data as { success: boolean; message: string };
    } catch (error: any) {
      console.error('Error testing GoDaddy credentials:', error);
      return {
        success: false,
        message: error.message || 'Failed to test credentials'
      };
    } finally {
      setPlatformSettingsLoading(false);
    }
  }, []);

  // Audit log operations
  const refreshAuditLogs = useCallback(async () => {
    const db = getFirebaseDb();
    if (!db) return;

    setAuditLogsLoading(true);
    try {
      let q = query(
        collection(db, 'auditLogs'),
        orderBy('createdAt', 'desc'),
        limit(auditLogFilter.limit || 50)
      );

      // Apply filters
      if (auditLogFilter.actorType) {
        q = query(q, where('actorType', '==', auditLogFilter.actorType));
      }
      if (auditLogFilter.action) {
        q = query(q, where('action', '==', auditLogFilter.action));
      }
      if (auditLogFilter.resource) {
        q = query(q, where('resource', '==', auditLogFilter.resource));
      }

      const snapshot = await getDocs(q);
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AuditLog[];
      setAuditLogs(logsData);
    } catch (error) {
      console.error('Error refreshing audit logs:', error);
    } finally {
      setAuditLogsLoading(false);
    }
  }, [auditLogFilter]);

  // Load audit logs when filter changes
  useEffect(() => {
    refreshAuditLogs();
  }, [refreshAuditLogs]);

  const exportAuditLogs = useCallback(async () => {
    const headers = ['Timestamp', 'Actor', 'Action', 'Resource', 'Details'];
    const rows = auditLogs.map(log => [
      log.createdAt,
      log.actorEmail || log.actorId,
      log.action,
      log.resource,
      JSON.stringify(log.details)
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    return csv;
  }, [auditLogs]);

  // Refresh system health by calling the Cloud Function
  const refreshSystemHealth = useCallback(async () => {
    try {
      const functionsUrl = process.env.REACT_APP_FUNCTIONS_URL || 'https://us-central1-renovatemysite-app.cloudfunctions.net';
      const response = await fetch(`${functionsUrl}/checkSystemHealth`);
      const data = await response.json();
      setSystemHealth(data);
    } catch (error) {
      console.error('Error refreshing system health:', error);
    }
  }, []);

  // Admin management operations
  const inviteAdmin = useCallback(async (email: string, displayName: string, role: string) => {
    try {
      const functionsUrl = process.env.REACT_APP_FUNCTIONS_URL || 'https://us-central1-renovatemysite-app.cloudfunctions.net';
      const response = await fetch(`${functionsUrl}/inviteAdmin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          displayName,
          role,
          invitedBy: currentAdmin?.id
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to invite admin');
      }
    } catch (error) {
      console.error('Error inviting admin:', error);
      throw error;
    }
  }, [currentAdmin]);

  const updateAdminRole = useCallback(async (adminId: string, updates: { role?: string; isActive?: boolean }) => {
    try {
      const functionsUrl = process.env.REACT_APP_FUNCTIONS_URL || 'https://us-central1-renovatemysite-app.cloudfunctions.net';
      const response = await fetch(`${functionsUrl}/updateAdmin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          updates,
          updatedBy: currentAdmin?.id
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update admin');
      }
    } catch (error) {
      console.error('Error updating admin:', error);
      throw error;
    }
  }, [currentAdmin]);

  // Session management operations
  const terminateSession = useCallback(async (sessionId: string) => {
    try {
      const functionsUrl = process.env.REACT_APP_FUNCTIONS_URL || 'https://us-central1-renovatemysite-app.cloudfunctions.net';
      const response = await fetch(`${functionsUrl}/terminateAdminSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          terminatedBy: currentAdmin?.id
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to terminate session');
      }
    } catch (error) {
      console.error('Error terminating session:', error);
      throw error;
    }
  }, [currentAdmin]);

  const terminateAllSessions = useCallback(async (adminId: string) => {
    try {
      const functionsUrl = process.env.REACT_APP_FUNCTIONS_URL || 'https://us-central1-renovatemysite-app.cloudfunctions.net';
      const response = await fetch(`${functionsUrl}/terminateAdminSession`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId,
          terminateAll: true,
          terminatedBy: currentAdmin?.id
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to terminate sessions');
      }
    } catch (error) {
      console.error('Error terminating all sessions:', error);
      throw error;
    }
  }, [currentAdmin]);

  // Security policies operations
  const updateSecurityPolicies = useCallback(async (policies: any) => {
    try {
      const functionsUrl = process.env.REACT_APP_FUNCTIONS_URL || 'https://us-central1-renovatemysite-app.cloudfunctions.net';
      const response = await fetch(`${functionsUrl}/updateSecurityPolicies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policies,
          updatedBy: currentAdmin?.id
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update security policies');
      }
    } catch (error) {
      console.error('Error updating security policies:', error);
      throw error;
    }
  }, [currentAdmin]);

  const value: AdminContextType = {
    currentAdmin,
    isAuthenticated: !!currentAdmin,
    isLoading,
    activeTab,
    setActiveTab,
    users,
    usersLoading,
    refreshUsers,
    updateUserStatus,
    deleteUser,
    aiConfig,
    aiConfigLoading,
    updateAIConfig,
    aiUsageRecords,
    aiUsageStats,
    apiKeys,
    apiKeysLoading,
    createAPIKey,
    revokeAPIKey,
    webhooks,
    webhooksLoading,
    createWebhook,
    deleteWebhook,
    auditLogs,
    auditLogsLoading,
    auditLogFilter,
    setAuditLogFilter,
    refreshAuditLogs,
    exportAuditLogs,
    platformStats,
    metricsChanges,
    systemHealth,
    refreshSystemHealth,
    admins,
    adminsLoading,
    inviteAdmin,
    updateAdminRole,
    activeSessions,
    sessionsLoading,
    terminateSession,
    terminateAllSessions,
    securityPolicies,
    updateSecurityPolicies,
    platformSettings,
    platformSettingsLoading,
    updateGoDaddyCredentials,
    testGoDaddyCredentials
  };

  return (
    <AdminContext.Provider value={value}>
      {children}
    </AdminContext.Provider>
  );
};

export const useAdmin = (): AdminContextType => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

export default AdminContext;
