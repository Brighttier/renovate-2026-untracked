/**
 * Data Export Cloud Function for Marketplace Services
 * Allows users to export their service data in various formats
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import type { MarketplaceServiceId } from '../../../types';

const db = getFirestore();
const storage = getStorage();

// Type definitions
interface ExportRequest {
  siteId: string;
  serviceId: MarketplaceServiceId;
  dataTypes: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  format: 'csv' | 'excel' | 'json';
}

interface ExportedData {
  conversations?: any[];
  visitors?: any[];
  appointments?: any[];
  clients?: any[];
  leads?: any[];
  submissions?: any[];
}

/**
 * Check if user owns the site
 */
async function userOwnsSite(userId: string, siteId: string): Promise<boolean> {
  // Check marketplace_subscriptions for ownership
  const subscriptionsQuery = await db
    .collection('marketplace_subscriptions')
    .where('siteId', '==', siteId)
    .where('userId', '==', userId)
    .limit(1)
    .get();

  if (!subscriptionsQuery.empty) {
    return true;
  }

  // Check leads collection for ownership
  const leadsQuery = await db
    .collection('leads')
    .where('siteId', '==', siteId)
    .where('ownerId', '==', userId)
    .limit(1)
    .get();

  return !leadsQuery.empty;
}

/**
 * Export chatbot conversations
 */
async function exportConversations(
  siteId: string,
  dateRange?: { start: string; end: string }
): Promise<any[]> {
  let query = db
    .collection('chatbotConfig')
    .doc(siteId)
    .collection('conversations')
    .orderBy('startedAt', 'desc');

  if (dateRange) {
    query = query
      .where('startedAt', '>=', dateRange.start)
      .where('startedAt', '<=', dateRange.end);
  }

  const snapshot = await query.limit(1000).get();

  const conversations = await Promise.all(
    snapshot.docs.map(async (doc) => {
      const data = doc.data();

      // Get messages for this conversation
      const messagesSnapshot = await doc.ref
        .collection('messages')
        .orderBy('timestamp', 'asc')
        .get();

      const messages = messagesSnapshot.docs.map((m) => m.data());

      return {
        id: doc.id,
        visitorEmail: data.visitorEmail || '',
        startedAt: data.startedAt,
        lastMessageAt: data.lastMessageAt,
        messageCount: data.messageCount || messages.length,
        status: data.status,
        summary: data.summary || '',
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
      };
    })
  );

  return conversations;
}

/**
 * Export chatbot visitors
 */
async function exportVisitors(
  siteId: string,
  dateRange?: { start: string; end: string }
): Promise<any[]> {
  let query = db
    .collection('chatbotConfig')
    .doc(siteId)
    .collection('visitors')
    .orderBy('firstVisit', 'desc');

  const snapshot = await query.limit(1000).get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      email: data.email || '',
      name: data.name || '',
      firstVisit: data.firstVisit,
      lastVisit: data.lastVisit,
      visitCount: data.visitCount || 1,
      conversationCount: data.conversationCount || 0,
    };
  });
}

/**
 * Export booking appointments
 */
async function exportAppointments(
  siteId: string,
  dateRange?: { start: string; end: string }
): Promise<any[]> {
  let query = db
    .collection('bookingConfig')
    .doc(siteId)
    .collection('appointments')
    .orderBy('startTime', 'desc');

  if (dateRange) {
    query = query
      .where('startTime', '>=', dateRange.start)
      .where('startTime', '<=', dateRange.end);
  }

  const snapshot = await query.limit(1000).get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      clientName: data.clientName,
      clientEmail: data.clientEmail,
      clientPhone: data.clientPhone || '',
      eventType: data.eventTypeId,
      startTime: data.startTime,
      endTime: data.endTime,
      status: data.status,
      notes: data.notes || '',
      confirmationCode: data.confirmationCode,
      createdAt: data.createdAt,
    };
  });
}

/**
 * Export booking clients
 */
async function exportClients(
  siteId: string,
  dateRange?: { start: string; end: string }
): Promise<any[]> {
  const snapshot = await db
    .collection('bookingConfig')
    .doc(siteId)
    .collection('clients')
    .limit(1000)
    .get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      email: data.email,
      phone: data.phone || '',
      appointmentCount: data.appointmentCount || 0,
      lastAppointment: data.lastAppointment || '',
      createdAt: data.createdAt,
    };
  });
}

/**
 * Export CRM leads
 */
