import { Business, WebsiteBlueprint, WebsitePlugin, BusinessResearchData, ExtractedAssets, ImagePreference, AIEditorMessage, AIEditorMessageAttachment, SiteIdentity, ModernizationStyle, ModernizedSiteResponse } from "../types";
import { validateAndRecover } from "./blueprintValidator";
import { analyzeEditIntent } from "./editIntentAnalyzer";

// Cloud Functions base URL
const FUNCTIONS_BASE_URL = 'https://us-central1-renovatemysite-vibe.cloudfunctions.net';

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

/**
 * Searches for local business leads using Cloud Function with Gemini.
 */
export const findBusinesses = async (category: string, location: string): Promise<Business[]> => {
  try {
    console.log("Finding businesses for:", category, location);
    const response = await fetch(`${FUNCTIONS_BASE_URL}/findBusinesses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, location })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to find businesses');
    }

    const businesses = await response.json();
    console.log("Found businesses:", businesses);
    return businesses;
  } catch (e: any) {
    console.error("Find businesses failed:", e?.message || e);
    // Fallback data for demo stability
    return [
      { id: 'f1', name: `${category} Studio`, rating: 4.8, address: `${location}`, websiteStatus: 'None' },
      { id: 'f2', name: `The ${category} Group`, rating: 4.2, address: `${location}`, websiteStatus: 'Outdated' },
    ];
  }
};

/**
 * Generates a high-quality image using Cloud Function.
 */
export const generateImage = async (prompt: string): Promise<string | null> => {
  try {
    console.log("Generating image with prompt:", prompt);
    const response = await fetch(`${FUNCTIONS_BASE_URL}/generateImage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Image generation API error:", response.status, errorText);
      return null;
    }

    const result = await response.json();
    console.log("Image generation result:", result);
    return result.imageUrl || null;
  } catch (e) {
    console.error("Image generation failed", e);
    return null;
  }
};

/**
 * Research a business using Google Search grounding
 */
export const researchBusiness = async (
  businessName: string,
  location?: string,
  category?: string,
  websiteUrl?: string
): Promise<BusinessResearchData> => {
  try {
    console.log("Researching business:", businessName);
    const response = await fetch(`${FUNCTIONS_BASE_URL}/researchBusiness`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName, location, category, websiteUrl })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to research business');
    }

    const data = await response.json();
    console.log("Research data received:", data);
    return data;
  } catch (e: any) {
    console.error("Business research failed:", e?.message || e);
    // Return minimal data on failure
    return { name: businessName, address: location || '' };
  }
};

/**
 * Scrape a website to extract assets (logo, images, content, colors)
 */
export const scrapeWebsite = async (url: string): Promise<ExtractedAssets | null> => {
  try {
    console.log("Scraping website:", url);
    const response = await fetch(`${FUNCTIONS_BASE_URL}/scrapeWebsite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to scrape website');
    }

    const assets = await response.json();
    console.log("Extracted assets:", assets);
    return assets;
  } catch (e: any) {
    console.error("Website scraping failed:", e?.message || e);
    return null;
  }
};

/**
 * Store an image to Firebase Storage (returns public URL)
 */
export const storeImage = async (
  imageUrl: string,
  siteId: string,
  imageType: string
): Promise<string | null> => {
  try {
    console.log("Storing image:", imageUrl);
    const response = await fetch(`${FUNCTIONS_BASE_URL}/storeImage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, siteId, imageType })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to store image');
    }

    const result = await response.json();
    console.log("Image stored:", result.storedUrl);
    return result.storedUrl;
  } catch (e: any) {
    console.error("Image storage failed:", e?.message || e);
    return null;
  }
};

/**
 * Store a base64 image to Firebase Storage
 */
export const storeBase64Image = async (
  base64Data: string,
  siteId: string,
  imageType: string
): Promise<string | null> => {
  try {
    console.log("Storing base64 image for:", siteId);
    const response = await fetch(`${FUNCTIONS_BASE_URL}/storeBase64Image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64Data, siteId, imageType })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to store base64 image');
    }

    const result = await response.json();
    console.log("Base64 image stored:", result.storedUrl);
    return result.storedUrl;
  } catch (e: any) {
    console.error("Base64 image storage failed:", e?.message || e);
    return null;
  }
};

/**
 * Generates a fallback blueprint for demo purposes when API fails
 */
const generateFallbackBlueprint = (businessName: string, category: string): WebsiteBlueprint => {
  console.log("Using fallback blueprint for:", businessName);
  return {
    brand: {
      primaryColor: '#10b981',
      secondaryColor: '#8B5CF6',
      fontFamily: 'Outfit',
      tone: 'Professional and welcoming'
    },
    sections: [
      {
        id: 'hero-1',
        type: 'hero',
        title: `Welcome to ${businessName}`,
        content: `Your trusted ${category} serving the community with excellence and dedication.`,
        cta: 'Get Started',
        imagePrompt: `Professional ${category} business storefront, modern and welcoming`
      },
      {
        id: 'services-1',
        type: 'services',
        title: 'Our Services',
        content: `We offer comprehensive ${category} services tailored to your needs. From consultation to completion, we're here to help.`,
        cta: 'Learn More',
        imagePrompt: `${category} services being provided, professional setting`
      },
      {
        id: 'about-1',
        type: 'about',
        title: 'About Us',
        content: `At ${businessName}, we pride ourselves on delivering exceptional ${category} services. Our experienced team is committed to your satisfaction.`,
        cta: 'Meet Our Team',
        imagePrompt: `${category} team at work, professional environment`
      },
      {
        id: 'contact-1',
        type: 'contact',
        title: 'Get In Touch',
        content: `Ready to experience the best ${category} services? Contact us today and let's discuss how we can help you.`,
        cta: 'Contact Us'
      }
    ],
    plugins: []
  };
};

