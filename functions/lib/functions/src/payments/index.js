"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAvailablePlans = exports.stripeWebhook = exports.getSubscriptionStatus = exports.resumeSubscription = exports.cancelSubscription = exports.getPaymentHistory = exports.createCustomerPortalSession = exports.createCheckoutSession = exports.initializeStripeProducts = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const stripe_1 = require("../config/stripe");
const db = admin.firestore();
// ============================================
// IDEMPOTENCY HELPERS
// ============================================
/**
 * Check if a webhook event has already been processed
 * Prevents duplicate processing of the same event
 */
async function isEventProcessed(eventId) {
    const doc = await db.collection('processedWebhookEvents').doc(eventId).get();
    return doc.exists;
}
/**
 * Mark a webhook event as processed
 * Events are stored with a timestamp for cleanup
 */
async function markEventProcessed(eventId, eventType) {
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
async function getOrCreateStripeCustomer(userId, email) {
    const stripe = (0, stripe_1.getStripe)();
    // Check if customer exists in Firestore
    const customerDoc = await db.collection('customers').doc(userId).get();
    if (customerDoc.exists) {
        const data = customerDoc.data();
        if (data === null || data === void 0 ? void 0 : data.stripeCustomerId) {
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
async function updateSubscriptionInFirestore(userId, subscription) {
    var _a, _b, _c;
    const planId = ((_c = (_b = (_a = subscription.items.data[0]) === null || _a === void 0 ? void 0 : _a.price) === null || _b === void 0 ? void 0 : _b.metadata) === null || _c === void 0 ? void 0 : _c.plan_id) || 'free';
    await db.collection('subscriptions').doc(subscription.id).set({
        userId,
        stripeSubscriptionId: subscription.id,
        planId,
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
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
            const plan = (0, stripe_1.getPlanDetails)(planId);
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
async function recordPayment(userId, paymentIntent, type, description, tokensAdded) {
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
async function addTokensToUser(userId, tokens, tokenType) {
    const userQuery = await db.collection('users').where('ownerId', '==', userId).get();
    if (!userQuery.empty) {
        const userDoc = userQuery.docs[0];
        if (tokenType === 'edit') {
            await userDoc.ref.update({
                'stats.editTokensRemaining': admin.firestore.FieldValue.increment(tokens),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
        else {
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
exports.initializeStripeProducts = (0, https_1.onCall)({
    secrets: [stripe_1.stripeSecretKey],
    region: 'us-central1'
}, async (request) => {
    // Verify caller is admin (optional - add your admin check here)
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    try {
        const result = await (0, stripe_1.ensureStripeProducts)();
        return {
            success: true,
            subscriptionPrices: result.subscriptionPrices,
            topupPrices: result.topupPrices
        };
    }
    catch (error) {
        console.error('Error initializing Stripe products:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
/**
 * Create a checkout session for subscription or top-up
 */
exports.createCheckoutSession = (0, https_1.onCall)({
    secrets: [stripe_1.stripeSecretKey],
    region: 'us-central1'
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const { priceType, planId, packId, successUrl, cancelUrl } = request.data;
    const userId = request.auth.uid;
    const userEmail = request.auth.token.email || '';
    try {
        const stripe = (0, stripe_1.getStripe)();
        // Get or create Stripe customer
        const customerId = await getOrCreateStripeCustomer(userId, userEmail);
        let priceId = null;
        let mode = 'subscription';
        if (priceType === 'subscription' && planId) {
            priceId = await (0, stripe_1.getPriceId)(planId);
            mode = 'subscription';
        }
        else if (priceType === 'topup' && packId) {
            priceId = await (0, stripe_1.getPriceId)(packId);
            mode = 'payment';
        }
        if (!priceId) {
            throw new https_1.HttpsError('not-found', 'Price not found for the specified plan or pack');
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
    }
    catch (error) {
        console.error('Error creating checkout session:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
/**
 * Create a customer portal session for subscription management
 */
exports.createCustomerPortalSession = (0, https_1.onCall)({
    secrets: [stripe_1.stripeSecretKey],
    region: 'us-central1'
}, async (request) => {
    var _a;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userId = request.auth.uid;
    try {
        const stripe = (0, stripe_1.getStripe)();
        // Get customer ID from Firestore
        const customerDoc = await db.collection('customers').doc(userId).get();
        if (!customerDoc.exists || !((_a = customerDoc.data()) === null || _a === void 0 ? void 0 : _a.stripeCustomerId)) {
            throw new https_1.HttpsError('not-found', 'No Stripe customer found for this user');
        }
        const customerId = customerDoc.data().stripeCustomerId;
        // Create portal session
        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: request.data.returnUrl || 'https://renovatemysite-app.web.app/settings'
        });
        return { url: session.url };
    }
    catch (error) {
        console.error('Error creating portal session:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
/**
 * Get payment history for a user
 */
exports.getPaymentHistory = (0, https_1.onCall)({
    secrets: [stripe_1.stripeSecretKey],
    region: 'us-central1'
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
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
    }
    catch (error) {
        console.error('Error getting payment history:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
/**
 * Cancel subscription at period end
 */
exports.cancelSubscription = (0, https_1.onCall)({
    secrets: [stripe_1.stripeSecretKey],
    region: 'us-central1'
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userId = request.auth.uid;
    try {
        const stripe = (0, stripe_1.getStripe)();
        // Get active subscription
        const subscriptionQuery = await db.collection('subscriptions')
            .where('userId', '==', userId)
            .where('status', 'in', ['active', 'trialing'])
            .limit(1)
            .get();
        if (subscriptionQuery.empty) {
            throw new https_1.HttpsError('not-found', 'No active subscription found');
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
            endsAt: new Date(subscription.current_period_end * 1000).toISOString()
        };
    }
    catch (error) {
        console.error('Error cancelling subscription:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
/**
 * Resume a cancelled subscription
 */
exports.resumeSubscription = (0, https_1.onCall)({
    secrets: [stripe_1.stripeSecretKey],
    region: 'us-central1'
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const userId = request.auth.uid;
    try {
        const stripe = (0, stripe_1.getStripe)();
        // Get subscription that's set to cancel
        const subscriptionQuery = await db.collection('subscriptions')
            .where('userId', '==', userId)
            .where('cancelAtPeriodEnd', '==', true)
            .limit(1)
            .get();
        if (subscriptionQuery.empty) {
            throw new https_1.HttpsError('not-found', 'No subscription pending cancellation found');
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
    }
    catch (error) {
        console.error('Error resuming subscription:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
/**
 * Get current subscription status
 */
exports.getSubscriptionStatus = (0, https_1.onCall)({
    secrets: [stripe_1.stripeSecretKey],
    region: 'us-central1'
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', 'User must be authenticated');
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
    }
    catch (error) {
        console.error('Error getting subscription status:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
/**
 * Stripe webhook handler
 */
exports.stripeWebhook = (0, https_1.onRequest)({
    secrets: [stripe_1.stripeSecretKey, stripe_1.stripeWebhookSecret],
    region: 'us-central1'
}, async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }
    const stripe = (0, stripe_1.getStripe)();
    const sig = req.headers['stripe-signature'];
    if (!sig) {
        res.status(400).send('Missing stripe-signature header');
        return;
    }
    let event;
    try {
        const webhookSecret = stripe_1.stripeWebhookSecret.value();
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    }
    catch (err) {
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
                const session = event.data.object;
                const userId = (_a = session.metadata) === null || _a === void 0 ? void 0 : _a.userId;
                if (!userId) {
                    console.error('No userId in session metadata');
                    break;
                }
                if (session.mode === 'subscription') {
                    // Subscription checkout completed
                    const subscription = await stripe.subscriptions.retrieve(session.subscription);
                    await updateSubscriptionInFirestore(userId, subscription);
                    const planId = ((_b = session.metadata) === null || _b === void 0 ? void 0 : _b.planId) || 'starter';
                    const plan = (0, stripe_1.getPlanDetails)(planId);
                    await recordPayment(userId, { id: session.id, amount: session.amount_total || 0, currency: session.currency || 'usd' }, 'subscription', `${(plan === null || plan === void 0 ? void 0 : plan.name) || planId} subscription activated`);
                }
                else if (session.mode === 'payment') {
                    // One-time payment (top-up) completed
                    const packId = (_c = session.metadata) === null || _c === void 0 ? void 0 : _c.packId;
                    if (packId) {
                        const pack = (0, stripe_1.getTopupPackDetails)(packId);
                        if (pack) {
                            await addTokensToUser(userId, pack.tokens, pack.type);
                            await recordPayment(userId, { id: session.id, amount: session.amount_total || 0, currency: session.currency || 'usd' }, 'topup', `Purchased ${pack.name}`, pack.tokens);
                        }
                    }
                }
                break;
            }
            case 'invoice.paid': {
                const invoice = event.data.object;
                const subscriptionId = invoice.subscription;
                if (subscriptionId) {
                    // Get subscription and update
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    const userId = (_d = subscription.metadata) === null || _d === void 0 ? void 0 : _d.userId;
                    if (userId) {
                        await updateSubscriptionInFirestore(userId, subscription);
                        // For recurring payments (not the first one), refresh tokens
                        if (invoice.billing_reason === 'subscription_cycle') {
                            const planId = ((_e = subscription.metadata) === null || _e === void 0 ? void 0 : _e.planId) || ((_h = (_g = (_f = subscription.items.data[0]) === null || _f === void 0 ? void 0 : _f.price) === null || _g === void 0 ? void 0 : _g.metadata) === null || _h === void 0 ? void 0 : _h.plan_id);
                            const plan = (0, stripe_1.getPlanDetails)(planId || '');
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
                        await recordPayment(userId, invoice, 'subscription', `Invoice paid - ${((_j = invoice.lines.data[0]) === null || _j === void 0 ? void 0 : _j.description) || 'Subscription'}`);
                    }
                }
                break;
            }
            case 'invoice.payment_failed': {
                const invoice = event.data.object;
                const subscriptionId = invoice.subscription;
                if (subscriptionId) {
                    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
                    const userId = (_k = subscription.metadata) === null || _k === void 0 ? void 0 : _k.userId;
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
                const subscription = event.data.object;
                const userId = (_l = subscription.metadata) === null || _l === void 0 ? void 0 : _l.userId;
                if (userId) {
                    await updateSubscriptionInFirestore(userId, subscription);
                }
                break;
            }
            case 'customer.subscription.deleted': {
                const subscription = event.data.object;
                const userId = (_m = subscription.metadata) === null || _m === void 0 ? void 0 : _m.userId;
                if (userId) {
                    // Update subscription status
                    await db.collection('subscriptions').doc(subscription.id).update({
                        status: 'canceled',
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                    // Downgrade user to free plan
                    const userQuery = await db.collection('users').where('ownerId', '==', userId).get();
                    if (!userQuery.empty) {
                        const freePlan = stripe_1.PLATFORM_PLANS.free;
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
    }
    catch (error) {
        console.error('Error processing webhook:', error);
        res.status(500).send(`Webhook Error: ${error.message}`);
    }
});
/**
 * Get available plans and top-up packs with prices
 */
exports.getAvailablePlans = (0, https_1.onCall)({
    region: 'us-central1'
}, async () => {
    return {
        plans: Object.values(stripe_1.PLATFORM_PLANS),
        topupPacks: Object.values(stripe_1.TOPUP_PACKS)
    };
});
//# sourceMappingURL=index.js.map