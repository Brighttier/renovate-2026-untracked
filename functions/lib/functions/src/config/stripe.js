"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOPUP_PACKS = exports.PLATFORM_PLANS = exports.stripeWebhookSecret = exports.stripeSecretKey = void 0;
exports.getStripe = getStripe;
exports.ensureStripeProducts = ensureStripeProducts;
exports.getPriceId = getPriceId;
exports.getPlanDetails = getPlanDetails;
exports.getTopupPackDetails = getTopupPackDetails;
const stripe_1 = __importDefault(require("stripe"));
const params_1 = require("firebase-functions/params");
// Define secrets for Stripe
exports.stripeSecretKey = (0, params_1.defineSecret)('STRIPE_SECRET_KEY');
exports.stripeWebhookSecret = (0, params_1.defineSecret)('STRIPE_WEBHOOK_SECRET');
// Lazy-initialized Stripe client
let stripeClient = null;
function getStripe() {
    if (!stripeClient) {
        const secretKey = exports.stripeSecretKey.value();
        if (!secretKey) {
            throw new Error('STRIPE_SECRET_KEY is not configured');
        }
        stripeClient = new stripe_1.default(secretKey);
    }
    return stripeClient;
}
// Platform plan configurations
exports.PLATFORM_PLANS = {
    free: {
        id: 'free',
        name: 'Free Trial',
        price: 0,
        limits: { sites: 1, editTokens: 5 },
        isOneTime: true // Free plan cannot be renewed
    },
    starter: {
        id: 'starter',
        name: 'Starter',
        price: 49,
        limits: { sites: 10, editTokens: 100 }
    },
    growth: {
        id: 'growth',
        name: 'Growth',
        price: 149,
        limits: { sites: 50, editTokens: 500 }
    },
    enterprise: {
        id: 'enterprise',
        name: 'Enterprise',
        price: 399,
        limits: { sites: 500, editTokens: 2000 }
    }
};
// Top-up pack configurations
exports.TOPUP_PACKS = {
    'edit-50': {
        id: 'edit-50',
        name: '50 Edit Tokens',
        price: 10,
        tokens: 50,
        type: 'edit'
    },
    'site-5': {
        id: 'site-5',
        name: '5 Site Generations',
        price: 15,
        tokens: 5,
        type: 'site'
    }
};
// Cache for Stripe product/price IDs
let stripePriceCache = {};
/**
 * Get or create Stripe products and prices for all plans
 * This should be called once during initial setup or when prices change
 */
async function ensureStripeProducts() {
    const stripe = getStripe();
    const subscriptionPrices = {};
    const topupPrices = {};
    // Create subscription products/prices for paid plans
    for (const [planId, plan] of Object.entries(exports.PLATFORM_PLANS)) {
        if (plan.price === 0)
            continue; // Skip free plan
        // Search for existing product
        const existingProducts = await stripe.products.search({
            query: `metadata['plan_id']:'${planId}'`
        });
        let product;
        if (existingProducts.data.length > 0) {
            product = existingProducts.data[0];
        }
        else {
            // Create new product
            product = await stripe.products.create({
                name: `RenovateMySite - ${plan.name}`,
                description: `${plan.limits.sites} sites, ${plan.limits.editTokens} edit tokens/month`,
                metadata: {
                    plan_id: planId,
                    sites_limit: String(plan.limits.sites),
                    tokens_limit: String(plan.limits.editTokens)
                }
            });
        }
        // Search for existing price
        const existingPrices = await stripe.prices.list({
            product: product.id,
            active: true
        });
        let price;
        const matchingPrice = existingPrices.data.find(p => { var _a; return p.unit_amount === plan.price * 100 && ((_a = p.recurring) === null || _a === void 0 ? void 0 : _a.interval) === 'month'; });
        if (matchingPrice) {
            price = matchingPrice;
        }
        else {
            // Create new price
            price = await stripe.prices.create({
                product: product.id,
                unit_amount: plan.price * 100, // Convert to cents
                currency: 'usd',
                recurring: {
                    interval: 'month'
                },
                metadata: {
                    plan_id: planId
                }
            });
        }
        subscriptionPrices[planId] = price.id;
    }
    // Create top-up products/prices
    for (const [packId, pack] of Object.entries(exports.TOPUP_PACKS)) {
        // Search for existing product
        const existingProducts = await stripe.products.search({
            query: `metadata['pack_id']:'${packId}'`
        });
        let product;
        if (existingProducts.data.length > 0) {
            product = existingProducts.data[0];
        }
        else {
            // Create new product
            product = await stripe.products.create({
                name: `RenovateMySite - ${pack.name}`,
                description: `One-time purchase: ${pack.tokens} ${pack.type} ${pack.type === 'edit' ? 'tokens' : 'generations'}`,
                metadata: {
                    pack_id: packId,
                    token_type: pack.type,
                    token_amount: String(pack.tokens)
                }
            });
        }
        // Search for existing price
        const existingPrices = await stripe.prices.list({
            product: product.id,
            active: true
        });
        let price;
        const matchingPrice = existingPrices.data.find(p => p.unit_amount === pack.price * 100 && !p.recurring);
        if (matchingPrice) {
            price = matchingPrice;
        }
        else {
            // Create new price
            price = await stripe.prices.create({
                product: product.id,
                unit_amount: pack.price * 100, // Convert to cents
                currency: 'usd',
                metadata: {
                    pack_id: packId,
                    token_type: pack.type,
                    token_amount: String(pack.tokens)
                }
            });
        }
        topupPrices[packId] = price.id;
    }
    // Cache the prices
    stripePriceCache = { ...subscriptionPrices, ...topupPrices };
    return { subscriptionPrices, topupPrices };
}
/**
 * Get cached price ID or fetch from Stripe
 */
async function getPriceId(id) {
    if (stripePriceCache[id]) {
        return stripePriceCache[id];
    }
    // Fetch from Stripe if not cached
    const stripe = getStripe();
    // Try to find by plan_id or pack_id in metadata
    const prices = await stripe.prices.search({
        query: `metadata['plan_id']:'${id}' OR metadata['pack_id']:'${id}'`
    });
    if (prices.data.length > 0) {
        stripePriceCache[id] = prices.data[0].id;
        return prices.data[0].id;
    }
    return null;
}
/**
 * Get plan details from plan ID
 */
function getPlanDetails(planId) {
    return exports.PLATFORM_PLANS[planId] || null;
}
/**
 * Get top-up pack details from pack ID
 */
function getTopupPackDetails(packId) {
    return exports.TOPUP_PACKS[packId] || null;
}
//# sourceMappingURL=stripe.js.map