/**
 * Generates the full initial Website Blueprint via Cloud Function.
 * Enhanced to support research data and image preferences.
 */
export const generateWebsiteBlueprint = async (
  business: Business,
  category: string,
  researchData?: BusinessResearchData,
  extractedAssets?: ExtractedAssets,
  imagePreference?: ImagePreference
): Promise<WebsiteBlueprint> => {
  try {
    console.log("Generating blueprint for:", business.name, category);
    console.log("With research data:", !!researchData, "extracted assets:", !!extractedAssets, "image pref:", imagePreference);

    const response = await fetch(`${FUNCTIONS_BASE_URL}/generateBlueprint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName: business.name,
        category,
        address: business.address,
        researchData,
        extractedAssets,
        imagePreference
      })
    });

    if (!response.ok) {
      console.warn("Cloud function returned error, using fallback blueprint");
      return generateFallbackBlueprint(business.name, category);
    }

    const blueprint = await response.json();
    console.log("Blueprint received:", JSON.stringify(blueprint, null, 2));

    // Validate the blueprint structure
    if (!blueprint || !blueprint.sections || !blueprint.brand) {
      console.warn("Invalid blueprint from API, using fallback");
      return generateFallbackBlueprint(business.name, category);
    }

    return blueprint;
  } catch (e: any) {
    console.error("Website blueprint generation failed:", e?.message || e);
    console.log("Using fallback blueprint due to error");
    return generateFallbackBlueprint(business.name, category);
  }
};

export interface EditResponse {
  updatedBlueprint: WebsiteBlueprint;
  marketplaceSuggestion?: string;
}

/**
 * Applies simple color/tone changes to blueprint as fallback
 * Enhanced to handle more complex instructions
 */
const applySimpleEdit = (instruction: string, currentBlueprint: WebsiteBlueprint): WebsiteBlueprint => {
  const lowerInstruction = instruction.toLowerCase();
  const updated = JSON.parse(JSON.stringify(currentBlueprint)); // Deep clone

  // Color mapping
  const colorMap: Record<string, { primary: string; secondary: string }> = {
    'blue': { primary: '#3b82f6', secondary: '#2563eb' },
    'red': { primary: '#ef4444', secondary: '#dc2626' },
    'purple': { primary: '#a855f7', secondary: '#9333ea' },
    'violet': { primary: '#8b5cf6', secondary: '#7c3aed' },
    'lavender': { primary: '#9B8CF7', secondary: '#8B5CF6' },
    'green': { primary: '#22c55e', secondary: '#16a34a' },
    'orange': { primary: '#f97316', secondary: '#ea580c' },
    'gold': { primary: '#eab308', secondary: '#ca8a04' },
    'yellow': { primary: '#facc15', secondary: '#eab308' },
    'pink': { primary: '#ec4899', secondary: '#db2777' },
    'rose': { primary: '#f43f5e', secondary: '#e11d48' },
    'cyan': { primary: '#06b6d4', secondary: '#0891b2' },
    'teal': { primary: '#14b8a6', secondary: '#0d9488' },
    'indigo': { primary: '#6366f1', secondary: '#4f46e5' },
    'slate': { primary: '#64748b', secondary: '#475569' },
    'gray': { primary: '#6b7280', secondary: '#4b5563' },
    'zinc': { primary: '#71717a', secondary: '#52525b' },
    'dark': { primary: '#1f2937', secondary: '#111827' },
    'black': { primary: '#000000', secondary: '#1f2937' }
  };

  // Detect primary color change
  let colorChanged = false;
  for (const [colorName, colors] of Object.entries(colorMap)) {
    if (lowerInstruction.includes(colorName) && lowerInstruction.includes('color')) {
      updated.brand = { ...updated.brand, primaryColor: colors.primary, secondaryColor: colors.secondary };
      colorChanged = true;
      console.log(`Applied ${colorName} color scheme`);
      break;
    }
  }

  // If no "color" keyword, check for standalone color mentions
  if (!colorChanged) {
    for (const [colorName, colors] of Object.entries(colorMap)) {
      if (lowerInstruction.includes(colorName)) {
        updated.brand = { ...updated.brand, primaryColor: colors.primary, secondaryColor: colors.secondary };
        console.log(`Applied ${colorName} color scheme`);
        break;
      }
    }
  }

  // Handle tone changes
  if (lowerInstruction.includes('professional') || lowerInstruction.includes('formal') || lowerInstruction.includes('business')) {
    updated.brand = { ...updated.brand, tone: 'Professional and authoritative' };
    console.log('Applied professional tone');
  } else if (lowerInstruction.includes('friendly') || lowerInstruction.includes('warm') || lowerInstruction.includes('welcoming')) {
    updated.brand = { ...updated.brand, tone: 'Warm and friendly' };
    console.log('Applied friendly tone');
  } else if (lowerInstruction.includes('luxury') || lowerInstruction.includes('premium') || lowerInstruction.includes('elegant')) {
    updated.brand = { ...updated.brand, tone: 'Luxury and exclusive' };
    console.log('Applied luxury tone');
  } else if (lowerInstruction.includes('casual') || lowerInstruction.includes('relaxed') || lowerInstruction.includes('laid-back')) {
    updated.brand = { ...updated.brand, tone: 'Casual and approachable' };
    console.log('Applied casual tone');
  } else if (lowerInstruction.includes('energetic') || lowerInstruction.includes('exciting') || lowerInstruction.includes('vibrant')) {
    updated.brand = { ...updated.brand, tone: 'Energetic and vibrant' };
    console.log('Applied energetic tone');
  } else if (lowerInstruction.includes('minimal') || lowerInstruction.includes('simple') || lowerInstruction.includes('clean')) {
    updated.brand = { ...updated.brand, tone: 'Minimal and clean' };
    console.log('Applied minimal tone');
  }

  // Handle font changes
  if (lowerInstruction.includes('font') || lowerInstruction.includes('typeface')) {
    if (lowerInstruction.includes('modern') || lowerInstruction.includes('sans')) {
      updated.brand = { ...updated.brand, fontFamily: 'Inter' };
      console.log('Applied Inter font');
    } else if (lowerInstruction.includes('elegant') || lowerInstruction.includes('sophisticated')) {
      updated.brand = { ...updated.brand, fontFamily: 'Outfit' };
      console.log('Applied Outfit font');
    } else if (lowerInstruction.includes('classic') || lowerInstruction.includes('serif')) {
      updated.brand = { ...updated.brand, fontFamily: 'Georgia' };
      console.log('Applied Georgia font');
    }
  }

  // Handle content modifications for sections
  if (lowerInstruction.includes('urgent') || lowerInstruction.includes('action')) {
    updated.sections = updated.sections.map((section: any) => {
      if (section.cta) {
        return { ...section, cta: `${section.cta} Now!` };
      }
      return section;
    });
    console.log('Added urgency to CTAs');
  }

  // Handle heading/title modifications
  if (lowerInstruction.includes('shorter') && (lowerInstruction.includes('title') || lowerInstruction.includes('heading'))) {
    updated.sections = updated.sections.map((section: any) => {
      if (section.title) {
        const words = section.title.split(' ');
        return { ...section, title: words.slice(0, Math.ceil(words.length / 2)).join(' ') };
      }
      return section;
    });
    console.log('Shortened titles');
  }

  return updated;
};

/**
 * Handles AI Remixes and Edits via Cloud Function with intent analysis and validation.
 */
export const editWebsite = async (instruction: string, currentBlueprint: WebsiteBlueprint): Promise<EditResponse> => {
  // Analyze user intent for better logging
  const { intent, confidence } = analyzeEditIntent(instruction);
  console.log(`editWebsite: Intent="${intent}" (${(confidence * 100).toFixed(0)}%), instruction="${instruction}"`);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`editWebsite: Retry attempt ${attempt}/${MAX_RETRIES}`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt));
      }

      const response = await fetch(`${FUNCTIONS_BASE_URL}/editBlueprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, currentBlueprint })
      });

      if (!response.ok) {
        console.warn(`editWebsite: Cloud function failed with status ${response.status}`);
        lastError = new Error(`HTTP ${response.status}`);
        continue; // Retry
      }

      const result = await response.json();

      // Check for error response from Cloud Function
      if (result.error) {
        console.warn("editWebsite: Cloud function returned error:", result.error);
        lastError = new Error(result.error);
        continue; // Retry
      }

      // Validate and attempt recovery if needed
      const { blueprint, wasRecovered, validation } = validateAndRecover(result, currentBlueprint);

      if (validation.errors.length > 0) {
        console.warn("editWebsite: Validation errors:", validation.errors);
      }
      if (validation.warnings.length > 0) {
        console.log("editWebsite: Validation warnings:", validation.warnings);
      }

      if (wasRecovered) {
        console.log("editWebsite: Blueprint was recovered from partial response");
      }

      if (validation.valid || wasRecovered) {
        console.log("editWebsite: Success! Brand:", JSON.stringify(blueprint.brand, null, 2));
        return {
          updatedBlueprint: blueprint,
          marketplaceSuggestion: undefined
        };
      }

      // If validation completely failed, retry
      lastError = new Error('Validation failed: ' + validation.errors.join(', '));
      continue;

    } catch (e: any) {
      console.error(`editWebsite: Attempt ${attempt} failed:`, e?.message || e);
      lastError = e;
    }
  }

  // All retries exhausted, use fallback
  console.warn("editWebsite: All retries failed, using simple edit fallback");
  return {
    updatedBlueprint: applySimpleEdit(instruction, currentBlueprint),
    marketplaceSuggestion: undefined
  };
};

