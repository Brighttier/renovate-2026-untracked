
export enum BusinessCategory {
  DENTIST = 'Dentist',
  RESTAURANT = 'Restaurant',
  SALON = 'Salon',
  GYM = 'Gym',
  PLUMBER = 'Plumber'
}

export type CategoryInput = BusinessCategory | string;

export enum WizardStep {
  LANDING = 0,    // Landing page for unauthenticated users
  CATEGORY = 1,
  LOCATION = 2,
  SEARCHING = 3,
  SELECT_BUSINESS = 4,
  AI_CREATING = 5,
  PREVIEW = 6,
  PROMPT_LIBRARY = 7,
  PREVIEW_DEPLOY = 8,    // Deploy temporary preview before pricing
  PRICING_CONFIG = 9,
  SEND_PROPOSAL = 10,
  SUCCESS = 11,
  TRACK_STATUS = 12,
  MARKETPLACE = 13,
  EARNINGS = 14,
  EDIT_WEBSITE = 15,
  ADMIN = 16,
  SETTINGS = 17,
  KNOWLEDGE_BASE = 18,
  HELP_SUPPORT = 19,
  REFERRALS = 20,
  DOMAIN_SETUP = 21,
  PRIVACY_POLICY = 22,
  TERMS_OF_SERVICE = 23
}

export interface Business {
  id: string;
  name: string;
  rating: number;
  address: string;
  websiteStatus: 'None' | 'Outdated' | 'Modern';
  contactEmail?: string;
  phone?: string;
  websiteUrl?: string;  // For scraping original assets
  googleMapsUrl?: string;
  userRatingsTotal?: number;  // Google Maps total reviews count
  types?: string[];  // Business types from Google Maps (e.g., ["restaurant", "food"])
}

// ==========================================
// BUSINESS RESEARCH & SCRAPING TYPES
// ==========================================

export interface BusinessResearchData {
  name: string;
  address: string;
  phone?: string;
  email?: string;
  hours?: Record<string, string>;
  services?: string[];
  rating?: number;
  reviewCount?: number;
  websiteUrl?: string;
  googleMapsUrl?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    yelp?: string;
  };
  extractedAssets?: ExtractedAssets;
}

export interface ExtractedAssets {
  logo?: string;
  images: ExtractedImage[];
  content?: {
    hero?: string;
    about?: string;
    services?: string[];
    testimonials?: string[];
  };
  colorPalette?: string[];
}

export interface ExtractedImage {
  url: string;
  alt: string;
  type: 'logo' | 'hero' | 'gallery' | 'team' | 'product' | 'service' | 'other';
  storedUrl?: string;  // Firebase Storage URL after storing
  dimensions?: {
    width: number;
    height: number;
  };
  // Deep-Multimodal fields (v3.0)
  semanticCaption?: string;        // 10-word AI caption describing image content
  extractedText?: string[];        // OCR text detected via Vision TEXT_DETECTION
  dominantColors?: string[];       // Up to 3 hex colors via IMAGE_PROPERTIES
  visionConfidence?: number;       // Vision API confidence score (0-1)
  base64?: string;                 // Inline storage for reliable injection
  placeholderId?: string;          // e.g., "[[ID_HERO_1_HERE]]"
}

export type ImagePreference = 'extract' | 'generate' | 'hybrid';

// ==========================================
// SITE IDENTITY TYPES (Site Modernization v2.0)
// ==========================================

export interface NavigationLink {
  label: string;
  href: string;        // Normalized anchor: #services, #about, etc.
  isExternal: boolean;
}

// Product/Service image identified for enhancement
export interface ProductImage {
  originalUrl: string;              // URL from the original site
  alt: string;                      // Alt text or description
  context: string;                  // Where it was found (hero, services, gallery, etc.)
  editPrompt?: string;              // AI-generated prompt for Nano Banana enhancement
  enhancedUrl?: string;             // URL after Nano Banana processing
}

// Enhanced image with context (for deep scraping)
export interface SiteImage {
  url: string;
  alt: string;
  context: 'hero' | 'services' | 'gallery' | 'team' | 'general';
  width?: number;
  height?: number;
  base64?: string;                  // Optional inline storage for reliability
}

// Extracted page content from multi-page crawling
export interface ExtractedPage {
  url: string;
  title: string;
  path: string;                     // /about, /services, etc.
  headings: string[];               // All h1, h2, h3
  paragraphs: string[];             // All meaningful text
  listItems: string[];              // All bullet points
  rawMarkdown: string;              // Full page as markdown
}

// Service extracted from the site
export interface ExtractedService {
  name: string;
  description: string;
  imageUrl?: string;
  features?: string[];
}

// Real testimonial from the site (NO HALLUCINATION)
export interface ExtractedTestimonial {
  quote: string;
  authorName: string;
  authorTitle?: string;             // "Member since 2020" or "Google Review"
  rating?: number;                  // 1-5 stars
  source?: string;                  // "Google", "Yelp", original site
}

// Team member info
export interface ExtractedTeamMember {
  name: string;
  role: string;
  bio?: string;
  imageUrl?: string;
}

// FAQ item
export interface ExtractedFAQ {
  question: string;
  answer: string;
}

// Contact information
export interface ContactInfo {
  phone?: string;
  email?: string;
  address?: string;
}

// Social media links
export interface SocialLinks {
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  yelp?: string;
}

// ENHANCED SITE IDENTITY - Stores ALL extracted content (v2.0)
export interface SiteIdentity {
  // Basic info
  businessName: string;
  tagline: string;
  sourceUrl: string;
  extractedAt: string;

  // Visual assets
  logoUrl: string | null;
  logoBase64?: string;              // Store logo inline for reliability
  heroImages: SiteImage[];          // Hero/banner images
  galleryImages: SiteImage[];       // All other images

  // Brand colors - ALL of them (up to 5)
  primaryColors: string[];          // Up to 5 colors (primary, secondary, accent, etc.)

