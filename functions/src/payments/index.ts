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

                        if (userId) {
                            await updateSubscriptionInFirestore(userId, subscription);

                            // For recurring payments (not the first one), refresh tokens
                            if (invoice.billing_reason === 'subscription_cycle') {
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
