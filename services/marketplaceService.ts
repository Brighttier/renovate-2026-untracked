import { getFunctions, httpsCallable, HttpsCallable } from 'firebase/functions';
import type {
    MarketplaceServiceId,
    MarketplaceOrder,
    MarketplaceSubscription,
    ServiceUsage,
} from '../types';

// Lazy initialization of Firebase Functions
let functionsInstance: ReturnType<typeof getFunctions> | null = null;

const getFirebaseFunctions = () => {
    if (!functionsInstance) {
        functionsInstance = getFunctions();
    }
    return functionsInstance;
};

// Callable function getter (lazy initialized)
const getCallable = <T = unknown, R = unknown>(name: string): HttpsCallable<T, R> => {
    return httpsCallable<T, R>(getFirebaseFunctions(), name);
};

// Type definitions for function requests and responses
interface MarketplaceCheckoutRequest {
    serviceId: MarketplaceServiceId;
    leadId: string;
    siteId: string;
    businessName?: string;
    successUrl?: string;
    cancelUrl?: string;
}

interface MarketplaceCheckoutResponse {
    sessionId: string;
    url: string | null;
    orderId: string;
}

interface CancelServiceRequest {
    siteId: string;
    serviceId: MarketplaceServiceId;
    reason?: string;
}

interface CancelServiceResponse {
    success: boolean;
    effectiveDate: string;
    message: string;
}

interface ReactivateServiceRequest {
    siteId: string;
    serviceId: MarketplaceServiceId;
}

interface ReactivateServiceResponse {
    success: boolean;
    message: string;
}

interface GetSubscriptionsRequest {
    siteId?: string;
}

interface GetSubscriptionsResponse {
    subscriptions: (MarketplaceSubscription & { usage: ServiceUsage | null })[];
}

interface ExportDataRequest {
    siteId: string;
    serviceId: MarketplaceServiceId;
    dataTypes: string[];
    dateRange?: {
        start: string;
        end: string;
    };
    format: 'csv' | 'excel' | 'json';
}

interface ExportDataResponse {
    downloadUrl: string;
    filename: string;
    expiresIn: string;
}

/**
 * Marketplace Service - Frontend API for marketplace operations
 */