  // Navigation
  navigation: NavigationLink[];

  // Content from ALL pages (multi-page scraping)
  pages: ExtractedPage[];           // Content from each scraped page

  // Structured content (extracted from pages)
  services: ExtractedService[];     // Real services with descriptions
  testimonials: ExtractedTestimonial[];  // REAL testimonials (no hallucination)
  teamMembers: ExtractedTeamMember[];    // Real team members
  faqs: ExtractedFAQ[];                  // Real FAQs
  coreValues: string[];                   // Mission/values/vision statements

  // Contact
  contactInfo: ContactInfo;
  socialLinks: SocialLinks;
  businessHours?: string;

  // Metadata
  visualVibe: string;               // AI-analyzed brand personality from screenshot
  screenshotBase64?: string;        // Optional: pass to Gemini for multimodal analysis
  contentSparsity: 'rich' | 'moderate' | 'sparse';

  // Legacy fields (for backwards compatibility)
  fullCopy?: string;                // Markdown of main page content (deprecated, use pages[])
  productImages?: ProductImage[];   // Legacy image format (deprecated, use heroImages/galleryImages)

  // Deep-Multimodal fields (v3.0)
  extractedFacts?: ExtractedFact[];         // OCR facts from logos, flyers, signage
  accentColor?: string | null;              // Exact accent color via IMAGE_PROPERTIES
  visionAnalysisComplete?: boolean;         // Flag indicating Vision API processing done
  semanticImageMap?: SemanticImageMap;      // Section-to-image mapping for smart placement
}

export type ModernizationStyle =
  | 'saas-modern'
  | 'bento-grid'
  | 'high-end-minimal'
  | 'auto';

export interface ModernizationRequest {
  sourceUrl: string;
  businessName?: string;             // Override extracted name
  category?: string;                 // For color fallbacks
  designStyle?: ModernizationStyle;
  preserveColors?: boolean;          // Use extracted vs style defaults
  forceRefresh?: boolean;            // Bypass cache
}

export interface ModernizedSiteResponse {
  html: string;
  siteIdentity: SiteIdentity;
  designStyle: ModernizationStyle;
  thinking?: string;
  // v3.0 Deep-Multimodal fields
  pipelineVersion?: string;          // e.g., "3.0-deep-multimodal"
}

// ==========================================
// DEEP-MULTIMODAL PIPELINE TYPES (v3.0)
// ==========================================

// OCR-extracted facts from images (logos, flyers, signage)
export interface ExtractedFact {
  source: 'logo' | 'flyer' | 'hero' | 'signage';
  text: string;
  confidence: number;
  imageUrl: string;
}

// Semantic mapping of images to website sections
export interface SemanticImageMap {
  hero: ExtractedImage[];           // Images with hero-relevant captions
  services: ExtractedImage[];       // Service/product images
  about: ExtractedImage[];          // Team/office/about images
  testimonials: ExtractedImage[];   // Customer/social proof images
  gallery: ExtractedImage[];        // General portfolio images
}

// Configuration for Deep-Multimodal Pipeline
export interface DeepMultimodalConfig {
  // Crawling settings
  maxPages: number;                 // Default: 8
  crawlTimeout: number;             // Default: 120000ms
  priorityPaths: string[];          // ['/about', '/services', '/team', '/contact', ...]

  // Vision API settings
  enableOCR: boolean;               // Enable TEXT_DETECTION for OCR
  enableColorExtraction: boolean;   // Enable IMAGE_PROPERTIES for colors
  maxImagesForVision: number;       // Cost control: limit Vision API calls

  // Gemini settings
  thinkingLevel: 'none' | 'low' | 'high';
  model: string;                    // Default: 'gemini-2.5-flash-preview-05-20'
  maxOutputTokens: number;          // Default: 65536

  // Post-processing settings
  placeholderPrefix: string;        // Default: '[[ID_'
  placeholderSuffix: string;        // Default: '_HERE]]'
  injectBase64: boolean;            // Convert URLs to base64 for reliability
}

// Placeholder registry for asset injection
export interface PlaceholderRegistry {
  logo: { id: string; target: string | null };
  heroImages: { id: string; target: string | null }[];
  serviceImages: { id: string; target: string | null }[];
  galleryImages: { id: string; target: string | null }[];
  teamImages: { id: string; target: string | null }[];
}

// Default configuration for Deep-Multimodal Pipeline
export const DEFAULT_MULTIMODAL_CONFIG: DeepMultimodalConfig = {
  maxPages: 12,  // Increased for Total Content Modernization
  crawlTimeout: 180000,  // 3 minutes for exhaustive crawl
  priorityPaths: ['/about', '/services', '/team', '/contact', '/testimonials', '/reviews', '/staff', '/our-team', '/faq', '/pricing', '/gallery', '/portfolio'],
  enableOCR: true,
  enableColorExtraction: true,
  maxImagesForVision: 25,  // Increased for comprehensive analysis
  thinkingLevel: 'high',
  model: 'gemini-2.5-flash-preview-05-20',
  maxOutputTokens: 65536,
  placeholderPrefix: '[[ID_',
  placeholderSuffix: '_HERE]]',
  injectBase64: true,
};

// ==========================================
// TOTAL CONTENT MODERNIZATION TYPES (v4.0)
// ==========================================

/**
 * Semantic intent classification for extracted content
 * Distinguishes between different types of business content
 */
export type SemanticIntent =
  | 'vision_mission'      // Core philosophy, why we exist
  | 'value_proposition'   // What makes us unique
  | 'service_offering'    // What we do/sell
  | 'team_culture'        // Who we are, team info
  | 'social_proof'        // Testimonials, reviews, awards
  | 'operational'         // Hours, location, policies
  | 'educational'         // Blog, guides, how-to
  | 'legal'               // Privacy, terms, refund policy
  | 'promotional'         // Sales, offers, CTAs
  | 'unknown';

/**
 * Page content with semantic classification
 */
