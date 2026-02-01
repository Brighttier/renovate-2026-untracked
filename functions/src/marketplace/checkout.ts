/**
 * Marketplace Checkout & Subscription Management
 * Handles Stripe checkout sessions for marketplace services
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { getStripe, stripeSecretKey } from '../config/stripe';

// Marketplace pricing configuration
const MARKETPLACE_PRICING = {
  chatbot: {
    id: 'chatbot',
    name: 'AI Support Agent',
    setupFee: 99,
    monthly: 29,
    annual: 290,
  },
  booking: {
    id: 'booking',
    name: 'Booking Calendar',
    setupFee: 149,
    monthly: 19,
    annual: 190,
  },
  'simple-crm': {
    id: 'simple-crm',
    name: 'Lead Dashboard',
    setupFee: 49,
    monthly: 9,
    annual: 90,
  },
  bundle: {
    id: 'bundle',
    name: 'Business Suite',
    setupFee: 199,
    monthly: 49,
    annual: 490,
    includes: ['chatbot', 'booking', 'simple-crm'],
  },
};

type MarketplaceServiceId = 'chatbot' | 'booking' | 'simple-crm' | 'bundle';

// Cache for Stripe price IDs
const priceIdCache: Record<string, { setupPriceId: string; monthlyPriceId: string }> = {};

/**
 * Get or create Stripe products and prices for a marketplace service
 */
async function getOrCreateMarketplacePrices(
  stripe: Stripe,
  serviceId: MarketplaceServiceId
): Promise<{ setupPriceId: string; monthlyPriceId: string }> {
  // Check cache first
  if (priceIdCache[serviceId]) {
    return priceIdCache[serviceId];
  }

  const pricing = MARKETPLACE_PRICING[serviceId];
  if (!pricing) {
    throw new Error(`Unknown service: ${serviceId}`);
  }

  // Search for existing product
  const products = await stripe.products.search({
    query: `metadata['serviceId']:'${serviceId}' AND metadata['type']:'marketplace'`,
  });

  let product: Stripe.Product;

  if (products.data.length > 0) {
    product = products.data[0];
  } else {
    // Create new product
    product = await stripe.products.create({
      name: pricing.name,
      description: `Marketplace service: ${pricing.name}`,
      metadata: {
        serviceId,
        type: 'marketplace',
      },
    });
  }

  // Get or create setup price (one-time)
  let setupPriceId: string;
  const setupPrices = await stripe.prices.list({
    product: product.id,
    type: 'one_time',
    active: true,
  });

  if (setupPrices.data.length > 0) {
    setupPriceId = setupPrices.data[0].id;
  } else {
    const setupPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: pricing.setupFee * 100,
      currency: 'usd',
      metadata: {
        serviceId,
        priceType: 'setup',
      },
    });
    setupPriceId = setupPrice.id;
  }

  // Get or create monthly price (recurring)
  let monthlyPriceId: string;
  const monthlyPrices = await stripe.prices.list({
    product: product.id,
    type: 'recurring',
    active: true,
  });

  if (monthlyPrices.data.length > 0) {
    monthlyPriceId = monthlyPrices.data[0].id;
  } else {
    const monthlyPrice = await stripe.prices.create({
      product: product.id,
      unit_amount: pricing.monthly * 100,
      currency: 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        serviceId,
        priceType: 'monthly',
      },
    });
    monthlyPriceId = monthlyPrice.id;
  }

  // Cache the result
  priceIdCache[serviceId] = { setupPriceId, monthlyPriceId };

  return { setupPriceId, monthlyPriceId };
}

/**
 * Get or create a Stripe customer for the user
 */