export interface ProposalEmail {
  subject: string;
  body: string;
}

/**
 * Generates a personalized proposal email using AI via Cloud Function.
 */
export const generateProposalEmail = async (
  businessName: string,
  category: string,
  address: string,
  previewUrl: string,
  setupFee: number,
  monthlyFee: number
): Promise<ProposalEmail> => {
  try {
    console.log("Generating proposal email for:", businessName);
    const response = await fetch(`${FUNCTIONS_BASE_URL}/generateProposalEmail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName,
        category,
        address,
        previewUrl,
        setupFee,
        monthlyFee
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate proposal email');
    }

    const emailContent = await response.json();
    console.log("Proposal email generated:", emailContent.subject);
    return emailContent;
  } catch (e: any) {
    console.error("Proposal email generation failed:", e?.message || e);
    // Fallback email
    const firstYearTotal = setupFee + (monthlyFee * 12);
    return {
      subject: `A New Website Design for ${businessName}`,
      body: `Hi there,\n\nI came across ${businessName} and was impressed by what you do. I took the liberty of creating a sample website design specifically for your business.\n\nYou can preview it here: ${previewUrl}\n\nIf you like what you see, I'd love to discuss bringing this to life for you.\n\nPricing:\n- One-time setup: $${setupFee}\n- Monthly maintenance: $${monthlyFee}/month\n- First year total: $${firstYearTotal}\n\nLet me know what you think!\n\nBest regards`
    };
  }
};