export interface SemanticPage extends ExtractedPage {
  semanticIntent: SemanticIntent;
  intentConfidence: number;        // 0-1 confidence score
  keyPhrases: string[];            // Important phrases extracted
  emotionalTone: 'professional' | 'friendly' | 'authoritative' | 'casual' | 'luxury';
  contentPriority: 'critical' | 'important' | 'supplementary';
}

/**
 * Vision-extracted hidden gem (from OCR on images)
 */
export interface HiddenGem {
  type: 'founding_date' | 'award' | 'certification' | 'slogan' | 'statistic' | 'location_detail' | 'unique_fact';
  text: string;
  source: string;                  // Image URL or description
  confidence: number;
  displaySuggestion?: string;      // How to display this (e.g., "Badge", "Hero subtitle")
}

/**
 * Rich image with full Vision analysis
 */
export interface EnrichedImage extends ExtractedImage {
  semanticCaption: string;         // What's in the image
  vibeDescription: string;         // The feeling/mood (e.g., "High-energy group class with focus on community")
  suggestedSection: 'hero' | 'services' | 'about' | 'gallery' | 'team' | 'testimonials' | 'features';
  visualElements: string[];        // Detected elements (people, equipment, food, etc.)
  brandAlignment: number;          // 0-1 how well it matches brand colors
}

/**
 * Consolidated footer data from entire site
 */
export interface ConsolidatedFooter {
  contactInfo: ContactInfo;
  socialLinks: SocialLinks;
  businessHours: {
    formatted: string;             // "Mon-Fri: 9am-5pm"
    structured?: Record<string, { open: string; close: string }>;
  } | null;
  legalLinks: Array<{ label: string; content: string }>;  // Privacy, Terms, etc.
  additionalLinks: Array<{ label: string; href: string }>;
  copyrightText: string;
  certifications: string[];        // "BBB Accredited", "Licensed & Insured"
}

/**
 * Consolidated header/navigation data
 */
export interface ConsolidatedHeader {
  logoUrl: string | null;
  logoBase64?: string;
  businessName: string;
  tagline: string | null;
  primaryNavigation: Array<{
    label: string;
    href: string;
    children?: Array<{ label: string; href: string }>;
  }>;
  ctaButton: {
    label: string;
    href: string;
    style: 'primary' | 'secondary';
  } | null;
  topBar?: {
    phone?: string;
    email?: string;
    announcement?: string;
  };
}

/**
 * UniversalBusinessDNA - The complete essence of a business
 * Consolidates ALL content from multi-page crawl + Vision analysis
 */
export interface UniversalBusinessDNA {
  // === IDENTITY ===
  businessName: string;
  tagline: string | null;
  sourceUrl: string;
  extractedAt: string;

  // === SOUL (Vision/Mission/Values) ===
  visionStatement: string | null;       // The aspirational "why"
  missionStatement: string | null;      // The practical "what we do"
  coreValues: string[];                 // Guiding principles
  brandPersonality: string;             // AI-analyzed personality (e.g., "Energetic & Community-Focused")
  uniqueSellingPoints: string[];        // What makes them different

  // === HIDDEN GEMS (Vision API Discoveries) ===
  hiddenGems: HiddenGem[];              // Facts found in images via OCR
  foundingStory: string | null;         // Origin story if found
  achievements: string[];               // Awards, certifications, milestones

  // === OFFERINGS ===
  services: ExtractedService[];
  products?: Array<{
    name: string;
    description: string;
    price?: string;
    imageUrl?: string;
  }>;
  pricingInfo: Array<{
    tier: string;
    price: string;
    features: string[];
  }>;

  // === PEOPLE ===
  teamMembers: ExtractedTeamMember[];
  teamCulture: string | null;           // Description of team/culture

  // === SOCIAL PROOF ===
  testimonials: ExtractedTestimonial[];
  reviewSummary: {
    averageRating: number | null;
    totalReviews: number | null;
    platforms: string[];                // "Google", "Yelp", etc.
  };
  mediaFeatures: string[];              // "As seen in...", press mentions

  // === CONTENT LIBRARY ===
  faqs: ExtractedFAQ[];
  blogPosts: Array<{
    title: string;
    excerpt: string;
    url: string;
  }>;
  educationalContent: string[];         // Tips, guides, how-tos

  // === VISUAL ASSETS ===
  enrichedImages: EnrichedImage[];      // All images with full analysis
  semanticImageMap: SemanticImageMap;   // Images organized by section
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;                     // Vision API extracted
    neutrals: string[];
  };

  // === CONTACT & OPERATIONS ===
  consolidatedHeader: ConsolidatedHeader;
  consolidatedFooter: ConsolidatedFooter;
  locations: Array<{
    name: string;
    address: string;
    phone?: string;
    hours?: string;
  }>;

  // === SEMANTIC PAGES ===
  semanticPages: SemanticPage[];        // All pages with intent classification

  // === METADATA ===
  contentSparsity: 'rich' | 'moderate' | 'sparse';
  visualVibe: string;
  industryCategory: string;
  totalPagesScraped: number;
  visionAnalysisComplete: boolean;
  pipelineVersion: string;              // "4.0-total-content"
}

/**
 * Configuration for Total Content Modernization
 */
export interface TotalContentConfig extends DeepMultimodalConfig {
  // Extended crawling
  maxPages: number;                      // Default: 12
  followExternalLinks: boolean;         // Follow links to social profiles for data
  extractBlogContent: boolean;          // Scrape blog posts

  // Vision analysis
  analyzeAllImages: boolean;            // Run Vision on every image
  generateVibeDescriptions: boolean;    // Generate mood/feeling captions

  // Content consolidation
  deduplicateContent: boolean;          // Remove duplicate text across pages
  mergeContactInfo: boolean;            // Consolidate all contact info found

  // Output
  preserveAllContent: boolean;          // Zero-waste policy
  generateSectionSuggestions: boolean;  // AI suggests which sections to create
}