async function exportLeads(
  siteId: string,
  dateRange?: { start: string; end: string }
): Promise<any[]> {
  let query = db
    .collection('crmConfig')
    .doc(siteId)
    .collection('leads')
    .orderBy('createdAt', 'desc');

  if (dateRange) {
    query = query
      .where('createdAt', '>=', dateRange.start)
      .where('createdAt', '<=', dateRange.end);
  }

  const snapshot = await query.limit(1000).get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      email: data.email,
      phone: data.phone || '',
      source: data.source,
      status: data.status,
      value: data.value || '',
      tags: (data.tags || []).join(', '),
      notes: (data.notes || []).join(' | '),
      createdAt: data.createdAt,
      lastContactedAt: data.lastContactedAt || '',
    };
  });
}

/**
 * Export CRM form submissions
 */
async function exportSubmissions(
  siteId: string,
  dateRange?: { start: string; end: string }
): Promise<any[]> {
  let query = db
    .collection('crmConfig')
    .doc(siteId)
    .collection('submissions')
    .orderBy('createdAt', 'desc');

  if (dateRange) {
    query = query
      .where('createdAt', '>=', dateRange.start)
      .where('createdAt', '<=', dateRange.end);
  }

  const snapshot = await query.limit(1000).get();

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      formId: data.formId,
      status: data.status,
      pageUrl: data.source?.pageUrl || '',
      createdAt: data.createdAt,
      ...data.data, // Spread form field data
    };
  });
}

/**
 * Generate CSV content from data
 */
function generateCSV(data: ExportedData): string {
  const rows: string[] = [];

  // Conversations
  if (data.conversations && data.conversations.length > 0) {
    rows.push('=== CONVERSATIONS ===');
    rows.push('ID,Visitor Email,Started At,Message Count,Status,Summary');
    for (const conv of data.conversations) {
      rows.push(
        `"${conv.id}","${conv.visitorEmail}","${conv.startedAt}",${conv.messageCount},"${conv.status}","${(conv.summary || '').replace(/"/g, '""')}"`
      );
    }
    rows.push('');

    // Messages detail
    rows.push('=== MESSAGES ===');
    rows.push('Conversation ID,Role,Content,Timestamp');
    for (const conv of data.conversations) {
      for (const msg of conv.messages || []) {
        rows.push(
          `"${conv.id}","${msg.role}","${(msg.content || '').replace(/"/g, '""')}","${msg.timestamp}"`
        );
      }
    }
    rows.push('');
  }

  // Visitors
  if (data.visitors && data.visitors.length > 0) {
    rows.push('=== VISITORS ===');
    rows.push('ID,Email,Name,First Visit,Last Visit,Visit Count,Conversation Count');
    for (const visitor of data.visitors) {
      rows.push(
        `"${visitor.id}","${visitor.email}","${visitor.name}","${visitor.firstVisit}","${visitor.lastVisit}",${visitor.visitCount},${visitor.conversationCount}`
      );
    }
    rows.push('');
  }

  // Appointments
  if (data.appointments && data.appointments.length > 0) {
    rows.push('=== APPOINTMENTS ===');
    rows.push('ID,Client Name,Email,Phone,Event Type,Start Time,End Time,Status,Confirmation Code,Notes');
    for (const appt of data.appointments) {
      rows.push(
        `"${appt.id}","${appt.clientName}","${appt.clientEmail}","${appt.clientPhone}","${appt.eventType}","${appt.startTime}","${appt.endTime}","${appt.status}","${appt.confirmationCode}","${(appt.notes || '').replace(/"/g, '""')}"`
      );
    }
    rows.push('');
  }

  // Clients
  if (data.clients && data.clients.length > 0) {
    rows.push('=== CLIENTS ===');
    rows.push('ID,Name,Email,Phone,Appointment Count,Last Appointment');
    for (const client of data.clients) {
      rows.push(
        `"${client.id}","${client.name}","${client.email}","${client.phone}",${client.appointmentCount},"${client.lastAppointment}"`
      );
    }
    rows.push('');
  }

  // Leads
  if (data.leads && data.leads.length > 0) {
    rows.push('=== LEADS ===');
    rows.push('ID,Name,Email,Phone,Source,Status,Value,Tags,Notes,Created At,Last Contacted');
    for (const lead of data.leads) {
      rows.push(
        `"${lead.id}","${lead.name}","${lead.email}","${lead.phone}","${lead.source}","${lead.status}","${lead.value}","${lead.tags}","${(lead.notes || '').replace(/"/g, '""')}","${lead.createdAt}","${lead.lastContactedAt}"`
      );
    }
    rows.push('');
  }

  // Submissions
  if (data.submissions && data.submissions.length > 0) {
    rows.push('=== FORM SUBMISSIONS ===');
    // Get all possible columns from submissions
    const allKeys = new Set<string>();
    data.submissions.forEach((sub) => {
      Object.keys(sub).forEach((key) => allKeys.add(key));
    });
    const columns = Array.from(allKeys);
    rows.push(columns.join(','));

    for (const sub of data.submissions) {
      const values = columns.map((col) => {
        const val = sub[col];
        if (val === undefined || val === null) return '';
        return `"${String(val).replace(/"/g, '""')}"`;
      });
      rows.push(values.join(','));
    }
  }

  return rows.join('\n');
}

