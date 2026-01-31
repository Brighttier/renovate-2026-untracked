
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { WizardStep, BusinessCategory, Business, WebsiteBlueprint, Lead, LeadStatus, MarketplaceService, HostingConfig, AdminTab, PreviewDeployment, AIEditorMessage, AIEditorVersion, AIDeploymentStatus, AIEditorMessageAttachment } from './types';
import { ICONS, MARKETPLACE_SERVICES, PLATFORM_PLANS, TOPUP_PACKS, INFRA_COST_PER_SITE, INFRA_COST_PER_EDIT, REFERRAL_REWARDS, STYLE_PRESETS } from './constants';
import StepIndicator from './components/StepIndicator';
import WebsiteRenderer from './components/WebsiteRenderer';
import CodePreview from './components/CodePreview';
import { findLeadsWithMaps, FinalLead, generateWebsiteBlueprint, editWebsite, generateImage, injectPlugin, generateProposalEmail, editSiteHTML, modernizeSite } from './services/geminiService';
import { Icons } from './components/Icons';
import { AdminProvider, useAdmin } from './contexts/AdminContext';
import { AdminLayout, AdminDashboard, AdminAccounts, AdminAIOptimization, AdminSecurity, AdminAPIWebhooks, AdminAuditLogs, AdminBetaErrors, AdminSettings } from './components/admin';
import BetaFeedbackWidget from './components/BetaFeedbackWidget';
import { getManualDNSRecords } from './services/domainService';
import { generateConnectUrl, generateGoDaddyDNSUrl, getFirebaseDNSRecords, parseDomain, handleCallback } from './services/domainConnectService';
import { useTheme } from './contexts/ThemeContext';
import LandingPage from './components/LandingPage';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfService from './components/TermsOfService';
import { deployPreview, deployHTMLPreview, formatExpirationDate, getDaysRemaining, getPreviewDeployment, isPreviewExpired } from './services/previewDeployService';
import { adminSignIn, adminSignUp, adminSignInWithGoogle } from './services/firebase';
import UsageLimitModal from './components/billing/UsageLimitModal';
import AISandbox from './components/AISandbox';
import AIChatPanel from './components/AIChatPanel';
import { VibeEditorUI } from './components/VibeEditorUI';
import { stripeService } from './services/stripeService';

const DEMO_LEADS: Lead[] = [
  {
    id: 'demo-1',
    business: { id: 'biz-1', name: 'Elite Dental Care', rating: 4.8, address: 'Austin, TX', websiteStatus: 'Outdated', websiteUrl: 'https://www.elitedentalaustin.com' },
    status: 'Paid',
    projectValue: 499,
    monthlyValue: 29,
    date: '2 days ago',
    requestedServices: ['chatbot'],
    hosting: {
      status: 'Live',
      subdomain: 'elite-dental-tx.renovatemysite.app',
      customDomain: 'elitedentalaustin.com',
      ssl: true,
      provider: 'Firebase'
    },
    blueprint: {
      brand: { primaryColor: '#10b981', secondaryColor: '#059669', fontFamily: 'Outfit', tone: 'Professional' },
      sections: [
        { id: 'h1', type: 'hero', title: 'Elite Dental', content: 'Premium care for your smile.', cta: 'Book Now', imagePrompt: 'Dental office interior luxury' }
      ],
      plugins: [
        { id: 'chatbot', config: { greeting: 'Welcome to Elite Dental. How can we help you smile today?' } }
      ]
    }
  }
];

const PROMPT_RECIPES = [
  {
    label: 'Visual Style',
    items: [
      { title: 'Dark Premium', icon: <Icons.Sparkles size={20} />, prompt: 'Make it a dark theme with charcoal background and gold accents' },
      { title: 'Ultra Minimalist', icon: <Icons.Folder size={20} />, prompt: 'Make the design extremely clean and high-fashion editorial' },
      { title: 'Luxury Boutique', icon: <Icons.Sparkles size={20} />, prompt: 'Apply a luxury boutique aesthetic with elegant serif fonts' }
    ]
  },
  {
    label: 'Structure',
    items: [
      { title: 'Add Navbar', icon: <Icons.Settings size={20} />, prompt: 'Add a modern fixed navigation bar with glass effect and links to all sections' },
      { title: 'Add Footer', icon: <Icons.Grid size={20} />, prompt: 'Add a detailed footer with 3 columns, social links, and newsletter signup' },
      { title: 'Testimonials', icon: <Icons.Users size={20} />, prompt: 'Add a testimonials section with 3 customer reviews and star ratings' },
      { title: 'Pricing Table', icon: <Icons.Analytics size={20} />, prompt: 'Add a 3-tier pricing table (Basic, Pro, Enterprise) with feature comparison' },
      { title: 'FAQ Section', icon: <Icons.Chatbot size={20} />, prompt: 'Add an FAQ section with 5 common questions and expandable answers' }
    ]
  },
  {
    label: 'Market Strategy',
    items: [
      { title: 'Expert Tone', icon: <Icons.CRM size={20} />, prompt: 'Make the tone authoritative and professional' },
      { title: 'Warm & Local', icon: <Icons.Booking size={20} />, prompt: 'Make it feel warm, inviting and neighborhood-focused' }
    ]
  }
];

// Admin Command Center Component
const AdminCommandCenter: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { activeTab } = useAdmin();

  const renderTabContent = () => {
    switch (activeTab) {
      case AdminTab.DASHBOARD:
        return <AdminDashboard />;
      case AdminTab.ACCOUNTS:
        return <AdminAccounts />;
      case AdminTab.AI_OPTIMIZATION:
        return <AdminAIOptimization />;
      case AdminTab.SECURITY:
        return <AdminSecurity />;
      case AdminTab.API_WEBHOOKS:
        return <AdminAPIWebhooks />;
      case AdminTab.AUDIT_LOGS:
        return <AdminAuditLogs />;
      case AdminTab.BETA_ERRORS:
        return <AdminBetaErrors />;
      case AdminTab.SETTINGS:
        return <AdminSettings />;
      default:
        return <AdminDashboard />;
    }
  };

  return (
    <AdminLayout onExit={onExit}>
      {renderTabContent()}
    </AdminLayout>
  );
};