async function getOrCreateCustomer(
  stripe: Stripe,
  userId: string,
  email: string
): Promise<string> {
  const db = getFirestore();
  const customerDoc = await db.collection('customers').doc(userId).get();

  if (customerDoc.exists && customerDoc.data()?.stripeCustomerId) {
    return customerDoc.data()!.stripeCustomerId;
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email,
    metadata: {
      firebaseUserId: userId,
    },
  });

  // Store in Firestore
  await db.collection('customers').doc(userId).set({
    stripeCustomerId: customer.id,
    email,
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return customer.id;
}

/**
 * Create a Stripe checkout session for a marketplace service
 */
export const createMarketplaceCheckout = onCall(
  { cors: true, secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const {
      serviceId,
      leadId,
      siteId,
      businessName,
      successUrl,
      cancelUrl,
    } = request.data;

    if (!serviceId || !leadId || !siteId) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    const userId = request.auth.uid;
    const email = request.auth.token.email || '';

    console.log(`[MarketplaceCheckout] Creating checkout for ${serviceId}, user: ${userId}`);

    try {
      const stripe = getStripe();
      const db = getFirestore();

      // Get or create customer
      const customerId = await getOrCreateCustomer(stripe, userId, email);

      // Get or create prices
      const { setupPriceId, monthlyPriceId } = await getOrCreateMarketplacePrices(
        stripe,
        serviceId as MarketplaceServiceId
      );

      // Create order record
      const orderRef = db.collection('marketplace_orders').doc();
      const orderId = orderRef.id;

      await orderRef.set({
        id: orderId,
        userId,
        leadId,
        siteId,
        serviceId,
        serviceName: MARKETPLACE_PRICING[serviceId as MarketplaceServiceId].name,
        setupFee: MARKETPLACE_PRICING[serviceId as MarketplaceServiceId].setupFee,
        monthlyFee: MARKETPLACE_PRICING[serviceId as MarketplaceServiceId].monthly,
        status: 'pending',
        businessName,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Create Stripe checkout session with setup fee + subscription
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [
          // Setup fee (one-time)
          {
            price: setupPriceId,
            quantity: 1,
          },
          // Monthly subscription
          {
            price: monthlyPriceId,
            quantity: 1,
          },
        ],
        subscription_data: {
          metadata: {
            orderId,
            userId,
            leadId,
            siteId,
            serviceId,
            businessName,
            type: 'marketplace',
          },
        },
        metadata: {
          orderId,
          userId,
          leadId,
          siteId,
          serviceId,
          businessName,
          type: 'marketplace',
        },
        success_url: `${successUrl}?order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${cancelUrl}?cancelled=true`,
      });

      // Update order with session ID
      await orderRef.update({
        stripeSessionId: session.id,
        updatedAt: FieldValue.serverTimestamp(),
      });

      console.log(`[MarketplaceCheckout] Session created: ${session.id}`);

      return {
        sessionId: session.id,
        url: session.url,
        orderId,
      };
    } catch (error: any) {
      console.error('[MarketplaceCheckout] Error:', error);
      throw new HttpsError('internal', error.message || 'Failed to create checkout');
    }
  }
);

/**
 * Cancel a marketplace service subscription
 */
export const cancelMarketplaceService = onCall(
  { cors: true, secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const { siteId, serviceId, reason } = request.data;
    const userId = request.auth.uid;

    console.log(`[MarketplaceCancel] Cancelling ${serviceId} for site: ${siteId}`);

    try {
      const stripe = getStripe();
      const db = getFirestore();

      // Find the subscription
      const subscriptionQuery = await db
        .collection('marketplace_subscriptions')
        .where('siteId', '==', siteId)
        .where('serviceId', '==', serviceId)
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (subscriptionQuery.empty) {
        throw new HttpsError('not-found', 'Subscription not found');
      }

      const subscriptionDoc = subscriptionQuery.docs[0];
      const subscription = subscriptionDoc.data();

      // Cancel at period end in Stripe
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      // Update Firestore
      await subscriptionDoc.ref.update({
        cancelAtPeriodEnd: true,
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Record cancellation
      await db.collection('service_cancellations').add({
        siteId,
        serviceId,
        userId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        cancelAt: 'period_end',
        reason,
        dataExported: false,
        status: 'pending',
        cancelledAt: new Date().toISOString(),
        effectiveDate: subscription.currentPeriodEnd,
      });

      console.log(`[MarketplaceCancel] Subscription cancelled at period end`);

      return {
        success: true,
        effectiveDate: subscription.currentPeriodEnd,
        message: 'Service will be cancelled at end of billing period',
      };
    } catch (error: any) {
      console.error('[MarketplaceCancel] Error:', error);
      throw new HttpsError('internal', error.message || 'Failed to cancel subscription');
    }
  }
);

/**
 * Reactivate a cancelled marketplace service
 */
export const reactivateMarketplaceService = onCall(
  { cors: true, secrets: [stripeSecretKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const { siteId, serviceId } = request.data;
    const userId = request.auth.uid;

    console.log(`[MarketplaceReactivate] Reactivating ${serviceId} for site: ${siteId}`);

    try {
      const stripe = getStripe();
      const db = getFirestore();

      // Find the subscription (may be cancelled but not expired)
      const subscriptionQuery = await db
        .collection('marketplace_subscriptions')
        .where('siteId', '==', siteId)
        .where('serviceId', '==', serviceId)
        .where('userId', '==', userId)
        .limit(1)
        .get();

      if (subscriptionQuery.empty) {
        throw new HttpsError('not-found', 'Subscription not found');
      }

      const subscriptionDoc = subscriptionQuery.docs[0];
      const subscription = subscriptionDoc.data();

      // Check if subscription is still active in Stripe
      const stripeSubscription = await stripe.subscriptions.retrieve(
        subscription.stripeSubscriptionId
      );

      if (stripeSubscription.status === 'canceled') {
        throw new HttpsError('failed-precondition', 'Subscription has expired. Please create a new subscription.');
      }

      // Resume subscription (remove cancel_at_period_end)
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });

      // Update Firestore
      await subscriptionDoc.ref.update({
        cancelAtPeriodEnd: false,
        status: 'active',
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Update cancellation record
      const cancellationQuery = await db
        .collection('service_cancellations')
        .where('siteId', '==', siteId)
        .where('serviceId', '==', serviceId)
        .where('status', '==', 'pending')
        .limit(1)
        .get();

      if (!cancellationQuery.empty) {
        await cancellationQuery.docs[0].ref.update({
          status: 'reactivated',
          reactivatedAt: new Date().toISOString(),
        });
      }

      console.log(`[MarketplaceReactivate] Subscription reactivated`);

      return {
        success: true,
        message: 'Service has been reactivated',
      };
    } catch (error: any) {
      console.error('[MarketplaceReactivate] Error:', error);
      throw new HttpsError('internal', error.message || 'Failed to reactivate subscription');
    }
  }
);

/**
 * Get all marketplace subscriptions for a user
 */
export const getMarketplaceSubscriptions = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in');
    }

    const userId = request.auth.uid;
    const { siteId } = request.data || {};

    console.log(`[MarketplaceSubscriptions] Getting subscriptions for user: ${userId}`);

    try {
      const db = getFirestore();

      let query = db
        .collection('marketplace_subscriptions')
        .where('userId', '==', userId);

      if (siteId) {
        query = query.where('siteId', '==', siteId);
      }

      const subscriptionsSnapshot = await query.get();

      const subscriptions = subscriptionsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Get usage for each subscription
      const subscriptionsWithUsage = await Promise.all(
        subscriptions.map(async (sub: any) => {
          const period = new Date().toISOString().slice(0, 7); // "2025-02"
          const usageDoc = await db
            .collection('service_usage')
            .doc(`${sub.siteId}_${sub.serviceId}_${period}`)
            .get();

          return {
            ...sub,
            usage: usageDoc.exists ? usageDoc.data() : null,
          };
        })
      );

      return { subscriptions: subscriptionsWithUsage };
    } catch (error: any) {
      console.error('[MarketplaceSubscriptions] Error:', error);
      throw new HttpsError('internal', error.message || 'Failed to get subscriptions');
    }
  }
);