export const marketplaceService = {
    /**
     * Create a checkout session for a marketplace service
     * @param request - The checkout request with service and site details
     */
    createCheckout: async (request: MarketplaceCheckoutRequest): Promise<MarketplaceCheckoutResponse> => {
        const defaultSuccessUrl = `${window.location.origin}/marketplace?success=true`;
        const defaultCancelUrl = `${window.location.origin}/marketplace?cancelled=true`;

        const result = await getCallable<MarketplaceCheckoutRequest, MarketplaceCheckoutResponse>('createMarketplaceCheckout')({
            ...request,
            successUrl: request.successUrl || defaultSuccessUrl,
            cancelUrl: request.cancelUrl || defaultCancelUrl,
        });
        return result.data;
    },

    /**
     * Redirect to Stripe checkout for a marketplace service
     * @param request - The checkout request
     */
    redirectToCheckout: async (request: MarketplaceCheckoutRequest): Promise<void> => {
        const response = await marketplaceService.createCheckout(request);
        if (response.url) {
            window.location.href = response.url;
        } else {
            throw new Error('No checkout URL returned');
        }
    },

    /**
     * Get all marketplace subscriptions for the current user
     * @param siteId - Optional site ID to filter by
     */
    getSubscriptions: async (siteId?: string): Promise<GetSubscriptionsResponse> => {
        const result = await getCallable<GetSubscriptionsRequest, GetSubscriptionsResponse>('getMarketplaceSubscriptions')({
            siteId,
        });
        return result.data;
    },

    /**
     * Cancel a marketplace service subscription
     * Service continues until end of billing period
     * @param siteId - The site ID
     * @param serviceId - The service to cancel
     * @param reason - Optional cancellation reason
     */
    cancelService: async (
        siteId: string,
        serviceId: MarketplaceServiceId,
        reason?: string
    ): Promise<CancelServiceResponse> => {
        const result = await getCallable<CancelServiceRequest, CancelServiceResponse>('cancelMarketplaceService')({
            siteId,
            serviceId,
            reason,
        });
        return result.data;
    },

    /**
     * Reactivate a cancelled marketplace service (if still within billing period)
     * @param siteId - The site ID
     * @param serviceId - The service to reactivate
     */
    reactivateService: async (
        siteId: string,
        serviceId: MarketplaceServiceId
    ): Promise<ReactivateServiceResponse> => {
        const result = await getCallable<ReactivateServiceRequest, ReactivateServiceResponse>('reactivateMarketplaceService')({
            siteId,
            serviceId,
        });
        return result.data;
    },

    /**
     * Export service data (conversations, appointments, leads)
     * @param request - The export request with data types and format
     */
    exportData: async (request: ExportDataRequest): Promise<ExportDataResponse> => {
        const result = await getCallable<ExportDataRequest, ExportDataResponse>('exportServiceData')(request);
        return result.data;
    },

    /**
     * Download exported data by opening the download URL
     * @param request - The export request
     */
    downloadData: async (request: ExportDataRequest): Promise<void> => {
        const response = await marketplaceService.exportData(request);
        if (response.downloadUrl) {
            // Create a temporary link and trigger download
            const link = document.createElement('a');
            link.href = response.downloadUrl;
            link.download = response.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            throw new Error('No download URL returned');
        }
    },

    /**
     * Check if a service is active for a site
     * @param siteId - The site ID
     * @param serviceId - The service to check
     */
    isServiceActive: async (
        siteId: string,
        serviceId: MarketplaceServiceId
    ): Promise<boolean> => {
        const { subscriptions } = await marketplaceService.getSubscriptions(siteId);
        const subscription = subscriptions.find(
            (s) => s.serviceId === serviceId && s.status === 'active'
        );
        return !!subscription;
    },

    /**
     * Get usage for a specific service
     * @param siteId - The site ID
     * @param serviceId - The service to check
     */
    getServiceUsage: async (
        siteId: string,
        serviceId: MarketplaceServiceId
    ): Promise<ServiceUsage | null> => {
        const { subscriptions } = await marketplaceService.getSubscriptions(siteId);
        const subscription = subscriptions.find(
            (s) => s.serviceId === serviceId
        );
        return subscription?.usage || null;
    },

    /**
     * Get service status badge info
     */
    getStatusBadge: (subscription: MarketplaceSubscription): {
        label: string;
        color: string;
    } => {
        if (subscription.status === 'active' && subscription.cancelAtPeriodEnd) {
            return { label: 'Cancelling', color: 'orange' };
        }
        switch (subscription.status) {
            case 'active':
                return { label: 'Active', color: 'green' };
            case 'past_due':
                return { label: 'Past Due', color: 'red' };
            case 'cancelled':
                return { label: 'Cancelled', color: 'gray' };
            default:
                return { label: subscription.status, color: 'gray' };
        }
    },

    /**
     * Format usage display
     */
    formatUsage: (usage: ServiceUsage | null, serviceId: MarketplaceServiceId): string => {
        if (!usage) return 'No usage data';

        switch (serviceId) {
            case 'chatbot':
                return `${usage.usage?.messagesAI || 0} / 500 messages`;
            case 'booking':
                return `${usage.usage?.appointmentsBooked || 0} appointments`;
            case 'simple-crm':
                return `${usage.usage?.formsSubmitted || 0} submissions`;
            default:
                return 'Active';
        }
    },

    /**
     * Calculate usage percentage for progress bars
     */
    getUsagePercentage: (usage: ServiceUsage | null, serviceId: MarketplaceServiceId): number => {
        if (!usage) return 0;

        switch (serviceId) {
            case 'chatbot':
                return Math.min(((usage.usage?.messagesAI || 0) / 500) * 100, 100);
            default:
                return 0; // Unlimited services don't have a percentage
        }
    },

    /**
     * Get service display name
     */
    getServiceName: (serviceId: MarketplaceServiceId): string => {
        const names: Record<MarketplaceServiceId, string> = {
            chatbot: 'AI Chatbot',
            booking: 'Booking Calendar',
            'simple-crm': 'Lead Dashboard',
            bundle: 'Business Suite',
        };
        return names[serviceId] || serviceId;
    },

    /**
     * Get service icon name
     */
    getServiceIcon: (serviceId: MarketplaceServiceId): string => {
        const icons: Record<MarketplaceServiceId, string> = {
            chatbot: 'MessageCircle',
            booking: 'Calendar',
            'simple-crm': 'Users',
            bundle: 'Package',
        };
        return icons[serviceId] || 'Package';
    },
};

export default marketplaceService;