/**
 * Upload export file to temporary storage
 */
async function uploadExportFile(
  content: string,
  filename: string,
  contentType: string
): Promise<string> {
  const bucket = storage.bucket();
  const file = bucket.file(`exports/${filename}`);

  await file.save(content, {
    contentType,
    metadata: {
      // File expires in 1 hour
      cacheControl: 'no-cache',
    },
  });

  // Generate signed URL that expires in 1 hour
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 60 * 60 * 1000, // 1 hour
  });

  return url;
}

/**
 * Log export for audit trail
 */
async function logExport(
  userId: string,
  siteId: string,
  serviceId: string,
  dataTypes: string[],
  format: string
): Promise<void> {
  await db.collection('audit_logs').add({
    action: 'data_export',
    userId,
    siteId,
    serviceId,
    dataTypes,
    format,
    timestamp: FieldValue.serverTimestamp(),
  });
}

/**
 * Export service data Cloud Function
 */
export const exportServiceData = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const { siteId, serviceId, dataTypes, dateRange, format } = request.data as ExportRequest;
    const userId = request.auth.uid;

    // Validate request
    if (!siteId || !serviceId || !dataTypes || dataTypes.length === 0) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    // Verify user owns the site
    if (!(await userOwnsSite(userId, siteId))) {
      throw new HttpsError('permission-denied', 'You do not have access to this site');
    }

    console.log(`[Export] Exporting ${serviceId} data for site: ${siteId}, types: ${dataTypes.join(',')}`);

    try {
      const exportData: ExportedData = {};

      // Collect requested data based on service type
      for (const dataType of dataTypes) {
        switch (dataType) {
          case 'conversations':
            exportData.conversations = await exportConversations(siteId, dateRange);
            break;
          case 'visitors':
            exportData.visitors = await exportVisitors(siteId, dateRange);
            break;
          case 'appointments':
            exportData.appointments = await exportAppointments(siteId, dateRange);
            break;
          case 'clients':
            exportData.clients = await exportClients(siteId, dateRange);
            break;
          case 'leads':
            exportData.leads = await exportLeads(siteId, dateRange);
            break;
          case 'submissions':
            exportData.submissions = await exportSubmissions(siteId, dateRange);
            break;
        }
      }

      // Generate file based on format
      let content: string;
      let contentType: string;
      let extension: string;

      switch (format) {
        case 'csv':
          content = generateCSV(exportData);
          contentType = 'text/csv';
          extension = 'csv';
          break;
        case 'json':
          content = JSON.stringify(exportData, null, 2);
          contentType = 'application/json';
          extension = 'json';
          break;
        case 'excel':
          // For Excel, we'll generate CSV (basic implementation)
          // A full implementation would use a library like exceljs
          content = generateCSV(exportData);
          contentType = 'text/csv';
          extension = 'csv';
          break;
        default:
          content = JSON.stringify(exportData, null, 2);
          contentType = 'application/json';
          extension = 'json';
      }

      // Generate unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${serviceId}-export-${siteId}-${timestamp}.${extension}`;

      // Upload to temporary storage
      const downloadUrl = await uploadExportFile(content, filename, contentType);

      // Log export for audit
      await logExport(userId, siteId, serviceId, dataTypes, format);

      console.log(`[Export] Successfully created export: ${filename}`);

      return {
        downloadUrl,
        filename,
        expiresIn: '1 hour',
      };
    } catch (error: any) {
      console.error('[Export] Error:', error);
      throw new HttpsError('internal', error.message || 'Failed to export data');
    }
  }
);