/**
 * Injects a marketplace plugin into the blueprint.
 * This is done client-side since it doesn't require AI.
 */
export const injectPlugin = async (serviceId: string, currentBlueprint: WebsiteBlueprint): Promise<WebsiteBlueprint> => {
  const newPlugin: WebsitePlugin = {
    id: serviceId,
    config: {
      enabled: true,
      settings: '{}'
    }
  };

  // Update or Add plugin
  const existingPlugins = currentBlueprint.plugins || [];
  const filteredPlugins = existingPlugins.filter(p => p.id !== serviceId);

  return {
    ...currentBlueprint,
    plugins: [...filteredPlugins, newPlugin]
  };
};

// ==========================================
// LEAD FINDER FUNCTIONS WITH GOOGLE PLACES API
// ==========================================

/**
 * Lead structure from Google Places API + Gemini analysis
 * Uses Search-Verify-Analyze architecture for 100% real business data
 */
export interface FinalLead {
  id: string;
  businessName: string;
  location: string;
  phone: string | null;
  email: string | null;  // Scraped from business website
  websiteUrl: string | null;
  websiteStatus: 'None' | 'Outdated' | 'Modern';
  pitchAngle: string;
  mapsUrl: string;
}

export interface FindLeadsResponse {
  leads: FinalLead[];
  message?: string;
}

/**
 * Find business leads using Google Places API.
 * Returns REAL businesses only - no fake/fallback data.
 * Empty array returned if no results found.
 */
export const findLeadsWithMaps = async (
  query: string,
  location: string
): Promise<FindLeadsResponse> => {
  try {
    console.log("Finding leads with Places API:", query, location);
    const response = await fetch(`${FUNCTIONS_BASE_URL}/findLeadsWithMaps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, location })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to find leads');
    }

    const data = await response.json();
    console.log("Found leads:", data.leads?.length || 0, data.message || '');
    return data;
  } catch (e: any) {
    console.error("Find leads failed:", e?.message || e);
    // Return empty array - NO fake data
    return {
      leads: [],
      message: 'Search failed. Please try again.'
    };
  }
};

// ==========================================
// VIBE CODER AI EDITOR FUNCTIONS (NEW)
// ==========================================

export interface GenerateSiteHTMLResponse {
  html: string;
  thinking?: string;
}

export interface EditSiteHTMLResponse {
  html: string | null;
  thinking?: string;
  text: string;
}

/**
 * Generate complete website HTML using Vibe Coder AI
 */
export const generateSiteHTML = async (
  businessName: string,
  category: string,
  address?: string,
  researchData?: BusinessResearchData
): Promise<GenerateSiteHTMLResponse> => {
  try {
    console.log("Generating site HTML for:", businessName, category);

    const response = await fetch(`${FUNCTIONS_BASE_URL}/generateSiteHTML`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        businessName,
        category,
        address,
        researchData
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate site HTML');
    }

    const result = await response.json();
    console.log("Site HTML generated, length:", result.html?.length);
    return result;
  } catch (e: any) {
    console.error("Site HTML generation failed:", e?.message || e);

    // Return fallback HTML
    return {
      html: getFallbackHTML(businessName, category),
      thinking: 'Using fallback template due to generation error'
    };
  }
};

/**
 * Edit website HTML based on user instruction
 * Supports multimodal input with image attachments
 */
export const editSiteHTML = async (
  instruction: string,
  currentHTML: string,
  conversationHistory?: AIEditorMessage[],
  attachments?: AIEditorMessageAttachment[]
): Promise<EditSiteHTMLResponse> => {
  try {
    console.log("Editing site HTML with instruction:", instruction);
    console.log("Attachments:", attachments?.length || 0);

    const response = await fetch(`${FUNCTIONS_BASE_URL}/editSiteHTML`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instruction,
        currentHTML,
        conversationHistory,
        attachments
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to edit site HTML');
    }

    const result = await response.json();
    console.log("Site HTML edit result:", result.html ? 'Updated' : 'Text response only');
    return result;
  } catch (e: any) {
    console.error("Site HTML edit failed:", e?.message || e);
    return {
      html: null,
      thinking: '',
      text: 'Sorry, I encountered an error while processing your request. Please try again.'
    };
  }
};

// ==========================================
// SITE MODERNIZATION FUNCTIONS
// ==========================================

export interface ModernizeSiteRequest {
  sourceUrl: string;
  businessName?: string;
  category?: string;
  designStyle?: ModernizationStyle;
  preserveColors?: boolean;
  forceRefresh?: boolean;
}

/**
 * Extract site identity from an existing website (Scout service)
 */
export const extractSiteIdentity = async (
  url: string,
  forceRefresh?: boolean
): Promise<SiteIdentity> => {
  try {
    console.log("Extracting site identity from:", url);

    const response = await fetch(`${FUNCTIONS_BASE_URL}/extractSiteIdentity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, forceRefresh })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract site identity');
    }

    const siteIdentity = await response.json();
    console.log("Site identity extracted:", siteIdentity.businessName);
    return siteIdentity;
  } catch (e: any) {
    console.error("Site identity extraction failed:", e?.message || e);
    throw e;
  }
};

