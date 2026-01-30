"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminTab = exports.AuditResource = exports.AuditAction = exports.WebhookEventType = exports.APIScope = exports.AccountStatus = exports.AdminRole = exports.ProposalChannel = exports.DEFAULT_TOTAL_CONTENT_CONFIG = exports.DEFAULT_MULTIMODAL_CONFIG = exports.WizardStep = exports.BusinessCategory = void 0;
var BusinessCategory;
(function (BusinessCategory) {
    BusinessCategory["DENTIST"] = "Dentist";
    BusinessCategory["RESTAURANT"] = "Restaurant";
    BusinessCategory["SALON"] = "Salon";
    BusinessCategory["GYM"] = "Gym";
    BusinessCategory["PLUMBER"] = "Plumber";
})(BusinessCategory || (exports.BusinessCategory = BusinessCategory = {}));
var WizardStep;
(function (WizardStep) {
    WizardStep[WizardStep["LANDING"] = 0] = "LANDING";
    WizardStep[WizardStep["CATEGORY"] = 1] = "CATEGORY";
    WizardStep[WizardStep["LOCATION"] = 2] = "LOCATION";
    WizardStep[WizardStep["SEARCHING"] = 3] = "SEARCHING";
    WizardStep[WizardStep["SELECT_BUSINESS"] = 4] = "SELECT_BUSINESS";
    WizardStep[WizardStep["AI_CREATING"] = 5] = "AI_CREATING";
    WizardStep[WizardStep["PREVIEW"] = 6] = "PREVIEW";
    WizardStep[WizardStep["PROMPT_LIBRARY"] = 7] = "PROMPT_LIBRARY";
    WizardStep[WizardStep["PREVIEW_DEPLOY"] = 8] = "PREVIEW_DEPLOY";
    WizardStep[WizardStep["PRICING_CONFIG"] = 9] = "PRICING_CONFIG";
    WizardStep[WizardStep["SEND_PROPOSAL"] = 10] = "SEND_PROPOSAL";
    WizardStep[WizardStep["SUCCESS"] = 11] = "SUCCESS";
    WizardStep[WizardStep["TRACK_STATUS"] = 12] = "TRACK_STATUS";
    WizardStep[WizardStep["MARKETPLACE"] = 13] = "MARKETPLACE";
    WizardStep[WizardStep["EARNINGS"] = 14] = "EARNINGS";
    WizardStep[WizardStep["EDIT_WEBSITE"] = 15] = "EDIT_WEBSITE";
    WizardStep[WizardStep["ADMIN"] = 16] = "ADMIN";
    WizardStep[WizardStep["SETTINGS"] = 17] = "SETTINGS";
    WizardStep[WizardStep["KNOWLEDGE_BASE"] = 18] = "KNOWLEDGE_BASE";
    WizardStep[WizardStep["HELP_SUPPORT"] = 19] = "HELP_SUPPORT";
    WizardStep[WizardStep["REFERRALS"] = 20] = "REFERRALS";
    WizardStep[WizardStep["DOMAIN_SETUP"] = 21] = "DOMAIN_SETUP";
    WizardStep[WizardStep["PRIVACY_POLICY"] = 22] = "PRIVACY_POLICY";
    WizardStep[WizardStep["TERMS_OF_SERVICE"] = 23] = "TERMS_OF_SERVICE";
})(WizardStep || (exports.WizardStep = WizardStep = {}));
// Default configuration for Deep-Multimodal Pipeline
exports.DEFAULT_MULTIMODAL_CONFIG = {
    maxPages: 12, // Increased for Total Content Modernization
    crawlTimeout: 180000, // 3 minutes for exhaustive crawl
    priorityPaths: ['/about', '/services', '/team', '/contact', '/testimonials', '/reviews', '/staff', '/our-team', '/faq', '/pricing', '/gallery', '/portfolio'],
    enableOCR: true,
    enableColorExtraction: true,
    maxImagesForVision: 25, // Increased for comprehensive analysis
    thinkingLevel: 'high',
    model: 'gemini-2.5-flash-preview-05-20',
    maxOutputTokens: 65536,
    placeholderPrefix: '[[ID_',
    placeholderSuffix: '_HERE]]',
    injectBase64: true,
};
exports.DEFAULT_TOTAL_CONTENT_CONFIG = {
    ...exports.DEFAULT_MULTIMODAL_CONFIG,
    maxPages: 12,
    followExternalLinks: false,
    extractBlogContent: true,
    analyzeAllImages: true,
    generateVibeDescriptions: true,
    deduplicateContent: true,
    mergeContactInfo: true,
    preserveAllContent: true,
    generateSectionSuggestions: true,
};
var ProposalChannel;
(function (ProposalChannel) {
    ProposalChannel["EMAIL"] = "email";
    ProposalChannel["LINK"] = "link";
})(ProposalChannel || (exports.ProposalChannel = ProposalChannel = {}));
// ==========================================
// COMMAND CENTER TYPES (Platform Admin)
// ==========================================
// Admin Role & User
var AdminRole;
(function (AdminRole) {
    AdminRole["SUPER_ADMIN"] = "super_admin";
    AdminRole["ADMIN"] = "admin";
    AdminRole["SUPPORT"] = "support";
})(AdminRole || (exports.AdminRole = AdminRole = {}));
// Platform Users (Accounts)
var AccountStatus;
(function (AccountStatus) {
    AccountStatus["ACTIVE"] = "active";
    AccountStatus["SUSPENDED"] = "suspended";
    AccountStatus["PENDING"] = "pending";
    AccountStatus["DELETED"] = "deleted";
})(AccountStatus || (exports.AccountStatus = AccountStatus = {}));
// API Keys
var APIScope;
(function (APIScope) {
    APIScope["LEADS_READ"] = "leads:read";
    APIScope["LEADS_WRITE"] = "leads:write";
    APIScope["SITES_READ"] = "sites:read";
    APIScope["SITES_WRITE"] = "sites:write";
    APIScope["ANALYTICS_READ"] = "analytics:read";
    APIScope["WEBHOOKS_MANAGE"] = "webhooks:manage";
})(APIScope || (exports.APIScope = APIScope = {}));
// Webhooks
var WebhookEventType;
(function (WebhookEventType) {
    WebhookEventType["LEAD_CREATED"] = "lead.created";
    WebhookEventType["LEAD_UPDATED"] = "lead.updated";
    WebhookEventType["LEAD_DELETED"] = "lead.deleted";
    WebhookEventType["SITE_GENERATED"] = "site.generated";
    WebhookEventType["SITE_EDITED"] = "site.edited";
    WebhookEventType["SITE_PUBLISHED"] = "site.published";
    WebhookEventType["PAYMENT_RECEIVED"] = "payment.received";
    WebhookEventType["USER_SUSPENDED"] = "user.suspended";
})(WebhookEventType || (exports.WebhookEventType = WebhookEventType = {}));
// Audit Logs
var AuditAction;
(function (AuditAction) {
    // Auth actions
    AuditAction["LOGIN"] = "login";
    AuditAction["LOGOUT"] = "logout";
    AuditAction["LOGIN_FAILED"] = "login_failed";
    // CRUD actions
    AuditAction["CREATE"] = "create";
    AuditAction["READ"] = "read";
    AuditAction["UPDATE"] = "update";
    AuditAction["DELETE"] = "delete";
    // Admin actions
    AuditAction["SUSPEND"] = "suspend";
    AuditAction["ACTIVATE"] = "activate";
    AuditAction["IMPERSONATE"] = "impersonate";
    // API actions
    AuditAction["API_KEY_CREATED"] = "api_key_created";
    AuditAction["API_KEY_REVOKED"] = "api_key_revoked";
    AuditAction["WEBHOOK_TRIGGERED"] = "webhook_triggered";
    // AI actions
    AuditAction["AI_GENERATION"] = "ai_generation";
    AuditAction["AI_CONFIG_CHANGED"] = "ai_config_changed";
})(AuditAction || (exports.AuditAction = AuditAction = {}));
var AuditResource;
(function (AuditResource) {
    AuditResource["ADMIN"] = "admin";
    AuditResource["USER"] = "user";
    AuditResource["LEAD"] = "lead";
    AuditResource["SITE"] = "site";
    AuditResource["API_KEY"] = "api_key";
    AuditResource["WEBHOOK"] = "webhook";
    AuditResource["AI_CONFIG"] = "ai_config";
    AuditResource["SETTINGS"] = "settings";
})(AuditResource || (exports.AuditResource = AuditResource = {}));
// Admin Tab Navigation
var AdminTab;
(function (AdminTab) {
    AdminTab["DASHBOARD"] = "dashboard";
    AdminTab["ACCOUNTS"] = "accounts";
    AdminTab["DOMAINS"] = "domains";
    AdminTab["AI_OPTIMIZATION"] = "ai_optimization";
    AdminTab["SCALING"] = "scaling";
    AdminTab["SECURITY"] = "security";
    AdminTab["API_WEBHOOKS"] = "api_webhooks";
    AdminTab["AUDIT_LOGS"] = "audit_logs";
    AdminTab["BETA_ERRORS"] = "beta_errors";
    AdminTab["SETTINGS"] = "settings";
})(AdminTab || (exports.AdminTab = AdminTab = {}));
//# sourceMappingURL=types.js.map