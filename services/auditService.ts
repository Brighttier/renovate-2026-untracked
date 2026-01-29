import { AuditLog, AuditAction, AuditResource, AuditLogFilter } from '../types';
import { getFirebaseDb, collection, doc, setDoc, getDocs, query, where, orderBy, limit as firestoreLimit, Timestamp } from './firebase';

const COLLECTION = 'auditLogs';

// Generate unique ID
const generateId = (): string => {
  return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// Log an audit event
export const logAuditEvent = async (params: {
  actorId: string;
  actorType: 'admin' | 'user' | 'system' | 'api';
  actorEmail?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<AuditLog> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const log: AuditLog = {
    id: generateId(),
    actorId: params.actorId,
    actorType: params.actorType,
    actorEmail: params.actorEmail,
    action: params.action,
    resource: params.resource,
    resourceId: params.resourceId,
    details: params.details || {},
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
    createdAt: new Date().toISOString()
  };

  const docRef = doc(db, COLLECTION, log.id);
  await setDoc(docRef, log);

  return log;
};

// Get audit logs with filters
export const getAuditLogs = async (filter: AuditLogFilter): Promise<AuditLog[]> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const constraints: any[] = [orderBy('createdAt', 'desc')];

  if (filter.actorId) {
    constraints.push(where('actorId', '==', filter.actorId));
  }

  if (filter.actorType) {
    constraints.push(where('actorType', '==', filter.actorType));
  }

  if (filter.action) {
    constraints.push(where('action', '==', filter.action));
  }

  if (filter.resource) {
    constraints.push(where('resource', '==', filter.resource));
  }

  if (filter.resourceId) {
    constraints.push(where('resourceId', '==', filter.resourceId));
  }

  if (filter.limit) {
    constraints.push(firestoreLimit(filter.limit));
  }

  const q = query(collection(db, COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  let logs = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as AuditLog[];

  // Client-side date filtering (Firestore doesn't support range queries on dates with other filters)
  if (filter.startDate) {
    const start = new Date(filter.startDate);
    logs = logs.filter(log => new Date(log.createdAt) >= start);
  }

  if (filter.endDate) {
    const end = new Date(filter.endDate);
    logs = logs.filter(log => new Date(log.createdAt) <= end);
  }

  // Apply offset
  if (filter.offset) {
    logs = logs.slice(filter.offset);
  }

  return logs;
};

// Get audit logs for a specific resource
export const getResourceAuditLogs = async (resource: AuditResource, resourceId: string): Promise<AuditLog[]> => {
  return getAuditLogs({
    resource,
    resourceId,
    limit: 100
  });
};

// Get audit logs for a specific actor
export const getActorAuditLogs = async (actorId: string): Promise<AuditLog[]> => {
  return getAuditLogs({
    actorId,
    limit: 100
  });
};

// Get recent audit logs
export const getRecentAuditLogs = async (count: number = 50): Promise<AuditLog[]> => {
  return getAuditLogs({ limit: count });
};

// Export audit logs to CSV
export const exportAuditLogsToCSV = (logs: AuditLog[]): string => {
  const headers = [
    'ID',
    'Timestamp',
    'Actor ID',
    'Actor Type',
    'Actor Email',
    'Action',
    'Resource',
    'Resource ID',
    'Details',
    'IP Address',
    'User Agent'
  ];

  const rows = logs.map(log => [
    log.id,
    log.createdAt,
    log.actorId,
    log.actorType,
    log.actorEmail || '',
    log.action,
    log.resource,
    log.resourceId || '',
    JSON.stringify(log.details),
    log.ipAddress || '',
    log.userAgent || ''
  ]);

  const escapeCSV = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const csvRows = [headers, ...rows].map(row =>
    row.map(cell => escapeCSV(String(cell))).join(',')
  );

  return csvRows.join('\n');
};

// Helper functions for common audit events
export const auditLogin = (adminId: string, email: string, ipAddress?: string) =>
  logAuditEvent({
    actorId: adminId,
    actorType: 'admin',
    actorEmail: email,
    action: AuditAction.LOGIN,
    resource: AuditResource.ADMIN,
    ipAddress
  });

export const auditLogout = (adminId: string, email: string) =>
  logAuditEvent({
    actorId: adminId,
    actorType: 'admin',
    actorEmail: email,
    action: AuditAction.LOGOUT,
    resource: AuditResource.ADMIN
  });

export const auditUserSuspend = (adminId: string, adminEmail: string, userId: string, reason?: string) =>
  logAuditEvent({
    actorId: adminId,
    actorType: 'admin',
    actorEmail: adminEmail,
    action: AuditAction.SUSPEND,
    resource: AuditResource.USER,
    resourceId: userId,
    details: { reason }
  });

export const auditUserActivate = (adminId: string, adminEmail: string, userId: string) =>
  logAuditEvent({
    actorId: adminId,
    actorType: 'admin',
    actorEmail: adminEmail,
    action: AuditAction.ACTIVATE,
    resource: AuditResource.USER,
    resourceId: userId
  });

export const auditImpersonate = (adminId: string, adminEmail: string, userId: string) =>
  logAuditEvent({
    actorId: adminId,
    actorType: 'admin',
    actorEmail: adminEmail,
    action: AuditAction.IMPERSONATE,
    resource: AuditResource.USER,
    resourceId: userId
  });

export const auditAIConfigChange = (adminId: string, adminEmail: string, changes: Record<string, unknown>) =>
  logAuditEvent({
    actorId: adminId,
    actorType: 'admin',
    actorEmail: adminEmail,
    action: AuditAction.AI_CONFIG_CHANGED,
    resource: AuditResource.AI_CONFIG,
    details: changes
  });

export const auditAPIKeyCreated = (adminId: string, adminEmail: string, keyId: string, userId: string) =>
  logAuditEvent({
    actorId: adminId,
    actorType: 'admin',
    actorEmail: adminEmail,
    action: AuditAction.API_KEY_CREATED,
    resource: AuditResource.API_KEY,
    resourceId: keyId,
    details: { userId }
  });

export const auditAPIKeyRevoked = (adminId: string, adminEmail: string, keyId: string) =>
  logAuditEvent({
    actorId: adminId,
    actorType: 'admin',
    actorEmail: adminEmail,
    action: AuditAction.API_KEY_REVOKED,
    resource: AuditResource.API_KEY,
    resourceId: keyId
  });