/**
 * Modernize an existing website using AI
 * Uses Total Content Modernization V4.0 - exhaustive crawl + Vision API + complete content migration
 */
export const modernizeSite = async (
  request: ModernizeSiteRequest
): Promise<ModernizedSiteResponse> => {
  try {
    console.log("[V3.0] Modernizing site with Gemini-only scraper:", request.sourceUrl);

    // Use Gemini-only scraper (NO Puppeteer/Cheerio/Vision)
    const response = await fetch(`${FUNCTIONS_BASE_URL}/generateModernizedSite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceUrl: request.sourceUrl,
        businessName: request.businessName,
        category: request.category
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to modernize site');
    }

    const result = await response.json();
    console.log("[V4.0] Site modernized:", {
      designStyle: result.designStyle,
      pipelineVersion: result.pipelineVersion || 'v4.0',
      totalPages: result.dna?.totalPagesScraped || 0,
      services: result.dna?.services?.length || 0,
      testimonials: result.dna?.testimonials?.length || 0,
      hiddenGems: result.dna?.hiddenGems?.length || 0,
      visionComplete: result.dna?.visionAnalysisComplete || false
    });

    // Map V4.0 response to expected format
    return {
      html: result.html,
      siteIdentity: {
        businessName: result.dna?.businessName || request.businessName || 'Business',
        tagline: result.dna?.tagline || null,
        sourceUrl: result.dna?.sourceUrl || request.sourceUrl,
        extractedAt: result.dna?.extractedAt || new Date().toISOString(),
        services: result.dna?.services?.map((s: any) => s.name || s) || [],
        testimonials: result.dna?.testimonials || [],
        teamMembers: result.dna?.teamMembers || [],
        coreValues: result.dna?.coreValues || [],
        faqs: result.dna?.faqs || [],
        contactInfo: result.dna?.consolidatedFooter?.contactInfo || {},
        socialLinks: result.dna?.consolidatedFooter?.socialLinks || {},
        businessHours: result.dna?.consolidatedFooter?.businessHours?.formatted || null,
        navigation: result.dna?.consolidatedHeader?.primaryNavigation || [],
        primaryColors: [
          result.dna?.brandColors?.primary || '#3B82F6',
          result.dna?.brandColors?.secondary || '#1E40AF',
          result.dna?.brandColors?.accent || '#60A5FA'
        ],
        logoUrl: result.dna?.consolidatedHeader?.logoUrl || null,
        logoBase64: result.dna?.consolidatedHeader?.logoBase64 || null,
        heroImages: result.dna?.semanticImageMap?.hero || [],
        galleryImages: result.dna?.semanticImageMap?.gallery || [],
        pages: result.dna?.semanticPages || [],
        visualVibe: result.dna?.brandPersonality || 'professional and modern',
        contentSparsity: result.dna?.contentSparsity || 'moderate',
        extractedFacts: result.dna?.hiddenGems || [],
        accentColor: result.dna?.brandColors?.accent || null,
        visionAnalysisComplete: result.dna?.visionAnalysisComplete || false,
        semanticImageMap: result.dna?.semanticImageMap || null,
      },
      designStyle: result.designStyle || 'glass-glow-premium',
      thinking: result.thinking,
      pipelineVersion: result.pipelineVersion || '4.0-total-content'
    };
  } catch (e: any) {
    console.error("[V4.0] Site modernization failed:", e?.message || e);
    throw e;
  }
};

/**
 * Generate AI image using Gemini (returns placeholder or generated image)
 */
export const generateAIImage = async (prompt: string): Promise<string | null> => {
  try {
    console.log("Generating AI image for:", prompt);

    const response = await fetch(`${FUNCTIONS_BASE_URL}/generateAIImage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      console.warn("AI image generation failed, using placeholder");
      return null;
    }

    const result = await response.json();
    return result.imageUrl || null;
  } catch (e: any) {
    console.error("AI image generation failed:", e?.message || e);
    return null;
  }
};