export const DEFAULT_TOTAL_CONTENT_CONFIG: TotalContentConfig = {
  ...DEFAULT_MULTIMODAL_CONFIG,
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

export interface WebsitePlugin {
  id: string; // 'chatbot' | 'whatsapp' | 'booking' | 'simple-crm'
  config: Record<string, any>;
}

// ==========================================
// NAVBAR & FOOTER CUSTOMIZATION TYPES
// ==========================================

// Navigation link structure
export interface NavbarLink {
  id: string;
  label: string;
  href: string;  // "#section-id" for anchor links
}

// Navbar configuration
export interface WebsiteNavbar {
  enabled: boolean;
  style: 'transparent' | 'solid' | 'glass';
  position: 'fixed' | 'static';
  links: NavbarLink[];
  ctaButton?: { label: string; href: string };
}

// Footer column structure
export interface FooterColumn {
  id: string;
  title: string;
  links: { label: string; href: string }[];
}

// Footer configuration
export interface WebsiteFooter {
  enabled: boolean;
  style: 'minimal' | 'standard' | 'detailed';
  columns?: FooterColumn[];
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
  };
  copyright?: string;
  showNewsletter?: boolean;
}

// ==========================================
// DESIGN TEMPLATE SYSTEM (v5.0)
// ==========================================

/**
 * Design Template ID - 12 distinct visual styles
 */
export type DesignTemplateId =
  | 'glass-aurora'       // Glassmorphism + dark gradients (Tech/SaaS)
  | 'bold-brutalist'     // High contrast, geometric (Creative/Design)
  | 'soft-organic'       // Rounded, natural colors (Wellness/Spa)
  | 'dark-luxury'        // Dark + gold accents (Luxury/Finance)
  | 'clean-minimal'      // Maximum whitespace (Architecture/Photography)
  | 'bento-playful'      // Asymmetric cards (Retail/E-commerce)
  | 'editorial-magazine' // Serif headlines, editorial (Media/Publishing)
  | 'neon-cyber'         // Neon accents, futuristic (Gaming/Tech)
  | 'warm-artisan'       // Earthy, handcrafted (Restaurant/Cafe)
  | 'corporate-trust'    // Professional blues (Legal/Healthcare)
  | 'vibrant-startup'    // Gradient CTAs, energetic (Startups)
  | 'retro-nostalgic';   // Vintage colors (Boutique/Craft)

/**
 * Typography configuration for a template
 */
export interface TemplateTypography {
  hero: string;          // Hero headline size: "text-5xl md:text-6xl lg:text-7xl"
  h1: string;            // Section headers
  h2: string;            // Card headers
  h3: string;            // Subheadings
  body: string;          // Paragraph text
  small: string;         // Captions, labels
  lineHeight: string;    // "leading-tight" | "leading-relaxed"
  letterSpacing: string; // "tracking-tight" | "tracking-wide"
}

/**
 * Spacing rhythm configuration
 */
export interface TemplateSpacing {
  sectionPadding: string;   // "py-24 md:py-32" or "py-32 md:py-48"
  elementGap: string;       // "space-y-6" | "space-y-8"
  containerWidth: string;   // "max-w-6xl" | "max-w-7xl"
  containerPadding: string; // "px-6 lg:px-8"
}

/**
 * Visual elements configuration
 */
export interface TemplateVisual {
  borderRadius: string;  // "rounded-3xl" | "rounded-none" | "rounded-lg"
  shadowDepth: string;   // "shadow-none" | "shadow-lg" | "shadow-2xl"
  borderStyle: string;   // "border-none" | "border border-gray-200"
  cardStyle: string;     // Full card class string
  buttonStyle: string;   // Full button class string
  imageStyle: string;    // Image treatment classes
}

/**
 * Animation configuration
 */
export interface TemplateAnimation {
  entranceAnimation: string;  // "fadeInUp" | "slideInLeft" | "scaleIn"
  duration: string;           // "0.6s" | "0.8s" | "1.2s"
  easing: string;             // "ease-out" | "cubic-bezier(...)"
  staggerDelay: number;       // Base delay in ms (100, 150, 200)
  hoverEffect: string;        // "hover:scale-105" | "hover:-translate-y-2"
}

/**
 * Color strategy configuration
 */
export interface TemplateColor {
  backgroundMode: 'light' | 'dark' | 'mixed';
  heroBackground: string;     // Hero section background
  sectionAlternation: boolean; // Alternate light/dark sections
  accentUsage: 'buttons-only' | 'buttons-and-highlights' | 'everywhere';
  gradientStyle: string | null; // Gradient definition or null
  glassEffect: boolean;       // Enable glassmorphism
  glowEffect: boolean;        // Enable glow shadows
}

/**
 * Layout patterns configuration
 */
export interface TemplateLayout {
  heroLayout: 'centered' | 'left-aligned' | 'split' | 'fullscreen-image';
  servicesLayout: 'grid-3' | 'grid-2' | 'bento' | 'list' | 'cards-stacked';
  testimonialsLayout: 'carousel' | 'grid' | 'single-featured' | 'masonry';
  ctaLayout: 'centered' | 'left-with-image' | 'full-width-gradient';
  navbarStyle: 'transparent' | 'solid' | 'glass' | 'floating';
  footerStyle: 'minimal' | 'columns' | 'centered' | 'dark-gradient';
}

/**
 * Font pairing configuration
 */
export interface TemplateFonts {
  headlineFont: string;    // "Inter" | "Playfair Display" | "Space Grotesk"
  bodyFont: string;        // "Inter" | "DM Sans"
  headlineWeight: string;  // "font-bold" | "font-black"
  bodyWeight: string;      // "font-normal" | "font-light"
  googleFontsUrl: string;  // Full import URL
}

/**
 * Complete Design Template Definition
 */
export interface DesignTemplate {
  id: DesignTemplateId;
  name: string;           // Display name: "Glass Aurora"
  description: string;    // One-liner description

