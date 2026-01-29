import { getFunctions, httpsCallable, HttpsCallable } from 'firebase/functions';
import { Subscription, Payment, PlatformPlan, TopupPack } from '../types';

// Lazy initialization of Firebase Functions
let functionsInstance: ReturnType<typeof getFunctions> | null = null;

const getFirebaseFunctions = () => {
    if (!functionsInstance) {
        functionsInstance = getFunctions();
    }
    return functionsInstance;
};

// Callable function getters (lazy initialized)
const getCallable = <T = unknown, R = unknown>(name: string): HttpsCallable<T, R> => {
    return httpsCallable<T, R>(getFirebaseFunctions(), name);
};

// Type definitions for function responses
interface CheckoutSessionResponse {
    sessionId: string;
    url: string | null;
}

interface CustomerPortalResponse {
    url: string;
}

interface PaymentHistoryResponse {
    payments: Payment[];
    subscription: Subscription | null;
}

interface CancelSubscriptionResponse {
    success: boolean;
    endsAt: string;
}

interface ResumeSubscriptionResponse {
    success: boolean;
}

interface SubscriptionStatusResponse {
    hasSubscription: boolean;
    planId: string;
    status: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
}

interface AvailablePlansResponse {
    plans: PlatformPlan[];
    topupPacks: TopupPack[];
}

interface InitializeProductsResponse {
    success: boolean;
    subscriptionPrices: Record<string, string>;
    topupPrices: Record<string, string>;
}

/**
 * Stripe Service - Frontend API for payment operations
 */
export const stripeService = {
    /**
     * Initialize Stripe products and prices (admin only)
     * Call this once to set up all products in Stripe
     */
    initializeProducts: async (): Promise<InitializeProductsResponse> => {
        const result = await getCallable<void, InitializeProductsResponse>('initializeStripeProducts')();
        return result.data;
    },

    /**
     * Create a checkout session for subscription upgrade
     * @param planId - The plan to subscribe to (starter, growth, enterprise)
     * @param successUrl - URL to redirect to after successful payment
     * @param cancelUrl - URL to redirect to if payment is cancelled
     */
    createSubscriptionCheckout: async (
        planId: string,
        successUrl?: string,
        cancelUrl?: string
    ): Promise<CheckoutSessionResponse> => {
        const result = await getCallable<{ priceType: string; planId: string; successUrl?: string; cancelUrl?: string }, CheckoutSessionResponse>('createCheckoutSession')({
            priceType: 'subscription',
            planId,
            successUrl,
            cancelUrl
        });
        return result.data;
    },

    /**
     * Create a checkout session for token top-up purchase
     * @param packId - The pack to purchase (edit-50, site-5)
     * @param successUrl - URL to redirect to after successful payment
     * @param cancelUrl - URL to redirect to if payment is cancelled
     */
    createTopupCheckout: async (
        packId: string,
        successUrl?: string,
        cancelUrl?: string
    ): Promise<CheckoutSessionResponse> => {
        const result = await getCallable<{ priceType: string; packId: string; successUrl?: string; cancelUrl?: string }, CheckoutSessionResponse>('createCheckoutSession')({
            priceType: 'topup',
            packId,
            successUrl,
            cancelUrl
        });
        return result.data;
    },

    /**
     * Open Stripe billing portal for subscription management
     * Redirects the user to Stripe's hosted portal
     * @param returnUrl - URL to return to after leaving the portal
     */
    openBillingPortal: async (returnUrl?: string): Promise<void> => {
        const result = await getCallable<{ returnUrl?: string }, CustomerPortalResponse>('createCustomerPortalSession')({ returnUrl });
        window.location.href = result.data.url;
    },

    /**
     * Get the billing portal URL without redirecting
     * @param returnUrl - URL to return to after leaving the portal
     */
    getBillingPortalUrl: async (returnUrl?: string): Promise<string> => {
        const result = await getCallable<{ returnUrl?: string }, CustomerPortalResponse>('createCustomerPortalSession')({ returnUrl });
        return result.data.url;
    },

    /**
     * Get payment history and current subscription for the user
     * @param limit - Maximum number of payments to return (default 20)
     */
    getPaymentHistory: async (limit?: number): Promise<PaymentHistoryResponse> => {
        const result = await getCallable<{ limit?: number }, PaymentHistoryResponse>('getPaymentHistory')({ limit });
        return result.data;
    },

    /**
     * Cancel the current subscription at the end of the billing period
     */
    cancelSubscription: async (): Promise<CancelSubscriptionResponse> => {
        const result = await getCallable<void, CancelSubscriptionResponse>('cancelSubscription')();
        return result.data;
    },

    /**
     * Resume a cancelled subscription (if still within billing period)
     */
    resumeSubscription: async (): Promise<ResumeSubscriptionResponse> => {
        const result = await getCallable<void, ResumeSubscriptionResponse>('resumeSubscription')();
        return result.data;
    },

    /**
     * Get current subscription status
     */
    getSubscriptionStatus: async (): Promise<SubscriptionStatusResponse> => {
        const result = await getCallable<void, SubscriptionStatusResponse>('getSubscriptionStatus')();
        return result.data;
    },

    /**
     * Get available plans and top-up packs with pricing
     */
    getAvailablePlans: async (): Promise<AvailablePlansResponse> => {
        const result = await getCallable<void, AvailablePlansResponse>('getAvailablePlans')();
        return result.data;
    },

    /**
     * Helper: Redirect to checkout
     * @param planId - Plan ID for subscription or pack ID for top-up
     * @param type - 'subscription' or 'topup'
     */
    redirectToCheckout: async (
        id: string,
        type: 'subscription' | 'topup'
    ): Promise<void> => {
        let response: CheckoutSessionResponse;

        if (type === 'subscription') {
            response = await stripeService.createSubscriptionCheckout(id);
        } else {
            response = await stripeService.createTopupCheckout(id);
        }

        if (response.url) {
            window.location.href = response.url;
        } else {
            throw new Error('No checkout URL returned');
        }
    },

    /**
     * Format currency for display
     */
    formatCurrency: (amount: number, currency: string = 'usd'): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency.toUpperCase()
        }).format(amount);
    },

    /**
     * Format date for display
     */
    formatDate: (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }
};

export default stripeService;