/**
 * Fallback HTML template when generation fails - Premium design
 */
const getFallbackHTML = (businessName: string, category: string): string => {
  // Determine industry-appropriate colors
  const getColors = () => {
    const cat = category.toLowerCase();
    if (cat.includes('dental') || cat.includes('medical') || cat.includes('doctor')) {
      return { primary: 'sky', secondary: 'teal', gradient: 'from-sky-500 to-teal-500' };
    }
    if (cat.includes('restaurant') || cat.includes('food') || cat.includes('cafe')) {
      return { primary: 'orange', secondary: 'red', gradient: 'from-orange-500 to-red-500' };
    }
    if (cat.includes('gym') || cat.includes('fitness')) {
      return { primary: 'green', secondary: 'purple', gradient: 'from-[#9B8CF7] to-[#8B5CF6]' };
    }
    if (cat.includes('salon') || cat.includes('beauty') || cat.includes('spa')) {
      return { primary: 'purple', secondary: 'pink', gradient: 'from-purple-500 to-pink-500' };
    }
    if (cat.includes('plumb') || cat.includes('hvac') || cat.includes('electric')) {
      return { primary: 'blue', secondary: 'indigo', gradient: 'from-blue-500 to-indigo-500' };
    }
    return { primary: 'indigo', secondary: 'purple', gradient: 'from-indigo-500 to-purple-500' };
  };

  const colors = getColors();

  return `
<!-- Navigation -->
<nav class="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="flex items-center justify-between h-16">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 bg-gradient-to-br ${colors.gradient} rounded-lg"></div>
        <span class="font-bold text-slate-900">${businessName}</span>
      </div>
      <div class="hidden md:flex items-center gap-8">
        <a href="#services" class="text-sm text-slate-600 hover:text-slate-900 transition-colors">Services</a>
        <a href="#about" class="text-sm text-slate-600 hover:text-slate-900 transition-colors">About</a>
        <a href="#testimonials" class="text-sm text-slate-600 hover:text-slate-900 transition-colors">Reviews</a>
        <a href="#contact" class="text-sm text-slate-600 hover:text-slate-900 transition-colors">Contact</a>
      </div>
      <a href="#contact" class="px-5 py-2.5 bg-gradient-to-r ${colors.gradient} text-white text-sm font-semibold rounded-full shadow-lg shadow-${colors.primary}-500/25 hover:shadow-xl hover:shadow-${colors.primary}-500/30 transition-all hover:-translate-y-0.5">
        Get Quote
      </a>
    </div>
  </div>
</nav>

<!-- Hero Section -->
<section class="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-slate-100 pt-16">
  <!-- Background decorations -->
  <div class="absolute inset-0 overflow-hidden">
    <div class="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br ${colors.gradient} opacity-10 rounded-full blur-3xl"></div>
    <div class="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br ${colors.gradient} opacity-10 rounded-full blur-3xl"></div>
  </div>

  <div class="relative max-w-7xl mx-auto px-6 lg:px-8 py-24 md:py-32 lg:py-40">
    <div class="text-center max-w-4xl mx-auto">
      <!-- Trust badge -->
      <div class="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-md border border-slate-200/50 mb-8">
        <div class="flex -space-x-2">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 border-2 border-white"></div>
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 border-2 border-white"></div>
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-slate-500 to-slate-600 border-2 border-white"></div>
        </div>
        <div class="flex items-center gap-1">
          <svg class="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          <span class="text-sm font-semibold text-slate-700">4.9</span>
        </div>
        <span class="text-sm text-slate-500">500+ happy customers</span>
      </div>

      <h1 class="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 mb-6">
        Your Trusted
        <span class="block bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent">${category} Partner</span>
      </h1>

      <p class="text-xl md:text-2xl text-slate-600 font-light max-w-2xl mx-auto mb-10 leading-relaxed">
        ${businessName} delivers exceptional results with meticulous attention to detail. Experience the difference quality makes.
      </p>

      <div class="flex flex-col sm:flex-row items-center justify-center gap-4">
        <a href="#contact" class="px-8 py-4 bg-gradient-to-r ${colors.gradient} text-white font-semibold rounded-xl shadow-xl shadow-${colors.primary}-500/25 hover:shadow-2xl hover:shadow-${colors.primary}-500/30 transition-all hover:-translate-y-1 flex items-center gap-2">
          Schedule Consultation
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
        </a>
        <a href="#services" class="px-8 py-4 bg-white text-slate-700 font-semibold rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all">
          View Services
        </a>
      </div>
    </div>
  </div>
</section>

<!-- Services Section -->
<section id="services" class="py-24 md:py-32 bg-white">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="text-center max-w-3xl mx-auto mb-16">
      <span class="inline-block px-4 py-1.5 bg-${colors.primary}-100 text-${colors.primary}-700 text-sm font-semibold rounded-full mb-4">Our Services</span>
      <h2 class="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">What We Offer</h2>
      <p class="text-xl text-slate-600">Comprehensive solutions tailored to your needs</p>
    </div>

    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
      <div class="group p-8 bg-white rounded-2xl border border-slate-200 hover:border-${colors.primary}-200 shadow-sm hover:shadow-xl transition-all duration-300">
        <div class="w-14 h-14 bg-gradient-to-br ${colors.gradient} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
        </div>
        <h3 class="text-xl font-bold text-slate-900 mb-3">Premium Quality</h3>
        <p class="text-slate-600 leading-relaxed">Exceptional craftsmanship and attention to detail in everything we do.</p>
      </div>

      <div class="group p-8 bg-white rounded-2xl border border-slate-200 hover:border-${colors.primary}-200 shadow-sm hover:shadow-xl transition-all duration-300">
        <div class="w-14 h-14 bg-gradient-to-br ${colors.gradient} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <h3 class="text-xl font-bold text-slate-900 mb-3">Fast Response</h3>
        <p class="text-slate-600 leading-relaxed">Quick turnaround times without compromising on quality standards.</p>
      </div>

      <div class="group p-8 bg-white rounded-2xl border border-slate-200 hover:border-${colors.primary}-200 shadow-sm hover:shadow-xl transition-all duration-300">
        <div class="w-14 h-14 bg-gradient-to-br ${colors.gradient} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
          <svg class="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
        </div>
        <h3 class="text-xl font-bold text-slate-900 mb-3">Trusted Experts</h3>
        <p class="text-slate-600 leading-relaxed">Certified professionals with years of industry experience.</p>
      </div>
    </div>
  </div>
</section>

<!-- Stats Section -->
<section class="py-20 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
      <div>
        <div class="text-4xl md:text-5xl font-bold text-white mb-2">15+</div>
        <div class="text-slate-400 font-medium">Years Experience</div>
      </div>
      <div>
        <div class="text-4xl md:text-5xl font-bold text-white mb-2">500+</div>
        <div class="text-slate-400 font-medium">Happy Customers</div>
      </div>
      <div>
        <div class="text-4xl md:text-5xl font-bold text-white mb-2">4.9</div>
        <div class="text-slate-400 font-medium">Star Rating</div>
      </div>
      <div>
        <div class="text-4xl md:text-5xl font-bold text-white mb-2">24/7</div>
        <div class="text-slate-400 font-medium">Support</div>
      </div>
    </div>
  </div>
</section>

<!-- Testimonials -->
<section id="testimonials" class="py-24 md:py-32 bg-slate-50">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="text-center max-w-3xl mx-auto mb-16">
      <span class="inline-block px-4 py-1.5 bg-${colors.primary}-100 text-${colors.primary}-700 text-sm font-semibold rounded-full mb-4">Testimonials</span>
      <h2 class="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight mb-4">What Our Clients Say</h2>
    </div>

    <div class="grid md:grid-cols-3 gap-8">
      <div class="p-8 bg-white rounded-2xl shadow-sm">
        <div class="flex text-yellow-400 mb-4">
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
        </div>
        <p class="text-slate-600 mb-6 leading-relaxed">"Absolutely fantastic service! The team was professional, punctual, and exceeded all my expectations. Highly recommend to anyone."</p>
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-slate-300 to-slate-400"></div>
          <div>
            <div class="font-semibold text-slate-900">Sarah Johnson</div>
            <div class="text-sm text-slate-500">Verified Customer</div>
          </div>
        </div>
      </div>

      <div class="p-8 bg-white rounded-2xl shadow-sm">
        <div class="flex text-yellow-400 mb-4">
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
        </div>
        <p class="text-slate-600 mb-6 leading-relaxed">"Been using their services for years. Consistent quality and great communication. They truly care about their customers."</p>
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-slate-400 to-slate-500"></div>
          <div>
            <div class="font-semibold text-slate-900">Michael Chen</div>
            <div class="text-sm text-slate-500">Verified Customer</div>
          </div>
        </div>
      </div>

      <div class="p-8 bg-white rounded-2xl shadow-sm">
        <div class="flex text-yellow-400 mb-4">
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
          <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/></svg>
        </div>
        <p class="text-slate-600 mb-6 leading-relaxed">"The best in the business! Fast, reliable, and always goes above and beyond. Can't recommend them enough."</p>
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-full bg-gradient-to-br from-slate-500 to-slate-600"></div>
          <div>
            <div class="font-semibold text-slate-900">Emily Davis</div>
            <div class="text-sm text-slate-500">Verified Customer</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- Contact Section -->
<section id="contact" class="py-24 md:py-32 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="grid lg:grid-cols-2 gap-16 items-center">
      <div>
        <span class="inline-block px-4 py-1.5 bg-white/10 text-white text-sm font-semibold rounded-full mb-6">Get In Touch</span>
        <h2 class="text-4xl md:text-5xl font-bold text-white tracking-tight mb-6">Ready to Get Started?</h2>
        <p class="text-xl text-slate-300 mb-8 leading-relaxed">Contact us today for a free consultation. We're here to help you achieve your goals.</p>

        <div class="space-y-4">
          <div class="flex items-center gap-4 text-slate-300">
            <div class="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
            </div>
            <span>Call us anytime</span>
          </div>
          <div class="flex items-center gap-4 text-slate-300">
            <div class="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
            </div>
            <span>Local service area</span>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-3xl p-8 md:p-10 shadow-2xl">
        <h3 class="text-2xl font-bold text-slate-900 mb-6">Send us a message</h3>
        <form class="space-y-5">
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Your Name</label>
            <input type="text" class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-${colors.primary}-500 focus:border-transparent transition-all" placeholder="John Smith"/>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Email Address</label>
            <input type="email" class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-${colors.primary}-500 focus:border-transparent transition-all" placeholder="john@example.com"/>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Phone Number</label>
            <input type="tel" class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-${colors.primary}-500 focus:border-transparent transition-all" placeholder="(555) 123-4567"/>
          </div>
          <div>
            <label class="block text-sm font-medium text-slate-700 mb-2">Message</label>
            <textarea rows="4" class="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-${colors.primary}-500 focus:border-transparent transition-all resize-none" placeholder="How can we help you?"></textarea>
          </div>
          <button type="submit" class="w-full py-4 bg-gradient-to-r ${colors.gradient} text-white font-semibold rounded-xl shadow-lg shadow-${colors.primary}-500/25 hover:shadow-xl hover:shadow-${colors.primary}-500/30 transition-all hover:-translate-y-0.5">
            Send Message
          </button>
        </form>
      </div>
    </div>
  </div>
</section>

<!-- Footer -->
<footer class="bg-slate-950 py-12 border-t border-slate-800">
  <div class="max-w-7xl mx-auto px-6 lg:px-8">
    <div class="flex flex-col md:flex-row items-center justify-between gap-6">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 bg-gradient-to-br ${colors.gradient} rounded-lg"></div>
        <span class="font-bold text-white">${businessName}</span>
      </div>
      <p class="text-slate-500 text-sm">© ${new Date().getFullYear()} ${businessName}. All rights reserved.</p>
      <div class="flex items-center gap-4">
        <a href="#" class="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/></svg>
        </a>
        <a href="#" class="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
        </a>
        <a href="#" class="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-colors">
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.325v-21.35c0-.732-.593-1.325-1.325-1.325z"/></svg>
        </a>
      </div>
    </div>
  </div>
</footer>
  `.trim();
};