  // Core design tokens
  typography: TemplateTypography;
  spacing: TemplateSpacing;
  visual: TemplateVisual;
  animation: TemplateAnimation;
  color: TemplateColor;
  layout: TemplateLayout;
  fonts: TemplateFonts;

  // Section ordering preference
  sectionOrder: string[];

  // Auto-selection scoring (0-1 per industry)
  industryScores: Record<string, number>;

  // Vibe keywords for matching
  vibeKeywords: string[];

  // Trend metadata
  trendYear?: number;
  trendTags?: string[];

  // AI prompt fragment (injected into generation)
  promptFragment: string;
}

/**
 * Template selection request
 */
export interface TemplateSelectionRequest {
  userSelected?: DesignTemplateId;
  category?: string;
  visualVibe?: string;
  brandPersonality?: string;
  preferDarkMode?: boolean;
  preferMinimal?: boolean;
}

export interface WebsiteBlueprint {
  brand: {
    logoUrl?: string;
    logoOptions?: string[];
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    tone: string;
  };
  navbar?: WebsiteNavbar;
  sections: WebsiteSection[];
  footer?: WebsiteFooter;
  plugins?: WebsitePlugin[];
}

// Section type for website content blocks
export type WebsiteSectionType =
  | 'hero'
  | 'services'
  | 'about'
  | 'contact'
  | 'trust'
  | 'testimonials'
  | 'pricing'
  | 'faq'
  | 'gallery'
  | 'team'
  | 'features'
  | 'cta';

export interface WebsiteSection {
  id: string;
  type: WebsiteSectionType;
  title: string;
  content: string;
  cta?: string;
  imageUrl?: string;
  imagePrompt?: string;
}

export type LeadStatus = 'Sent' | 'Viewed' | 'Interested' | 'Approved' | 'Paid';

export interface HostingConfig {
  status: 'Pending' | 'Verifying' | 'Live' | 'Error';
  subdomain: string;
  customDomain?: string;
  connectionMethod?: 'GoDaddy' | 'Manual';
  ssl: boolean;
  provider: 'Firebase';
  // Domain connection tracking (1-click custom domain)
  domainConnectionId?: string;
  sslStatus?: 'pending' | 'provisioning' | 'active' | 'failed';
  verificationStatus?: 'pending' | 'verified' | 'failed';
  dnsStatus?: 'pending' | 'propagating' | 'configured';
  connectedAt?: string;
}

// ============================================================================
// Domain Connection Types (1-Click Custom Domain)
// ============================================================================

export type DomainConnectionStatus =
  | 'pending_verification'
  | 'verification_failed'
  | 'pending_dns'
  | 'dns_propagating'
  | 'pending_ssl'
  | 'ssl_provisioning'
  | 'connected'
  | 'error'
  | 'disconnected'
  // Firebase Hosting 1-Click statuses
  | 'creating_site'
  | 'deploying_content'
  | 'adding_domain'
  | 'rollback';

export type SSLStatus = 'pending' | 'provisioning' | 'active' | 'failed';

export interface DomainConnection {
  id: string;
  domain: string;
  subdomain?: string;
  agencyId: string;
  leadId: string;
  userId: string;
  firebaseSiteId: string;
  connectionMethod: 'GoDaddy' | 'Manual';
  status: DomainConnectionStatus;
  verificationToken: string;
  verificationTxtRecord: string;
  ownershipVerifiedAt?: string;
  dnsConfiguredAt?: string;
  dnsProvider?: string;
  sslStatus: SSLStatus;
  sslProvisionedAt?: string;
  sslCertExpiry?: string;
  sslErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
  connectedAt?: string;
  lastCheckAt?: string;
  checkCount: number;
  errorMessage?: string;
  errorCount: number;
}

export interface DNSRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'SRV' | 'NS';
  name: string;
  data: string;
  ttl: number;
}

// Domain function request/response types
export interface AddCustomDomainRequest {
  domain: string;
  siteId?: string;
  leadId: string;
  agencyId: string;
  connectionMethod: 'GoDaddy' | 'Manual';
}

export interface AddCustomDomainResponse {
  success: boolean;
  domainConnectionId: string;
  verificationToken: string;
  verificationTxtRecord: string;
  requiredRecords: DNSRecord[];
  status: DomainConnectionStatus;
  message: string;
}

export interface ConfigureGoDaddyDNSRequest {
  domain: string;
  domainConnectionId: string;
  verificationToken: string;
  includeWww?: boolean;
}

export interface ConfigureGoDaddyDNSResponse {
  success: boolean;
  recordsAdded: DNSRecord[];
  estimatedPropagationMinutes: number;
  message: string;
}

export interface GetDomainStatusResponse {
  domain: string;
  status: DomainConnectionStatus;
  sslStatus: SSLStatus;
  sslCertExpiry?: string;
  lastCheckedAt: string;
  steps: {
    domainRegistered: boolean;
    ownershipVerified: boolean;
    dnsConfigured: boolean;
    sslProvisioned: boolean;
  };
  message: string;
  errorMessage?: string;
}

export interface VerifyDomainOwnershipResponse {
  verified: boolean;
  status: DomainConnectionStatus;
  message: string;
  retryAfterMs?: number;
  currentTxtRecords?: string[];
  expectedTxtRecord?: string;
}

// ============================================================================
// Firebase Hosting 1-Click Connection Types
// ============================================================================

export interface FirebaseHostingConnectionRequest {
  domain: string;
  leadId: string;
  agencyId: string;
  userId: string;
  htmlContent: string;
  businessName: string;
  connectionMethod: 'firebase_auto' | 'godaddy_auto' | 'manual';
}

export interface FirebaseHostingConnectionResponse {
  success: boolean;
  connectionId?: string;
  siteId?: string;
  siteUrl?: string;
  customDomain?: string;
  status?: DomainConnectionStatus;
  dnsRecords?: FirebaseHostingDNSRecord[];
  error?: string;
}

