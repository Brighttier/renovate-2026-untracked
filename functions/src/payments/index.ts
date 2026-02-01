import { onRequest, onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import {
    getStripe,
    stripeSecretKey,
    stripeWebhookSecret,
    ensureStripeProducts,
    getPriceId,
    getPlanDetails,
    getTopupPackDetails,
    PLATFORM_PLANS,
    TOPUP_PACKS
} from '../config/stripe';
import {
    generateChatbotWidget,
    generateBookingWidget,
    generateCRMWidget,
    injectWidgetIntoHtml,
    removeWidgetFromHtml,
} from '../marketplace/widgetGenerators';
import type { MarketplaceServiceId } from '../../../types';

const db = admin.firestore();

// ============================================
// IDEMPOTENCY HELPERS
// ============================================

/**
 * Check if a webhook event has already been processed
 * Prevents duplicate processing of the same event
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
    const doc = await db.collection('processedWebhookEvents').doc(eventId).get();
    return doc.exists;
}

/**
 * Mark a webhook event as processed
 * Events are stored with a timestamp for cleanup
 */
async function markEventProcessed(eventId: string, eventType: string): Promise<void> {
    await db.collection('processedWebhookEvents').doc(eventId).set({
        eventType,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        // TTL field for automatic cleanup (30 days)
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get or create a Stripe customer for a user
 */
async function getOrCreateStripeCustomer(userId: string, email: string): Promise<string> {
    const stripe = getStripe();

    // Check if customer exists in Firestore
    const customerDoc = await db.collection('customers').doc(userId).get();

    if (customerDoc.exists) {
        const data = customerDoc.data();
        if (data?.stripeCustomerId) {
            return data.stripeCustomerId;
        }
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
        email,
        metadata: {
            firebaseUserId: userId
        }
    });

    // Store mapping in Firestore
    await db.collection('customers').doc(userId).set({
        stripeCustomerId: customer.id,
        email,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return customer.id;
}

/**
 * Update user's subscription status in Firestore
 */
async function updateSubscriptionInFirestore(
    userId: string,
    subscription: Stripe.Subscription
): Promise<void> {
    const planId = subscription.items.data[0]?.price?.metadata?.plan_id || 'free';

    await db.collection('subscriptions').doc(subscription.id).set({
        userId,
        stripeSubscriptionId: subscription.id,
        planId,
        status: subscription.status,
        currentPeriodStart: new Date((subscription as any).current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Update user's plan
    const userQuery = await db.collection('users').where('ownerId', '==', userId).get();
    if (!userQuery.empty) {
        const userDoc = userQuery.docs[0];
        await userDoc.ref.update({
            planId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // If subscription is active, refresh tokens based on plan
        if (subscription.status === 'active') {
            const plan = getPlanDetails(planId);
            if (plan) {
                await userDoc.ref.update({
                    'stats.editTokensRemaining': plan.limits.editTokens
                });
            }
        }
    }
}

/**
 * Record a payment in Firestore
 */
async function recordPayment(
    userId: string,
    paymentIntent: Stripe.PaymentIntent | Stripe.Invoice,
    type: 'subscription' | 'topup',
    description: string,
    tokensAdded?: number
): Promise<void> {
    const amount = 'amount_paid' in paymentIntent
        ? paymentIntent.amount_paid
        : paymentIntent.amount;

    await db.collection('payments').add({
        userId,
        stripePaymentId: paymentIntent.id,
        type,
        amount: amount / 100, // Convert from cents
        currency: paymentIntent.currency,
        status: 'succeeded',
        description,
        tokensAdded,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Add tokens to user account
 */
async function addTokensToUser(userId: string, tokens: number, tokenType: 'edit' | 'site'): Promise<void> {
    const userQuery = await db.collection('users').where('ownerId', '==', userId).get();

    if (!userQuery.empty) {
        const userDoc = userQuery.docs[0];

        if (tokenType === 'edit') {
            await userDoc.ref.update({
                'stats.editTokensRemaining': admin.firestore.FieldValue.increment(tokens),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // For site generation tokens, we could track separately
            // For now, we'll add to a siteTokensRemaining field
            await userDoc.ref.update({
                'stats.siteTokensRemaining': admin.firestore.FieldValue.increment(tokens),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
}

// ============================================
// MARKETPLACE HELPER FUNCTIONS
// ============================================

/**
 * Handle marketplace subscription purchase
 * Deploys widget to the client's website
 */
async function handleMarketplacePurchase(
    session: Stripe.Checkout.Session,
    subscription: Stripe.Subscription
): Promise<void> {
    const { orderId, userId, leadId, siteId, serviceId, businessName } = session.metadata || {};

    if (!orderId || !userId || !leadId || !siteId || !serviceId) {
        console.error('[MarketplaceWebhook] Missing required metadata');
        return;
    }

    console.log(`[MarketplaceWebhook] Processing purchase for order: ${orderId}, service: ${serviceId}`);

    try {
        // 1. Update order status to 'paid'
        await db.collection('marketplace_orders').doc(orderId).update({
            status: 'deploying',
            stripeSubscriptionId: subscription.id,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 2. Get the lead and site data
        const leadDoc = await db.collection('leads').doc(leadId).get();
        if (!leadDoc.exists) {
            throw new Error(`Lead not found: ${leadId}`);
        }
        const lead = leadDoc.data();

        // 3. Get current HTML from pending_deployments or hosting
        let currentHtml = '';
        const pendingDeployDoc = await db.collection('pending_deployments').doc(orderId).get();
        if (pendingDeployDoc.exists) {
            currentHtml = pendingDeployDoc.data()?.html || '';
        } else if (lead?.hosting?.deployedHtml) {
            currentHtml = lead.hosting.deployedHtml;
        } else if (lead?.blueprint?.html) {
            currentHtml = lead.blueprint.html;
        }

        if (!currentHtml) {
            console.warn('[MarketplaceWebhook] No HTML found for site, skipping widget injection');
            await db.collection('marketplace_orders').doc(orderId).update({
                status: 'deployed',
                deployedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                note: 'Widget injection skipped - no HTML available',
            });
            return;
        }

        // 4. Get business info for widget generation
        const siteIdentity = lead?.siteIdentity || {};
        const primaryColor = siteIdentity.primaryColors?.[0] || '#10b981';
        const widgetOptions = {
            siteId,
            businessName: businessName || siteIdentity.businessName || 'Business',
            primaryColor,
            accentColor: siteIdentity.accentColor || primaryColor,
        };

        // 5. Generate widget code
        let widgetCode = '';
        switch (serviceId as MarketplaceServiceId) {
            case 'chatbot':
                widgetCode = generateChatbotWidget(widgetOptions);
                break;
            case 'booking':
                widgetCode = generateBookingWidget(widgetOptions);
                break;
            case 'simple-crm':
                widgetCode = generateCRMWidget(widgetOptions);
                break;
            case 'bundle':
                // For bundle, inject all three widgets
                widgetCode = generateChatbotWidget(widgetOptions) +
                    '\n' + generateBookingWidget(widgetOptions) +
                    '\n' + generateCRMWidget(widgetOptions);
                break;
        }

        // 6. Inject widget into HTML
        let updatedHtml = currentHtml;
        if (serviceId === 'bundle') {
            updatedHtml = injectWidgetIntoHtml(updatedHtml, generateChatbotWidget(widgetOptions), 'chatbot');
            updatedHtml = injectWidgetIntoHtml(updatedHtml, generateBookingWidget(widgetOptions), 'booking');
            updatedHtml = injectWidgetIntoHtml(updatedHtml, generateCRMWidget(widgetOptions), 'simple-crm');
        } else {
            updatedHtml = injectWidgetIntoHtml(updatedHtml, widgetCode, serviceId as 'chatbot' | 'booking' | 'simple-crm');
        }

        // 7. Create marketplace subscription record
        await db.collection('marketplace_subscriptions').doc(`${siteId}_${serviceId}`).set({
            siteId,
            leadId,
            userId,
            serviceId,
            stripeSubscriptionId: subscription.id,
            status: 'active',
            currentPeriodStart: new Date((subscription as any).current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
            cancelAtPeriodEnd: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 8. Create service config (chatbot/booking/crm)
        await seedServiceConfig(siteId, userId, serviceId as MarketplaceServiceId, siteIdentity);

        // 9. Update order status
        await db.collection('marketplace_orders').doc(orderId).update({
            status: 'deployed',
            deployedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 10. Update lead with deployed HTML and service info
        await leadDoc.ref.update({
            'blueprint.html': updatedHtml,
            [`services.${serviceId}`]: {
                enabled: true,
                activatedAt: admin.firestore.FieldValue.serverTimestamp(),
                subscriptionId: subscription.id,
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 11. Clean up pending deployment
        if (pendingDeployDoc.exists) {
            await pendingDeployDoc.ref.delete();
        }

        console.log(`[MarketplaceWebhook] Successfully deployed ${serviceId} for order: ${orderId}`);
    } catch (error: any) {
        console.error('[MarketplaceWebhook] Error processing purchase:', error);

        // Update order status to failed
        await db.collection('marketplace_orders').doc(orderId).update({
            status: 'failed',
            error: error.message,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
}

/**
 * Seed service configuration based on business type
 */
async function seedServiceConfig(
    siteId: string,
    userId: string,
    serviceId: MarketplaceServiceId,
    siteIdentity: any
): Promise<void> {
    const businessName = siteIdentity.businessName || 'Business';
    const primaryColor = siteIdentity.primaryColors?.[0] || '#10b981';
    const services = siteIdentity.services || [];
    const businessHours = siteIdentity.businessHours || 'Mon-Fri 9am-5pm';

    switch (serviceId) {
        case 'chatbot':
            await db.collection('chatbotConfig').doc(siteId).set({
                siteId,
                userId,
                enabled: true,
                settings: {
                    welcomeMessage: `Hi! 👋 Welcome to ${businessName}. How can I help you today?`,
                    systemPrompt: `You are a helpful assistant for ${businessName}. Be friendly, concise, and helpful. Services offered: ${services.join(', ')}. Business hours: ${businessHours}.`,
                    primaryColor,
                    position: 'bottom-right',
                    collectEmail: true,
                },
                knowledgeBase: `Business: ${businessName}\nServices: ${services.join(', ')}\nHours: ${businessHours}`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            break;

        case 'booking':
            await db.collection('bookingConfig').doc(siteId).set({
                siteId,
                userId,
                enabled: true,
                settings: {
                    timezone: 'America/New_York',
                    bufferMinutes: 15,
                    minNoticeHours: 24,
                    maxAdvanceDays: 30,
                    confirmationEmail: true,
                    reminderEmail: true,
                },
                eventTypes: [
                    { id: 'consultation', name: 'Consultation', duration: 30, price: 0, isActive: true },
                    { id: 'service', name: 'Service Appointment', duration: 60, price: null, isActive: true },
                ],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            break;

        case 'simple-crm':
            await db.collection('crmConfig').doc(siteId).set({
                siteId,
                userId,
                enabled: true,
                settings: {
                    notifyOnSubmission: true,
                    notifyEmail: '',  // Will use user's email
                    autoResponse: true,
                    autoResponseMessage: `Thank you for contacting ${businessName}! We'll get back to you within 24 hours.`,
                },
                forms: [{
                    id: 'contact',
                    name: 'Contact Form',
                    isActive: true,
                }],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            break;

        case 'bundle':
            // Seed all three configs
            await seedServiceConfig(siteId, userId, 'chatbot', siteIdentity);
            await seedServiceConfig(siteId, userId, 'booking', siteIdentity);
            await seedServiceConfig(siteId, userId, 'simple-crm', siteIdentity);
            break;
    }
}

/**
 * Handle marketplace subscription cancellation
 */
async function handleMarketplaceCancellation(subscription: Stripe.Subscription): Promise<void> {
    const { siteId, serviceId, leadId } = subscription.metadata || {};

    if (!siteId || !serviceId) {
        console.log('[MarketplaceWebhook] Not a marketplace subscription, skipping');
        return;
    }

    console.log(`[MarketplaceWebhook] Processing cancellation for site: ${siteId}, service: ${serviceId}`);

    try {
        // 1. Update subscription status
        await db.collection('marketplace_subscriptions').doc(`${siteId}_${serviceId}`).update({
            status: 'cancelled',
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // 2. Disable service config
        const configCollection = serviceId === 'chatbot' ? 'chatbotConfig'
            : serviceId === 'booking' ? 'bookingConfig'
            : 'crmConfig';

        await db.collection(configCollection).doc(siteId).update({
            enabled: false,
            disabledAt: admin.firestore.FieldValue.serverTimestamp(),
            disabledReason: 'subscription_cancelled',
        });

        // 3. Remove widget from site HTML (optional - could leave it but disable backend)
        if (leadId) {
            const leadDoc = await db.collection('leads').doc(leadId).get();
            if (leadDoc.exists) {
                const lead = leadDoc.data();
                let html = lead?.blueprint?.html || '';

                if (html && serviceId !== 'bundle') {
                    html = removeWidgetFromHtml(html, serviceId as 'chatbot' | 'booking' | 'simple-crm');
                    await leadDoc.ref.update({
                        'blueprint.html': html,
                        [`services.${serviceId}.enabled`]: false,
                        [`services.${serviceId}.cancelledAt`]: admin.firestore.FieldValue.serverTimestamp(),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                }
            }
        }

        console.log(`[MarketplaceWebhook] Successfully cancelled ${serviceId} for site: ${siteId}`);
    } catch (error: any) {
        console.error('[MarketplaceWebhook] Error processing cancellation:', error);
    }
}

/**
 * Handle marketplace subscription renewal
 */
async function handleMarketplaceRenewal(subscription: Stripe.Subscription): Promise<void> {
    const { siteId, serviceId } = subscription.metadata || {};

    if (!siteId || !serviceId) {
        return;
    }

    console.log(`[MarketplaceWebhook] Processing renewal for site: ${siteId}, service: ${serviceId}`);

    try {
        // Update subscription period
        await db.collection('marketplace_subscriptions').doc(`${siteId}_${serviceId}`).update({
            currentPeriodStart: new Date((subscription as any).current_period_start * 1000).toISOString(),
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000).toISOString(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Reset monthly usage counters
        const period = new Date().toISOString().slice(0, 7); // "2025-02"
        await db.collection('service_usage').doc(`${siteId}_${serviceId}_${period}`).set({
            siteId,
            serviceId,
            period,
            usage: {
                messagesReceived: 0,
                messagesAI: 0,
                appointmentsBooked: 0,
                formsSubmitted: 0,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`[MarketplaceWebhook] Successfully renewed ${serviceId} for site: ${siteId}`);
    } catch (error: any) {
        console.error('[MarketplaceWebhook] Error processing renewal:', error);
    }
}

// ============================================
// CLOUD FUNCTIONS
// ============================================

/**
 * Initialize Stripe products and prices
 * Call this once to set up all products in Stripe
 */
export const initializeStripeProducts = onCall(
    {
        secrets: [stripeSecretKey],
        region: 'us-central1'
    },
    async (request: CallableRequest) => {
        // Verify caller is admin (optional - add your admin check here)
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        try {
            const result = await ensureStripeProducts();
            return {
                success: true,
                subscriptionPrices: result.subscriptionPrices,
                topupPrices: result.topupPrices
            };
        } catch (error: any) {
            console.error('Error initializing Stripe products:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);

/**
 * Create a checkout session for subscription or top-up
 */
export const createCheckoutSession = onCall(
    {
        secrets: [stripeSecretKey],
        region: 'us-central1'
    },
    async (request: CallableRequest<{
        priceType: 'subscription' | 'topup';
        planId?: string;
        packId?: string;
        successUrl?: string;
        cancelUrl?: string;
    }>) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { priceType, planId, packId, successUrl, cancelUrl } = request.data;
        const userId = request.auth.uid;
        const userEmail = request.auth.token.email || '';

        try {
            const stripe = getStripe();

            // Get or create Stripe customer
            const customerId = await getOrCreateStripeCustomer(userId, userEmail);

            let priceId: string | null = null;
            let mode: 'subscription' | 'payment' = 'subscription';

            if (priceType === 'subscription' && planId) {
                priceId = await getPriceId(planId);
                mode = 'subscription';
            } else if (priceType === 'topup' && packId) {
                priceId = await getPriceId(packId);
                mode = 'payment';
            }

            if (!priceId) {
                throw new HttpsError('not-found', 'Price not found for the specified plan or pack');
            }

            // Create checkout session
            const session = await stripe.checkout.sessions.create({
                customer: customerId,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1
                    }
                ],
                mode,
                success_url: successUrl || 'https://renovatemysite-app.web.app/settings?payment=success',
                cancel_url: cancelUrl || 'https://renovatemysite-app.web.app/settings?payment=cancelled',
                metadata: {
                    userId,
                    priceType,
                    planId: planId || '',
                    packId: packId || ''
                },
                subscription_data: mode === 'subscription' ? {
                    metadata: {
                        userId,
                        planId: planId || ''
                    }
                } : undefined
            });

            return {
                sessionId: session.id,
                url: session.url
            };
        } catch (error: any) {
            console.error('Error creating checkout session:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);

/**
 * Create a customer portal session for subscription management
 */
export const createCustomerPortalSession = onCall(
    {
        secrets: [stripeSecretKey],
        region: 'us-central1'
    },
    async (request: CallableRequest<{ returnUrl?: string }>) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userId = request.auth.uid;

        try {
            const stripe = getStripe();

            // Get customer ID from Firestore
            const customerDoc = await db.collection('customers').doc(userId).get();

            if (!customerDoc.exists || !customerDoc.data()?.stripeCustomerId) {
                throw new HttpsError('not-found', 'No Stripe customer found for this user');
            }

            const customerId = customerDoc.data()!.stripeCustomerId;

            // Create portal session
            const session = await stripe.billingPortal.sessions.create({
                customer: customerId,
                return_url: request.data.returnUrl || 'https://renovatemysite-app.web.app/settings'
            });

            return { url: session.url };
        } catch (error: any) {
            console.error('Error creating portal session:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);

/**
 * Get payment history for a user
 */
export const getPaymentHistory = onCall(
    {
        secrets: [stripeSecretKey],
        region: 'us-central1'
    },
    async (request: CallableRequest<{ limit?: number }>) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userId = request.auth.uid;
        const limit = request.data.limit || 20;

        try {
            // Get payments from Firestore
            const paymentsQuery = await db.collection('payments')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(limit)
                .get();

            const payments = paymentsQuery.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Get active subscription
            const subscriptionQuery = await db.collection('subscriptions')
                .where('userId', '==', userId)
                .where('status', 'in', ['active', 'trialing', 'past_due'])
                .limit(1)
                .get();

            const subscription = subscriptionQuery.empty
                ? null
                : { id: subscriptionQuery.docs[0].id, ...subscriptionQuery.docs[0].data() };

            return { payments, subscription };
        } catch (error: any) {
            console.error('Error getting payment history:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);

/**
 * Cancel subscription at period end
 */
export const cancelSubscription = onCall(
    {
        secrets: [stripeSecretKey],
        region: 'us-central1'
    },
    async (request: CallableRequest) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userId = request.auth.uid;

        try {
            const stripe = getStripe();

            // Get active subscription
            const subscriptionQuery = await db.collection('subscriptions')
                .where('userId', '==', userId)
                .where('status', 'in', ['active', 'trialing'])
                .limit(1)
                .get();

            if (subscriptionQuery.empty) {
                throw new HttpsError('not-found', 'No active subscription found');
            }

            const subscriptionDoc = subscriptionQuery.docs[0];
            const subscriptionData = subscriptionDoc.data();

            // Cancel at period end in Stripe
            const subscription = await stripe.subscriptions.update(subscriptionData.stripeSubscriptionId, {
                cancel_at_period_end: true
            });

            // Update Firestore
            await subscriptionDoc.ref.update({
                cancelAtPeriodEnd: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return {
                success: true,
                endsAt: new Date((subscription as any).current_period_end * 1000).toISOString()
            };
        } catch (error: any) {
            console.error('Error cancelling subscription:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);

/**
 * Resume a cancelled subscription
 */
export const resumeSubscription = onCall(
    {
        secrets: [stripeSecretKey],
        region: 'us-central1'
    },
    async (request: CallableRequest) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userId = request.auth.uid;

        try {
            const stripe = getStripe();

            // Get subscription that's set to cancel
            const subscriptionQuery = await db.collection('subscriptions')
                .where('userId', '==', userId)
                .where('cancelAtPeriodEnd', '==', true)
                .limit(1)
                .get();

            if (subscriptionQuery.empty) {
                throw new HttpsError('not-found', 'No subscription pending cancellation found');
            }

            const subscriptionDoc = subscriptionQuery.docs[0];
            const subscriptionData = subscriptionDoc.data();

            // Resume subscription in Stripe
            await stripe.subscriptions.update(subscriptionData.stripeSubscriptionId, {
                cancel_at_period_end: false
            });

            // Update Firestore
            await subscriptionDoc.ref.update({
                cancelAtPeriodEnd: false,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { success: true };
        } catch (error: any) {
            console.error('Error resuming subscription:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);

/**
 * Get current subscription status
 */
export const getSubscriptionStatus = onCall(
    {
        secrets: [stripeSecretKey],
        region: 'us-central1'
    },
    async (request: CallableRequest) => {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const userId = request.auth.uid;

        try {
            // Get active subscription
            const subscriptionQuery = await db.collection('subscriptions')
                .where('userId', '==', userId)
                .where('status', 'in', ['active', 'trialing', 'past_due'])
                .limit(1)
                .get();

            if (subscriptionQuery.empty) {
                return {
                    hasSubscription: false,
                    planId: 'free',
                    status: 'none'
                };
            }

            const subscriptionData = subscriptionQuery.docs[0].data();

            return {
                hasSubscription: true,
                planId: subscriptionData.planId,
                status: subscriptionData.status,
                currentPeriodEnd: subscriptionData.currentPeriodEnd,
                cancelAtPeriodEnd: subscriptionData.cancelAtPeriodEnd
            };
        } catch (error: any) {
            console.error('Error getting subscription status:', error);
            throw new HttpsError('internal', error.message);
        }
    }
);

/**
 * Stripe webhook handler
 */
export const stripeWebhook = onRequest(
    {
        secrets: [stripeSecretKey, stripeWebhookSecret],
        region: 'us-central1'
    },
    async (req, res) => {
        if (req.method !== 'POST') {
            res.status(405).send('Method Not Allowed');
            return;
        }

        const stripe = getStripe();
        const sig = req.headers['stripe-signature'];

        if (!sig) {
            res.status(400).send('Missing stripe-signature header');
            return;
        }

        let event: Stripe.Event;

        try {
            const webhookSecret = stripeWebhookSecret.value();
            event = stripe.webhooks.constructEvent(
                req.rawBody,
                sig,
                webhookSecret
            );
        } catch (err: any) {
            console.error('Webhook signature verification failed:', err.message);
            res.status(400).send(`Webhook Error: ${err.message}`);
            return;
        }

        console.log('Received Stripe event:', event.type, event.id);

        // Idempotency check - prevent duplicate processing
        if (await isEventProcessed(event.id)) {
            console.log('Event already processed, skipping:', event.id);
            res.status(200).json({ received: true, skipped: true });
            return;
        }

        try {
            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object as Stripe.Checkout.Session;
                    const userId = session.metadata?.userId;

                    if (!userId) {
                        console.error('No userId in session metadata');
                        break;
                    }

                    // Check if this is a marketplace purchase
                    if (session.metadata?.type === 'marketplace') {
                        console.log('[Webhook] Processing marketplace checkout');
                        const subscription = await stripe.subscriptions.retrieve(
                            session.subscription as string
                        );
                        await handleMarketplacePurchase(session, subscription);
                        break;
                    }

                    if (session.mode === 'subscription') {
                        // Subscription checkout completed
                        const subscription = await stripe.subscriptions.retrieve(
                            session.subscription as string
                        );
                        await updateSubscriptionInFirestore(userId, subscription);

                        const planId = session.metadata?.planId || 'starter';
                        const plan = getPlanDetails(planId);
                        await recordPayment(
                            userId,
                            { id: session.id, amount: session.amount_total || 0, currency: session.currency || 'usd' } as any,
                            'subscription',
                            `${plan?.name || planId} subscription activated`
                        );
                    } else if (session.mode === 'payment') {
                        // One-time payment (top-up) completed
                        const packId = session.metadata?.packId;
                        if (packId) {
                            const pack = getTopupPackDetails(packId);
                            if (pack) {
                                await addTokensToUser(userId, pack.tokens, pack.type);
                                await recordPayment(
                                    userId,
                                    { id: session.id, amount: session.amount_total || 0, currency: session.currency || 'usd' } as any,
                                    'topup',
                                    `Purchased ${pack.name}`,
                                    pack.tokens
                                );
                            }
                        }
                    }
                    break;
                }

                case 'invoice.paid': {
                    const invoice = event.data.object as Stripe.Invoice;
                    const subscriptionId = (invoice as any).subscription as string;

                    if (subscriptionId) {
                        // Get subscription and update
                        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                        const userId = subscription.metadata?.userId;

                        // Check if this is a marketplace subscription renewal
                        if (subscription.metadata?.type === 'marketplace' && invoice.billing_reason === 'subscription_cycle') {
                            console.log('[Webhook] Processing marketplace renewal');
                            await handleMarketplaceRenewal(subscription);
                        }

                        if (userId) {
                            await updateSubscriptionInFirestore(userId, subscription);

                            // For recurring payments (not the first one), refresh tokens
                            if (invoice.billing_reason === 'subscription_cycle' && !subscription.metadata?.type) {
                                const planId = subscription.metadata?.planId || subscription.items.data[0]?.price?.metadata?.plan_id;
                                const plan = getPlanDetails(planId || '');
                                if (plan) {
                                    const userQuery = await db.collection('users').where('ownerId', '==', userId).get();
                                    if (!userQuery.empty) {
                                        await userQuery.docs[0].ref.update({
                                            'stats.editTokensRemaining': plan.limits.editTokens,
                                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                                        });
                                    }
                                }
                            }

                            await recordPayment(userId, invoice, 'subscription', `Invoice paid - ${invoice.lines.data[0]?.description || 'Subscription'}`);
                        }
                    }
                    break;
                }

                case 'invoice.payment_failed': {
                    const invoice = event.data.object as Stripe.Invoice;
                    const subscriptionId = (invoice as any).subscription as string;

                    if (subscriptionId) {
                        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                        const userId = subscription.metadata?.userId;

                        if (userId) {
                            // Update subscription status
                            await db.collection('subscriptions').doc(subscriptionId).update({
                                status: 'past_due',
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            });

                            // Record failed payment
                            await db.collection('payments').add({
                                userId,
                                stripePaymentId: invoice.id,
                                type: 'subscription',
                                amount: (invoice.amount_due || 0) / 100,
                                currency: invoice.currency,
                                status: 'failed',
                                description: 'Payment failed - please update payment method',
                                createdAt: admin.firestore.FieldValue.serverTimestamp()
                            });

                            // TODO: Send notification email to user
                        }
                    }
                    break;
                }

                case 'customer.subscription.updated': {
                    const subscription = event.data.object as Stripe.Subscription;
                    const userId = subscription.metadata?.userId;

                    if (userId) {
                        await updateSubscriptionInFirestore(userId, subscription);
                    }
                    break;
                }

                case 'customer.subscription.deleted': {
                    const subscription = event.data.object as Stripe.Subscription;
                    const userId = subscription.metadata?.userId;

                    // Check if this is a marketplace subscription cancellation
                    if (subscription.metadata?.type === 'marketplace') {
                        console.log('[Webhook] Processing marketplace subscription deletion');
                        await handleMarketplaceCancellation(subscription);
                        break;
                    }

                    if (userId) {
                        // Update subscription status
                        await db.collection('subscriptions').doc(subscription.id).update({
                            status: 'canceled',
                            updatedAt: admin.firestore.FieldValue.serverTimestamp()
                        });

                        // Downgrade user to free plan
                        const userQuery = await db.collection('users').where('ownerId', '==', userId).get();
                        if (!userQuery.empty) {
                            const freePlan = PLATFORM_PLANS.free;
                            await userQuery.docs[0].ref.update({
                                planId: 'free',
                                'stats.editTokensRemaining': freePlan.limits.editTokens,
                                updatedAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                        }
                    }
                    break;
                }

                default:
                    console.log(`Unhandled event type: ${event.type}`);
            }

            // Mark event as processed after successful handling
            await markEventProcessed(event.id, event.type);

            res.status(200).json({ received: true });
        } catch (error: any) {
            console.error('Error processing webhook:', error);
            res.status(500).send(`Webhook Error: ${error.message}`);
        }
    }
);

/**
 * Get available plans and top-up packs with prices
 */
export const getAvailablePlans = onCall(
    {
        region: 'us-central1'
    },
    async () => {
        return {
            plans: Object.values(PLATFORM_PLANS),
            topupPacks: Object.values(TOPUP_PACKS)
        };
    }
);