// ============================================
// VIBE CODER SITE GENERATION (from gemini-vibe-coder-22-Jan)
// ============================================

/**
 * Analyze brand and generate Design Brief using Google Search grounding
 * Returns a structured Design Brief with VIBE & AESTHETICS + CONTENT DATA SHEET
 */
export const analyzeBrand = async (
  businessInfo: string,
  logoBase64: string | null,
  websiteUrl: string
): Promise<string> => {
  try {
    console.log('[VibeCoder] Analyzing brand...');

    const response = await fetch(`${FUNCTIONS_BASE_URL}/analyzeBrand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessInfo, logoBase64, websiteUrl })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Brand analysis failed');
    }

    const data = await response.json();
    console.log('[VibeCoder] Brand analysis complete');
    return data.analysis;
  } catch (error: any) {
    console.error('[VibeCoder] analyzeBrand error:', error);
    throw error;
  }
};

/**
 * Generate site HTML from Design Brief using Vibe Coder methodology
 * Uses [CODE_UPDATE] tags for extraction
 */
export const generateSiteFromBrief = async (
  designBrief: string,
  currentCode: string = ''
): Promise<{ text: string; code: string | null }> => {
  try {
    console.log('[VibeCoder] Generating site from Design Brief...');

    const response = await fetch(`${FUNCTIONS_BASE_URL}/generateSiteFromBrief`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ designBrief, currentCode })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Site generation failed');
    }

    const result = await response.json();
    console.log('[VibeCoder] Site generation complete, code length:', result.code?.length || 0);
    return result;
  } catch (error: any) {
    console.error('[VibeCoder] generateSiteFromBrief error:', error);
    throw error;
  }
};

/**
 * Generate image using Gemini image models (for data-prompt hydration)
 */
export const generateVibeImage = async (prompt: string): Promise<string | null> => {
  try {
    const enhancedPrompt = `${prompt}, photorealistic, 4k, high fidelity, no text`;

    console.log('[VibeCoder] Generating image for:', prompt.substring(0, 50));

    const response = await fetch(`${FUNCTIONS_BASE_URL}/generateVibeImage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: enhancedPrompt })
    });

    if (!response.ok) {
      console.warn('[VibeCoder] Image generation API error');
      return null;
    }

    const data = await response.json();
    return data.imageUrl || null;
  } catch (error) {
    console.error('[VibeCoder] generateVibeImage error:', error);
    return null;
  }
};