export interface FirebaseHostingDNSRecord {
  type: 'A' | 'AAAA' | 'CNAME' | 'TXT';
  name: string;
  value: string;
  ttl: number;
  status: 'pending' | 'configured' | 'propagating' | 'active' | 'error';
}

export interface FirebaseHostingPollResponse {
  connectionId: string;
  domain: string;
  hostState: string;
  ownershipStatus: string;
  certState?: string;
  isComplete: boolean;
  requiresRetry: boolean;
  nextCheckDelay?: number;
  error?: string;
}

export interface PreviewDeployment {
  id: string;
  previewUrl: string;
  status: 'deploying' | 'live' | 'expired' | 'error';
  createdAt: string;
  expiresAt: string;
  errorMessage?: string;
}

export interface Lead {
  id: string;
  business: Business;
  status: LeadStatus;
  blueprint?: WebsiteBlueprint;
  projectValue?: number;
  monthlyValue?: number;
  date: string;
  requestedServices?: string[];
  hosting?: HostingConfig;
  previewDeployment?: PreviewDeployment;
  archived?: boolean;
  archivedAt?: string;
}

export interface MarketplaceService {
  id: string;
  title: string;
  description: string;
  platformFee: number;
  suggestedPrice: number;
  deliveryTime: string;
  icon: string;
}

// ==========================================
// MARKETPLACE SUBSCRIPTION TYPES
// ==========================================

export type MarketplaceServiceId = 'chatbot' | 'booking' | 'simple-crm' | 'bundle';

export interface MarketplacePricing {
  id: MarketplaceServiceId;
  name: string;
  setupFee: number;
  monthly: number;
  annual: number;
  limits: {
    messagesPerMonth?: number | 'unlimited';
    appointmentsPerMonth?: number | 'unlimited';
    leadsPerMonth?: number | 'unlimited';
    forms?: number;
  };
  overage?: {
    enabled: boolean;
    pricePerUnit: number;
    hardLimit: number;
  };
  includes?: MarketplaceServiceId[];
}

