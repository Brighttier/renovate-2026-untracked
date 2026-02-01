/**
 * Marketplace Services Module
 * Handles checkout, subscription management, and widget deployment
 */

export {
  createMarketplaceCheckout,
  cancelMarketplaceService,
  reactivateMarketplaceService,
  getMarketplaceSubscriptions,
} from './checkout';

export {
  exportServiceData,
} from './export';

export {
  generateChatbotWidget,
  generateBookingWidget,
  generateCRMWidget,
  injectWidgetIntoHtml,
} from './widgetGenerators';

// Re-export types
export type {
  MarketplaceServiceId,
  MarketplaceOrder,
  MarketplaceSubscription,
  ServiceUsage,
} from '../../../types';
