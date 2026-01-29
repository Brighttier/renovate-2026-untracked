
import React from 'react';
import { BusinessCategory, MarketplaceService, AdminTab, AIModel, APIScope, WebhookEventType, AuditAction, AuditResource } from './types';
import { Icons } from './components/Icons';

export const INFRA_COST_PER_SITE = 0.07; // Text + 4 Nano Banana Images
export const INFRA_COST_PER_EDIT = 0.005; // Text remixing cost

// Style presets for quick one-click styling
export const STYLE_PRESETS = [
  { id: 'modern', label: 'Modern', primaryColor: '#3B82F6', secondaryColor: '#1E40AF', font: 'Inter', tone: 'Professional' },
  { id: 'elegant', label: 'Elegant', primaryColor: '#D4AF37', secondaryColor: '#1a1a1a', font: 'Playfair Display', tone: 'Sophisticated' },
  { id: 'playful', label: 'Playful', primaryColor: '#F472B6', secondaryColor: '#A855F7', font: 'Poppins', tone: 'Friendly' },
  { id: 'corporate', label: 'Corporate', primaryColor: '#0F172A', secondaryColor: '#3B82F6', font: 'IBM Plex Sans', tone: 'Professional' },
  { id: 'minimal', label: 'Minimal', primaryColor: '#18181B', secondaryColor: '#71717A', font: 'Outfit', tone: 'Clean' },
  { id: 'bold', label: 'Bold', primaryColor: '#EF4444', secondaryColor: '#FBBF24', font: 'Bebas Neue', tone: 'Energetic' },
  { id: 'nature', label: 'Nature', primaryColor: '#9B8CF7', secondaryColor: '#8B5CF6', font: 'Nunito', tone: 'Organic' },
  { id: 'luxury', label: 'Luxury', primaryColor: '#1C1917', secondaryColor: '#A16207', font: 'Cormorant Garamond', tone: 'Premium' },
];

export const REFERRAL_REWARDS = {
  PER_INVITE: 20,
  MILESTONES: [
    { target: 5, reward: '1 Site Generation Credit', icon: <Icons.Folder size={16} /> },
    { target: 10, reward: 'Agency Partner Status + 100 Tokens', icon: <Icons.Rocket size={16} /> }
  ]
};

export const PLATFORM_PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    features: ['1 Site Generation', '5 Edit Tokens', '1 Custom Domain', 'Subdomain Hosting'],
    limits: { sites: 1, editTokens: 5, customDomains: 1 },
    isOneTime: true // Free plan cannot be renewed
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 49,
    features: ['10 Site Generations', '100 Edit Tokens', '3 Custom Domains'],
    limits: { sites: 10, editTokens: 100, customDomains: 3 }
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 149,
    features: ['50 Site Generations', '500 Edit Tokens', '15 Custom Domains'],
    limits: { sites: 50, editTokens: 500, customDomains: 15 }
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 399,
    features: ['Unlimited Generations', '2000 Edit Tokens', 'Unlimited Custom Domains'],
    limits: { sites: 500, editTokens: 2000, customDomains: 999 }
  }
];

export const TOPUP_PACKS = [
  { id: 'edit-50', name: '50 Edit Tokens', price: 10, icon: <Icons.Sparkles size={24} /> },
  { id: 'site-5', name: '5 Site Generations', price: 15, icon: <Icons.Folder size={24} /> }
];

export const INDUSTRY_DEFAULTS: Record<BusinessCategory, any> = {
  [BusinessCategory.DENTIST]: {
    color: '#0EA5E9',
    tone: 'Professional & Caring',
    services: ['Checkups', 'Whitening', 'Implants']
  },
  [BusinessCategory.RESTAURANT]: {
    color: '#F97316',
    tone: 'Warm & Inviting',
    services: ['Menu', 'Reservations', 'Catering']
  },
  [BusinessCategory.SALON]: {
    color: '#EC4899',
    tone: 'Trendy & Relaxing',
    services: ['Haircut', 'Coloring', 'Styling']
  },
  [BusinessCategory.GYM]: {
    color: '#22C55E',
    tone: 'Energetic & Powerful',
    services: ['Personal Training', 'Yoga', 'Cardio']
  },
  [BusinessCategory.PLUMBER]: {
    color: '#3B82F6',
    tone: 'Reliable & Expert',
    services: ['Leak Repair', 'Installation', 'Emergency']
  }
};

export const ICONS: Record<string, React.ReactNode> = {
  Dentist: <Icons.Dentist size={48} />,
  Restaurant: <Icons.Restaurant size={48} />,
  Salon: <Icons.Salon size={48} />,
  Gym: <Icons.Gym size={48} />,
  Plumber: <Icons.Plumber size={48} />
};

export const MARKETPLACE_SERVICES: MarketplaceService[] = [
  {
    id: 'chatbot',
    title: 'AI Support Agent',
    description: 'We build a custom AI chatbot that handles bookings and questions.',
    platformFee: 49,
    suggestedPrice: 199,
    deliveryTime: '2 Days',
    icon: 'Chatbot'
  },
    {
    id: 'booking',
    title: 'Advanced Booking',
    description: 'Professional calendar and scheduling system integration.',
    platformFee: 89,
    suggestedPrice: 299,
    deliveryTime: '3 Days',
    icon: 'Booking'
  },
  {
    id: 'simple-crm',
    title: 'Business Dashboard',
    description: 'A dedicated area for the owner to manage incoming leads.',
    platformFee: 59,
    suggestedPrice: 149,
    deliveryTime: '2 Days',
    icon: 'CRM'
  }
];