const App: React.FC = () => {
  // Theme State
  const { theme, toggleTheme, isDark } = useTheme();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'waitlist'>('signup');
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);

  // Auth form state
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [hasAccess, setHasAccess] = useState(false);
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isWaitlisted, setIsWaitlisted] = useState(false);

  const [step, setStep] = useState<WizardStep>(WizardStep.LANDING);
  const [category, setCategory] = useState<string>('');
  const [customCategory, setCategoryCustom] = useState<string>('');
  const [location, setLocation] = useState('');
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);
  const [blueprint, setBlueprint] = useState<WebsiteBlueprint | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [leads, setLeads] = useState<Lead[]>(DEMO_LEADS);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [selectedMarketplaceLead, setSelectedMarketplaceLead] = useState<Lead | null>(null);
  const [isInjecting, setIsInjecting] = useState(false);
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [blueprintHistory, setBlueprintHistory] = useState<WebsiteBlueprint[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 means at latest
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [editPrompt, setEditPrompt] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isFullscreenPreview, setIsFullscreenPreview] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>(new Date().toLocaleTimeString());
  const [selectedKbTopic, setSelectedKbTopic] = useState<string | null>(null);

  const [referralCount, setReferralCount] = useState(2); // Demo count
  const [referredBy, setReferredBy] = useState<string | null>(null);

  const referralLink = useMemo(() => {
    const baseUrl = window.location.origin;
    const userId = authEmail ? btoa(authEmail).substring(0, 8) : 'guest';
    return `${baseUrl}?ref=${userId}`;
  }, [authEmail]);

  // Password Change State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [isCompactView, setIsCompactView] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [editorView, setEditorView] = useState<'preview' | 'code'>('preview');

  // New AI Editor State (Vibe Coder - HTML-based)
  const [useVibeEditor, setUseVibeEditor] = useState(true); // Toggle between old/new editor
  const [useNewVibeUI, setUseNewVibeUI] = useState(false); // Toggle for Phase 3 vibe editor UI (false = use legacy with preview)
  const [siteHTML, setSiteHTML] = useState<string>('');
  const [aiVersions, setAiVersions] = useState<AIEditorVersion[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const [aiChatMessages, setAiChatMessages] = useState<AIEditorMessage[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [aiDeploymentStatus, setAiDeploymentStatus] = useState<AIDeploymentStatus>({ step: 'idle' });

  const [userPlanId, setUserPlanId] = useState('free');
  const [availableEditTokens, setAvailableEditTokens] = useState(PLATFORM_PLANS[0].limits.editTokens);
  const [availableSiteGenerations, setAvailableSiteGenerations] = useState(PLATFORM_PLANS[0].limits.sites);
  const [totalEditsMade, setTotalEditsMade] = useState(0);
  const [totalSitesGenerated, setTotalSitesGenerated] = useState(0);
  const [setupFee, setSetupFee] = useState(499);
  const [monthlyFee, setMonthlyFee] = useState(29);

  // Usage Limit Modal State
  const [showUsageLimitModal, setShowUsageLimitModal] = useState(false);
  const [usageLimitType, setUsageLimitType] = useState<'edits' | 'sites'>('edits');
  const [subscriptionRenewalDate, setSubscriptionRenewalDate] = useState<string | undefined>(undefined);
  const [showLowTokensWarning, setShowLowTokensWarning] = useState(false);

  const activePlan = useMemo(() => PLATFORM_PLANS.find(p => p.id === userPlanId) || PLATFORM_PLANS[0], [userPlanId]);

  // Domain Connect State - Redesigned client-friendly flow
  const [domainInput, setDomainInput] = useState('');
  const [hostingMethod, setHostingMethod] = useState<'godaddy' | 'manual' | null>(null);
  const [dnsRecords, setDnsRecords] = useState<{ type: string; host: string; value: string; ttl: string }[]>([]);

  // New Domain Connection Flow State
  const [domainFlowStep, setDomainFlowStep] = useState<'initial' | 'collect-info' | 'who-connects' | 'user-connects' | 'client-handoff' | 'waiting' | 'success'>('initial');
  const [domainProvider, setDomainProvider] = useState<string>('');
  const [whoConnects, setWhoConnects] = useState<'user' | 'client' | 'unsure' | null>(null);
  const [clientEmail, setClientEmail] = useState('');
  const [domainConnectionStatus, setDomainConnectionStatus] = useState<'pending' | 'waiting' | 'connected'>('pending');

  // Preview Deployment State
  const [previewDeployment, setPreviewDeployment] = useState<PreviewDeployment | null>(null);
  const [isDeployingPreview, setIsDeployingPreview] = useState(false);
  const [previewDeployError, setPreviewDeployError] = useState<string | null>(null);

  // Preview Viewer State (for viewing shared preview links)
  const [isViewingPreview, setIsViewingPreview] = useState(false);
  const [previewViewerData, setPreviewViewerData] = useState<{
    blueprint: WebsiteBlueprint;
    businessName: string;
    expiresAt: string;
  } | null>(null);
  const [previewLoadError, setPreviewLoadError] = useState<string | null>(null);

  // Domain Connect State for Client Cards
  const [expandedDomainLeadId, setExpandedDomainLeadId] = useState<string | null>(null);
  const [cardDomainInput, setCardDomainInput] = useState('');
  const [showManualDNS, setShowManualDNS] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Check for preview URL parameter on load
  useEffect(() => {
    const checkPreviewParam = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const previewId = urlParams.get('preview');

      if (previewId) {
        setIsViewingPreview(true);
        try {
          const deployment = await getPreviewDeployment(previewId);
          if (!deployment) {
            setPreviewLoadError('Preview not found. It may have been deleted or the link is invalid.');
            return;
          }

          if (isPreviewExpired(deployment)) {
            setPreviewLoadError('This preview has expired. Please request a new preview link from the sender.');
            return;
          }

          setPreviewViewerData({
            blueprint: deployment.blueprint,
            businessName: deployment.businessName,
            expiresAt: deployment.expiresAt
          });
        } catch (error) {
          setPreviewLoadError('Failed to load preview. Please try again later.');
        }
      }

      // Check for referral code
      const refToken = urlParams.get('ref');
      if (refToken) {
        setReferredBy(refToken);
        localStorage.setItem('referredBy', refToken);
      }
    };

    checkPreviewParam();
  }, []);

  // Handle Domain Connect callback from GoDaddy
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const state = urlParams.get('state');

    // Check if this is a callback from GoDaddy Domain Connect
    if (state && window.location.pathname.includes('domain-callback')) {
      const result = handleCallback(urlParams);
      if (result.success) {
        alert(result.message);
        setStep(WizardStep.SUCCESS);
      } else {
        alert(result.message);
      }
      // Clean up URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Redirect authenticated users from landing to category
  useEffect(() => {
    if (isAuthenticated && step === WizardStep.LANDING) {
      setStep(WizardStep.CATEGORY);
    }
  }, [isAuthenticated, step]);

  const stats = useMemo(() => {
    // Filter out archived leads for all statistics
    const activeLeadsForStats = leads.filter(l => !l.archived);
    const revenue = activeLeadsForStats.filter(l => l.status === 'Paid').reduce((acc, curr) => acc + (curr.projectValue || 0), 0);
    const mrr = activeLeadsForStats.filter(l => l.status === 'Paid').reduce((acc, curr) => acc + (curr.monthlyValue || 0), 0);
    const siteGenCost = activeLeadsForStats.length * INFRA_COST_PER_SITE;
    const editCost = totalEditsMade * INFRA_COST_PER_EDIT;
    const totalInfraCost = siteGenCost + editCost;
    const netProfit = revenue - totalInfraCost;
    const margin = revenue > 0 ? (netProfit / revenue) * 100 : 100;

    return {
      revenue,
      mrr,
      totalInfraCost,
      netProfit,
      activeLeads: activeLeadsForStats.length,
      margin,
      siteGenCost,
      editCost
    };
  }, [leads, totalEditsMade]);

  const validateInviteCode = () => {
    if (inviteCode.toUpperCase() === 'ALPHA100') {
      setHasAccess(true);
    } else {
      alert("Invalid Invite Code. Please join the waitlist.");
    }
  };

  const handleJoinWaitlist = (e: React.FormEvent) => {
    e.preventDefault();
    if (waitlistEmail) {
      setIsWaitlisted(true);
    }
  };

  const nextStep = () => {
    setStep(prev => {
      if (prev === WizardStep.PREVIEW) return WizardStep.PROMPT_LIBRARY;
      return prev + 1;
    });
  };
  const prevStep = () => setStep(prev => Math.max(1, prev - 1));

  const revertToVersion = (index: number) => {
    if (index >= 0 && index < blueprintHistory.length) {
      const target = blueprintHistory[index];
      setBlueprint(target);
      setHistoryIndex(index);
      setLastSavedTime(new Date().toLocaleTimeString());
    }
  };

  // Get current position in history (accounting for -1 meaning "at end")
  const currentHistoryIndex = historyIndex === -1 ? blueprintHistory.length - 1 : historyIndex;
  const canUndo = blueprintHistory.length > 1 && currentHistoryIndex > 0;
  const canRedo = historyIndex !== -1 && historyIndex < blueprintHistory.length - 1;

  const handleUndo = () => {
    if (!canUndo) return;
    const newIndex = currentHistoryIndex - 1;
    setHistoryIndex(newIndex);
    setBlueprint(blueprintHistory[newIndex]);
    setLastSavedTime(new Date().toLocaleTimeString());
  };

  const handleRedo = () => {
    if (!canRedo) return;
    const newIndex = historyIndex + 1;
    if (newIndex === blueprintHistory.length - 1) {
      setHistoryIndex(-1); // Back to "at end"
    } else {
      setHistoryIndex(newIndex);
    }
    setBlueprint(blueprintHistory[newIndex]);
    setLastSavedTime(new Date().toLocaleTimeString());
  };

  const handleSearch = async () => {
    if (!category || !location) return;
    setStep(WizardStep.SEARCHING);
    try {
      // Use Google Places API for real business data
      const response = await findLeadsWithMaps(category, location);

      // Convert FinalLead[] to Business[] format
      // Include ALL businesses - we'll visually indicate which ones can use Site Modernization
      const results: Business[] = response.leads
        .map((lead: FinalLead) => ({
          id: lead.id,
          name: lead.businessName,
          rating: 0, // Rating requires additional API call
          address: lead.location,
          websiteStatus: lead.websiteStatus,
          phone: lead.phone || undefined,
          websiteUrl: lead.websiteUrl || undefined,
          googleMapsUrl: lead.mapsUrl
        }));

      // Log website URL availability for debugging
      const withWebsite = results.filter(b => b.websiteUrl).length;
      console.log(`[Search] Found ${results.length} businesses, ${withWebsite} with website URLs`);

      setBusinesses(results);

      // Show message if no results found
      if (results.length === 0) {
        console.log('No businesses found in this area');
      }

      setTimeout(() => setStep(WizardStep.SELECT_BUSINESS), 1500);
    } catch (e) {
      console.error('Search failed:', e);
      setStep(WizardStep.SELECT_BUSINESS);
    }
  };

  const handleCreateWebsite = async (biz: Business) => {
    // Check for site generation limits
    if (availableSiteGenerations <= 0) {
      setUsageLimitType('sites');
      setShowUsageLimitModal(true);
      return;
    }

    // Require a website URL for Site Modernization
    if (!biz.websiteUrl) {
      alert("This business doesn't have a website URL. Site Modernization requires an existing website to extract content from.");
      return;
    }

    setSelectedBusiness(biz);
    setStep(WizardStep.AI_CREATING);
    setIsGenerating(true);
    setGenerationProgress(5);

    try {
      // SITE MODERNIZATION: Extract real content with Vision API and create modern version
      console.log("Site Modernization: Extracting from", biz.websiteUrl);
      setGenerationProgress(10);

      const response = await modernizeSite({
        sourceUrl: biz.websiteUrl,
        businessName: biz.name,
        category: category || 'General',
        designStyle: 'auto',
        preserveColors: true
      });
      console.log("[App.tsx] HTML response length:", response.html?.length || 0);
      console.log("[App.tsx] HTML first 300 chars:", response.html?.substring(0, 300));
      console.log("[App.tsx] Pipeline version:", response.pipelineVersion);
      setGenerationProgress(80);

      const html = response.html;
      const thinking = response.thinking || `I've analyzed ${response.siteIdentity.businessName}'s existing website and created a modern version preserving their brand identity.\n\n**Extracted:**\n- Logo: ${response.siteIdentity.logoUrl ? '✓' : '✗'}\n- Colors: ${response.siteIdentity.primaryColors.join(', ')}\n- Services: ${response.siteIdentity.services.slice(0, 3).join(', ')}\n- Visual Vibe: ${response.siteIdentity.visualVibe?.slice(0, 100)}...`;

      // Validate HTML was generated - check for actual HTML content, not just CSS
      const hasVisibleContent = html?.includes('<section') || html?.includes('<div') || html?.includes('<nav');
      if (!html || html.length < 100 || !hasVisibleContent) {
        console.error("Invalid HTML response - missing visible content");
        console.error("[App.tsx] Full HTML for debugging:", html?.substring(0, 1000));
        alert("The AI generated an invalid website (no visible content). Please try again.");
        setStep(WizardStep.SELECT_BUSINESS);
        return;
      }

      // Create initial version for Vibe Editor
      const newVersionId = `v-${Date.now()}`;
      const newVersion: AIEditorVersion = {
        id: newVersionId,
        timestamp: Date.now(),
        prompt: `Modernized ${biz.name} from existing website`,
        code: html
      };

      // Set Vibe Editor state
      setSiteHTML(html);
      setAiVersions([newVersion]);
      setCurrentVersionId(newVersionId);

      // Add initial AI message to chat
      const aiMessage: AIEditorMessage = {
        role: 'model',
        content: thinking
          ? `<thought>${thinking}</thought>\n\nI've created a stunning modernized website for ${biz.name}! Click "Edit with AI" to customize colors, layout, and content.`
          : `I've created a stunning modernized website for ${biz.name}! Click "Edit with AI" to customize colors, layout, and content.`,
        timestamp: Date.now()
      };
      setAiChatMessages([aiMessage]);

      setGenerationProgress(100);
      setLastSavedTime(new Date().toLocaleTimeString());

      // Decrement site generation count on successful generation
      setAvailableSiteGenerations(s => s - 1);
      setTotalSitesGenerated(t => t + 1);

      // Go directly to AI Editor (PROMPT_LIBRARY triggers split view with Vibe Editor)
      setTimeout(() => setStep(WizardStep.PROMPT_LIBRARY), 500);
    } catch (e) {
      console.error("Creation error", e);
      alert("Something went wrong during generation.");
      setStep(WizardStep.SELECT_BUSINESS);
    } finally {
      setIsGenerating(false);
    }
  };

  const applyPrompt = async (prompt: string) => {
    if (!blueprint) {
      console.warn("applyPrompt: No blueprint available");
      return;
    }
    if (availableEditTokens <= 0) {
      setUsageLimitType('edits');
      setShowUsageLimitModal(true);
      return;
    }

    setIsGenerating(true);
    console.log('applyPrompt: Starting with prompt:', prompt);
    console.log('applyPrompt: Current blueprint brand:', JSON.stringify(blueprint.brand, null, 2));

    try {
      const instruction = attachments.length > 0
        ? `${prompt}. Please reference the visual styles provided in the uploaded theme references.`
        : prompt;

      const { updatedBlueprint } = await editWebsite(instruction, blueprint);

      console.log('applyPrompt: Received updatedBlueprint brand:', JSON.stringify(updatedBlueprint?.brand, null, 2));

      // Validate updatedBlueprint
      if (!updatedBlueprint || !updatedBlueprint.brand) {
        console.error('applyPrompt: Invalid updatedBlueprint received - missing brand');
        alert("⚠️ AI returned an invalid response. Please try again.");
        return;
      }

      // Use AI's sections if provided, preserving imageUrl from existing sections
      const sectionsWithPreservedData = (updatedBlueprint.sections || blueprint.sections).map((updatedSection, index) => {
        const existingSection = blueprint.sections.find(s => s.id === updatedSection.id) || blueprint.sections[index];
        return {
          ...updatedSection,
          // Preserve imageUrl from existing section if AI didn't provide one
          imageUrl: updatedSection.imageUrl || existingSection?.imageUrl,
        };
      });

      const finalBlueprint = {
        ...updatedBlueprint, // Apply all AI changes
        brand: updatedBlueprint.brand || blueprint.brand,
        sections: sectionsWithPreservedData,
        plugins: updatedBlueprint.plugins || blueprint.plugins
      };

      console.log('applyPrompt: Final blueprint brand:', JSON.stringify(finalBlueprint.brand, null, 2));

      setBlueprintHistory(prev => [...prev, finalBlueprint]);
      setBlueprint(finalBlueprint);
      setEditPrompt('');
      setLastSavedTime(new Date().toLocaleTimeString());

      setAvailableEditTokens(t => {
        const newTokens = t - 1;
        // Show warning when user reaches 2 edits remaining
        if (newTokens === 2) {
          setShowLowTokensWarning(true);
        }
        return newTokens;
      });
      setTotalEditsMade(e => e + 1);

      console.log('applyPrompt: Successfully applied changes');
      alert("✨ Custom instruction applied! Check the preview to see the changes.");
    } catch (error) {
      console.error("applyPrompt: AI editing failed:", error);
      alert("⚠️ AI was unable to process that request. Please try a different instruction or simpler wording.");
    } finally {
      setIsGenerating(false);
    }
  };

  // New Vibe Editor Handlers
  const handleVibeEditorSendMessage = async (text: string, attachments?: AIEditorMessageAttachment[]) => {
    if (!siteHTML && !selectedBusiness) return;
    if (availableEditTokens <= 0) {
      setUsageLimitType('edits');
      setShowUsageLimitModal(true);
      return;
    }

    // Add user message to chat (include attachment info if present)
    const userMessage: AIEditorMessage = {
      role: 'user',
      content: text,
      timestamp: Date.now(),
      attachments: attachments
    };
    setAiChatMessages(prev => [...prev, userMessage]);
    setIsGenerating(true);
    setGenerationProgress(0);

    try {
      // If no HTML yet, generate initial site via Site Modernization
      if (!siteHTML) {
        if (!selectedBusiness?.websiteUrl) {
          const aiMessage: AIEditorMessage = {
            role: 'model',
            content: "I need a website URL to modernize. Please select a business with an existing website.",
            timestamp: Date.now()
          };
          setAiChatMessages(prev => [...prev, aiMessage]);
          setIsGenerating(false);
          setGenerationProgress(0);
          return;
        }

        // Start progress animation for website generation
        setGenerationProgress(5);

        // Simulate progress steps while waiting for API
        const progressInterval = setInterval(() => {
          setGenerationProgress(prev => {
            if (prev < 20) return prev + 3;
            if (prev < 40) return prev + 2;
            if (prev < 70) return prev + 1;
            if (prev < 85) return prev + 0.5;
            return prev; // Stay at 85 until complete
          });
        }, 500);

        let response;
        try {
          response = await modernizeSite({
            sourceUrl: selectedBusiness.websiteUrl,
            businessName: selectedBusiness.name,
            category: category || 'General',
            designStyle: 'auto',
            preserveColors: true
          });
        } finally {
          clearInterval(progressInterval);
        }

        console.log("[App.tsx Vibe] HTML response length:", response.html?.length || 0);
        console.log("[App.tsx Vibe] HTML first 300 chars:", response.html?.substring(0, 300));
        console.log("[App.tsx Vibe] Pipeline version:", response.pipelineVersion);

        // Validate HTML has visible content
        const hasVisibleContent = response.html?.includes('<section') || response.html?.includes('<div') || response.html?.includes('<nav');
        if (!response.html || response.html.length < 100 || !hasVisibleContent) {
          console.error("[App.tsx Vibe] Invalid HTML - no visible content");
          const errorMessage: AIEditorMessage = {
            role: 'model',
            content: "Sorry, the AI generated an invalid website (no visible content). Please try again.",
            timestamp: Date.now()
          };
          setAiChatMessages(prev => [...prev, errorMessage]);
          setIsGenerating(false);
          setGenerationProgress(0);
          return;
        }

        // Complete progress
        setGenerationProgress(100);

        const newVersionId = `v-${Date.now()}`;
        const newVersion: AIEditorVersion = {
          id: newVersionId,
          timestamp: Date.now(),
          prompt: text,
          code: response.html
        };

        setSiteHTML(response.html);
        setAiVersions([newVersion]);
        setCurrentVersionId(newVersionId);

        // Add AI response message
        const thinking = response.thinking || `I've analyzed ${response.siteIdentity.businessName}'s existing website and created a modern version preserving their brand identity.`;
        const aiMessage: AIEditorMessage = {
          role: 'model',
          content: `<thought>${thinking}</thought>\n\nI've modernized your website! You can see the preview on the right. Let me know what changes you'd like to make.`,
          timestamp: Date.now()
        };
        setAiChatMessages(prev => [...prev, aiMessage]);
      } else {
        // Edit existing HTML - add progress animation
        setGenerationProgress(10);

        // Progress animation for edits (faster since edits are quicker)
        const editProgressInterval = setInterval(() => {
          setGenerationProgress(prev => {
            if (prev < 30) return prev + 5;
            if (prev < 60) return prev + 3;
            if (prev < 85) return prev + 1;
            return prev; // Stay at 85 until complete
          });
        }, 300);

        let response;
        try {
          response = await editSiteHTML(text, siteHTML, aiChatMessages, attachments);
        } finally {
          clearInterval(editProgressInterval);
        }

        // Complete progress
        setGenerationProgress(100);

        if (response.html) {
          const newVersionId = `v-${Date.now()}`;
          const newVersion: AIEditorVersion = {
            id: newVersionId,
            timestamp: Date.now(),
            prompt: text,
            code: response.html
          };

          setSiteHTML(response.html);
          setAiVersions(prev => [...prev, newVersion]);
          setCurrentVersionId(newVersionId);

          // Consume token
          setAvailableEditTokens(t => {
            const newTokens = t - 1;
            if (newTokens === 2) {
              setShowLowTokensWarning(true);
            }
            return newTokens;
          });
          setTotalEditsMade(e => e + 1);
        }

        // Add AI response message
        const aiMessage: AIEditorMessage = {
          role: 'model',
          content: response.thinking
            ? `<thought>${response.thinking}</thought>\n\n${response.text}`
            : response.text,
          timestamp: Date.now()
        };
        setAiChatMessages(prev => [...prev, aiMessage]);
      }
    } catch (error) {
      console.error("Vibe Editor error:", error);
      const errorMessage: AIEditorMessage = {
        role: 'model',
        content: "I encountered an error processing your request. Please try again with a simpler instruction.",
        timestamp: Date.now()
      };
      setAiChatMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsGenerating(false);
      // Reset progress after a short delay to show completion animation
      setTimeout(() => setGenerationProgress(0), 500);
    }
  };

  const handleVibeVersionRestore = (versionId: string) => {
    const version = aiVersions.find(v => v.id === versionId);
    if (version) {
      setSiteHTML(version.code);
      setCurrentVersionId(versionId);
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);

    // Add a message to indicate the generation was stopped
    const stoppedMessage: AIEditorMessage = {
      role: 'model',
      content: 'Generation stopped. You can try again with a different request.',
      timestamp: Date.now()
    };
    setAiChatMessages(prev => [...prev, stoppedMessage]);
  };

  const handleVibeElementSelect = (element: { tag: string; id?: string; className?: string }) => {
    // When user clicks an element in selection mode, suggest an edit
    const suggestion = `I noticed you selected a ${element.tag} element${element.className ? ` with class "${element.className}"` : ''}. What would you like to change about it?`;
    const aiMessage: AIEditorMessage = {
      role: 'model',
      content: suggestion,
      timestamp: Date.now()
    };
    setAiChatMessages(prev => [...prev, aiMessage]);
    setIsSelectionMode(false);
  };

  const handleOrderService = async (service: MarketplaceService) => {
    if (!selectedMarketplaceLead || !selectedMarketplaceLead.blueprint) return;

    setIsInjecting(true);
    try {
      const updatedBlueprint = await injectPlugin(service.id, selectedMarketplaceLead.blueprint);

      setLeads(prev => prev.map(l =>
        l.id === selectedMarketplaceLead.id
          ? { ...l, blueprint: updatedBlueprint, requestedServices: [...(l.requestedServices || []), service.id] }
          : l
      ));

      setSelectedMarketplaceLead({
        ...selectedMarketplaceLead,
        blueprint: updatedBlueprint,
        requestedServices: [...(selectedMarketplaceLead.requestedServices || []), service.id]
      });

      alert(`Success! '${service.title}' has been AI-configured and injected into the client's website.`);
    } catch (error) {
      console.error("Plugin injection failed:", error);
      alert("Failed to inject the service plugin.");
    } finally {
      setIsInjecting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleTopup = (packId: string) => {
    const pack = TOPUP_PACKS.find(p => p.id === packId);
    if (!pack) return;

    if (packId.includes('edit')) {
      setAvailableEditTokens(t => t + 50);
      alert("Success! 50 Edit Tokens added.");
    } else {
      alert("Success! 5 Site credits added.");
    }
  };

  const handlePlanChange = (planId: string) => {
    const plan = PLATFORM_PLANS.find(p => p.id === planId);
    if (!plan) return;
    setUserPlanId(planId);
    setAvailableEditTokens(plan.limits.editTokens);
    alert(`Upgraded to ${plan.name} Plan!`);
  };

  const handleFinishEditing = () => {
    if (editingLeadId && siteHTML) {
      // Editing existing lead - save HTML to lead
      setLeads(prev => prev.map(l => l.id === editingLeadId ? { ...l, siteHTML, blueprint: null } : l));
      setEditingLeadId(null);
      setSiteHTML('');
      setAiChatMessages([]);
      setAiVersions([]);
      setCurrentVersionId(null);
      setStep(WizardStep.TRACK_STATUS);
    } else if (editingLeadId && blueprint) {
      // Legacy: Editing existing lead with old blueprint
      setLeads(prev => prev.map(l => l.id === editingLeadId ? { ...l, blueprint } : l));
      setEditingLeadId(null);
      setBlueprint(null);
      setStep(WizardStep.TRACK_STATUS);
    } else {
      // Go to preview deploy step before pricing
      setStep(WizardStep.PREVIEW_DEPLOY);
    }
  };

  // Handle preview deployment
  const handleDeployPreview = async () => {
    if (!selectedBusiness) return;

    // Need either siteHTML (new Vibe Editor) or blueprint (legacy)
    if (!siteHTML && !blueprint) return;

    setIsDeployingPreview(true);
    setPreviewDeployError(null);

    try {
      let deployment;

      if (siteHTML) {
        // New Vibe Editor: Deploy HTML directly
        deployment = await deployHTMLPreview(
          selectedBusiness.name,
          selectedBusiness.id || `biz-${Date.now()}`,
          siteHTML
        );
      } else if (blueprint) {
        // Legacy: Deploy using blueprint
        deployment = await deployPreview(selectedBusiness, blueprint);
      } else {
        throw new Error('No content to deploy');
      }

      setPreviewDeployment({
        id: deployment.id,
        previewUrl: deployment.previewUrl,
        status: deployment.status,
        createdAt: deployment.createdAt,
        expiresAt: deployment.expiresAt
      });
    } catch (error: any) {
      setPreviewDeployError(error.message || 'Failed to deploy preview. Please try again.');
    } finally {
      setIsDeployingPreview(false);
    }
  };

  // Skip preview deployment and go directly to pricing
  const handleSkipPreviewDeploy = () => {
    setStep(WizardStep.PRICING_CONFIG);
  };

  // Continue from preview deploy to pricing
  const handleContinueFromPreview = () => {
    setStep(WizardStep.PRICING_CONFIG);
  };

  const handleSendProposal = async () => {
    if (!selectedBusiness) return;

    setIsGeneratingEmail(true);
    try {
      // Get preview URL
      const previewUrl = previewDeployment?.previewUrl || `https://renovatemysite-app.web.app/preview/${selectedBusiness.id}`;

      // Generate AI proposal email
      const proposalEmail = await generateProposalEmail(
        selectedBusiness.name,
        category,
        selectedBusiness.address,
        previewUrl,
        setupFee,
        monthlyFee
      );

      // Construct mailto link
      const toEmail = selectedBusiness.contactEmail || '';
      const subject = encodeURIComponent(proposalEmail.subject);
      const body = encodeURIComponent(proposalEmail.body);
      const mailtoUrl = `mailto:${toEmail}?subject=${subject}&body=${body}`;

      // Open email client
      window.location.href = mailtoUrl;

      // Create lead record
      const slug = selectedBusiness.name.toLowerCase().replace(/\s+/g, '-');
      const newLead: Lead = {
        id: Math.random().toString(36).substr(2, 9),
        business: selectedBusiness,
        status: 'Sent',
        blueprint: blueprint || undefined,
        projectValue: setupFee,
        monthlyValue: monthlyFee,
        date: 'Just now',
        requestedServices: [],
        hosting: {
          status: 'Pending',
          subdomain: `${slug}-${Math.floor(Math.random() * 1000)}.renovatemysite.app`,
          ssl: true,
          provider: 'Firebase'
        },
        previewDeployment: previewDeployment || undefined
      };
      setLeads([newLead, ...leads]);
      setStep(WizardStep.DOMAIN_SETUP);
    } catch (error) {
      console.error('Failed to generate proposal email:', error);
      alert('Failed to generate proposal email. Please try again.');
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const updateLeadStatus = (leadId: string, newStatus: LeadStatus) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
  };

  const handleDeleteLead = (leadId: string) => {
    if (window.confirm("Are you sure? This will wipe the business data, demo website, and hosting records from the platform permanently.")) {
      setLeads(prev => prev.filter(l => l.id !== leadId));
    }
  };

  const handleArchiveLead = (leadId: string) => {
    setLeads(prev => prev.map(l =>
      l.id === leadId
        ? { ...l, archived: true, archivedAt: new Date().toISOString() }
        : l
    ));
  };

  const handleUnarchiveLead = (leadId: string) => {
    setLeads(prev => prev.map(l =>
      l.id === leadId
        ? { ...l, archived: false, archivedAt: undefined }
        : l
    ));
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      window.location.reload();
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      alert("Please fill in all password fields.");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      alert("Password must be at least 8 characters long.");
      return;
    }

    setIsUpdatingPassword(true);
    // Simulate API call
    setTimeout(() => {
      alert("Password updated successfully!");
      setNewPassword('');
      setConfirmPassword('');
      setIsUpdatingPassword(false);
    }, 1500);
  };

  const copyReferral = () => {
    navigator.clipboard.writeText(referralLink);
    alert("Referral link copied to clipboard! Share it to earn tokens.");
  };

  // Handle category selection - show auth modal if not authenticated
  const handleCategorySelect = (selectedCategory: string) => {
    if (!isAuthenticated) {
      setPendingCategory(selectedCategory);
      setShowAuthModal(true);
    } else {
      // Check for available site generations
      if (availableSiteGenerations <= 0) {
        setUsageLimitType('sites');
        setShowUsageLimitModal(true);
        return;
      }
      setCategory(selectedCategory);
      nextStep();
    }
  };

  // Handle authentication
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    // Handle waitlist submission
    if (authMode === 'waitlist') {
      if (!authEmail) {
        alert("Please enter your email address.");
        return;
      }
      setIsAuthLoading(true);
      setTimeout(() => {
        setIsWaitlisted(true);
        setIsAuthLoading(false);
      }, 1000);
      return;
    }

    // Handle signup - requires invite code
    if (authMode === 'signup') {
      if (!inviteCode) {
        alert("Please enter your invite code.");
        return;
      }
      if (inviteCode.toUpperCase() !== 'ALPHA100') {
        alert("Invalid invite code. Please join the waitlist to get access.");
        setAuthMode('waitlist');
        return;
      }
    }

    if (!authEmail || !authPassword) {
      alert("Please enter email and password.");
      return;
    }

    setIsAuthLoading(true);

    try {
      // For login, validate credentials with Firebase Auth
      if (authMode === 'login') {
        await adminSignIn(authEmail, authPassword);
        console.log('Login successful');
      } else if (authMode === 'signup') {
        // For signup, create a new Firebase user
        await adminSignUp(authEmail, authPassword);
        console.log('Signup successful');
      }

      setIsAuthenticated(true);
      setShowAuthModal(false);
      setIsAuthLoading(false);

      // Reward for using a referral
      const savedRef = localStorage.getItem('referredBy');
      if (savedRef && authMode === 'signup') {
        alert("Referral Applied! You've earned 20 extra AI tokens.");
        setAvailableEditTokens(t => t + 20);
        localStorage.removeItem('referredBy');
      }

      // If user selected a category before auth, continue with it
      if (pendingCategory) {
        setCategory(pendingCategory);
        setPendingCategory(null);
        setStep(WizardStep.LOCATION);
      }
    } catch (error: any) {
      setIsAuthLoading(false);
      console.error('Auth error:', error);

      // Provide more specific error messages for development
      const errorCode = error?.code;
      const errorMessage = error?.message;

      if (errorCode === 'auth/user-not-found' || errorCode === 'auth/wrong-password' || errorCode === 'auth/invalid-credential') {
        alert("Email ID or Password does not match.");
      } else if (errorCode === 'auth/email-already-in-use') {
        alert("This email is already registered. Please try logging in instead.");
      } else if (errorCode === 'auth/weak-password') {
        alert("Password should be at least 6 characters.");
      } else if (errorCode === 'auth/invalid-email') {
        alert("Please enter a valid email address.");
      } else {
        // Fallback error message
        alert("Email ID or Password does not match.");
      }

      console.log('Error code:', errorCode);
      console.log('Error message:', errorMessage);
    }
  };

  const openAuthModal = (mode: 'login' | 'signup' | 'waitlist') => {
    setAuthMode(mode);
    setIsWaitlisted(false);
    setShowAuthModal(true);
  };

  /// HoneyBook signature easing: cubic-bezier(0.625, 0.05, 0, 1)
  // Step transitions: fade + subtle vertical slide
  const stepVariants: Variants = {
    initial: { opacity: 0, y: 12 },
    enter: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] } },
    exit: { opacity: 0, y: -8, transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] } }
  };

  const STATUSES: LeadStatus[] = ['Sent', 'Viewed', 'Interested', 'Approved', 'Paid'];
  const isSplitView = step === WizardStep.PROMPT_LIBRARY || step === WizardStep.EDIT_WEBSITE;

  // Auth Modal JSX (inlined to prevent re-creation on every render)
  const authModalContent = showAuthModal && (
    <AnimatePresence>
      {showAuthModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={() => setShowAuthModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white border border-[#9B8CF7]/20 rounded-[20px] p-8 shadow-xl"
          >
            <div className="text-center mb-6">
              <img src="/rms-final-logo.png" alt="RenovateMySite" className="h-24 w-24 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2 text-[#1E1B4B]">
                {authMode === 'login' ? 'Welcome Back' : authMode === 'signup' ? 'Get Started' : 'Join the Alpha 100'}
              </h2>
              <p className="text-[#6B7280] text-sm">
                {authMode === 'waitlist'
                  ? 'Limited to the first 100 agencies for premium support'
                  : pendingCategory
                    ? `Sign ${authMode === 'login' ? 'in' : 'up'} to build websites for ${pendingCategory} businesses`
                    : `${authMode === 'login' ? 'Sign in to' : 'Create an account to'} access the platform`
                }
              </p>
            </div>

            {/* Auth Mode Toggle - 3 tabs */}
            <div className="flex bg-[#F5F3FF] rounded-2xl p-1 mb-6">
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-3 rounded-xl text-xs font-medium transition-all ${authMode === 'login' ? 'bg-[#9B8CF7] text-white' : 'text-[#6B7280] hover:text-[#1E1B4B]'}`}
              >
                Login
              </button>
              <button
                onClick={() => setAuthMode('signup')}
                className={`flex-1 py-3 rounded-xl text-xs font-medium transition-all ${authMode === 'signup' ? 'bg-[#9B8CF7] text-white' : 'text-[#6B7280] hover:text-[#1E1B4B]'}`}
              >
                Sign Up
              </button>
              <button
                onClick={() => { setAuthMode('waitlist'); setIsWaitlisted(false); }}
                className={`flex-1 py-3 rounded-xl text-xs font-medium transition-all ${authMode === 'waitlist' ? 'bg-[#9B8CF7] text-white' : 'text-[#6B7280] hover:text-[#1E1B4B]'}`}
              >
                Waitlist
              </button>
            </div>

            {/* Waitlist Tab Content */}
            {authMode === 'waitlist' && !isWaitlisted && (
              <form onSubmit={handleAuth} className="space-y-4">
                <div className="p-4 bg-[#F5F3FF] border border-[#9B8CF7]/20 rounded-xl text-center mb-4">
                  <p className="text-sm font-black text-[#9B8CF7] font-medium mb-1">Private Beta</p>
                  <p className="text-xs text-[#6B7280]">We're limiting access to ensure platform stability and premium infrastructure quality.</p>
                </div>
                <input
                  type="email"
                  placeholder="Enter your email to join the queue"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full p-4 bg-[#F5F3FF] border border-[#9B8CF7]/20 rounded-xl text-sm text-[#1E1B4B] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#9B8CF7]/30 transition-all"
                />
                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full py-4 bg-[#9B8CF7] text-white font-semibold text-sm tracking-widest rounded-xl hover:bg-[#8B5CF6] transition-all disabled:opacity-50 shadow-lg shadow-[#9B8CF7]/20"
                >
                  {isAuthLoading ? 'Please wait...' : 'Join the Queue'}
                </button>
                <div className="flex justify-center gap-8 pt-4">
                  <div className="text-center">
                    <p className="text-xl font-bold text-[#1E1B4B]">82</p>
                    <p className="text-xs font-semibold text-[#6B7280] tracking-widest">Spots Left</p>
                  </div>
                  <div className="w-px h-10 bg-[#9B8CF7]/20" />
                  <div className="text-center">
                    <p className="text-xl font-bold text-[#1E1B4B]">100%</p>
                    <p className="text-xs font-semibold text-[#6B7280] tracking-widest">Uptime</p>
                  </div>
                </div>
              </form>
            )}

            {/* Waitlist Success */}
            {authMode === 'waitlist' && isWaitlisted && (
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center py-6"
              >
                <div className="w-16 h-16 bg-[#F5F3FF] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icons.Sparkles size={28} className="text-[#9B8CF7]" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-[#1E1B4B]">You're on the list!</h3>
                <p className="text-[#6B7280] text-xs mb-6">Position: #1,242 in queue</p>
                <div className="p-4 bg-[#F5F3FF] border border-[#9B8CF7]/20 rounded-xl">
                  <p className="text-xs font-black text-[#9B8CF7] font-medium mb-1">Founding Member Secret</p>
                  <p className="text-sm text-[#1E1B4B]">Try the code: <span className="font-bold text-[#9B8CF7]">ALPHA100</span></p>
                </div>
                <button
                  onClick={() => setAuthMode('signup')}
                  className="mt-4 text-sm font-black text-[#9B8CF7] font-medium hover:text-[#8B5CF6]"
                >
                  Have an invite code? Sign up →
                </button>
              </motion.div>
            )}

            {/* Login Tab Content */}
            {authMode === 'login' && (
              <form onSubmit={handleAuth} className="space-y-4">
                <input
                  type="email"
                  placeholder="Email address"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full p-4 bg-[#F5F3FF] border border-[#9B8CF7]/20 rounded-xl text-sm text-[#1E1B4B] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#9B8CF7]/30 transition-all"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full p-4 bg-[#F5F3FF] border border-[#9B8CF7]/20 rounded-xl text-sm text-[#1E1B4B] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#9B8CF7]/30 transition-all"
                />
                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full py-4 bg-[#9B8CF7] text-white font-semibold text-sm tracking-widest rounded-xl hover:bg-[#8B5CF6] transition-all disabled:opacity-50 shadow-lg shadow-[#9B8CF7]/20"
                >
                  {isAuthLoading ? 'Please wait...' : 'Sign In'}
                </button>
              </form>
            )}

            {/* Sign Up Tab Content (with invite code) */}
            {authMode === 'signup' && (
              <form onSubmit={handleAuth} className="space-y-4">
                <input
                  type="text"
                  placeholder="Invite Code (required)"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full p-4 bg-[#F5F3FF] border border-[#9B8CF7]/30 rounded-xl text-sm text-[#1E1B4B] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#9B8CF7]/30 transition-all text-center font-bold font-medium"
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  className="w-full p-4 bg-[#F5F3FF] border border-[#9B8CF7]/20 rounded-xl text-sm text-[#1E1B4B] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#9B8CF7]/30 transition-all"
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  className="w-full p-4 bg-[#F5F3FF] border border-[#9B8CF7]/20 rounded-xl text-sm text-[#1E1B4B] placeholder-[#9CA3AF] outline-none focus:ring-2 focus:ring-[#9B8CF7]/30 transition-all"
                />
                <button
                  type="submit"
                  disabled={isAuthLoading}
                  className="w-full py-4 bg-[#9B8CF7] text-white font-semibold text-sm tracking-widest rounded-xl hover:bg-[#8B5CF6] transition-all disabled:opacity-50 shadow-lg shadow-[#9B8CF7]/20"
                >
                  {isAuthLoading ? 'Please wait...' : 'Create Account'}
                </button>
                <p className="text-center text-sm text-[#6B7280]">
                  No invite code?{' '}
                  <button type="button" onClick={() => setAuthMode('waitlist')} className="text-[#9B8CF7] hover:text-[#8B5CF6] font-bold">
                    Join the waitlist
                  </button>
                </p>
              </form>
            )}

            {/* Google OAuth (not for waitlist) */}
            {authMode !== 'waitlist' && (
              <>
                <div className="flex items-center gap-4 my-6">
                  <div className="h-px bg-[#9B8CF7]/20 flex-1" />
                  <span className="text-xs font-semibold text-[#6B7280] tracking-widest">or</span>
                  <div className="h-px bg-[#9B8CF7]/20 flex-1" />
                </div>
                <button className="w-full py-4 bg-[#F5F3FF] text-[#1E1B4B] font-bold text-sm rounded-xl hover:bg-[#EDE9FE] transition-all flex items-center justify-center gap-3 border border-[#9B8CF7]/20">
                  <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                  Continue with Google
                </button>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // If viewing a shared preview, render the preview viewer instead of the main app
  if (isViewingPreview) {
    return (
      <div className="min-h-screen">
        {/* Preview Banner */}
        <div className="fixed top-0 left-0 right-0 bg-gradient-to-r from-amber-500 to-orange-500 text-white py-3 px-4 text-center z-50 shadow-lg">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-4 flex-wrap">
            <span className="font-semibold text-sm">
              ⚠️ This is a temporary preview
            </span>
            {previewViewerData && (
              <>
                <span className="text-xs opacity-80">|</span>
                <span className="text-xs opacity-90">
                  Expires: {formatExpirationDate(previewViewerData.expiresAt)} ({getDaysRemaining(previewViewerData.expiresAt)} days remaining)
                </span>
              </>
            )}
            <a
              href="https://renovatemysite.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline hover:no-underline opacity-90"
            >
              Powered by RenovateMySite
            </a>
          </div>
        </div>

        {/* Preview Content */}
        <div className="pt-12">
          {previewLoadError ? (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
              <div className="text-center p-12 max-w-md">
                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Icons.X size={48} className="text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 mb-4">Preview Unavailable</h1>
                <p className="text-slate-600 mb-8">{previewLoadError}</p>
                <a
                  href="https://renovatemysite.app"
                  className="inline-block px-8 py-3 bg-[#9B8CF7] text-white rounded-xl font-semibold hover:bg-[#9B8CF7] transition-colors"
                >
                  Visit RenovateMySite
                </a>
              </div>
            </div>
          ) : previewViewerData ? (
            <WebsiteRenderer blueprint={previewViewerData.blueprint} isPreview={false} />
          ) : (
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 border-4 border-[#9B8CF7] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-600 font-medium">Loading preview...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Auth Modal */}
      {authModalContent}

      {/* Usage Limit Modal */}
      <UsageLimitModal
        isOpen={showUsageLimitModal}
        onClose={() => setShowUsageLimitModal(false)}
        limitType={usageLimitType}
        currentPlanId={userPlanId}
        renewalDate={subscriptionRenewalDate}
        onNavigateToCredits={() => setStep(WizardStep.EARNINGS)}
      />

      {/* Low Tokens Warning Modal */}
      <AnimatePresence>
        {showLowTokensWarning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowLowTokensWarning(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white border border-[#9B8CF7]/20 rounded-[20px] w-full max-w-md overflow-hidden shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-[#9B8CF7]/10 bg-gradient-to-r from-[#FEF3C7] to-[#FDE68A]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/80 rounded-xl flex items-center justify-center">
                    <Icons.AlertCircle size={24} className="text-[#F59E0B]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#1E1B4B] headline-font">Running Low on Edits</h2>
                    <p className="text-sm text-[#6B7280]">You have 2 edit tokens remaining</p>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <p className="text-[#6B7280] text-sm">
                  {userPlanId === 'free'
                    ? "You're on the free trial which includes 5 one-time edit tokens. Once you run out, you'll need to purchase more or upgrade to continue editing."
                    : `Your ${activePlan.name} plan tokens will replenish on your next billing cycle. Need more edits now?`
                  }
                </p>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => {
                      setShowLowTokensWarning(false);
                      setStep(WizardStep.EARNINGS);
                    }}
                    className="w-full py-3 px-6 bg-[#9B8CF7] hover:bg-[#8B5CF6] text-white rounded-xl font-semibold text-sm transition-colors"
                  >
                    View Plans & Buy Tokens
                  </button>
                  <button
                    onClick={() => setShowLowTokensWarning(false)}
                    className="w-full py-3 px-6 bg-transparent border border-[#9B8CF7]/20 text-[#6B7280] rounded-xl font-medium text-sm hover:border-[#9B8CF7]/40 transition-colors"
                  >
                    Continue Editing
                  </button>
                </div>

                <p className="text-xs text-[#9CA3AF] text-center">
                  Upgrade your plan or buy tokens on the Credits page
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header - Hidden on landing page since LandingPage has its own nav */}
      {step !== WizardStep.LANDING && (
      <header
        className="h-20 flex items-center justify-between px-10 border-b backdrop-blur-2xl sticky top-0 z-50 bg-white/95"
        style={{ borderColor: 'rgba(155, 140, 247, 0.15)' }}
      >
        {/* Logo - Always visible */}
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => { setStep(isAuthenticated ? WizardStep.CATEGORY : WizardStep.LANDING); setBlueprint(null); setEditingLeadId(null); setSelectedKbTopic(null); }}>
          <img src="/rms-final-logo.png" alt="RenovateMySite" className="h-12 w-12 group-hover:scale-105 transition-transform" />
          <span className="font-semibold text-lg text-[#1E1B4B] tracking-tight headline-font">Renovate<span className="text-[#9B8CF7]">MySite</span></span>
        </div>

        {/* Right side - Conditional based on auth state */}
        {!isAuthenticated ? (
          /* Public Header - Login/Signup/Waitlist buttons */
          <div className="flex items-center gap-3">
            <button
              onClick={() => openAuthModal('login')}
              className="nav-link-reveal text-sm font-medium text-[#6B7280] hover:text-[#1E1B4B] transition-colors"
            >
              Login
            </button>
            <button
              onClick={() => openAuthModal('signup')}
              className="px-5 py-2.5 text-sm font-medium rounded-full border border-[#9B8CF7]/20 bg-white text-[#1E1B4B] hover:border-[#9B8CF7]/50 transition-all"
            >
              Sign Up
            </button>
            <button
              onClick={() => openAuthModal('waitlist')}
              className="hb-btn hb-btn-lavender px-6 py-2.5 text-sm"
            >
              <span>Join Waitlist</span>
            </button>
          </div>
        ) : (
          /* Authenticated Header - Full nav */
          <div className="flex items-center gap-8">
            <nav className="hidden md:flex items-center gap-2">
              <button data-tour="clients-nav" onClick={() => setStep(WizardStep.TRACK_STATUS)} className={`nav-link-reveal text-sm font-medium transition-colors ${step === WizardStep.TRACK_STATUS ? 'text-[#9B8CF7]' : 'text-[#6B7280] hover:text-[#1E1B4B]'}`}>My Clients</button>
              <button data-tour="marketplace-nav" onClick={() => { setSelectedMarketplaceLead(null); setStep(WizardStep.MARKETPLACE); }} className={`nav-link-reveal text-sm font-medium transition-colors ${step === WizardStep.MARKETPLACE ? 'text-[#9B8CF7]' : 'text-[#6B7280] hover:text-[#1E1B4B]'}`}>Marketplace</button>
              <button onClick={() => setStep(WizardStep.EARNINGS)} className={`nav-link-reveal text-sm font-medium transition-colors ${step === WizardStep.EARNINGS ? 'text-[#9B8CF7]' : 'text-[#6B7280] hover:text-[#1E1B4B]'}`}>Credits</button>
            </nav>

            <button
              onClick={() => setStep(WizardStep.REFERRALS)}
              className="hidden lg:flex items-center gap-3 px-4 py-2 rounded-full border border-[#9B8CF7]/20 bg-white hover:border-[#9B8CF7]/50 transition-all group"
            >
              <Icons.Rocket size={16} className="text-[#6B7280] group-hover:text-[#9B8CF7]" />
              <span className="text-sm font-medium text-[#6B7280] group-hover:text-[#9B8CF7]">Invite & Earn</span>
            </button>

            <div data-tour="credits-display" className="hidden lg:flex items-center gap-3 bg-[#F5F3FF] px-4 py-2 rounded-full border border-[#9B8CF7]/20">
              <Icons.Sparkles size={16} className="text-[#9B8CF7]" />
              <span className="text-sm font-medium text-[#9B8CF7]">{availableEditTokens} Edits Left</span>
            </div>

            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="w-10 h-10 rounded-full bg-[#F5F3FF] border border-[#9B8CF7]/20 flex items-center justify-center overflow-hidden hover:border-[#9B8CF7]/50 transition-all group"
              >
                <Icons.User size={20} className="text-[#9B8CF7] group-hover:text-[#8B5CF6] transition-colors" />
              </button>

              <AnimatePresence>
                {isUserMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-4 w-64 rounded-[20px] shadow-lg overflow-hidden z-50 p-2 bg-white border border-[#9B8CF7]/15"
                  >
                    <div className="px-4 py-3 mb-2 border-b border-[#9B8CF7]/10">
                      <p className="text-sm font-medium text-[#6B7280]">Signed in as</p>
                      <p className="text-xs font-bold truncate text-[#1E1B4B]">{authEmail || 'agency.owner@example.com'}</p>
                    </div>

                    <button onClick={() => { setStep(WizardStep.ADMIN); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#6B7280] hover:bg-[#F5F3FF] hover:text-[#9B8CF7] transition-all text-left">
                      <Icons.CRM size={16} />
                      <span className="text-sm font-medium">Command Center</span>
                    </button>

                    <div className="h-px my-2 bg-[#9B8CF7]/10" />

                    <button onClick={() => { setStep(WizardStep.SETTINGS); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#6B7280] hover:bg-[#F5F3FF] hover:text-[#9B8CF7] transition-all text-left">
                      <Icons.Settings size={16} />
                      <span className="text-sm font-medium">Account Settings</span>
                    </button>

                    <button onClick={() => { setStep(WizardStep.KNOWLEDGE_BASE); setIsUserMenuOpen(false); setSelectedKbTopic(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#6B7280] hover:bg-[#F5F3FF] hover:text-[#9B8CF7] transition-all text-left">
                      <Icons.Book size={16} />
                      <span className="text-sm font-medium">Knowledge Base</span>
                    </button>

                    <button data-tour="help-nav" onClick={() => { setStep(WizardStep.HELP_SUPPORT); setIsUserMenuOpen(false); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#6B7280] hover:bg-[#F5F3FF] hover:text-[#9B8CF7] transition-all text-left">
                      <Icons.Help size={16} />
                      <span className="text-sm font-medium">Help & Support</span>
                    </button>

                    <div className="h-px my-2 bg-[#9B8CF7]/10" />

                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[#6B7280] hover:bg-red-50 hover:text-red-500 transition-all text-left">
                      <Icons.Logout size={16} />
                      <span className="text-sm font-medium">Logout</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </header>
      )}

      <main className={`flex-1 flex flex-col items-center relative ${isSplitView || step === WizardStep.LANDING || step === WizardStep.PRIVACY_POLICY || step === WizardStep.TERMS_OF_SERVICE || step === WizardStep.ADMIN || step === WizardStep.SETTINGS || step === WizardStep.KNOWLEDGE_BASE || step === WizardStep.HELP_SUPPORT || step === WizardStep.REFERRALS ? 'p-0' : 'p-8 max-w-7xl mx-auto w-full'}`}>
        <div className="w-full h-full">
          <AnimatePresence mode="wait">
            <motion.div key={step} variants={stepVariants} initial="initial" animate="enter" exit="exit" className="w-full h-full">

              {/* Landing Page - Shown for unauthenticated users */}
              {step === WizardStep.LANDING && !isAuthenticated && (
                <LandingPage
                  onGetStarted={() => setStep(WizardStep.CATEGORY)}
                  onLogin={() => setShowAuthModal(true)}
                  onSignUp={() => { setAuthMode('signup'); setShowAuthModal(true); }}
                  onJoinWaitlist={() => { setAuthMode('waitlist'); setShowAuthModal(true); }}
                  onPrivacyPolicy={() => setStep(WizardStep.PRIVACY_POLICY)}
                  onTermsOfService={() => setStep(WizardStep.TERMS_OF_SERVICE)}
                />
              )}

              {/* Privacy Policy Page */}
              {step === WizardStep.PRIVACY_POLICY && (
                <PrivacyPolicy onBack={() => setStep(WizardStep.LANDING)} />
              )}

              {/* Terms of Service Page */}
              {step === WizardStep.TERMS_OF_SERVICE && (
                <TermsOfService onBack={() => setStep(WizardStep.LANDING)} />
              )}

              {step === WizardStep.CATEGORY && (
                <div className="text-center max-w-4xl mx-auto py-10 px-6">
                  <motion.h1
                    initial={{ opacity: 0, y: -30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="text-5xl md:text-7xl font-bold mb-6 tracking-tighter headline-font text-[#1E1B4B]"
                  >
                    Choose a Business to <br /><span className="headline-serif italic font-normal text-[#9B8CF7]">Build For</span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                    className="mb-12 text-lg font-light text-[#6B7280]"
                  >
                    Target local businesses with low-performing websites.
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    className="max-w-2xl mx-auto mb-16 relative"
                  >
                    <input
                      data-tour="category-select"
                      type="text"
                      placeholder="Enter any business type (e.g. Architect, HVAC, Bakery)..."
                      className="w-full p-8 rounded-[20px] text-xl outline-none focus:ring-4 focus:ring-[#9B8CF7]/20 transition-all text-center hb-card-shadow bg-white border border-[#9B8CF7]/15 text-[#1E1B4B] placeholder-[#9CA3AF]"
                      value={customCategory}
                      onChange={(e) => setCategoryCustom(e.target.value)}
                      onKeyPress={(e) => { if (e.key === 'Enter' && customCategory.trim()) { handleCategorySelect(customCategory.trim()); } }}
                    />
                    {customCategory.trim() && (
                      <motion.button initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} onClick={() => handleCategorySelect(customCategory.trim())} className="absolute right-4 top-1/2 -translate-y-1/2 hb-btn hb-btn-lavender font-semibold text-sm px-8 py-4"><span>Continue</span></motion.button>
                    )}
                  </motion.div>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-16">
                    {Object.entries(ICONS).map(([name, icon], index) => {
                      if (['Dentist', 'Restaurant', 'Salon', 'Gym', 'Plumber'].includes(name)) {
                        const categoryIndex = ['Dentist', 'Restaurant', 'Salon', 'Gym', 'Plumber'].indexOf(name);
                        return (
                          <motion.button
                            key={name}
                            initial={{ opacity: 0, y: 30, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                              duration: 0.4,
                              delay: 0.4 + categoryIndex * 0.08,
                              ease: [0.25, 0.46, 0.45, 0.94]
                            }}
                            whileHover={{ scale: 1.05, y: -8 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleCategorySelect(name)}
                            className="p-10 rounded-[20px] flex flex-col items-center gap-5 bg-white border border-[#9B8CF7]/15 hover:border-[var(--accent-pink)]/50 transition-colors group"
                          >
                            <span className="group-hover:scale-110 transition-transform text-[#9B8CF7] group-hover:text-[var(--accent-pink)]">{icon}</span>
                            <span className="font-medium text-sm text-[#6B7280] group-hover:text-[var(--accent-pink)]">{name}</span>
                          </motion.button>
                        );
                      }
                      return null;
                    })}
                  </div>

                  {/* Site Generations Remaining Indicator */}
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="w-full max-w-2xl mx-auto mb-8 p-6 bg-white border border-[#9B8CF7]/15 rounded-[20px] flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#9B8CF7]/20 to-[var(--accent-pink)]/20 rounded-[12px] flex items-center justify-center">
                        <Icons.Rocket size={24} className="text-[#9B8CF7]" />
                      </div>
                      <div className="text-left">
                        <p className="text-sm font-semibold text-[#1E1B4B]">Site Generations</p>
                        <p className="text-xs text-[#6B7280]">
                          {userPlanId === 'free' ? 'One-time trial allocation' : 'Renews monthly with your plan'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-2xl font-bold text-[#1E1B4B] headline-font">{availableSiteGenerations}</span>
                        <span className="text-sm text-[#6B7280] ml-1">left</span>
                      </div>
                      {availableSiteGenerations <= 1 && (
                        <button
                          onClick={() => setStep(WizardStep.EARNINGS)}
                          className="px-4 py-2 bg-[#9B8CF7] hover:bg-[#8B5CF6] text-white text-xs font-semibold rounded-lg transition-colors"
                        >
                          Get More
                        </button>
                      )}
                    </div>
                  </motion.div>

                  {/* Academy Access - Only show for authenticated users */}
                  {isAuthenticated && (
                    <button
                      onClick={() => { setStep(WizardStep.KNOWLEDGE_BASE); setSelectedKbTopic(null); }}
                      className="w-full max-w-2xl mx-auto p-10 bg-[#F5F3FF] border border-[#9B8CF7]/20 rounded-[20px] flex items-center justify-between group hover:bg-[var(--accent-pink-soft)] hover:border-[var(--accent-pink)]/30 transition-all hb-card-shadow card-hover"
                    >
                      <div className="flex items-center gap-8 text-left">
                        <div className="w-16 h-16 bg-gradient-to-br from-[#9B8CF7] to-[var(--accent-pink)] text-white rounded-[16px] flex items-center justify-center shadow-lg shadow-[var(--accent-pink)]/20">
                          <Icons.Book size={32} className="text-white" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-bold headline-font mb-1 text-[#1E1B4B]">Academy <span className="headline-serif italic font-normal text-[#9B8CF7]">Access</span></h3>
                          <p className="text-sm font-light leading-snug text-[#6B7280]">Learn how to land your first paying client.</p>
                        </div>
                      </div>
                      <div className="p-4 rounded-full bg-white text-[var(--accent-pink)] group-hover:translate-x-2 transition-transform">
                        <Icons.Sparkles size={24} />
                      </div>
                    </button>
                  )}
                </div>
              )}

              {step === WizardStep.LOCATION && (
                <div className="text-center max-w-xl mx-auto py-10">
                  <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-4xl font-bold mb-10 headline-font text-[#1E1B4B]"
                  >
                    Set <span className="headline-serif italic font-normal text-[#9B8CF7]">Location</span>
                  </motion.h1>
                  <motion.input
                    data-tour="location-input"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.15 }}
                    type="text"
                    placeholder="e.g. Austin, TX"
                    className="w-full p-8 rounded-[20px] text-2xl outline-none focus:ring-4 focus:ring-[var(--accent-pink)]/20 text-center mb-8 hb-card-shadow bg-white border border-[#9B8CF7]/15 focus:border-[var(--accent-pink)]/40 text-[#1E1B4B] placeholder-[#9CA3AF] transition-all"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSearch}
                    disabled={!location}
                    className="w-full py-6 font-semibold text-sm disabled:opacity-50 rounded-full bg-gradient-to-r from-[#9B8CF7] to-[var(--accent-pink)] text-white shadow-lg shadow-[var(--accent-pink)]/20 hover:shadow-xl hover:shadow-[var(--accent-pink)]/30 transition-all"
                  >
                    <span>Find Leads</span>
                  </motion.button>
                </div>
              )}

              {step === WizardStep.SEARCHING && (
                <div className="text-center py-16 max-w-2xl mx-auto">
                  {/* Main animation container */}
                  <div className="relative w-48 h-48 mx-auto mb-12">
                    {/* Outer rotating ring */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-2 border-dashed border-[#9B8CF7]/30"
                    />

                    {/* Middle pulsing ring */}
                    <motion.div
                      animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-4 rounded-full border-2 border-[var(--accent-pink)]/40"
                      style={{ boxShadow: '0 0 30px var(--accent-pink-glow)' }}
                    />

                    {/* Inner spinning gradient ring */}
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-8 rounded-full"
                      style={{
                        background: 'conic-gradient(from 0deg, transparent, #9B8CF7, var(--accent-pink), transparent)',
                        padding: '3px'
                      }}
                    >
                      <div className="w-full h-full rounded-full bg-white" />
                    </motion.div>

                    {/* Center icon */}
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#9B8CF7] to-[var(--accent-pink)] flex items-center justify-center shadow-lg shadow-[var(--accent-pink)]/30">
                        <Icons.Search size={36} className="text-white" />
                      </div>
                    </motion.div>

                    {/* Orbiting dots */}
                    {[0, 1, 2, 3].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: i * 0.5 }}
                        className="absolute inset-0"
                        style={{ transformOrigin: 'center' }}
                      >
                        <motion.div
                          animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.25 }}
                          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
                          style={{ background: i % 2 === 0 ? '#9B8CF7' : 'var(--accent-pink)' }}
                        />
                      </motion.div>
                    ))}
                  </div>

                  {/* Text content */}
                  <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl font-bold mb-4 headline-font text-[#1E1B4B]"
                  >
                    Scanning the <span className="headline-serif italic font-normal text-[#9B8CF7]">Web</span>...
                  </motion.h2>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="font-light text-[#6B7280] mb-8"
                  >
                    Identifying {category} businesses in {location} with poor digital presence.
                  </motion.p>

                  {/* Animated status indicators */}
                  <div className="flex flex-col items-center gap-3">
                    {[
                      { text: 'Searching Google Maps...', delay: 0 },
                      { text: 'Analyzing website quality...', delay: 1.5 },
                      { text: 'Scoring opportunities...', delay: 3 }
                    ].map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: [0, 1, 1, 0.5], x: 0 }}
                        transition={{ delay: item.delay, duration: 1.5 }}
                        className="flex items-center gap-2 text-sm"
                      >
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: item.delay }}
                          className="w-2 h-2 rounded-full bg-[#9B8CF7]"
                        />
                        <span className="text-[#6B7280]">{item.text}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {step === WizardStep.SELECT_BUSINESS && (
                <div className="max-w-4xl mx-auto w-full text-center py-10">
                  <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-4xl font-bold mb-12 headline-font text-[#1E1B4B]"
                  >
                    Select an <span className="headline-serif italic font-normal text-[#9B8CF7]">Opportunity</span>
                  </motion.h1>
                  <div className="grid gap-6 text-left">
                    {businesses.map((biz, index) => (
                      <motion.div
                        key={biz.id}
                        initial={{ opacity: 0, x: -50, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        transition={{
                          duration: 0.5,
                          delay: index * 0.12,
                          ease: [0.25, 0.46, 0.45, 0.94]
                        }}
                        whileHover={{ scale: 1.02, y: -4 }}
                        className="p-10 rounded-[20px] flex items-center justify-between hb-card-shadow transition-all group bg-white border border-[#9B8CF7]/15 hover:border-[#9B8CF7]/40"
                      >
                        <div>
                          <h3 className="text-2xl font-bold mb-2 headline-font text-[#1E1B4B] group-hover:text-[#9B8CF7] transition-colors">{biz.name}</h3>
                          <div className="flex flex-wrap gap-4 text-sm font-medium text-[#6B7280]">
                            <span>{biz.address}</span>
                            <span className={biz.websiteUrl ? "badge-pink" : "badge-gray"}>
                              Website: {biz.websiteUrl ? biz.websiteStatus : 'Not Listed'}
                            </span>
                            {biz.websiteUrl ? (
                              <a
                                href={biz.websiteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-[#9B8CF7] hover:text-[#8B5CF6] underline"
                              >
                                View Current Site →
                              </a>
                            ) : (
                              <span className="text-amber-600 text-xs">
                                ⚠️ No website URL in Google - can't modernize
                              </span>
                            )}
                          </div>
                        </div>
                        <motion.button
                          whileHover={biz.websiteUrl ? { scale: 1.05 } : {}}
                          whileTap={biz.websiteUrl ? { scale: 0.95 } : {}}
                          onClick={() => biz.websiteUrl && handleCreateWebsite(biz)}
                          disabled={!biz.websiteUrl}
                          className={`font-semibold text-sm px-8 py-4 ${
                            biz.websiteUrl
                              ? 'hb-btn hb-btn-lavender cursor-pointer'
                              : 'bg-gray-200 text-gray-400 rounded-full cursor-not-allowed'
                          }`}
                        >
                          <span>{biz.websiteUrl ? 'Build Site' : 'No URL'}</span>
                        </motion.button>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {step === WizardStep.AI_CREATING && (
                <div className="text-center py-16 max-w-xl mx-auto px-6">
                  {/* Gentle floating icon */}
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="w-24 h-24 mx-auto mb-8 bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] rounded-[28px] flex items-center justify-center shadow-lg shadow-[#9B8CF7]/10"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    >
                      <Icons.Sparkles size={40} className="sparkle-pink" />
                    </motion.div>
                  </motion.div>

                  {/* Warm, friendly headline */}
                  <h1 className="text-3xl md:text-4xl font-bold mb-4 headline-font text-[#1E1B4B]">
                    Creating Something <span className="headline-serif italic font-normal text-[#9B8CF7]">Beautiful</span>
                  </h1>
                  <p className="text-[#6B7280] mb-10 text-base leading-relaxed">
                    We're crafting a stunning website just for {selectedBusiness?.name || 'your client'}.
                    <br className="hidden md:block" />
                    This usually takes less than a minute.
                  </p>

                  {/* Soft progress indicator with pink glow */}
                  <div className="relative mb-12">
                    <div className="w-full h-3 rounded-full overflow-visible bg-[#F5F3FF] shadow-inner">
                      <motion.div
                        className="h-full bg-gradient-to-r from-[#C4B5FD] via-[#9B8CF7] to-[var(--accent-pink)] rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: `${generationProgress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        style={{ boxShadow: '0 0 16px var(--accent-pink-glow)' }}
                      />
                    </div>
                    <motion.div
                      className="absolute -top-1 h-5 w-5 bg-white rounded-full shadow-md border-2 border-[var(--accent-pink)] flex items-center justify-center"
                      style={{ left: `calc(${Math.min(generationProgress, 98)}% - 10px)` }}
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    >
                      <div className="w-2 h-2 bg-[var(--accent-pink)] rounded-full" />
                    </motion.div>
                  </div>

                  {/* Elegant sequential wave animation - cards float forward one by one */}
                  <div className="space-y-3" style={{ perspective: '1000px' }}>
                    {[
                      { t: 'Understanding your business', icon: <Icons.Search size={18} />, p: 20, sub: 'Learning what makes them special' },
                      { t: 'Writing compelling stories', icon: <Icons.Chatbot size={18} />, p: 40, sub: 'Crafting words that connect' },
                      { t: 'Designing beautiful visuals', icon: <Icons.Sparkles size={18} />, p: 80, sub: 'Creating an inviting look' },
                      { t: 'Putting it all together', icon: <Icons.Rocket size={18} />, p: 100, sub: 'Almost ready to share!' }
                    ].map((stepInfo, i) => {
                      const isActive = generationProgress >= stepInfo.p - 19 && generationProgress < stepInfo.p + 1;
                      const isComplete = generationProgress >= stepInfo.p;
                      return (
                        <motion.div
                          key={i}
                          initial={{
                            opacity: 0,
                            y: 20,
                            scale: 0.96
                          }}
                          animate={{
                            opacity: 1,
                            y: [0, -4, 0],
                            scale: [1, 1.015, 1],
                            boxShadow: [
                              '0 2px 8px rgba(155, 140, 247, 0.08)',
                              '0 8px 24px rgba(155, 140, 247, 0.15)',
                              '0 2px 8px rgba(155, 140, 247, 0.08)'
                            ]
                          }}
                          transition={{
                            opacity: {
                              duration: 0.6,
                              delay: i * 0.18,
                              ease: [0.25, 0.1, 0.25, 1]
                            },
                            y: {
                              duration: 2.4,
                              repeat: Infinity,
                              ease: [0.45, 0, 0.55, 1],
                              delay: i * 0.2
                            },
                            scale: {
                              duration: 2.4,
                              repeat: Infinity,
                              ease: [0.45, 0, 0.55, 1],
                              delay: i * 0.2
                            },
                            boxShadow: {
                              duration: 2.4,
                              repeat: Infinity,
                              ease: [0.45, 0, 0.55, 1],
                              delay: i * 0.2
                            }
                          }}
                          className={`p-5 rounded-2xl border-2 flex items-center gap-4 transition-colors duration-700 ${
                            isComplete
                              ? 'bg-gradient-to-r from-[#F5F3FF] to-[#EDE9FE] border-[#9B8CF7]/40'
                              : isActive
                                ? 'bg-white border-[#9B8CF7]/30'
                                : 'bg-white/80 border-[#E5E7EB]/60'
                          }`}
                          style={{
                            transformStyle: 'preserve-3d',
                            willChange: 'transform, opacity, box-shadow'
                          }}
                        >
                          {/* Icon container with gentle pulse for active state */}
                          <motion.div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-700 ${
                              isComplete
                                ? 'bg-[#9B8CF7] text-white'
                                : isActive
                                  ? 'bg-[#F5F3FF] text-[#9B8CF7]'
                                  : 'bg-[#F3F4F6] text-[#9CA3AF]'
                            }`}
                            animate={isActive ? {
                              scale: [1, 1.05, 1],
                            } : {}}
                            transition={{
                              duration: 1.5,
                              repeat: Infinity,
                              ease: [0.45, 0, 0.55, 1]
                            }}
                          >
                            {isComplete ? (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{
                                  duration: 0.4,
                                  ease: [0.25, 0.1, 0.25, 1]
                                }}
                              >
                                <Icons.Check size={18} />
                              </motion.div>
                            ) : isActive ? (
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                              >
                                {stepInfo.icon}
                              </motion.div>
                            ) : (
                              stepInfo.icon
                            )}
                          </motion.div>

                          {/* Text content with smooth color transitions */}
                          <div className="flex-1 text-left">
                            <span className={`font-medium text-sm block transition-colors duration-500 ${
                              isComplete || isActive ? 'text-[#1E1B4B]' : 'text-[#9CA3AF]'
                            }`}>
                              {stepInfo.t}
                            </span>
                            <motion.span
                              className={`text-xs block transition-colors duration-500 ${
                                isComplete ? 'text-[#9B8CF7]' : isActive ? 'text-[#6B7280]' : 'text-[#D1D5DB]'
                              }`}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.18 + 0.2, duration: 0.4 }}
                            >
                              {isComplete ? 'Done!' : stepInfo.sub}
                            </motion.span>
                          </div>

                          {/* Completion sparkle with elegant fade-in */}
                          {isComplete && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{
                                duration: 0.5,
                                ease: [0.25, 0.1, 0.25, 1]
                              }}
                            >
                              <Icons.Sparkles size={16} className="text-[#9B8CF7]" />
                            </motion.div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>

                  {/* Reassuring footer message */}
                  <motion.p
                    className="mt-10 text-sm text-[#9CA3AF]"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    Great things take a moment...
                  </motion.p>
                </div>
              )}

              {step === WizardStep.PREVIEW && siteHTML && (
                <div className="w-full flex flex-col items-center py-5">
                  <div className="w-full h-[65vh] overflow-auto rounded-[20px] border border-[#9B8CF7]/15 hb-card-shadow bg-white custom-scrollbar mb-10">
                    <AISandbox
                      aiGeneratedCode={siteHTML}
                      isUpdating={false}
                      versions={aiVersions}
                      currentVersionId={currentVersionId}
                      onRevert={(version) => {
                        setSiteHTML(version.code);
                        setCurrentVersionId(version.id);
                      }}
                    />
                  </div>
                  <div className="w-full max-w-4xl p-10 backdrop-blur-xl border border-[#9B8CF7]/15 rounded-[20px] hb-card-shadow flex justify-between items-center text-left bg-white">
                    <div>
                      <h4 className="font-bold text-2xl mb-1 headline-font text-[#1E1B4B]">Draft <span className="headline-serif italic font-normal text-[#9B8CF7]">Ready</span></h4>
                      <p className="text-sm font-medium text-[#6B7280]">Open AI Editor to polish colors, wording, and layout.</p>
                    </div>
                    <button onClick={nextStep} className="hb-btn hb-btn-lavender px-12 py-5 font-semibold text-sm"><span>Edit with AI</span></button>
                  </div>
                </div>
              )}

              {/* New Vibe Editor (HTML-based) */}
              {isSplitView && useVibeEditor && (
                useNewVibeUI ? (
                  <div className="w-full h-[calc(100vh-80px)] overflow-hidden">
                    {/* Phase 3: New Vibe Editor UI with surgical diff-based editing */}
                    <VibeEditorUI
                      projectId={selectedBusiness?.id || 'demo-project'}
                      userId={authEmail ? btoa(authEmail).substring(0, 8) : 'demo-user'}
                      currentHTML={siteHTML}
                      onHTMLUpdate={(newHTML) => {
                        setSiteHTML(newHTML);
                        // Save version
                        const version: AIEditorVersion = {
                          id: `v${aiVersions.length + 1}`,
                          timestamp: Date.now(),
                          prompt: 'Vibe editor update',
                          code: newHTML
                        };
                        setAiVersions(prev => [...prev, version]);
                        setCurrentVersionId(version.id);
                      }}
                    />
                  </div>
                ) : (
                  // Legacy Vibe Editor with chat + sandbox
                  <div className="flex w-full h-[calc(100vh-80px)] overflow-hidden relative bg-[#F5F3FF]">
                    {/* Chat Panel */}
                    <div className={`w-[450px] h-full ${isFullscreenPreview ? 'hidden' : 'flex'}`}>
                      <AIChatPanel
                        messages={aiChatMessages}
                        isLoading={isGenerating}
                        onSendMessage={handleVibeEditorSendMessage}
                        onStopGeneration={handleStopGeneration}
                        deploymentStatus={aiDeploymentStatus}
                        businessName={selectedBusiness?.name}
                        category={category}
                      />
                    </div>

                    {/* Sandbox Preview */}
                    <div className={`flex-1 h-full flex flex-col transition-all duration-500 ${isFullscreenPreview ? 'p-0 z-50 fixed inset-0' : 'p-4'}`}>
                      <div className="flex-1 overflow-hidden rounded-2xl">
                        <AISandbox
                          aiGeneratedCode={siteHTML}
                          isUpdating={isGenerating}
                          versions={aiVersions}
                          currentVersionId={currentVersionId}
                          onRevert={(version) => handleVibeVersionRestore(version.id)}
                          onDeploy={handleFinishEditing}
                          isSelectionMode={isSelectionMode}
                          onSelectionModeToggle={(enabled) => setIsSelectionMode(enabled)}
                          onElementSelected={(tagName) => handleVibeElementSelect({ tag: tagName })}
                        />
                      </div>
                    </div>
                  </div>
                )
              )}

              {/* Legacy Blueprint Editor */}
              {isSplitView && !useVibeEditor && blueprint && (
                <div className="flex w-full h-[calc(100vh-80px)] overflow-hidden relative bg-[#F5F3FF]">
                  <div className={`w-[450px] flex flex-col border-r border-[#9B8CF7]/15 shadow-lg relative text-left z-20 bg-white ${isFullscreenPreview ? 'hidden' : 'flex'}`}>
                    <div className="p-6 border-b border-[#9B8CF7]/15 flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-bold headline-font text-[#1E1B4B]">Design <span className="headline-serif italic font-normal text-[#9B8CF7]">AI</span></h2>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="w-1.5 h-1.5 bg-[var(--accent-pink)] rounded-full animate-pulse" />
                          <p className="text-xs font-medium text-[#6B7280]">Auto-saved {lastSavedTime}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setIsHistoryOpen(!isHistoryOpen)} className={`p-2 rounded-lg transition-all text-sm ${isHistoryOpen ? 'bg-[#9B8CF7] text-white' : 'bg-[#F5F3FF] hover:bg-[#EDE9FE]'}`} title="History"><Icons.History size={16} className={isHistoryOpen ? 'text-white' : 'text-[#6B7280]'} /></button>
                        <button onClick={handleUndo} disabled={!canUndo} className="p-2 rounded-lg disabled:opacity-30 transition-all text-sm bg-[#F5F3FF] hover:bg-[#EDE9FE] text-[#6B7280]" title="Undo"><Icons.Undo size={16} /></button>
                        <button onClick={handleRedo} disabled={!canRedo} className="p-2 rounded-lg disabled:opacity-30 transition-all text-sm bg-[#F5F3FF] hover:bg-[#EDE9FE] text-[#6B7280]" title="Redo"><Icons.Redo size={16} /></button>
                      </div>
                    </div>

                    <div className="flex-1 p-6 overflow-auto custom-scrollbar space-y-8">
                      <AnimatePresence>
                        {isHistoryOpen && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-3 pb-6 border-b border-[#9B8CF7]/15 overflow-hidden">
                            <h4 className="text-sm font-medium text-[#6B7280]">Version History</h4>
                            {blueprintHistory.map((_, i) => (
                              <button key={i} onClick={() => revertToVersion(i)} className="w-full p-4 border border-[#9B8CF7]/15 rounded-[16px] text-left text-xs transition-all flex justify-between items-center bg-white text-[#6B7280] hover:border-[#9B8CF7]/40 hover:text-[#1E1B4B]">
                                <div className="flex flex-col">
                                  <span className="font-bold">Version {i + 1}</span>
                                  <span className="text-xs opacity-50 uppercase">{i === 0 ? 'Original' : `Auto-save ${i}`}</span>
                                </div>
                                {i === blueprintHistory.length - 1 && <span className="badge-pink">Active</span>}
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-[#6B7280]">Reference Themes</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {attachments.map((file, i) => (
                            <div key={i} className="p-3 rounded-xl border border-[#9B8CF7]/15 flex items-center justify-between group bg-[#F5F3FF]">
                              <span className="text-xs truncate max-w-[100px] text-[#6B7280]">{file.name}</span>
                              <button onClick={() => removeAttachment(i)} className="text-[#6B7280] hover:text-red-500 transition-colors">✕</button>
                            </div>
                          ))}
                          <label className="p-4 border-2 border-dashed border-[#9B8CF7]/20 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all group hover:bg-[#F5F3FF]">
                            <Icons.Folder size={20} className="text-[#9B8CF7] opacity-50 group-hover:opacity-100" />
                            <span className="text-xs font-semibold text-[#6B7280]">Attach Ref</span>
                            <input type="file" className="hidden" multiple accept="image/*" onChange={handleFileUpload} />
                          </label>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-[#6B7280]">Style Presets</h4>
                        <div className="grid grid-cols-4 gap-2">
                          {STYLE_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => {
                                if (!blueprint) return;
                                const newBlueprint = {
                                  ...blueprint,
                                  brand: {
                                    ...blueprint.brand,
                                    primaryColor: preset.primaryColor,
                                    secondaryColor: preset.secondaryColor,
                                    fontFamily: preset.font,
                                    tone: preset.tone
                                  }
                                };
                                setBlueprintHistory(prev => [...prev, newBlueprint]);
                                setBlueprint(newBlueprint);
                                setLastSavedTime(new Date().toLocaleTimeString());
                              }}
                              disabled={isGenerating || !blueprint}
                              className="group p-2 rounded-xl border border-[#9B8CF7]/15 transition-all hover:scale-105 hover:border-[#9B8CF7]/40"
                              title={`Apply ${preset.label} style`}
                            >
                              <div className="flex flex-col items-center gap-1">
                                <div className="flex gap-1">
                                  <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: preset.primaryColor }} />
                                  <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: preset.secondaryColor }} />
                                </div>
                                <span className="text-xs font-medium text-[#6B7280] group-hover:text-[#9B8CF7]">{preset.label}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h4 className="text-sm font-medium text-[#6B7280]">Quick Recipes</h4>
                        <div className="grid gap-3">
                          {PROMPT_RECIPES.flatMap(c => c.items).map((item, i) => (
                            <button key={i} onClick={() => applyPrompt(item.prompt)} disabled={isGenerating} className="p-4 border border-[#9B8CF7]/15 rounded-[16px] text-left hover:border-[#9B8CF7]/40 transition-all group flex items-center gap-4 bg-white hover:bg-[#F5F3FF]">
                              <span>{item.icon}</span>
                              <div className="text-[11px] font-medium text-[#6B7280] group-hover:text-[#9B8CF7]">{item.title}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-[#6B7280]">Custom Instruction</label>
                          <span className="text-xs font-medium text-[#9B8CF7]">AI-Powered</span>
                        </div>
                        <div className="relative">
                          <textarea
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            placeholder="Try: 'Change primary color to blue and make tone more friendly' or 'Add urgency to call-to-action buttons'"
                            className="w-full p-5 pr-16 border border-[#9B8CF7]/15 rounded-[20px] text-xs h-40 focus:ring-2 focus:ring-[#9B8CF7]/20 outline-none resize-none transition-all bg-[#F5F3FF] text-[#1E1B4B] placeholder-[#9CA3AF]"
                          />
                          <button
                            onClick={() => applyPrompt(editPrompt)}
                            disabled={isGenerating || !editPrompt}
                            title={editPrompt ? "Apply custom instruction" : "Enter an instruction first"}
                            className="absolute bottom-4 right-4 p-4 bg-[#9B8CF7] text-white rounded-[16px] hover:bg-[#8B5CF6] hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg transition-all"
                          >
                            {isGenerating ? (
                              <div className="animate-spin">
                                <Icons.Sparkles size={18} className="text-white" />
                              </div>
                            ) : (
                              <Icons.Sparkles size={18} className="text-white" />
                            )}
                          </button>
                        </div>
                        <div className="flex items-center justify-between text-xs text-[#6B7280]">
                          <p className="font-medium italic">Costs 1 Token per AI Edit</p>
                          {editPrompt && !isGenerating && (
                            <p className="text-[#9B8CF7] font-medium">Ready to apply</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-6 border-t border-[#9B8CF7]/15 flex gap-3 bg-white">
                      <button onClick={handleFinishEditing} className="w-full hb-btn hb-btn-lavender py-5 font-semibold text-sm"><span>Complete & Save</span></button>
                    </div>
                  </div>

                  <div className={`flex-1 h-full transition-all duration-500 ${isFullscreenPreview ? 'p-0 z-50 fixed inset-0' : 'p-10'} bg-[#F5F3FF]`}>
                    <div className={`w-full h-full bg-white transition-all duration-500 ${isFullscreenPreview ? 'rounded-0 shadow-none' : 'max-w-5xl mx-auto rounded-3xl shadow-3xl'} overflow-hidden flex flex-col relative`}>
                      {(isGenerating || isInjecting) && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-40 flex items-center justify-center">
                          <div className="text-center">
                            <div className="w-16 h-16 border-4 border-[#9B8CF7] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-zinc-900 font-semibold text-sm tracking-widest">
                              {isInjecting ? 'Injecting Service...' : 'AI is rebuilding...'}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="bg-[#F5F3FF] h-12 flex items-center justify-between px-6 border-b border-[#9B8CF7]/10 shrink-0 z-30">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-[#9B8CF7]/30" />
                          <div className="w-2.5 h-2.5 rounded-full bg-[#9B8CF7]/50" />
                          <div className="w-2.5 h-2.5 rounded-full bg-[#9B8CF7]" />
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-[#6B6478] uppercase tracking-[0.4em] font-black">Live Production Sandbox</span>
                          <div className="flex bg-white/5 p-1 rounded-lg">
                            <button
                              onClick={() => setEditorView('preview')}
                              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${editorView === 'preview' ? 'bg-[#9B8CF7] text-white shadow-lg shadow-[#9B8CF7]/20' : 'text-[#6B6478] hover:text-zinc-300'}`}
                            >
                              Preview
                            </button>
                            <button
                              onClick={() => setEditorView('code')}
                              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${editorView === 'code' ? 'bg-[#9B8CF7] text-white shadow-lg shadow-[#9B8CF7]/20' : 'text-[#6B6478] hover:text-zinc-300'}`}
                            >
                              Code
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => setIsFullscreenPreview(!isFullscreenPreview)}
                          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold text-[#A8A3B3] transition-all flex items-center gap-2"
                        >
                          {isFullscreenPreview ? 'Exit' : 'Full Preview'}
                        </button>
                      </div>

                      <div className="flex-1 overflow-auto custom-scrollbar">
                        {editorView === 'preview' ? (
                          <WebsiteRenderer blueprint={blueprint} isPreview={false} />
                        ) : (
                          <CodePreview blueprint={blueprint} isDark={true} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === WizardStep.PREVIEW_DEPLOY && (
                <div className="max-w-3xl mx-auto w-full text-center py-10">
                  <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="text-5xl font-bold mb-6 headline-font text-[#1E1B4B]"
                  >
                    Deploy <span className="headline-serif italic font-normal text-[#9B8CF7]">Preview</span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="mb-12 font-light text-[#6B7280]"
                  >
                    Create a shareable preview link for {selectedBusiness?.name} to review before finalizing a deal.
                  </motion.p>

                  {!previewDeployment && !isDeployingPreview && !previewDeployError && (
                    <motion.div
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="p-12 rounded-[20px] hb-card-shadow mb-10 bg-white border border-[#9B8CF7]/15"
                    >
                      <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 bg-gradient-to-br from-[#F5F3FF] to-[var(--accent-pink-soft)] border border-[var(--accent-pink)]/20">
                        <Icons.Globe size={48} className="text-[var(--accent-pink)]" />
                      </div>
                      <h3 className="text-2xl font-bold headline-font mb-4 italic text-[#1E1B4B]">Ready to Deploy</h3>
                      <p className="text-sm mb-8 leading-relaxed max-w-md mx-auto text-[#6B7280]">
                        Deploy a temporary preview of the website. The preview link will be active for <span className="font-bold text-[var(--accent-pink)]">5 days</span> and can be shared with the business owner for review.
                      </p>
                      <div className="flex items-center justify-center gap-3 mb-8 p-4 rounded-[16px] bg-[var(--accent-pink-soft)] border border-[var(--accent-pink)]/15">
                        <Icons.Clock size={16} className="text-[var(--accent-pink)]" />
                        <span className="text-xs font-medium text-[var(--accent-pink)]">Preview expires automatically after 5 days</span>
                      </div>
                      <button
                        onClick={handleDeployPreview}
                        className="hb-btn hb-btn-lavender px-16 py-5 font-semibold text-sm"
                      >
                        <span>Deploy Website Preview</span>
                      </button>
                    </motion.div>
                  )}

                  {isDeployingPreview && (
                    <motion.div
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="p-12 rounded-[20px] hb-card-shadow mb-10 bg-white border border-[#9B8CF7]/15"
                    >
                      <div className="w-20 h-20 border-4 border-[#9B8CF7] border-t-transparent rounded-full animate-spin mx-auto mb-8" />
                      <h3 className="text-2xl font-bold headline-font mb-4 italic text-[#1E1B4B]">Deploying Preview...</h3>
                      <p className="text-sm text-[#6B7280]">
                        Creating your shareable preview link. This may take a moment.
                      </p>
                    </motion.div>
                  )}

                  {previewDeployError && (
                    <motion.div
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="p-12 rounded-[20px] hb-card-shadow mb-10 bg-red-50 border border-red-200"
                    >
                      <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 bg-red-100 border border-red-200">
                        <Icons.X size={48} className="text-red-500" />
                      </div>
                      <h3 className="text-2xl font-bold headline-font mb-4 italic text-[#1E1B4B]">Deployment Failed</h3>
                      <p className="text-sm mb-8 text-red-600">{previewDeployError}</p>
                      <button
                        onClick={handleDeployPreview}
                        className="hb-btn hb-btn-lavender px-12 py-5 font-semibold text-sm"
                      >
                        <span>Try Again</span>
                      </button>
                    </motion.div>
                  )}

                  {previewDeployment && previewDeployment.status === 'live' && (
                    <motion.div
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="p-12 rounded-[20px] hb-card-shadow mb-10 bg-white border border-[#9B8CF7]/20"
                    >
                      <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 bg-[#F5F3FF] border border-[#9B8CF7]/20">
                        <Icons.Check size={48} className="text-[#9B8CF7]" />
                      </div>
                      <h3 className="text-2xl font-bold headline-font mb-4 italic text-[#1E1B4B]">Preview Live!</h3>
                      <p className="text-sm mb-6 text-[#6B7280]">
                        Your preview is live. This link will be included in your AI-generated pitch email.
                      </p>

                      <div className="p-6 rounded-[16px] mb-6 bg-[#F5F3FF] border border-[#9B8CF7]/15">
                        <label className="text-sm font-medium block mb-3 text-[#6B7280]">Preview URL</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            readOnly
                            value={previewDeployment.previewUrl}
                            className="flex-1 p-4 rounded-xl text-sm font-mono outline-none bg-white border border-[#9B8CF7]/15 text-[#9B8CF7]"
                          />
                          <button
                            onClick={() => navigator.clipboard.writeText(previewDeployment.previewUrl)}
                            className="p-4 rounded-xl transition-all hover:scale-105 bg-white border border-[#9B8CF7]/15 hover:bg-[#F5F3FF]"
                            title="Copy URL"
                          >
                            <Icons.Copy size={18} className="text-[#6B7280]" />
                          </button>
                          <a
                            href={previewDeployment.previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-4 bg-[#9B8CF7] rounded-xl hover:bg-[#8B5CF6] transition-all hover:scale-105"
                            title="Open Preview"
                          >
                            <Icons.ExternalLink size={18} className="text-white" />
                          </a>
                        </div>
                      </div>

                      <div className="flex items-center justify-center gap-6 p-4 rounded-[16px] bg-amber-50 border border-amber-200">
                        <div className="flex items-center gap-2">
                          <Icons.Clock size={16} className="text-amber-500" />
                          <span className="text-xs font-medium text-amber-600">
                            Expires: {formatExpirationDate(previewDeployment.expiresAt)}
                          </span>
                        </div>
                        <div className="w-px h-4 bg-amber-300" />
                        <span className="text-xs font-bold text-amber-600">
                          {getDaysRemaining(previewDeployment.expiresAt)} days remaining
                        </span>
                      </div>
                    </motion.div>
                  )}

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="flex justify-center gap-4"
                  >
                    <button
                      onClick={() => setStep(WizardStep.PROMPT_LIBRARY)}
                      className="px-12 py-5 font-semibold text-sm rounded-full bg-white border border-[#9B8CF7]/20 text-[#6B7280] hover:bg-[#F5F3FF] transition-all"
                    >
                      Back to Editor
                    </button>
                    {!previewDeployment && !isDeployingPreview && (
                      <button
                        onClick={handleSkipPreviewDeploy}
                        className="px-12 py-5 font-semibold text-sm rounded-full bg-[#F5F3FF] text-[#6B7280] hover:bg-[#EDE9FE] transition-all"
                      >
                        Skip for Now
                      </button>
                    )}
                    {previewDeployment && previewDeployment.status === 'live' && (
                      <button
                        onClick={handleContinueFromPreview}
                        className="hb-btn hb-btn-lavender px-16 py-5 font-semibold text-sm"
                      >
                        <span>Continue to Pricing</span>
                      </button>
                    )}
                  </motion.div>
                </div>
              )}

              {step === WizardStep.PRICING_CONFIG && (
                <div className="max-w-4xl mx-auto w-full text-center py-10">
                  <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="text-5xl font-bold mb-6 headline-font text-[#1E1B4B]"
                  >
                    Your <span className="headline-serif italic font-normal text-[#9B8CF7]">Service Fee</span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="mb-4 font-light text-[#6B7280]"
                  >
                    Set the price for your client, {selectedBusiness?.name}.
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="mb-16 text-sm text-[#9B8CF7] italic"
                  >
                    We've pre-filled industry-standard pricing, but you can set what feels right for you.
                  </motion.p>

                  <div className="grid md:grid-cols-2 gap-8 mb-16">
                    <motion.div
                      initial={{ opacity: 0, x: -30, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="p-10 rounded-[20px] hb-card-shadow text-left bg-white border border-[#9B8CF7]/15"
                    >
                      <h3 className="text-xl font-bold headline-font mb-2 italic text-[#1E1B4B]">Design Fee (One-time)</h3>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-[#6B7280]">$</span>
                        <input type="number" value={setupFee} onChange={(e) => setSetupFee(Number(e.target.value))} className="w-full p-6 pl-12 rounded-[20px] text-3xl font-bold outline-none focus:ring-4 focus:ring-[#9B8CF7]/20 bg-[#F5F3FF] border border-[#9B8CF7]/15 text-[#1E1B4B]" />
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, x: 30, scale: 0.95 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="p-10 rounded-[20px] hb-card-shadow text-left bg-white border border-[#9B8CF7]/15"
                    >
                      <h3 className="text-xl font-bold headline-font mb-2 italic text-[#1E1B4B]">Maintenance (Monthly)</h3>
                      <div className="relative">
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-bold text-[#6B7280]">$</span>
                        <input type="number" value={monthlyFee} onChange={(e) => setMonthlyFee(Number(e.target.value))} className="w-full p-6 pl-12 rounded-[20px] text-3xl font-bold outline-none focus:ring-4 focus:ring-[#9B8CF7]/20 bg-[#F5F3FF] border border-[#9B8CF7]/15 text-[#1E1B4B]" />
                      </div>
                    </motion.div>
                  </div>

                  <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="p-10 bg-gradient-to-r from-[#9B8CF7] to-[var(--accent-pink)] rounded-[20px] shadow-lg shadow-[var(--accent-pink)]/20 text-center flex justify-between items-center"
                  >
                    <div className="text-left text-white">
                      <h4 className="font-semibold text-sm mb-1">First Year Revenue</h4>
                      <p className="text-xs opacity-70">Setup + 12x Maintenance</p>
                    </div>
                    <div className="text-5xl font-bold text-white headline-font">${setupFee + (monthlyFee * 12)}</div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="mt-16 flex justify-center gap-4"
                  >
                    <button onClick={() => setStep(WizardStep.PREVIEW_DEPLOY)} className="px-12 py-5 font-semibold text-sm rounded-full bg-white border border-[#9B8CF7]/20 text-[#6B7280] hover:bg-[#F5F3FF]">Back</button>
                    <button onClick={nextStep} className="hb-btn hb-btn-lavender px-16 py-5 font-semibold text-sm"><span>Confirm Pricing</span></button>
                  </motion.div>
                </div>
              )}

              {step === WizardStep.SEND_PROPOSAL && (
                <div className="max-w-3xl mx-auto text-center py-10">
                  <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="text-5xl font-bold mb-12 headline-font text-[#1E1B4B]"
                  >
                    Ready to <span className="headline-serif italic font-normal text-[var(--accent-pink)]">Launch</span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="mb-16 font-light text-[#6B7280]"
                  >
                    Send a pitch to the business owner.
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="flex justify-center"
                  >
                    <button
                      onClick={handleSendProposal}
                      disabled={isGeneratingEmail}
                      className="p-12 rounded-[20px] flex flex-col items-center gap-6 hover:border-[var(--accent-pink)]/40 transition-all group disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-[#9B8CF7]/15 hb-card-shadow card-hover"
                    >
                      {isGeneratingEmail ? (
                        <>
                          <div className="w-12 h-12 border-2 border-[var(--accent-pink)] border-t-transparent rounded-full animate-spin" />
                          <div className="font-semibold text-sm text-[var(--accent-pink)]">Generating...</div>
                        </>
                      ) : (
                        <>
                          <Icons.Folder size={48} className="text-[var(--accent-pink)]" />
                          <div className="font-semibold text-sm text-[#6B7280] group-hover:text-[var(--accent-pink)]">Proposal Email</div>
                        </>
                      )}
                    </button>
                  </motion.div>
                </div>
              )}

              {step === WizardStep.SUCCESS && (
                <div className="text-center py-20 max-w-2xl mx-auto">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, rotate: -10 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="w-40 h-40 bg-gradient-to-br from-[#F5F3FF] to-[var(--accent-pink-soft)] border border-[var(--accent-pink)]/20 rounded-[50px] flex items-center justify-center mx-auto mb-12 shadow-lg shadow-[var(--accent-pink)]/10"
                  >
                    <Icons.Rocket size={80} className="text-[var(--accent-pink)]" />
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="text-5xl font-bold mb-6 headline-font text-[#1E1B4B]"
                  >
                    Prospect <span className="headline-serif italic font-normal text-[var(--accent-pink)]">Notified</span>
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="text-xl font-light mb-16 leading-relaxed text-[#6B7280]"
                  >
                    Your professional renovation proposal is now in their hands.
                  </motion.p>
                  <motion.button
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => { setStep(WizardStep.TRACK_STATUS); setBlueprint(null); }}
                    className="px-12 py-5 font-semibold text-sm rounded-full bg-gradient-to-r from-[#9B8CF7] to-[var(--accent-pink)] text-white shadow-lg shadow-[var(--accent-pink)]/20 hover:shadow-xl transition-all"
                  >
                    <span>Client Dashboard</span>
                  </motion.button>
                </div>
              )}

              {step === WizardStep.DOMAIN_SETUP && (
                <div className="max-w-2xl mx-auto text-center py-10 px-6">
                  {/* Progress indicator */}
                  {domainFlowStep !== 'initial' && domainFlowStep !== 'success' && domainFlowStep !== 'waiting' && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mb-8"
                    >
                      <div className="flex items-center justify-center gap-2 mb-2">
                        {['collect-info', 'who-connects', whoConnects === 'client' ? 'client-handoff' : 'user-connects'].map((s, i) => (
                          <div key={s} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                              domainFlowStep === s ? 'bg-[#9B8CF7] text-white' :
                              ['collect-info', 'who-connects', 'user-connects', 'client-handoff'].indexOf(domainFlowStep) > i ? 'bg-[#10B981] text-white' :
                              'bg-[#F5F3FF] text-[#6B7280]'
                            }`}>
                              {['collect-info', 'who-connects', 'user-connects', 'client-handoff'].indexOf(domainFlowStep) > i ? <Icons.Check size={16} /> : i + 1}
                            </div>
                            {i < 2 && <div className={`w-12 h-0.5 ${['collect-info', 'who-connects', 'user-connects', 'client-handoff'].indexOf(domainFlowStep) > i ? 'bg-[#10B981]' : 'bg-[#F5F3FF]'}`} />}
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-[#6B7280]">This usually takes 2–5 minutes</p>
                    </motion.div>
                  )}

                  {/* INITIAL STATE - Primary CTA */}
                  {domainFlowStep === 'initial' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5 }}
                    >
                      <div className="w-20 h-20 bg-gradient-to-br from-[#EDE9FE] to-[#F5F3FF] rounded-2xl flex items-center justify-center mx-auto mb-8">
                        <Icons.Globe size={40} className="text-[#9B8CF7]" />
                      </div>
                      <h1 className="text-4xl font-bold mb-4 headline-font text-[#1E1B4B]">Go <span className="headline-serif italic font-normal text-[#9B8CF7]">Live</span></h1>
                      <p className="text-[#6B7280] mb-8 max-w-md mx-auto leading-relaxed">
                        Ready to connect your client's website to their domain? This is easier than you think — we'll guide you through it.
                      </p>

                      <motion.button
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setDomainFlowStep('collect-info')}
                        className="px-8 py-4 bg-[#9B8CF7] text-white font-semibold rounded-xl shadow-lg hover:bg-[#8B5CF6] transition-all flex items-center justify-center gap-3 mx-auto"
                      >
                        <Icons.Globe size={20} />
                        Connect My Client's Domain
                      </motion.button>

                      <div className="mt-8 flex items-center justify-center gap-6 text-sm text-[#6B7280]">
                        <button
                          onClick={() => setStep(WizardStep.SUCCESS)}
                          className="hover:text-[#9B8CF7] transition-colors"
                        >
                          Skip for now →
                        </button>
                      </div>

                      <div className="mt-12 p-4 bg-[#F9FAFB] rounded-xl">
                        <p className="text-sm text-[#6B7280]">
                          <span className="font-semibold text-[#1E1B4B]">Don't have access to the domain?</span> No problem — you can send setup instructions to your client.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 1: COLLECT DOMAIN INFO */}
                  {domainFlowStep === 'collect-info' && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4 }}
                      className="text-left"
                    >
                      <button
                        onClick={() => { setDomainFlowStep('initial'); setDomainInput(''); setDomainProvider(''); }}
                        className="text-sm text-[#6B7280] hover:text-[#1E1B4B] transition-colors mb-6 flex items-center gap-2"
                      >
                        ← Back
                      </button>

                      <h2 className="text-2xl font-bold mb-2 headline-font text-[#1E1B4B]">Domain <span className="headline-serif italic font-normal text-[#9B8CF7]">Details</span></h2>
                      <p className="text-[#6B7280] mb-8">Let's start with some basic information about your client's domain.</p>

                      <div className="space-y-6">
                        <div>
                          <label className="text-sm font-semibold text-[#1E1B4B] mb-2 block">What's the website address?</label>
                          <input
                            type="text"
                            value={domainInput}
                            onChange={(e) => setDomainInput(e.target.value)}
                            className="w-full p-4 bg-white border border-[#9B8CF7]/20 rounded-xl outline-none focus:ring-2 focus:ring-[#9B8CF7]/30 text-[#1E1B4B] placeholder:text-[#A8A3B3]"
                            placeholder="atlanta-fitness.com"
                          />
                        </div>

                        <div>
                          <label className="text-sm font-semibold text-[#1E1B4B] mb-2 block">Where is the domain hosted?</label>
                          <select
                            value={domainProvider}
                            onChange={(e) => setDomainProvider(e.target.value)}
                            className="w-full p-4 bg-white border border-[#9B8CF7]/20 rounded-xl outline-none focus:ring-2 focus:ring-[#9B8CF7]/30 text-[#1E1B4B] appearance-none cursor-pointer"
                          >
                            <option value="">Select a provider...</option>
                            <option value="godaddy">GoDaddy</option>
                            <option value="squarespace">Squarespace</option>
                            <option value="wix">Wix</option>
                            <option value="namecheap">Namecheap</option>
                            <option value="bluehost">Bluehost</option>
                            <option value="cloudflare">Cloudflare</option>
                            <option value="google">Google Domains</option>
                            <option value="other">Other / Not sure</option>
                          </select>
                        </div>

                        <motion.button
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setDomainFlowStep('who-connects')}
                          disabled={!domainInput.trim()}
                          className="w-full py-4 bg-[#9B8CF7] text-white font-semibold rounded-xl hover:bg-[#8B5CF6] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Continue
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 2: WHO WILL CONNECT */}
                  {domainFlowStep === 'who-connects' && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4 }}
                      className="text-left"
                    >
                      <button
                        onClick={() => setDomainFlowStep('collect-info')}
                        className="text-sm text-[#6B7280] hover:text-[#1E1B4B] transition-colors mb-6 flex items-center gap-2"
                      >
                        ← Back
                      </button>

                      <h2 className="text-2xl font-bold mb-2 headline-font text-[#1E1B4B]">Who Will <span className="headline-serif italic font-normal text-[#9B8CF7]">Connect</span> It?</h2>
                      <p className="text-[#6B7280] mb-8">This helps us guide you through the right process.</p>

                      <div className="space-y-4">
                        <motion.button
                          whileHover={{ scale: 1.01, y: -2 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => { setWhoConnects('user'); setDomainFlowStep('user-connects'); }}
                          className="w-full p-5 bg-white border border-[#9B8CF7]/20 rounded-xl text-left hover:border-[#9B8CF7]/50 hover:shadow-md transition-all group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#EDE9FE] rounded-xl flex items-center justify-center group-hover:bg-[#9B8CF7]/20 transition-colors">
                              <Icons.User size={24} className="text-[#9B8CF7]" />
                            </div>
                            <div>
                              <div className="font-semibold text-[#1E1B4B]">I can connect it myself</div>
                              <div className="text-sm text-[#6B7280]">I have access to the domain settings</div>
                            </div>
                          </div>
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.01, y: -2 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => { setWhoConnects('client'); setDomainFlowStep('client-handoff'); }}
                          className="w-full p-5 bg-white border border-[#9B8CF7]/20 rounded-xl text-left hover:border-[#9B8CF7]/50 hover:shadow-md transition-all group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#FEF3C7] rounded-xl flex items-center justify-center group-hover:bg-[#F59E0B]/20 transition-colors">
                              <Icons.Users size={24} className="text-[#F59E0B]" />
                            </div>
                            <div>
                              <div className="font-semibold text-[#1E1B4B]">My client will connect it</div>
                              <div className="text-sm text-[#6B7280]">Send them easy setup instructions</div>
                            </div>
                          </div>
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.01, y: -2 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => { setWhoConnects('unsure'); setDomainFlowStep('client-handoff'); }}
                          className="w-full p-5 bg-white border border-[#9B8CF7]/20 rounded-xl text-left hover:border-[#9B8CF7]/50 hover:shadow-md transition-all group"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-[#F5F3FF] rounded-xl flex items-center justify-center group-hover:bg-[#9B8CF7]/10 transition-colors">
                              <Icons.HelpCircle size={24} className="text-[#6B7280]" />
                            </div>
                            <div>
                              <div className="font-semibold text-[#1E1B4B]">I'm not sure yet</div>
                              <div className="text-sm text-[#6B7280]">Get the instructions and decide later</div>
                            </div>
                          </div>
                        </motion.button>
                      </div>
                    </motion.div>
                  )}

                  {/* STEP 3A: USER CONNECTS FLOW */}
                  {domainFlowStep === 'user-connects' && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4 }}
                      className="text-left"
                    >
                      <button
                        onClick={() => setDomainFlowStep('who-connects')}
                        className="text-sm text-[#6B7280] hover:text-[#1E1B4B] transition-colors mb-6 flex items-center gap-2"
                      >
                        ← Back
                      </button>

                      <h2 className="text-2xl font-bold mb-2 headline-font text-[#1E1B4B]">Connect <span className="headline-serif italic font-normal text-[#9B8CF7]">{domainInput || 'Your Domain'}</span></h2>
                      <p className="text-[#6B7280] mb-6">Follow these simple steps to link the domain to your client's new site.</p>

                      {/* GoDaddy One-Click Option */}
                      {domainProvider === 'godaddy' && (
                        <div className="mb-6 p-5 bg-gradient-to-r from-[#10B981]/10 to-[#ECFDF5] border border-[#10B981]/20 rounded-xl">
                          <div className="flex items-center gap-3 mb-3">
                            <Icons.Zap size={20} className="text-[#10B981]" />
                            <span className="font-semibold text-[#1E1B4B]">One-Click Connection Available!</span>
                          </div>
                          <p className="text-sm text-[#6B7280] mb-4">Since your domain is on GoDaddy, you can connect it automatically.</p>
                          <button
                            onClick={() => {
                              const result = generateConnectUrl(domainInput);
                              if (result.success && result.redirectUrl) {
                                window.open(result.redirectUrl, '_blank');
                              } else {
                                alert(result.message);
                              }
                            }}
                            className="w-full py-3 bg-[#10B981] text-white font-semibold rounded-xl hover:bg-[#059669] transition-colors flex items-center justify-center gap-2"
                          >
                            <Icons.Rocket size={18} />
                            Connect with GoDaddy
                          </button>
                        </div>
                      )}

                      {/* Manual Instructions */}
                      <div className="p-5 bg-white border border-[#9B8CF7]/20 rounded-xl mb-6">
                        <h3 className="font-semibold text-[#1E1B4B] mb-4">{domainProvider === 'godaddy' ? 'Or connect manually:' : 'How to connect:'}</h3>

                        <div className="space-y-4">
                          <div className="flex items-start gap-4">
                            <div className="w-8 h-8 bg-[#EDE9FE] rounded-full flex items-center justify-center text-sm font-bold text-[#9B8CF7] flex-shrink-0">1</div>
                            <div>
                              <div className="font-medium text-[#1E1B4B]">Log in to {domainProvider && domainProvider !== 'other' ? domainProvider.charAt(0).toUpperCase() + domainProvider.slice(1) : 'your domain provider'}</div>
                              <div className="text-sm text-[#6B7280]">Go to your domain settings or management area</div>
                            </div>
                          </div>

                          <div className="flex items-start gap-4">
                            <div className="w-8 h-8 bg-[#EDE9FE] rounded-full flex items-center justify-center text-sm font-bold text-[#9B8CF7] flex-shrink-0">2</div>
                            <div>
                              <div className="font-medium text-[#1E1B4B]">Find "Domain Settings" or "DNS"</div>
                              <div className="text-sm text-[#6B7280]">Look for where you can edit domain records</div>
                            </div>
                          </div>

                          <div className="flex items-start gap-4">
                            <div className="w-8 h-8 bg-[#EDE9FE] rounded-full flex items-center justify-center text-sm font-bold text-[#9B8CF7] flex-shrink-0">3</div>
                            <div>
                              <div className="font-medium text-[#1E1B4B]">Add these records</div>
                              <div className="text-sm text-[#6B7280] mb-3">Copy and paste these values:</div>

                              <div className="space-y-2">
                                {getFirebaseDNSRecords().map((rec, i) => (
                                  <div key={i} className="p-3 bg-[#F5F3FF] rounded-lg flex items-center justify-between text-sm">
                                    <span className="font-mono text-[#9B8CF7]">{rec.type}</span>
                                    <span className="text-[#6B7280]">{rec.name}</span>
                                    <code className="text-[#1E1B4B] bg-white px-2 py-1 rounded select-all text-xs">{rec.value}</code>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 bg-[#FEF3C7]/50 border border-[#F59E0B]/20 rounded-xl mb-6">
                        <p className="text-sm text-[#6B7280]">
                          <span className="font-semibold text-[#1E1B4B]">Note:</span> Changes can take up to 24 hours to go live, but usually happen within minutes.
                        </p>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setDomainFlowStep('success')}
                        className="w-full py-4 bg-[#9B8CF7] text-white font-semibold rounded-xl hover:bg-[#8B5CF6] transition-all"
                      >
                        I've Connected the Domain
                      </motion.button>

                      <button
                        onClick={() => setDomainFlowStep('client-handoff')}
                        className="w-full mt-3 py-3 text-[#6B7280] font-medium hover:text-[#9B8CF7] transition-colors"
                      >
                        Actually, I need to send this to my client
                      </button>
                    </motion.div>
                  )}

                  {/* STEP 3B: CLIENT HANDOFF FLOW */}
                  {domainFlowStep === 'client-handoff' && (
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4 }}
                      className="text-left"
                    >
                      <button
                        onClick={() => setDomainFlowStep('who-connects')}
                        className="text-sm text-[#6B7280] hover:text-[#1E1B4B] transition-colors mb-6 flex items-center gap-2"
                      >
                        ← Back
                      </button>

                      <div className="p-4 bg-[#ECFDF5] border border-[#10B981]/20 rounded-xl mb-6">
                        <div className="flex items-center gap-3">
                          <Icons.CheckCircle size={20} className="text-[#10B981]" />
                          <p className="text-sm text-[#1E1B4B]">
                            <span className="font-semibold">No problem!</span> This is very common. We'll give you everything your client needs.
                          </p>
                        </div>
                      </div>

                      <h2 className="text-2xl font-bold mb-2 headline-font text-[#1E1B4B]">Client <span className="headline-serif italic font-normal text-[#9B8CF7]">Handoff</span></h2>
                      <p className="text-[#6B7280] mb-6">Share these simple instructions with your client. Most complete this in 3–5 minutes.</p>

                      {/* Instructions Box */}
                      <div className="p-5 bg-white border border-[#9B8CF7]/20 rounded-xl mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="font-semibold text-[#1E1B4B]">Instructions for Your Client</h3>
                          <button
                            onClick={() => {
                              const instructions = `Hi! Here's how to connect your domain (${domainInput || 'your-domain.com'}) to your new website:\n\n1. Log in to your domain provider${domainProvider && domainProvider !== 'other' ? ` (${domainProvider.charAt(0).toUpperCase() + domainProvider.slice(1)})` : ''}\n2. Find "Domain Settings" or "DNS Settings"\n3. Add these records:\n${getFirebaseDNSRecords().map(r => `   - Type: ${r.type}, Name: ${r.name}, Value: ${r.value}`).join('\n')}\n\nThis takes about 3-5 minutes. Let me know when it's done!`;
                              navigator.clipboard.writeText(instructions);
                              alert('Instructions copied to clipboard!');
                            }}
                            className="text-sm text-[#9B8CF7] hover:text-[#8B5CF6] font-medium flex items-center gap-1"
                          >
                            <Icons.Copy size={14} /> Copy
                          </button>
                        </div>

                        <div className="p-4 bg-[#F9FAFB] rounded-lg text-sm text-[#6B7280] space-y-3">
                          <p><strong className="text-[#1E1B4B]">Hi!</strong> Here's how to connect your domain to your new website:</p>
                          <ol className="list-decimal list-inside space-y-2 ml-2">
                            <li>Log in to your domain provider{domainProvider && domainProvider !== 'other' ? ` (${domainProvider.charAt(0).toUpperCase() + domainProvider.slice(1)})` : ''}</li>
                            <li>Find "Domain Settings" or "DNS Settings"</li>
                            <li>Add these records:</li>
                          </ol>
                          <div className="ml-6 space-y-1 font-mono text-xs bg-white p-3 rounded border border-[#9B8CF7]/10">
                            {getFirebaseDNSRecords().map((rec, i) => (
                              <div key={i}>Type: {rec.type}, Name: {rec.name}, Value: {rec.value}</div>
                            ))}
                          </div>
                          <p className="text-[#10B981] font-medium">This takes about 3-5 minutes. Let me know when it's done!</p>
                        </div>
                      </div>

                      {/* Email Option */}
                      <div className="p-5 bg-white border border-[#9B8CF7]/20 rounded-xl mb-6">
                        <h3 className="font-semibold text-[#1E1B4B] mb-3">Or email instructions directly</h3>
                        <div className="flex gap-3">
                          <input
                            type="email"
                            value={clientEmail}
                            onChange={(e) => setClientEmail(e.target.value)}
                            className="flex-1 p-3 bg-[#F9FAFB] border border-[#9B8CF7]/20 rounded-xl outline-none focus:ring-2 focus:ring-[#9B8CF7]/30 text-[#1E1B4B] placeholder:text-[#A8A3B3] text-sm"
                            placeholder="client@email.com"
                          />
                          <button
                            onClick={() => {
                              if (clientEmail) {
                                const subject = encodeURIComponent(`Connect your domain: ${domainInput || 'your-domain.com'}`);
                                const body = encodeURIComponent(`Hi!\n\nHere's how to connect your domain to your new website:\n\n1. Log in to your domain provider${domainProvider && domainProvider !== 'other' ? ` (${domainProvider.charAt(0).toUpperCase() + domainProvider.slice(1)})` : ''}\n2. Find "Domain Settings" or "DNS Settings"\n3. Add these records:\n${getFirebaseDNSRecords().map(r => `   - Type: ${r.type}, Name: ${r.name}, Value: ${r.value}`).join('\n')}\n\nThis takes about 3-5 minutes. Let me know when it's done!`);
                                window.open(`mailto:${clientEmail}?subject=${subject}&body=${body}`, '_blank');
                              }
                            }}
                            disabled={!clientEmail}
                            className="px-5 py-3 bg-[#9B8CF7] text-white font-semibold rounded-xl hover:bg-[#8B5CF6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Send Email
                          </button>
                        </div>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        onClick={() => {
                          setDomainConnectionStatus('waiting');
                          setDomainFlowStep('waiting');
                        }}
                        className="w-full py-4 bg-[#1E1B4B] text-white font-semibold rounded-xl hover:bg-[#2D2A5B] transition-all flex items-center justify-center gap-2"
                      >
                        <Icons.Clock size={18} />
                        Mark as Waiting for Client
                      </motion.button>

                      <button
                        onClick={() => setDomainFlowStep('success')}
                        className="w-full mt-3 py-3 text-[#6B7280] font-medium hover:text-[#9B8CF7] transition-colors"
                      >
                        Skip — I'll handle this later
                      </button>
                    </motion.div>
                  )}

                  {/* WAITING STATE */}
                  {domainFlowStep === 'waiting' && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                    >
                      <div className="w-20 h-20 bg-[#FEF3C7] rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Icons.Clock size={40} className="text-[#F59E0B]" />
                      </div>

                      <h2 className="text-2xl font-bold mb-2 headline-font text-[#1E1B4B]">Waiting for <span className="headline-serif italic font-normal text-[#F59E0B]">Client</span></h2>
                      <p className="text-[#6B7280] mb-2">Domain: <span className="font-semibold text-[#1E1B4B]">{domainInput || 'your-domain.com'}</span></p>
                      <p className="text-sm text-[#6B7280] mb-8">Most clients complete this the same day.</p>

                      <div className="space-y-4 max-w-sm mx-auto">
                        <motion.button
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setDomainFlowStep('client-handoff')}
                          className="w-full py-4 bg-white border border-[#9B8CF7]/20 text-[#1E1B4B] font-semibold rounded-xl hover:border-[#9B8CF7]/50 transition-all flex items-center justify-center gap-2"
                        >
                          <Icons.Copy size={18} />
                          Resend Instructions
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.01 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => setDomainFlowStep('success')}
                          className="w-full py-4 bg-[#9B8CF7] text-white font-semibold rounded-xl hover:bg-[#8B5CF6] transition-all flex items-center justify-center gap-2"
                        >
                          <Icons.Check size={18} />
                          My Client Says It's Done
                        </motion.button>

                        <button
                          onClick={() => setStep(WizardStep.SUCCESS)}
                          className="w-full py-3 text-[#6B7280] font-medium hover:text-[#9B8CF7] transition-colors"
                        >
                          Continue to Dashboard →
                        </button>
                      </div>

                      <div className="mt-10 p-4 bg-[#F9FAFB] rounded-xl">
                        <p className="text-sm text-[#6B7280]">
                          You can always check back on this from your <span className="font-semibold text-[#1E1B4B]">My Clients</span> tab.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* SUCCESS STATE */}
                  {domainFlowStep === 'success' && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5 }}
                    >
                      <div className="w-20 h-20 bg-[var(--accent-pink-soft)] rounded-2xl flex items-center justify-center mx-auto mb-6">
                        <Icons.CheckCircle size={40} className="text-[var(--accent-pink)]" />
                      </div>

                      <h2 className="text-3xl font-bold mb-4 headline-font text-[#1E1B4B]">You're <span className="headline-serif italic font-normal text-[var(--accent-pink)]">All Set!</span></h2>
                      <p className="text-[#6B7280] mb-8 max-w-md mx-auto">
                        {domainConnectionStatus === 'connected'
                          ? `Your client's site is now live at ${domainInput}!`
                          : 'You can manage domain settings anytime from your client dashboard.'}
                      </p>

                      <motion.button
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setDomainFlowStep('initial');
                          setDomainInput('');
                          setDomainProvider('');
                          setWhoConnects(null);
                          setClientEmail('');
                          setStep(WizardStep.SUCCESS);
                        }}
                        className="px-8 py-4 bg-[#9B8CF7] text-white font-semibold rounded-xl shadow-lg hover:bg-[#8B5CF6] transition-all"
                      >
                        Go to Dashboard
                      </motion.button>
                    </motion.div>
                  )}
                </div>
              )}

              {step === WizardStep.TRACK_STATUS && (
                <div className="max-w-6xl mx-auto w-full py-10 text-left px-6">
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="flex flex-col md:flex-row justify-between items-start md:items-end mb-16 gap-6"
                  >
                    <div>
                      <h1 className="text-5xl font-bold headline-font">{showArchived ? 'Archived' : 'Active'} <span className="headline-serif italic font-normal text-[var(--accent-pink)]">Portfolio</span></h1>
                      <p className="text-[#6B6478] font-medium text-xs font-black mt-2">
                        Managing {leads.filter(l => !l.archived).length} active clients
                        {leads.filter(l => l.archived).length > 0 && (
                          <button
                            onClick={() => setShowArchived(!showArchived)}
                            className="ml-2 text-[#9B8CF7] hover:underline"
                          >
                            {showArchived ? 'Show Active' : `View Archived (${leads.filter(l => l.archived).length})`}
                          </button>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => { setStep(WizardStep.KNOWLEDGE_BASE); setSelectedKbTopic(null); }}
                        className="px-6 py-3.5 bg-white border border-[#9B8CF7]/10 rounded-xl text-[#A8A3B3] font-semibold text-sm tracking-widest hover:border-[var(--accent-pink)]/50 hover:text-[var(--accent-pink)] transition-all flex items-center gap-3"
                      >
                        <Icons.Book size={16} /> Knowledge Base
                      </button>
                      <div className="flex bg-white p-1 rounded-xl border border-[#9B8CF7]/10 mx-2">
                        <button
                          onClick={() => setIsCompactView(false)}
                          className={`p-2.5 rounded-lg transition-all ${!isCompactView ? 'bg-[#EDE9FE] text-[#9B8CF7] shadow-inner' : 'text-[#6B6478] hover:text-zinc-300'}`}
                          title="Detailed View"
                        >
                          <Icons.CRM size={16} />
                        </button>
                        <button
                          onClick={() => setIsCompactView(true)}
                          className={`p-2.5 rounded-lg transition-all ${isCompactView ? 'bg-[#EDE9FE] text-[#9B8CF7] shadow-inner' : 'text-[#6B6478] hover:text-zinc-300'}`}
                          title="Compact View"
                        >
                          <Icons.Folder size={16} />
                        </button>
                      </div>
                      <button onClick={() => setStep(WizardStep.CATEGORY)} className="px-6 py-3.5 bg-gradient-to-r from-[#9B8CF7]/10 to-[var(--accent-pink)]/10 border border-[var(--accent-pink)]/20 rounded-xl text-[var(--accent-pink)] font-semibold text-sm tracking-widest hover:bg-[var(--accent-pink)]/20 transition-all">
                        New Prospect +
                      </button>
                    </div>
                  </motion.div>

                  <div className={`${isCompactView ? 'grid gap-4' : 'grid gap-8'}`}>
                    {leads.filter(l => showArchived ? l.archived : !l.archived).map((lead, index) => (
                      <motion.div
                        key={lead.id}
                        layout
                        initial={{ opacity: 0, y: 30, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ duration: 0.5, delay: index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className={`bg-white/50 border border-[#9B8CF7]/10 rounded-3xl shadow-3xl text-left overflow-hidden relative group ${isCompactView ? 'p-6 rounded-3xl' : 'p-10'}`}
                      >
                        <div className={`flex flex-col md:flex-row justify-between items-start md:items-center gap-6 ${isCompactView ? 'mb-0' : 'mb-10'}`}>
                          <div className="flex-1">
                            <h3 className={`${isCompactView ? 'text-xl' : 'text-3xl'} font-bold mb-1 headline-font flex items-center gap-4`}>
                              {lead.business.name}
                              {isCompactView && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${lead.status === 'Paid' ? 'bg-[var(--accent-pink-soft)] text-[var(--accent-pink)]' : 'bg-[#EDE9FE] text-[#6B6478]'}`}>
                                  {lead.status}
                                </span>
                              )}
                            </h3>
                            {!isCompactView && <div className="text-[#6B6478] text-sm font-medium">Client ID: {lead.id} • Last Activity: {lead.date}</div>}
                            {isCompactView && <div className="text-[#6B6478] text-xs font-bold font-medium">Value: ${lead.projectValue} + ${lead.monthlyValue}/mo</div>}
                          </div>

                          {!isCompactView && (
                            <div className="flex items-center gap-2 bg-[#F5F3FF] p-2 rounded-2xl border border-[#9B8CF7]/10">
                              {STATUSES.map(s => (
                                <button key={s} onClick={() => updateLeadStatus(lead.id, s)} className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${lead.status === s ? 'bg-[#9B8CF7] text-white shadow-lg' : 'text-[#6B6478] hover:text-[#9B8CF7]'}`}>
                                  {s}
                                </button>
                              ))}
                            </div>
                          )}

                          {isCompactView && (
                            <div className="flex items-center gap-2">
                              <button onClick={() => { setBlueprint(lead.blueprint!); setBlueprintHistory([lead.blueprint!]); setEditingLeadId(lead.id); setStep(WizardStep.EDIT_WEBSITE); }} className="px-4 py-2 bg-[var(--accent-pink-soft)] rounded-lg text-xs font-medium text-[var(--accent-pink)] hover:bg-[var(--accent-pink)] hover:text-white transition-colors">Edit ✨</button>
                              {lead.archived ? (
                                <button onClick={() => handleUnarchiveLead(lead.id)} className="px-4 py-2 bg-[#9B8CF7]/10 rounded-lg text-xs font-medium text-[#9B8CF7] hover:bg-[#9B8CF7] hover:text-white transition-all flex items-center gap-1">
                                  <Icons.ArchiveRestore size={14} /> Restore
                                </button>
                              ) : (
                                <button onClick={() => handleArchiveLead(lead.id)} className="px-4 py-2 bg-amber-500/10 rounded-lg text-xs font-medium text-amber-500 hover:bg-amber-500 hover:text-white transition-all flex items-center gap-1">
                                  <Icons.Archive size={14} /> Archive
                                </button>
                              )}
                              <button onClick={() => handleDeleteLead(lead.id)} className="px-4 py-2 bg-red-500/10 rounded-lg text-xs font-medium text-red-500 hover:bg-red-500 hover:text-white transition-all">Delete</button>
                            </div>
                          )}
                        </div>

                        {/* Preview Link Section */}
                        {!isCompactView && lead.previewDeployment && (
                          <div className="mt-6 p-6 bg-white/30 rounded-3xl border border-[#9B8CF7]/10">
                            <div className="flex items-center justify-between mb-4">
                              <div className="text-sm font-black text-[#6B6478] font-medium flex items-center gap-2">
                                <Icons.Globe size={14} /> Preview Link
                              </div>
                              {lead.previewDeployment.expiresAt && (
                                <div className={`text-xs font-medium ${getDaysRemaining(lead.previewDeployment.expiresAt) > 0 ? 'text-amber-500' : 'text-red-500'}`}>
                                  {getDaysRemaining(lead.previewDeployment.expiresAt) > 0
                                    ? `${getDaysRemaining(lead.previewDeployment.expiresAt)} days remaining`
                                    : 'Expired'}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 bg-[#F5F3FF] rounded-xl px-4 py-3 border border-[#9B8CF7]/10 overflow-hidden">
                                <div className="text-xs text-[#A8A3B3] truncate">{lead.previewDeployment.previewUrl}</div>
                              </div>
                              <button
                                onClick={() => navigator.clipboard.writeText(lead.previewDeployment!.previewUrl)}
                                className="px-4 py-3 bg-[#EDE9FE] rounded-xl text-xs font-medium text-[#6B7280] hover:text-white hover:bg-[#9B8CF7] transition-all"
                              >
                                Copy
                              </button>
                              <a
                                href={lead.previewDeployment.previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-4 py-3 bg-[#9B8CF7]/20 border border-[#9B8CF7]/30 rounded-xl text-xs font-medium text-[#9B8CF7] hover:bg-[#9B8CF7]/30 transition-all"
                              >
                                View
                              </a>
                            </div>
                          </div>
                        )}

                        {/* Domain Connect Section */}
                        {!isCompactView && (
                          <div className="mt-6 p-6 bg-white/30 rounded-3xl border border-[#9B8CF7]/10">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-black text-[#6B6478] font-medium flex items-center gap-2">
                                <Icons.Globe size={14} /> Domain Connection
                              </div>
                              {lead.hosting?.customDomain ? (
                                <div className="text-xs font-medium text-[#9B8CF7] flex items-center gap-2">
                                  <span className="w-2 h-2 bg-[var(--accent-pink)] rounded-full animate-pulse"></span>
                                  {lead.hosting.customDomain}
                                </div>
                              ) : (
                                <button
                                  onClick={() => {
                                    setExpandedDomainLeadId(expandedDomainLeadId === lead.id ? null : lead.id);
                                    setCardDomainInput('');
                                    setShowManualDNS(false);
                                  }}
                                  className="px-4 py-2 bg-[#EDE9FE] rounded-xl text-xs font-medium text-[#6B7280] hover:text-[#9B8CF7] hover:bg-[#F5F3FF] transition-all"
                                >
                                  {expandedDomainLeadId === lead.id ? 'Close' : 'Connect Domain'}
                                </button>
                              )}
                            </div>

                            {/* Expanded Domain Connect Panel */}
                            {expandedDomainLeadId === lead.id && !lead.hosting?.customDomain && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-6 pt-6 border-t border-[#9B8CF7]/10"
                              >
                                <div className="mb-4">
                                  <label className="text-xs font-medium text-[#6B6478] mb-2 block">Enter Domain Name</label>
                                  <input
                                    type="text"
                                    value={cardDomainInput}
                                    onChange={(e) => setCardDomainInput(e.target.value)}
                                    placeholder="example.com"
                                    className="w-full px-4 py-3 bg-[#F5F3FF] border border-[#9B8CF7]/15 rounded-xl text-white text-sm focus:border-[#9B8CF7]/50 focus:outline-none transition-colors"
                                  />
                                </div>

                                {cardDomainInput && (
                                  <div className="space-y-3">
                                    {/* GoDaddy Option */}
                                    <button
                                      onClick={() => {
                                        const result = generateConnectUrl(cardDomainInput);
                                        if (result.success && result.redirectUrl) {
                                          window.open(result.redirectUrl, '_blank');
                                        }
                                      }}
                                      className="w-full p-4 bg-gradient-to-r from-[#9B8CF7]/20 to-[#9B8CF7]/10 border border-[#9B8CF7]/30 rounded-xl text-left hover:border-[#9B8CF7]/50 transition-all group"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="text-sm font-medium text-[#9B8CF7] mb-1">GoDaddy (Recommended)</div>
                                          <div className="text-xs text-[#6B6478]">One-click connection - DNS configured automatically</div>
                                        </div>
                                        <Icons.ArrowRight size={16} className="text-[#9B8CF7] group-hover:translate-x-1 transition-transform" />
                                      </div>
                                    </button>

                                    {/* Manual DNS Option */}
                                    <button
                                      onClick={() => setShowManualDNS(!showManualDNS)}
                                      className="w-full p-4 bg-[#EDE9FE]/50 border border-[#9B8CF7]/15 rounded-xl text-left hover:border-white/20 transition-all"
                                    >
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="text-sm font-medium text-[#A8A3B3] mb-1">Manual DNS Setup</div>
                                          <div className="text-xs text-[#6B6478]">For other registrars (Namecheap, Bluehost, etc.)</div>
                                        </div>
                                        <Icons.ArrowRight size={16} className={`text-[#6B6478] transition-transform ${showManualDNS ? 'rotate-90' : ''}`} />
                                      </div>
                                    </button>

                                    {/* Manual DNS Records */}
                                    {showManualDNS && (
                                      <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="p-4 bg-[#F5F3FF] rounded-xl border border-[#9B8CF7]/10"
                                      >
                                        <div className="text-xs font-medium text-[#6B6478] mb-4">Add these DNS records:</div>
                                        <div className="space-y-2 font-mono text-xs">
                                          {getManualDNSRecords(cardDomainInput).map((record, idx) => (
                                            <div key={idx} className="flex gap-4 p-2 bg-white rounded-lg">
                                              <span className="text-[#9B8CF7] w-12">{record.type}</span>
                                              <span className="text-[#A8A3B3] w-24">{record.host}</span>
                                              <span className="text-zinc-300 flex-1 truncate">{record.value}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </motion.div>
                                    )}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </div>
                        )}

                        {!isCompactView && (
                          <div className="grid md:grid-cols-4 gap-6 pt-6 mt-6 border-t border-[#9B8CF7]/10">
                            <div className="p-6 bg-white/30 rounded-3xl border border-[#9B8CF7]/10">
                              <div className="text-sm font-black text-[#6B6478] font-medium mb-2">Deal Value</div>
                              <div className="text-2xl font-bold text-[#1E1B4B]">${lead.projectValue}</div>
                            </div>
                            <div className="p-6 bg-white/30 rounded-3xl border border-[#9B8CF7]/10">
                              <div className="text-sm font-black text-[#6B6478] font-medium mb-2">Retainer</div>
                              <div className="text-2xl font-bold text-[#1E1B4B]">${lead.monthlyValue}/mo</div>
                            </div>
                            <button onClick={() => { setSelectedMarketplaceLead(lead); setStep(WizardStep.MARKETPLACE); }} className="p-6 bg-[#9B8CF7]/10 border border-[#9B8CF7]/20 rounded-3xl text-white font-semibold text-sm tracking-widest hover:bg-[#9B8CF7]/20 transition-all flex items-center justify-center gap-2">
                              <Icons.Sparkles size={16} /> Add Paid AI Features
                            </button>
                            <div className="flex flex-col gap-2">
                              <button onClick={() => { setBlueprint(lead.blueprint!); setBlueprintHistory([lead.blueprint!]); setEditingLeadId(lead.id); setStep(WizardStep.EDIT_WEBSITE); }} className="flex-1 bg-[#EDE9FE]/50 border border-[#9B8CF7]/10 rounded-2xl text-[#9B8CF7] font-semibold text-sm tracking-widest hover:bg-[#EDE9FE] transition-all flex items-center justify-center gap-2">
                                <Icons.Sparkles size={16} /> Edit with AI
                              </button>
                              <button onClick={() => handleDeleteLead(lead.id)} className="py-2 bg-red-900/10 text-red-500/50 hover:text-red-500 hover:bg-red-500/10 text-xs font-semibold tracking-[0.3em] rounded-xl transition-all">
                                Wipe Client
                              </button>
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {step === WizardStep.MARKETPLACE && (
                <div className="w-full py-10">
                  {!selectedMarketplaceLead ? (
                    <div className="text-center px-6">
                      <h1 className="text-5xl font-bold mb-16 headline-font">Select <span className="headline-serif italic font-normal text-[#9B8CF7]">Client</span></h1>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 text-left">
                        {leads.map(lead => (
                          <button key={lead.id} onClick={() => setSelectedMarketplaceLead(lead)} className="p-10 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl hover:border-[#9B8CF7]/50 transition-all">
                            <h3 className="text-xl font-bold mb-2 headline-font">{lead.business.name}</h3>
                            <div className="text-sm text-[#6B6478] font-semibold">Current Lead Status: {lead.status}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-6xl mx-auto text-left px-6">
                      <button onClick={() => setSelectedMarketplaceLead(null)} className="text-sm font-medium text-[#6B6478] mb-10 block transition-colors">← Back to Marketplace</button>
                      <div className="flex justify-between items-start mb-16">
                        <div>
                          <h1 className="text-5xl font-bold mb-4 headline-font">Grow <span className="headline-serif italic font-normal text-[#9B8CF7]">{selectedMarketplaceLead.business.name}</span></h1>
                          <p className="text-[#6B6478] font-light">Increase recurring revenue with ready-to-inject AI modules.</p>
                        </div>
                        {selectedMarketplaceLead.blueprint && (
                          <button onClick={() => { setBlueprint(selectedMarketplaceLead.blueprint!); setEditingLeadId(selectedMarketplaceLead.id); setStep(WizardStep.EDIT_WEBSITE); }} className="px-6 py-3 border border-[#9B8CF7]/15 rounded-xl text-sm font-medium hover:bg-white/5 transition-all">
                            View Client Site
                          </button>
                        )}
                      </div>

                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 text-left">
                        {MARKETPLACE_SERVICES.map(service => {
                          const Icon = Icons[service.icon as keyof typeof Icons];
                          const isInstalled = selectedMarketplaceLead.requestedServices?.includes(service.id);
                          return (
                            <div key={service.id} className={`p-10 bg-white/40 border rounded-3xl flex flex-col shadow-2xl relative transition-all ${isInstalled ? 'border-[#9B8CF7]/50' : 'border-[#9B8CF7]/10'}`}>
                              <div className="mb-8">{Icon ? <Icon size={48} /> : null}</div>
                              <h3 className="text-2xl font-bold mb-4 headline-font">{service.title}</h3>
                              <p className="text-[#6B6478] text-sm font-light mb-8 flex-1 leading-relaxed">{service.description}</p>
                              <div className="mt-auto pt-8 border-t border-[#9B8CF7]/10">
                                <div className="flex justify-between items-center mb-6">
                                  <span className="text-xs font-semibold text-[#6B6478]">Investment</span>
                                  <span className="text-2xl font-bold text-[#1E1B4B]">${service.suggestedPrice}</span>
                                </div>
                                <button
                                  onClick={() => handleOrderService(service)}
                                  disabled={isInjecting || isInstalled}
                                  className={`w-full py-5 rounded-2xl font-semibold text-sm tracking-widest shadow-xl transition-all ${isInstalled ? 'bg-[#9B8CF7]/20 text-[#B5A8E0] cursor-default' : 'bg-[#9B8CF7] text-white hover:bg-[#9B8CF7]'}`}
                                >
                                  {isInstalled ? 'Service Active ✓' : (isInjecting ? 'Configuring...' : 'Order for Client')}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === WizardStep.SETTINGS && (
                <div className="max-w-4xl mx-auto w-full py-10 text-left px-6">
                  <div className="mb-16">
                    <h1 className="text-5xl font-bold headline-font mb-4">Account <span className="headline-serif italic font-normal text-[#9B8CF7]">Settings</span></h1>
                    <p className="text-[#6B6478] font-light">Manage your profile, platform preferences, and security.</p>
                  </div>

                  <div className="grid gap-8 pb-20">
                    <section className="p-10 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl shadow-2xl">
                      <h3 className="text-xl font-bold headline-font mb-8">Current <span className="headline-serif italic font-normal text-[#9B8CF7]">Plan</span></h3>
                      <div className="flex flex-col md:flex-row gap-8 items-start">
                        <div className="flex-1 p-6 bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] rounded-2xl border border-[#9B8CF7]/20">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-[#9B8CF7] to-[var(--accent-pink)] rounded-xl flex items-center justify-center">
                              <Icons.Sparkles size={20} className="text-white" />
                            </div>
                            <div>
                              <p className="font-bold text-[#1E1B4B] headline-font">Free Plan</p>
                              <p className="text-xs text-[#6B6478]">Basic features included</p>
                            </div>
                          </div>
                          <div className="space-y-2 mb-6">
                            <div className="flex items-center gap-2 text-sm text-[#6B6478]">
                              <Icons.Check size={16} className="text-[#9B8CF7]" />
                              <span>1 Site Generation (one-time)</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-[#6B6478]">
                              <Icons.Check size={16} className="text-[#9B8CF7]" />
                              <span>5 AI Edits (one-time)</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-[#6B6478]">
                              <Icons.Check size={16} className="text-[#9B8CF7]" />
                              <span>Subdomain Hosting</span>
                            </div>
                          </div>
                          <p className="text-xs text-[var(--accent-pink)] italic font-medium">Free trial - tokens do not renew</p>
                        </div>
                        <div className="flex flex-col gap-3 min-w-[200px]">
                          <button onClick={() => setStep(WizardStep.EARNINGS)} className="w-full py-3 px-6 bg-[#9B8CF7] text-white rounded-xl font-semibold text-sm hover:bg-[#8B5CF6] transition-colors">
                            Upgrade Plan
                          </button>
                          <button
                            onClick={async () => {
                              try {
                                await stripeService.openBillingPortal(window.location.href);
                              } catch (error) {
                                console.error('Failed to open billing portal:', error);
                                alert('Unable to open billing portal. Please try again.');
                              }
                            }}
                            className="w-full py-3 px-6 bg-transparent border border-[#9B8CF7]/30 text-[#6B6478] rounded-xl font-medium text-sm hover:border-[#9B8CF7] hover:text-[#9B8CF7] transition-colors"
                          >
                            Manage Subscription
                          </button>
                          <button
                            onClick={async () => {
                              const confirmed = window.confirm(
                                'Are you sure you want to cancel your subscription? You will retain access until the end of your current billing period.'
                              );
                              if (confirmed) {
                                try {
                                  const result = await stripeService.cancelSubscription();
                                  if (result.success) {
                                    alert(`Subscription cancelled. You have access until ${new Date(result.endsAt).toLocaleDateString()}.`);
                                  }
                                } catch (error) {
                                  console.error('Failed to cancel subscription:', error);
                                  alert('Unable to cancel subscription. Please try again or contact support.');
                                }
                              }
                            }}
                            className="w-full py-2 px-6 text-red-400 text-xs font-medium hover:text-red-500 transition-colors"
                          >
                            Cancel Plan
                          </button>
                        </div>
                      </div>
                    </section>

                    <section className="p-10 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl shadow-2xl">
                      <h3 className="text-xl font-bold headline-font mb-8">Platform <span className="headline-serif italic font-normal text-[#9B8CF7]">Preferences</span></h3>
                      <div className="space-y-6">
                        <div className="flex items-center justify-between p-4 bg-[#F5F3FF] rounded-2xl border border-[#9B8CF7]/10">
                          <div>
                            <p className="text-xs font-bold text-[#1E1B4B]">Email Notifications</p>
                            <p className="text-sm text-[#6B6478]">Receive alerts when clients view your proposals.</p>
                          </div>
                          <div className="w-12 h-6 bg-gradient-to-r from-[#9B8CF7] to-[var(--accent-pink)] rounded-full relative p-1 cursor-pointer">
                            <div className="w-4 h-4 bg-white rounded-full ml-auto" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-4 bg-[#F5F3FF] rounded-2xl border border-[#9B8CF7]/10">
                          <div>
                            <p className="text-xs font-bold text-[#1E1B4B]">Compact View by Default</p>
                            <p className="text-sm text-[#6B6478]">Toggle the layout style of your client portfolio.</p>
                          </div>
                          <div className="w-12 h-6 bg-[#EDE9FE] rounded-full relative p-1 cursor-pointer">
                            <div className="w-4 h-4 bg-zinc-500 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </section>

                    <section className="p-10 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl shadow-2xl">
                      <h3 className="text-xl font-bold headline-font mb-8">Security & <span className="headline-serif italic font-normal text-[#9B8CF7]">Password</span></h3>
                      <form onSubmit={handlePasswordUpdate} className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <label className="text-sm font-black text-[#6B6478] font-medium">New Password</label>
                            <input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full p-4 bg-[#F5F3FF] border border-[#9B8CF7]/10 rounded-2xl outline-none focus:ring-2 focus:ring-[#9B8CF7]/20"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-black text-[#6B6478] font-medium">Confirm New Password</label>
                            <input
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="••••••••"
                              className="w-full p-4 bg-[#F5F3FF] border border-[#9B8CF7]/10 rounded-2xl outline-none focus:ring-2 focus:ring-[#9B8CF7]/20"
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          disabled={isUpdatingPassword}
                          className="px-8 py-4 bg-[#9B8CF7] text-white font-semibold text-sm tracking-widest rounded-xl hover:bg-[#9B8CF7] transition-all shadow-xl disabled:opacity-50"
                        >
                          {isUpdatingPassword ? 'Updating...' : 'Update Password'}
                        </button>
                      </form>
                    </section>

                  </div>
                </div>
              )}

              {step === WizardStep.KNOWLEDGE_BASE && (
                <div className="max-w-6xl mx-auto w-full py-10 text-left px-6 min-h-[calc(100vh-80px)] flex flex-col">
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="mb-16"
                  >
                    <h1 className="text-5xl font-bold headline-font mb-4">Agency <span className="headline-serif italic font-normal text-[#9B8CF7]">Academy</span></h1>
                    <p className="text-[#6B6478] font-light">Master the strategy of high-profit outreach and scaling.</p>
                  </motion.div>

                  <AnimatePresence mode="wait">
                    {!selectedKbTopic ? (
                      <motion.div
                        key="kb-grid"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 pb-20"
                      >
                        <motion.button
                          initial={{ opacity: 0, y: 30, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                          whileHover={{ scale: 1.02, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedKbTopic('prospecting')}
                          className="p-10 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl flex flex-col items-center text-center gap-6 group hover:border-[#9B8CF7]/50 transition-all shadow-2xl"
                        >
                          <div className="w-16 h-16 bg-[#9B8CF7]/10 rounded-2xl flex items-center justify-center text-[#9B8CF7] group-hover:scale-110 transition-transform">
                            <Icons.Search size={32} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold headline-font mb-2">Lead Hunting</h3>
                            <p className="text-sm text-[#6B6478] font-bold font-medium">Prospecting Strategy</p>
                          </div>
                        </motion.button>

                        <motion.button
                          initial={{ opacity: 0, y: 30, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                          whileHover={{ scale: 1.02, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedKbTopic('design')}
                          className="p-10 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl flex flex-col items-center text-center gap-6 group hover:border-[#9B8CF7]/50 transition-all shadow-2xl"
                        >
                          <div className="w-16 h-16 bg-[#9B8CF7]/10 rounded-2xl flex items-center justify-center text-[#9B8CF7] group-hover:scale-110 transition-transform">
                            <Icons.Sparkles size={32} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold headline-font mb-2">AI Styling</h3>
                            <p className="text-sm text-[#6B6478] font-bold font-medium">Natural Language UI</p>
                          </div>
                        </motion.button>

                        <motion.button
                          initial={{ opacity: 0, y: 30, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.5, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                          whileHover={{ scale: 1.02, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedKbTopic('sales')}
                          className="p-10 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl flex flex-col items-center text-center gap-6 group hover:border-[#9B8CF7]/50 transition-all shadow-2xl"
                        >
                          <div className="w-16 h-16 bg-[#9B8CF7]/10 rounded-2xl flex items-center justify-center text-[#9B8CF7] group-hover:scale-110 transition-transform">
                            <Icons.Rocket size={32} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold headline-font mb-2">Closing Deals</h3>
                            <p className="text-sm text-[#6B6478] font-bold font-medium">The Outreach Script</p>
                          </div>
                        </motion.button>

                        <motion.button
                          initial={{ opacity: 0, y: 30, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          transition={{ duration: 0.5, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                          whileHover={{ scale: 1.02, y: -4 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedKbTopic('margins')}
                          className="p-10 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl flex flex-col items-center text-center gap-6 group hover:border-[#9B8CF7]/50 transition-all shadow-2xl"
                        >
                          <div className="w-16 h-16 bg-[#9B8CF7]/10 rounded-2xl flex items-center justify-center text-[#9B8CF7] group-hover:scale-110 transition-transform">
                            <Icons.CRM size={32} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold headline-font mb-2">Economics</h3>
                            <p className="text-sm text-[#6B6478] font-bold font-medium">Profit & ROI</p>
                          </div>
                        </motion.button>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="kb-content"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="flex-1 pb-20"
                      >
                        <button onClick={() => setSelectedKbTopic(null)} className="text-sm font-semibold text-[#6B6478] tracking-widest mb-10 hover:text-white transition-colors">← Back to Academy</button>

                        {selectedKbTopic === 'prospecting' && (
                          <section className="p-10 bg-white/60 border border-[#9B8CF7]/10 rounded-3xl shadow-lg">
                            <h3 className="text-2xl font-bold headline-font mb-3 text-[#1E1B4B]">Finding the Right <span className="headline-serif italic font-normal text-[#9B8CF7]">Businesses to Help</span></h3>

                            <p className="text-[#6B7280] font-light leading-relaxed mb-8">
                              The best opportunities come from businesses that either don't have a website yet or have one that's outdated.
                            </p>

                            <div className="grid md:grid-cols-2 gap-5 mb-8">
                              <div className="p-5 bg-[#F5F3FF] rounded-2xl border border-[#9B8CF7]/15">
                                <p className="text-[#1E1B4B] font-semibold mb-2">No Website</p>
                                <p className="text-[#6B7280] text-sm leading-relaxed">These businesses aren't visible online yet. A professional site helps customers find them.</p>
                              </div>

                              <div className="p-5 bg-[#F5F3FF] rounded-2xl border border-[#9B8CF7]/15">
                                <p className="text-[#1E1B4B] font-semibold mb-2">Outdated Website</p>
                                <p className="text-[#6B7280] text-sm leading-relaxed">These businesses know they need an update. A modern preview makes it easy to say yes.</p>
                              </div>
                            </div>

                            <div className="p-4 bg-[var(--accent-pink-soft)] rounded-xl border-l-2 border-[var(--accent-pink)]">
                              <p className="text-sm text-[#6B7280]"><span className="font-medium text-[var(--accent-pink)]">Helpful Tip:</span> Local service businesses like salons, contractors, and restaurants often need a refresh.</p>
                            </div>
                          </section>
                        )}

                        {selectedKbTopic === 'design' && (
                          <section className="p-12 bg-white/60 border border-[#9B8CF7]/10 rounded-3xl shadow-lg">
                            <div className="max-w-2xl">
                              <h3 className="text-3xl font-bold headline-font mb-4 text-[#1E1B4B]">Design Your Site With <span className="headline-serif italic font-normal text-[#9B8CF7]">Simple Instructions</span></h3>

                              <p className="text-[#6B7280] font-light leading-relaxed mb-10">
                                Just describe what you want, and the AI handles the design and copy for you. No design experience needed.
                              </p>

                              <div className="space-y-5 mb-10">
                                <p className="text-[#1E1B4B] font-medium">Fonts, colors, and spacing chosen automatically</p>
                                <p className="text-[#1E1B4B] font-medium">Clear, persuasive copy written for you</p>
                                <p className="text-[#1E1B4B] font-medium">A polished, modern layout that looks professional</p>
                              </div>

                              <div className="p-6 bg-[var(--accent-pink-soft)] rounded-2xl border border-[var(--accent-pink)]/30">
                                <p className="text-sm text-[var(--accent-pink)] font-medium mb-2">Example:</p>
                                <p className="text-[#1E1B4B] italic font-medium">"Make this site feel calm, modern, and welcoming."</p>
                              </div>
                            </div>
                          </section>
                        )}

                        {selectedKbTopic === 'sales' && (
                          <section className="p-10 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl shadow-2xl">
                            <div className="flex items-center gap-6 mb-8">
                              <div className="w-16 h-16 bg-[#9B8CF7]/10 rounded-2xl flex items-center justify-center text-[#9B8CF7]">
                                <Icons.Rocket size={32} />
                              </div>
                              <h3 className="text-3xl font-bold headline-font">The <span className="headline-serif italic font-normal text-[#9B8CF7]">'Show, Don't Tell'</span> Strategy</h3>
                            </div>
                            <div className="space-y-6 text-[#A8A3B3] font-light leading-relaxed">
                              <p>The secret to high conversion is simple: Never ask a business owner if they 'want' a website. <span className="text-white font-bold">Show them their new website instead.</span></p>
                              <div className="p-8 bg-[var(--accent-pink-soft)] rounded-3xl border border-[var(--accent-pink)]/20 space-y-4">
                                <p className="text-xs font-semibold text-[var(--accent-pink)]">The Winning Script</p>
                                <p className="italic text-lg text-[#1E1B4B]">"Hi [Name], I noticed your business didn't have a professional mobile presence, so I took the liberty of building a modern draft for [Business Name]. Check it out here: [Your Demo Link]. What do you think?"</p>
                              </div>
                              <p>When an owner sees their own name on a beautiful, fast-loading site, it becomes an emotional decision. Use the <span className="text-white font-bold">WhatsApp Bridge</span> or Email proposal tools to deliver the demo link directly to their phone.</p>
                            </div>
                          </section>
                        )}

                        {selectedKbTopic === 'margins' && (
                          <section className="p-10 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl shadow-2xl">
                            <div className="flex items-center gap-6 mb-8">
                              <div className="w-16 h-16 bg-[#9B8CF7]/10 rounded-2xl flex items-center justify-center text-[#9B8CF7]">
                                <Icons.CRM size={32} />
                              </div>
                              <h3 className="text-3xl font-bold headline-font">Maximizing Your <span className="headline-serif italic font-normal text-[#9B8CF7]">Agency Margins</span></h3>
                            </div>
                            <div className="space-y-6 text-[#A8A3B3] font-light leading-relaxed">
                              <p>Our platform is built for profitability. We handle the complex infrastructure so you can focus on sales. Understand your unit economics to scale effectively.</p>
                              <div className="grid md:grid-cols-3 gap-6">
                                <div className="p-6 bg-[#F5F3FF] rounded-2xl border border-[#9B8CF7]/10">
                                  <p className="text-sm font-semibold text-[#6B6478] mb-2">Operation Model</p>
                                  <p className="text-xl font-bold text-[#1E1B4B]">Fully Managed Cloud</p>
                                </div>
                                <div className="p-6 bg-[#F5F3FF] rounded-2xl border border-[#9B8CF7]/10">
                                  <p className="text-sm font-semibold text-[#6B6478] mb-2">Suggested Price</p>
                                  <p className="text-xl font-bold text-[#9B8CF7]">$499 Setup</p>
                                </div>
                                <div className="p-6 bg-[#F5F3FF] rounded-2xl border border-[#9B8CF7]/10">
                                  <p className="text-sm font-semibold text-[#6B6478] mb-2">Profit Strategy</p>
                                  <p className="text-xl font-bold text-[#9B8CF7]">High-Margin Recurring</p>
                                </div>
                              </div>
                              <p>The <span className="text-[#1E1B4B] font-bold">Monthly Retainer</span> you charge your clients covers the platform management and puts high-margin recurring revenue in your pocket. As you scale, upgrade your plan to unlock custom domains and lower your overall overhead.</p>
                            </div>
                          </section>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {step === WizardStep.REFERRALS && (
                <div className="max-w-5xl mx-auto w-full py-10 text-left px-6 min-h-[calc(100vh-80px)]">
                  <div className="mb-16">
                    <h1 className="text-5xl font-bold headline-font mb-4">Partner <span className="headline-serif italic font-normal text-[#9B8CF7]">Growth</span></h1>
                    <p className="text-[#6B6478] font-light">Bring other agency owners to RenovateMySite and unlock free infrastructure.</p>
                  </div>

                  <div className="grid lg:grid-cols-2 gap-8 mb-16">
                    <div className="p-10 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl shadow-3xl">
                      <h3 className="text-2xl font-bold headline-font mb-8">Your <span className="headline-serif italic font-normal text-[#9B8CF7]">Referral Link</span></h3>
                      <div className="p-6 bg-[#F5F3FF] border border-[#9B8CF7]/10 rounded-3xl mb-8 flex items-center justify-between group">
                        <code className="text-xs text-[#A8A3B3] truncate max-w-[250px]">{referralLink}</code>
                        <button onClick={copyReferral} className="p-3 bg-[#9B8CF7]/10 text-[#9B8CF7] rounded-xl hover:bg-[#9B8CF7] hover:text-white transition-all">
                          <Icons.Sparkles size={16} />
                        </button>
                      </div>
                      <div className="flex gap-4">
                        <button onClick={copyReferral} className="flex-1 py-4 bg-[#EDE9FE] text-[#6B7280] font-semibold text-sm tracking-widest rounded-xl hover:bg-[#9B8CF7] hover:text-white transition-all">WhatsApp</button>
                        <button onClick={copyReferral} className="flex-1 py-4 bg-[#EDE9FE] text-[#6B7280] font-semibold text-sm tracking-widest rounded-xl hover:bg-[#9B8CF7] hover:text-white transition-all">Email</button>
                      </div>
                    </div>

                    <div className="p-10 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl shadow-3xl flex flex-col justify-between">
                      <div>
                        <h3 className="text-2xl font-bold headline-font mb-2">Network <span className="headline-serif italic font-normal text-[#9B8CF7]">Stats</span></h3>
                        <p className="text-sm font-black text-[#6B6478] font-medium mb-8">Track your impact</p>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 bg-[#F5F3FF] rounded-3xl border border-[#9B8CF7]/10 text-center">
                          <div className="text-3xl font-bold text-[#1E1B4B] mb-1">{referralCount}</div>
                          <div className="text-xs font-black text-[#6B6478] font-medium">Joined Users</div>
                        </div>
                        <div className="p-6 bg-[var(--accent-pink-soft)] rounded-3xl border border-[var(--accent-pink)]/30 text-center">
                          <div className="text-3xl font-bold text-[var(--accent-pink)] mb-1">{referralCount * 20}</div>
                          <div className="text-xs font-black text-[var(--accent-pink)] font-medium">Tokens Earned</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-10 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl shadow-3xl">
                    <h3 className="text-2xl font-bold headline-font mb-10">Milestone <span className="headline-serif italic font-normal text-[#9B8CF7]">Rewards</span></h3>
                    <div className="space-y-6">
                      {REFERRAL_REWARDS.MILESTONES.map((m, idx) => {
                        const progress = (referralCount / m.target) * 100;
                        const isAchieved = referralCount >= m.target;
                        return (
                          <div key={idx} className={`p-8 rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-8 transition-all ${isAchieved ? 'bg-[#9B8CF7]/10 border-[#9B8CF7]/30' : 'bg-[#F5F3FF] border-[#9B8CF7]/10'}`}>
                            <div className="flex items-center gap-6 text-left w-full md:w-auto">
                              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isAchieved ? 'bg-[#9B8CF7] text-white' : 'bg-white text-[#6B6478]'}`}>
                                {m.icon}
                              </div>
                              <div>
                                <div className={`text-lg font-bold ${isAchieved ? 'text-[#9B8CF7]' : 'text-[#6B7280]'}`}>{m.reward}</div>
                                <div className="text-sm font-black text-[#6B6478] font-medium">Requirement: {m.target} Invites</div>
                              </div>
                            </div>
                            <div className="flex-1 w-full max-md">
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-semibold text-[#6B6478] tracking-widest">Progress</span>
                                <span className="text-xs font-semibold text-[#9B8CF7] tracking-widest">{referralCount} / {m.target}</span>
                              </div>
                              <div className="h-2 bg-white rounded-full overflow-hidden shadow-inner">
                                <div
                                  className={`h-full transition-all duration-1000 ${isAchieved ? 'bg-[#9B8CF7]' : 'bg-[#9B8CF7]/50'}`}
                                  style={{ width: `${Math.min(100, progress)}%` }}
                                />
                              </div>
                            </div>
                            {isAchieved && <span className="text-[#9B8CF7] font-bold">UNLOCKED ✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {step === WizardStep.HELP_SUPPORT && (
                <div className="max-w-3xl mx-auto w-full py-10 text-center px-6">
                  <div className="mb-16">
                    <h1 className="text-5xl font-bold headline-font mb-4">Help & <span className="headline-serif italic font-normal text-[#9B8CF7]">Support</span></h1>
                    <p className="text-[#6B6478] font-light">Need a hand? Our team is ready to help you grow your agency.</p>
                  </div>

                  <div className="p-12 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl shadow-3xl text-left">
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="text-sm font-black text-[#6B6478] font-medium">Issue Type</label>
                        <select className="w-full p-4 bg-[#F5F3FF] border border-[#9B8CF7]/10 rounded-2xl outline-none focus:ring-2 focus:ring-[#9B8CF7]/20 appearance-none text-[#A8A3B3]">
                          <option>General Question</option>
                          <option>Billing Issue</option>
                          <option>Technical Bug</option>
                          <option>Feature Request</option>
                        </select>
                      </div>
                      <div className="space-y-4">
                        <label className="text-sm font-black text-[#6B6478] font-medium">Description</label>
                        <textarea placeholder="How can we help?" className="w-full h-40 p-4 bg-[#F5F3FF] border border-[#9B8CF7]/10 rounded-2xl outline-none focus:ring-2 focus:ring-[#9B8CF7]/20 resize-none" />
                      </div>
                      <button className="w-full py-5 bg-[#9B8CF7] text-white font-semibold text-sm tracking-widest rounded-2xl shadow-xl hover:bg-[#9B8CF7] transition-all">Submit Support Ticket</button>
                    </div>
                  </div>

                  <div className="mt-12 flex justify-center gap-12 text-[#6B6478]">
                    <div className="text-center">
                      <p className="text-sm font-medium mb-1">Email Support</p>
                      <p className="text-sm font-bold text-[#1E1B4B]">help@renovatemysite.app</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium mb-1">Response Time</p>
                      <p className="text-sm font-bold text-[#1E1B4B]">&lt; 12 Hours</p>
                    </div>
                  </div>
                </div>
              )}

              {step === WizardStep.EARNINGS && (
                <div className="max-w-6xl mx-auto w-full py-10 text-left px-6">
                  <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="text-5xl font-bold mb-16 headline-font"
                  >
                    Credits & <span className="headline-serif italic font-normal text-[var(--accent-pink)]">Economy</span>
                  </motion.h1>
                  <div className="grid md:grid-cols-4 gap-6 mb-16">
                    <motion.div
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="p-8 bg-white/50 border border-[var(--accent-pink)]/20 rounded-2xl shadow-2xl"
                    >
                      <span className="text-[var(--accent-pink)] font-semibold text-xs tracking-widest mb-4 block">Available Edits</span>
                      <div className="text-4xl font-bold text-[#1E1B4B] headline-font">{availableEditTokens}</div>
                      <p className="text-xs text-[#6B6478] mt-4 uppercase font-black">AI Edit Tokens</p>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="p-8 bg-white/50 border border-[#9B8CF7]/10 rounded-2xl shadow-2xl"
                    >
                      <span className="text-[#6B6478] font-semibold text-xs tracking-widest mb-4 block">Total Profit</span>
                      <div className="text-4xl font-bold text-[#1E1B4B] headline-font">${stats.netProfit.toFixed(2)}</div>
                      <p className="text-xs text-[#6B6478] mt-4 uppercase font-black">After platform costs</p>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 30, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="p-8 bg-gradient-to-br from-[#9B8CF7] to-[var(--accent-pink)] rounded-2xl shadow-3xl shadow-[var(--accent-pink)]/20"
                    >
                      <span className="text-white/70 font-semibold text-xs tracking-widest mb-4 block">Current Plan</span>
                      <div className="text-3xl font-bold text-white headline-font">{activePlan.name}</div>
                      <p className="text-xs text-white/50 mt-4 uppercase font-black">
                        {userPlanId === 'free' ? 'One-Time Trial' : 'Renewing Monthly'}
                      </p>
                    </motion.div>
                  </div>

                  {/* Referral Quick Access Card */}
                  <motion.button
                    initial={{ opacity: 0, y: 30, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                    whileHover={{ scale: 1.01, y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setStep(WizardStep.REFERRALS)}
                    className="w-full mb-16 p-10 bg-gradient-to-r from-[#9B8CF7]/10 to-[var(--accent-pink-soft)] border border-[var(--accent-pink)]/20 rounded-3xl flex items-center justify-between group hover:border-[var(--accent-pink)]/40 transition-all"
                  >
                    <div className="flex items-center gap-8 text-left">
                      <div className="w-16 h-16 bg-gradient-to-br from-[#9B8CF7] to-[var(--accent-pink)] rounded-2xl flex items-center justify-center text-white shadow-xl shadow-[var(--accent-pink)]/20">
                        <Icons.Rocket size={32} className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold headline-font text-[#1E1B4B]">Refer & <span className="headline-serif italic font-normal text-[var(--accent-pink)]">Earn Tokens</span></h3>
                        <p className="text-[#6B6478] text-sm font-light">Get 20 AI Edit tokens for every agency owner that joins.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-[#6B6478] tracking-widest group-hover:text-[var(--accent-pink)] transition-colors">Go to Hub</span>
                      <div className="p-4 bg-white rounded-full text-[var(--accent-pink)] group-hover:translate-x-2 transition-transform">
                        <Icons.Sparkles size={20} />
                      </div>
                    </div>
                  </motion.button>

                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="grid lg:grid-cols-2 gap-12"
                  >
                    <section>
                      <h2 className="text-2xl font-bold headline-font mb-8">Account <span className="headline-serif italic font-normal text-[var(--accent-pink)]">Top-Ups</span></h2>
                      <div className="space-y-4">
                        {TOPUP_PACKS.map((pack, index) => (
                          <motion.button
                            key={pack.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, delay: 0.6 + index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                            whileHover={{ scale: 1.01, x: 4 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => handleTopup(pack.id)}
                            className="w-full p-8 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl flex items-center justify-between hover:border-[var(--accent-pink)] transition-all group"
                          >
                            <div className="flex items-center gap-6">
                              <span className="text-4xl">{pack.icon}</span>
                              <div className="text-left">
                                <div className="text-lg font-bold group-hover:text-[var(--accent-pink)] transition-colors">{pack.name}</div>
                                <div className="text-sm text-[#6B6478] uppercase font-black">Instant Activation</div>
                              </div>
                            </div>
                            <div className="text-2xl font-bold text-[var(--accent-pink)]">${pack.price}</div>
                          </motion.button>
                        ))}
                      </div>
                    </section>
                    <section>
                      <h2 className="text-2xl font-bold headline-font mb-8">Available <span className="headline-serif italic font-normal text-[#9B8CF7]">Plans</span></h2>
                      <div className="space-y-4">
                        {PLATFORM_PLANS.filter(p => p.id !== userPlanId).map((plan, index) => (
                          <motion.button
                            key={plan.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.4, delay: 0.6 + index * 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
                            whileHover={{ scale: 1.01, x: -4 }}
                            whileTap={{ scale: 0.99 }}
                            onClick={() => handlePlanChange(plan.id)}
                            className="w-full p-8 bg-white/40 border border-[#9B8CF7]/10 rounded-3xl text-left hover:border-[#9B8CF7] transition-all group"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div className="text-lg font-bold group-hover:text-[#9B8CF7]">{plan.name}</div>
                              <div className="text-xl font-bold text-[#1E1B4B]">${plan.price}/mo</div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {plan.features.slice(0, 3).map((f, i) => (
                                <span key={i} className="px-3 py-1 bg-[#F5F3FF] text-xs font-semibold text-[#9B8CF7] rounded-lg">{f}</span>
                              ))}
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </section>
                  </motion.div>
                </div>
              )}

              {step === WizardStep.ADMIN && (
                <AdminProvider>
                  <AdminCommandCenter onExit={() => setStep(WizardStep.TRACK_STATUS)} />
                </AdminProvider>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Public Landing Footer - Only show on CATEGORY step when NOT authenticated */}
      {!isAuthenticated && step === WizardStep.CATEGORY && (
        <footer className="h-20 bg-white/80 backdrop-blur-md border-t border-[#9B8CF7]/10 flex items-center justify-center px-10">
          <div className="max-w-6xl w-full flex justify-between items-center">
            <div className="text-[#6B6478] text-xs font-semibold tracking-[0.3em]">
              © 2024 Renovatemysite. All rights reserved.
            </div>
            <div className="flex items-center gap-8">
              <a href="#" className="text-[#6B6478] text-xs font-medium hover:text-white transition-colors">Privacy</a>
              <a href="#" className="text-[#6B6478] text-xs font-medium hover:text-white transition-colors">Terms</a>
              <a href="#" className="text-[#6B6478] text-xs font-medium hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </footer>
      )}

      {/* Wizard Footer - Only show for authenticated users during wizard steps */}
      {isAuthenticated && !isSplitView && step < WizardStep.SUCCESS && step < WizardStep.SETTINGS && step !== WizardStep.ADMIN && step !== WizardStep.MARKETPLACE && step !== WizardStep.EARNINGS && step !== WizardStep.TRACK_STATUS && step !== WizardStep.KNOWLEDGE_BASE && step !== WizardStep.REFERRALS && (step as any) !== WizardStep.CATEGORY && (
        <footer className="h-24 bg-white/80 backdrop-blur-md border-t border-[#9B8CF7]/10 flex items-center justify-center px-10 sticky bottom-0 z-50">
          <div className="max-w-4xl w-full flex justify-between items-center">
            <div className="flex items-center gap-6 w-full md:w-auto">
              <button onClick={prevStep} disabled={step <= 1 || isGenerating} className="px-10 py-4 bg-[#EDE9FE] text-[#6B7280] rounded-2xl font-semibold text-sm hover:bg-[#9B8CF7] hover:text-white disabled:opacity-20">Back</button>

              <button onClick={nextStep} disabled={step >= 9 || isGenerating || step === WizardStep.CATEGORY || step === WizardStep.LOCATION || step === WizardStep.SEARCHING} className="px-12 py-4 bg-[#9B8CF7] text-white rounded-2xl font-semibold text-sm hover:bg-[#9B8CF7] disabled:opacity-20 shadow-xl shadow-[#9B8CF7]/20">Next Step</button>

              {/* Relocated Small Status Bar to the right of Next Step (Percentage Removed) */}
              <div className="flex flex-col items-start gap-1.5 ml-2 min-w-[100px]">
                <div className="flex gap-3 items-center leading-none">
                  <span className="text-xs font-black text-[#6B6478] font-medium">Step {Math.min(step, 10)} of 10</span>
                </div>
                <div className="w-24 h-1 bg-[#EDE9FE] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#9B8CF7] transition-all duration-500 ease-out"
                    style={{ width: `${(Math.min(step, 10) / 10) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </footer>
      )}

      {/* Beta Feedback Widget - Show for authenticated users */}
      {isAuthenticated && <BetaFeedbackWidget userId={authEmail} userEmail={authEmail} />}
    </div>
  );
};

export default App;