export interface MarketplaceOrder {
  id: string;
  userId: string;
  leadId: string;
  siteId: string;
  serviceId: MarketplaceServiceId;
  serviceName: string;
  setupFee: number;
  monthlyFee: number;
  status: 'pending' | 'paid' | 'deploying' | 'deployed' | 'failed' | 'cancelled';
  stripeSessionId?: string;
  stripeSubscriptionId?: string;
  stripePaymentId?: string;
  deployedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceCheckoutRequest {
  serviceId: MarketplaceServiceId;
  leadId: string;
  siteId: string;
  businessName: string;
  successUrl: string;
  cancelUrl: string;
}

export interface MarketplaceSubscription {
  id: string;
  userId: string;
  siteId: string;
  serviceId: MarketplaceServiceId;
  stripeSubscriptionId: string;
  status: 'active' | 'past_due' | 'cancelled' | 'trialing';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceUsage {
  siteId: string;
  serviceId: MarketplaceServiceId;
  period: string;  // "2025-02" format
  usage: {
    messagesReceived?: number;
    messagesAI?: number;
    tokensUsed?: number;
    appointmentsBooked?: number;
    remindersSent?: number;
    formsSubmitted?: number;
    leadsCreated?: number;
  };
  limits: {
    messagesIncluded?: number;
    overageEnabled?: boolean;
    overageRate?: number;
  };
  overageCharges: number;
  updatedAt: string;
}

// Service Cancellation
export interface ServiceCancellation {
  siteId: string;
  serviceId: MarketplaceServiceId;
  userId: string;
  stripeSubscriptionId: string;
  cancelAt: 'period_end' | 'immediately';
  reason?: string;
  dataExported: boolean;
  status: 'pending' | 'cancelled' | 'reactivated';
  cancelledAt: string;
  effectiveDate: string;
}

// Data Export
export interface DataExportRequest {
  siteId: string;
  serviceId: MarketplaceServiceId;
  dataTypes: string[];
  dateRange?: {
    from: string;
    to: string;
  };
  format: 'csv' | 'excel' | 'json' | 'ical';
}

export interface DataExportResult {
  downloadUrl: string;
  filename: string;
  expiresIn: string;
}

// ==========================================
// CHATBOT SERVICE TYPES
// ==========================================

export interface ChatbotConfig {
  siteId: string;
  userId: string;
  enabled: boolean;
  settings: {
    welcomeMessage: string;
    systemPrompt: string;
    primaryColor: string;
    position: 'bottom-right' | 'bottom-left';
    collectEmail: boolean;
    collectPhone: boolean;
    businessHours?: { start: string; end: string };
    quickReplies?: string[];
  };
  knowledgeBase: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatConversation {
  id: string;
  siteId: string;
  visitorId: string;
  status: 'active' | 'closed';
  messageCount: number;
  startedAt: string;
  lastMessageAt: string;
  visitorEmail?: string;
  visitorName?: string;
  summary?: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'visitor' | 'ai' | 'human';
  content: string;
  timestamp: string;
}

export interface ChatVisitor {
  id: string;
  siteId: string;
  email?: string;
  phone?: string;
  name?: string;
  firstSeenAt: string;
  lastSeenAt: string;
  totalConversations: number;
  totalMessages: number;
}

// ==========================================
// BOOKING SERVICE TYPES
// ==========================================

export interface BookingConfig {
  siteId: string;
  userId: string;
  enabled: boolean;
  settings: {
    timezone: string;
    bufferMinutes: number;
    minNoticeHours: number;
    maxAdvanceDays: number;
    confirmationEmail: boolean;
    reminderEmail: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BookingEventType {
  id: string;
  siteId: string;
  name: string;
  duration: number;
  price?: number;
  description: string;
  color: string;
  isActive: boolean;
}

export interface WeeklyAvailability {
  siteId: string;
  schedule: {
    monday: { start: string; end: string }[];
    tuesday: { start: string; end: string }[];
    wednesday: { start: string; end: string }[];
    thursday: { start: string; end: string }[];
    friday: { start: string; end: string }[];
    saturday: { start: string; end: string }[];
    sunday: { start: string; end: string }[];
  };
  blockedDates: string[];
}

export interface BookingAppointment {
  id: string;
  siteId: string;
  eventTypeId: string;
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no-show';
  notes?: string;
  confirmationCode: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookingClient {
  id: string;
  siteId: string;
  email: string;
  phone?: string;
  name: string;
  totalAppointments: number;
  completedAppointments: number;
  noShows: number;
  createdAt: string;
  lastBookedAt?: string;
}

// ==========================================
// CRM SERVICE TYPES
// ==========================================

export interface CRMConfig {
  siteId: string;
  userId: string;
  enabled: boolean;
  settings: {
    notifyOnSubmission: boolean;
    notifyEmail: string;
    autoResponse: boolean;
    autoResponseMessage?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CRMForm {
  id: string;
  siteId: string;
  name: string;
  fields: CRMFormField[];
  submitButtonText: string;
  successMessage: string;
  isActive: boolean;
}

export interface CRMFormField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'textarea' | 'select' | 'checkbox' | 'date';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

export interface FormSubmission {
  id: string;
  siteId: string;
  formId: string;
  data: Record<string, any>;
  source: {
    pageUrl: string;
    referrer?: string;
    timestamp: string;
  };
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CRMLead {
  id: string;
  siteId: string;
  name: string;
  email: string;
  phone?: string;
  source: 'form' | 'chatbot' | 'booking' | 'manual';
  sourceId?: string;
  status: 'new' | 'contacted' | 'qualified' | 'won' | 'lost';
  value?: number;
  notes: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  lastContactedAt?: string;
}

export enum ProposalChannel {
  EMAIL = 'email',
  LINK = 'link'
}

// ==========================================
// COMMAND CENTER TYPES (Platform Admin)
// ==========================================

// Admin Role & User
export enum AdminRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  SUPPORT = 'support'
}

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt?: string;
  isActive: boolean;
}

export interface AdminSession {
  id: string;
  adminId: string;
  adminEmail: string;
  token?: string;
  expiresAt?: string;
  createdAt?: string;
  startedAt?: string;
  lastActiveAt?: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  isActive?: boolean;
}

// Platform Users (Accounts)
export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
  DELETED = 'deleted'
}

export interface User {
  id: string;
  name: string;
  ownerEmail: string;
  ownerId: string;
  planId: string;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
  settings: UserSettings;
  stats: UserStats;
}

export interface UserSettings {
  emailNotifications: boolean;
  compactView: boolean;
  supportEmail?: string;
  brandingEnabled: boolean;
}

export interface UserStats {
  totalLeads: number;
  totalSites: number;
  totalRevenue: number;
  monthlyRecurring: number;
  editTokensUsed: number;
  editTokensRemaining: number;
  aiCallsThisMonth: number;
  lastActiveAt?: string;
}

// AI Configuration
export interface AIModel {
  id: string;
  name: string;
  provider: 'google' | 'openai' | 'anthropic';
  capabilities: ('text' | 'image' | 'search')[];
  costPerCall: number;
  isDefault: boolean;
  isEnabled: boolean;
}

export interface AIConfig {
  primaryTextModel: string;
  primaryImageModel: string;
  temperature: number;
  maxTokens: number;
  rateLimitPerMinute: number;
  rateLimitPerUser: number;
  enableSearchGrounding: boolean;
  updatedAt: string;
  updatedBy: string;
}

export interface AIUsageRecord {
  id: string;
  userId: string;
  model: string;
  operation: 'lead_search' | 'site_generation' | 'site_edit' | 'image_generation' | 'plugin_inject';
  tokensUsed: number;
  cost: number;
  success: boolean;
  errorMessage?: string;
  createdAt: string;
}

// API Keys
export enum APIScope {
  LEADS_READ = 'leads:read',
  LEADS_WRITE = 'leads:write',
  SITES_READ = 'sites:read',
  SITES_WRITE = 'sites:write',
  ANALYTICS_READ = 'analytics:read',
  WEBHOOKS_MANAGE = 'webhooks:manage'
}

export interface APIKey {
  id: string;
  name: string;
  keyHash: string;
  keyPrefix: string; // First 8 chars for display
  userId: string;
  scopes: APIScope[];
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  isActive: boolean;
  createdBy: string;
}

// Webhooks
export enum WebhookEventType {
  LEAD_CREATED = 'lead.created',
  LEAD_UPDATED = 'lead.updated',
  LEAD_DELETED = 'lead.deleted',
  SITE_GENERATED = 'site.generated',
  SITE_EDITED = 'site.edited',
  SITE_PUBLISHED = 'site.published',
  PAYMENT_RECEIVED = 'payment.received',
  USER_SUSPENDED = 'user.suspended'
}

export interface WebhookEndpoint {
  id: string;
  userId: string;
  url: string;
  secret: string;
  events: WebhookEventType[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastTriggeredAt?: string;
  failureCount: number;
}

export interface WebhookDelivery {
  id: string;
  webhookId: string;
  eventType: WebhookEventType;
  payload: Record<string, unknown>;
  statusCode?: number;
  response?: string;
  success: boolean;
  attempts: number;
  createdAt: string;
  completedAt?: string;
}

// Audit Logs
export enum AuditAction {
  // Auth actions
  LOGIN = 'login',
  LOGOUT = 'logout',
  LOGIN_FAILED = 'login_failed',

  // CRUD actions
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',

  // Admin actions
  SUSPEND = 'suspend',
  ACTIVATE = 'activate',
  IMPERSONATE = 'impersonate',

  // API actions
  API_KEY_CREATED = 'api_key_created',
  API_KEY_REVOKED = 'api_key_revoked',
  WEBHOOK_TRIGGERED = 'webhook_triggered',

  // AI actions
  AI_GENERATION = 'ai_generation',
  AI_CONFIG_CHANGED = 'ai_config_changed'
}

export enum AuditResource {
  ADMIN = 'admin',
  USER = 'user',
  LEAD = 'lead',
  SITE = 'site',
  API_KEY = 'api_key',
  WEBHOOK = 'webhook',
  AI_CONFIG = 'ai_config',
  SETTINGS = 'settings'
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorType: 'admin' | 'user' | 'system' | 'api';
  actorEmail?: string;
  action: AuditAction;
  resource: AuditResource;
  resourceId?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface AuditLogFilter {
  actorId?: string;
  actorType?: 'admin' | 'user' | 'system' | 'api';
  action?: AuditAction;
  resource?: AuditResource;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

// Admin Tab Navigation
export enum AdminTab {
  DASHBOARD = 'dashboard',
  ACCOUNTS = 'accounts',
  DOMAINS = 'domains',
  AI_OPTIMIZATION = 'ai_optimization',
  SCALING = 'scaling',
  SECURITY = 'security',
  API_WEBHOOKS = 'api_webhooks',
  AUDIT_LOGS = 'audit_logs',
  BETA_ERRORS = 'beta_errors',
  SETTINGS = 'settings'
}

// ==========================================
// BETA FEEDBACK SYSTEM TYPES
// ==========================================

export type BetaFeedbackStatus = 'open' | 'in_progress' | 'resolved';
export type BetaFeedbackCategory = 'bug' | 'feature' | 'ux' | 'other';

export interface BetaFeedback {
  id: string;
  userId?: string;
  userEmail?: string;
  title: string;
  description: string;
  category: BetaFeedbackCategory;
  screenshotUrl?: string;
  screenshotPath?: string;
  pageUrl: string;
  userAgent: string;
  status: BetaFeedbackStatus;
  assignedTo?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

// Scaling Configuration Types
export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  enabled?: boolean;
}

export interface ScalingConfig {
  rateLimits: Record<string, RateLimitConfig>;
  cacheEnabled: boolean;
  cacheTTLDays: number;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ScrapingMetrics {
  cachedUrls: number;
  requestsLastHour: number;
  requestsToday: number;
  cacheHitRate: number;
}

export interface RateLimitStats {
  [endpoint: string]: {
    activeUsers: number;
    totalRequests: number;
  };
}

// Platform Settings (Admin-managed)
export interface GoDaddyConfig {
  isConfigured: boolean;
  apiKeyLastFour?: string;
  lastTestedAt?: string;
  lastTestSuccess?: boolean;
}

export interface PlatformSettings {
  godaddy: GoDaddyConfig;
  updatedAt: string;
  updatedBy: string;
}

// ==========================================
// REFERRAL SYSTEM TYPES
// ==========================================

export type ReferralStatus = 'pending' | 'completed' | 'rewarded';

export interface Referral {
  id: string;
  referrerUserId: string;
  referredUserId: string;
  referredEmail: string;
  status: ReferralStatus;
  tokensAwarded: number;
  createdAt: string;
  completedAt?: string;
}

export interface UserReferralStats {
  referralCode: string;
  totalReferrals: number;
  pendingReferrals: number;
  tokensEarned: number;
  milestonesUnlocked: number[];
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// WAITLIST SYSTEM TYPES
// ==========================================

export type WaitlistStatus = 'waiting' | 'invited' | 'converted';

export interface WaitlistEntry {
  id: string;
  email: string;
  position: number;
  status: WaitlistStatus;
  source?: string;  // e.g., 'landing_page', 'referral'
  referredBy?: string;
  inviteCode?: string;  // Generated when invited
  createdAt: string;
  invitedAt?: string;
  convertedAt?: string;
}

export interface WaitlistStats {
  totalEntries: number;
  spotsRemaining: number;
  totalSlots: number;
  convertedCount: number;
  invitedCount: number;
}

export interface WaitlistSettings {
  totalSlots: number;
  isOpen: boolean;
  autoInviteEnabled: boolean;
  updatedAt: string;
}

// ==========================================
// PAYMENT SYSTEM TYPES
// ==========================================

export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing' | 'none';

export type PaymentStatus = 'succeeded' | 'pending' | 'failed';

export interface Subscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  stripePaymentId: string;
  type: 'subscription' | 'topup';
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string;
  tokensAdded?: number;
  createdAt: string;
}

export interface StripeCustomer {
  stripeCustomerId: string;
  email: string;
  createdAt: string;
}

export interface PlanLimits {
  sites: number;
  editTokens: number;
}

export interface PlatformPlan {
  id: string;
  name: string;
  price: number;
  limits: PlanLimits;
}

export interface TopupPack {
  id: string;
  name: string;
  price: number;
  tokens: number;
  type: 'edit' | 'site';
}

export interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface CustomerInfo {
  stripeCustomerId: string;
  subscription: Subscription | null;
  paymentMethods: PaymentMethod[];
}

// ==========================================
// AI EDITOR TYPES (Vibe Coder)
// ==========================================

export interface AIEditorMessageAttachment {
  type: 'image';
  mimeType: string;           // 'image/png', 'image/jpeg', 'image/gif', 'image/webp'
  base64Data: string;         // Base64 encoded image data (without data: prefix)
  previewUrl?: string;        // data:URL for UI preview
  fileName?: string;          // Original filename
}

export interface AIEditorMessage {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  isThinking?: boolean;
  attachments?: AIEditorMessageAttachment[];  // Support image attachments
}

export interface AIEditorVersion {
  id: string;
  timestamp: number;
  prompt: string;
  code: string;
}

export type AIDeploymentStep = 'idle' | 'version' | 'upload' | 'finalizing' | 'complete' | 'error';

export interface AIDeploymentStatus {
  step: AIDeploymentStep;
  url?: string;
  message?: string;
}