// ==========================================
// COMMAND CENTER CONSTANTS (Platform Admin)
// ==========================================

export const ADMIN_TABS: { id: AdminTab; label: string; description: string }[] = [
  { id: AdminTab.DASHBOARD, label: 'Dashboard', description: 'Platform overview and metrics' },
  { id: AdminTab.ACCOUNTS, label: 'Accounts', description: 'Manage user accounts' },
  { id: AdminTab.DOMAINS, label: 'Domains', description: 'Custom domain connections' },
  { id: AdminTab.AI_OPTIMIZATION, label: 'AI Optimization', description: 'Model settings and costs' },
  { id: AdminTab.SCALING, label: 'Scaling', description: 'Rate limits and caching' },
  { id: AdminTab.SECURITY, label: 'Security & Auth', description: 'Users and permissions' },
  { id: AdminTab.API_WEBHOOKS, label: 'API & Webhooks', description: 'Developer integrations' },
  { id: AdminTab.AUDIT_LOGS, label: 'Audit Logs', description: 'Activity history' },
  { id: AdminTab.BETA_ERRORS, label: 'Beta Feedback', description: 'Bug reports and feedback' },
  { id: AdminTab.SETTINGS, label: 'Settings', description: 'Platform configuration' }
];

export const AI_MODELS: AIModel[] = [
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    provider: 'google',
    capabilities: ['text', 'search'],
    costPerCall: 0.005,
    isDefault: true,
    isEnabled: true
  },
  {
    id: 'gemini-2.5-flash-image',
    name: 'Gemini 2.5 Flash Image',
    provider: 'google',
    capabilities: ['image'],
    costPerCall: 0.02,
    isDefault: true,
    isEnabled: true
  },
  {
    id: 'gemini-pro',
    name: 'Gemini Pro',
    provider: 'google',
    capabilities: ['text'],
    costPerCall: 0.01,
    isDefault: false,
    isEnabled: false
  }
];

export const DEFAULT_AI_CONFIG = {
  primaryTextModel: 'gemini-3-flash-preview',
  primaryImageModel: 'gemini-2.5-flash-image',
  temperature: 0.7,
  maxTokens: 4096,
  rateLimitPerMinute: 60,
  rateLimitPerUser: 100,
  enableSearchGrounding: true
};

export const API_SCOPE_LABELS: Record<APIScope, { label: string; description: string }> = {
  [APIScope.LEADS_READ]: { label: 'Read Leads', description: 'View lead information' },
  [APIScope.LEADS_WRITE]: { label: 'Write Leads', description: 'Create and update leads' },
  [APIScope.SITES_READ]: { label: 'Read Sites', description: 'View website blueprints' },
  [APIScope.SITES_WRITE]: { label: 'Write Sites', description: 'Generate and edit sites' },
  [APIScope.ANALYTICS_READ]: { label: 'Read Analytics', description: 'View usage statistics' },
  [APIScope.WEBHOOKS_MANAGE]: { label: 'Manage Webhooks', description: 'Configure webhooks' }
};

export const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, { label: string; description: string }> = {
  [WebhookEventType.LEAD_CREATED]: { label: 'Lead Created', description: 'When a new lead is added' },
  [WebhookEventType.LEAD_UPDATED]: { label: 'Lead Updated', description: 'When lead status changes' },
  [WebhookEventType.LEAD_DELETED]: { label: 'Lead Deleted', description: 'When a lead is removed' },
  [WebhookEventType.SITE_GENERATED]: { label: 'Site Generated', description: 'When AI creates a new site' },
  [WebhookEventType.SITE_EDITED]: { label: 'Site Edited', description: 'When a site is modified' },
  [WebhookEventType.SITE_PUBLISHED]: { label: 'Site Published', description: 'When a site goes live' },
  [WebhookEventType.PAYMENT_RECEIVED]: { label: 'Payment Received', description: 'When payment is processed' },
  [WebhookEventType.USER_SUSPENDED]: { label: 'User Suspended', description: 'When account is suspended' }
};

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  [AuditAction.LOGIN]: 'Logged In',
  [AuditAction.LOGOUT]: 'Logged Out',
  [AuditAction.LOGIN_FAILED]: 'Login Failed',
  [AuditAction.CREATE]: 'Created',
  [AuditAction.READ]: 'Viewed',
  [AuditAction.UPDATE]: 'Updated',
  [AuditAction.DELETE]: 'Deleted',
  [AuditAction.SUSPEND]: 'Suspended',
  [AuditAction.ACTIVATE]: 'Activated',
  [AuditAction.IMPERSONATE]: 'Impersonated',
  [AuditAction.API_KEY_CREATED]: 'API Key Created',
  [AuditAction.API_KEY_REVOKED]: 'API Key Revoked',
  [AuditAction.WEBHOOK_TRIGGERED]: 'Webhook Triggered',
  [AuditAction.AI_GENERATION]: 'AI Generation',
  [AuditAction.AI_CONFIG_CHANGED]: 'AI Config Changed'
};

export const AUDIT_RESOURCE_LABELS: Record<AuditResource, string> = {
  [AuditResource.ADMIN]: 'Admin',
  [AuditResource.USER]: 'User',
  [AuditResource.LEAD]: 'Lead',
  [AuditResource.SITE]: 'Site',
  [AuditResource.API_KEY]: 'API Key',
  [AuditResource.WEBHOOK]: 'Webhook',
  [AuditResource.AI_CONFIG]: 'AI Config',
  [AuditResource.SETTINGS]: 'Settings'
};
