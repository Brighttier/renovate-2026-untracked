import { WebhookEndpoint, WebhookDelivery, WebhookEventType } from '../types';
import { getFirebaseDb, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, orderBy, limit as firestoreLimit, Timestamp } from './firebase';

const WEBHOOKS_COLLECTION = 'webhooks';
const DELIVERIES_COLLECTION = 'webhookDeliveries';

// Generate webhook secret
const generateSecret = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let secret = 'whsec_';
  for (let i = 0; i < 32; i++) {
    secret += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return secret;
};

// Create a new webhook endpoint
export const createWebhook = async (params: {
  userId: string;
  url: string;
  events: WebhookEventType[];
}): Promise<WebhookEndpoint> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  // Validate URL
  try {
    new URL(params.url);
  } catch {
    throw new Error('Invalid webhook URL');
  }

  const webhook: WebhookEndpoint = {
    id: `webhook-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    userId: params.userId,
    url: params.url,
    secret: generateSecret(),
    events: params.events,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    failureCount: 0
  };

  const docRef = doc(db, WEBHOOKS_COLLECTION, webhook.id);
  await setDoc(docRef, webhook);

  return webhook;
};

// Get all webhooks
export const getAllWebhooks = async (): Promise<WebhookEndpoint[]> => {
  const db = getFirebaseDb();
  if (!db) return [];

  const snapshot = await getDocs(collection(db, WEBHOOKS_COLLECTION));
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as WebhookEndpoint[];
};

// Get webhooks by agency
export const getWebhooksByAgency = async (userId: string): Promise<WebhookEndpoint[]> => {
  const db = getFirebaseDb();
  if (!db) return [];

  const q = query(
    collection(db, WEBHOOKS_COLLECTION),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as WebhookEndpoint[];
};

// Get webhook by ID
export const getWebhookById = async (webhookId: string): Promise<WebhookEndpoint | null> => {
  const db = getFirebaseDb();
  if (!db) return null;

  const docRef = doc(db, WEBHOOKS_COLLECTION, webhookId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as WebhookEndpoint;
};

// Update webhook
export const updateWebhook = async (webhookId: string, updates: Partial<Pick<WebhookEndpoint, 'url' | 'events' | 'isActive'>>): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  if (updates.url) {
    try {
      new URL(updates.url);
    } catch {
      throw new Error('Invalid webhook URL');
    }
  }

  const docRef = doc(db, WEBHOOKS_COLLECTION, webhookId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: new Date().toISOString()
  });
};

// Delete webhook
export const deleteWebhook = async (webhookId: string): Promise<void> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const docRef = doc(db, WEBHOOKS_COLLECTION, webhookId);
  await deleteDoc(docRef);
};

// Regenerate webhook secret
export const regenerateWebhookSecret = async (webhookId: string): Promise<string> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const newSecret = generateSecret();
  const docRef = doc(db, WEBHOOKS_COLLECTION, webhookId);
  await updateDoc(docRef, {
    secret: newSecret,
    updatedAt: new Date().toISOString()
  });

  return newSecret;
};

// Get webhooks subscribed to an event
export const getWebhooksForEvent = async (eventType: WebhookEventType): Promise<WebhookEndpoint[]> => {
  const db = getFirebaseDb();
  if (!db) return [];

  const q = query(
    collection(db, WEBHOOKS_COLLECTION),
    where('events', 'array-contains', eventType),
    where('isActive', '==', true)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as WebhookEndpoint[];
};

// Trigger webhook (send event)
export const triggerWebhook = async (params: {
  webhook: WebhookEndpoint;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
}): Promise<WebhookDelivery> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const delivery: WebhookDelivery = {
    id: `delivery-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    webhookId: params.webhook.id,
    eventType: params.eventType,
    payload: params.payload,
    success: false,
    attempts: 1,
    createdAt: new Date().toISOString()
  };

  try {
    // In production, this would make an actual HTTP request
    // For now, simulate the webhook call
    const response = await fetch(params.webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': params.webhook.secret,
        'X-Webhook-Event': params.eventType,
        'X-Webhook-Delivery-ID': delivery.id
      },
      body: JSON.stringify({
        event: params.eventType,
        timestamp: new Date().toISOString(),
        data: params.payload
      })
    });

    delivery.statusCode = response.status;
    delivery.success = response.ok;
    delivery.completedAt = new Date().toISOString();

    if (!response.ok) {
      delivery.response = await response.text().catch(() => 'Failed to read response');
    }
  } catch (error) {
    delivery.success = false;
    delivery.response = error instanceof Error ? error.message : 'Unknown error';
    delivery.completedAt = new Date().toISOString();
  }

  // Save delivery record
  const deliveryRef = doc(db, DELIVERIES_COLLECTION, delivery.id);
  await setDoc(deliveryRef, delivery);

  // Update webhook stats
  const webhookRef = doc(db, WEBHOOKS_COLLECTION, params.webhook.id);
  if (delivery.success) {
    await updateDoc(webhookRef, {
      lastTriggeredAt: new Date().toISOString(),
      failureCount: 0
    });
  } else {
    await updateDoc(webhookRef, {
      lastTriggeredAt: new Date().toISOString(),
      failureCount: params.webhook.failureCount + 1
    });
  }

  return delivery;
};

// Trigger event to all subscribed webhooks
export const triggerEvent = async (eventType: WebhookEventType, payload: Record<string, unknown>): Promise<WebhookDelivery[]> => {
  const webhooks = await getWebhooksForEvent(eventType);
  const deliveries: WebhookDelivery[] = [];

  for (const webhook of webhooks) {
    // Skip webhooks with too many failures
    if (webhook.failureCount >= 5) continue;

    const delivery = await triggerWebhook({ webhook, eventType, payload });
    deliveries.push(delivery);
  }

  return deliveries;
};

// Get webhook deliveries
export const getWebhookDeliveries = async (webhookId: string, limit: number = 50): Promise<WebhookDelivery[]> => {
  const db = getFirebaseDb();
  if (!db) return [];

  const q = query(
    collection(db, DELIVERIES_COLLECTION),
    where('webhookId', '==', webhookId),
    orderBy('createdAt', 'desc'),
    firestoreLimit(limit)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as WebhookDelivery[];
};

// Retry failed delivery
export const retryDelivery = async (deliveryId: string): Promise<WebhookDelivery> => {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase not initialized');

  const deliveryRef = doc(db, DELIVERIES_COLLECTION, deliveryId);
  const deliverySnap = await getDoc(deliveryRef);

  if (!deliverySnap.exists()) throw new Error('Delivery not found');

  const delivery = deliverySnap.data() as WebhookDelivery;
  const webhook = await getWebhookById(delivery.webhookId);

  if (!webhook) throw new Error('Webhook not found');

  return triggerWebhook({
    webhook,
    eventType: delivery.eventType,
    payload: delivery.payload
  });
};

// Test webhook (ping)
export const testWebhook = async (webhookId: string): Promise<WebhookDelivery> => {
  const webhook = await getWebhookById(webhookId);
  if (!webhook) throw new Error('Webhook not found');

  return triggerWebhook({
    webhook,
    eventType: WebhookEventType.LEAD_CREATED, // Use any event for test
    payload: {
      test: true,
      message: 'This is a test webhook delivery'
    }
  });
};
