"use strict";
/**
 * Post-Processor Module - Placeholder Injection & Asset Replacement
 *
 * Handles the final phase of the Deep-Multimodal Pipeline:
 * - Replaces [[ID_*_HERE]] placeholders with real assets
 * - Injects CSS color variables
 * - Validates no remaining placeholders
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlaceholderRegistry = createPlaceholderRegistry;
exports.injectLogo = injectLogo;
exports.injectHeroImages = injectHeroImages;
exports.injectServiceImages = injectServiceImages;
exports.injectGalleryImages = injectGalleryImages;
exports.injectTeamImages = injectTeamImages;
exports.injectColorVariables = injectColorVariables;
exports.injectRealAssets = injectRealAssets;
exports.validateNoPlaceholders = validateNoPlaceholders;
exports.cleanupRemainingPlaceholders = cleanupRemainingPlaceholders;
exports.injectAnimationStyles = injectAnimationStyles;
exports.injectGlassGlowStyles = injectGlassGlowStyles;
exports.injectSemanticImages = injectSemanticImages;
exports.runPostProcessingPipeline = runPostProcessingPipeline;
// ============================================
// PLACEHOLDER PATTERNS
// ============================================
const PLACEHOLDER_PATTERNS = {
    // Logo placeholder
    logo: /\[\[ID_REAL_LOGO_HERE\]\]/g,
    // Hero images: [[ID_HERO_1_HERE]], [[ID_HERO_2_HERE]], etc.
    heroImage: /\[\[ID_HERO_(\d+)_HERE\]\]/g,
    // Service images: [[ID_SERVICE_IMG_1_HERE]], etc.
    serviceImage: /\[\[ID_SERVICE_IMG_(\d+)_HERE\]\]/g,
    // Gallery images: [[ID_GALLERY_1_HERE]], etc.
    galleryImage: /\[\[ID_GALLERY_(\d+)_HERE\]\]/g,
    // Team images: [[ID_TEAM_1_HERE]], etc.
    teamImage: /\[\[ID_TEAM_(\d+)_HERE\]\]/g,
    // Color placeholders
    primaryColor: /\[\[ID_PRIMARY_COLOR_HERE\]\]/g,
    secondaryColor: /\[\[ID_SECONDARY_COLOR_HERE\]\]/g,
    accentColor: /\[\[ID_ACCENT_COLOR_HERE\]\]/g,
    // Any remaining placeholder (for validation)
    anyPlaceholder: /\[\[ID_[A-Z0-9_]+_HERE\]\]/g,
};
// ============================================
// PLACEHOLDER REGISTRY
// ============================================
/**
 * Create a placeholder registry from site identity
 * Maps placeholder IDs to their target asset URLs
 */
function createPlaceholderRegistry(siteIdentity) {
    var _a, _b, _c, _d, _e;
    const registry = {
        logo: {
            id: '[[ID_REAL_LOGO_HERE]]',
            target: siteIdentity.logoBase64 || siteIdentity.logoUrl || null,
        },
        heroImages: [],
        serviceImages: [],
        galleryImages: [],
        teamImages: [],
    };
    // Map hero images
    const heroImages = ((_a = siteIdentity.semanticImageMap) === null || _a === void 0 ? void 0 : _a.hero) || siteIdentity.heroImages || [];
    heroImages.forEach((img, index) => {
        registry.heroImages.push({
            id: `[[ID_HERO_${index + 1}_HERE]]`,
            target: img.base64 || img.url || null,
        });
    });
    // Map service images
    const serviceImages = ((_b = siteIdentity.semanticImageMap) === null || _b === void 0 ? void 0 : _b.services) || [];
    serviceImages.forEach((img, index) => {
        registry.serviceImages.push({
            id: `[[ID_SERVICE_IMG_${index + 1}_HERE]]`,
            target: img.base64 || img.url || null,
        });
    });
    // Map gallery images
    const galleryImages = ((_c = siteIdentity.semanticImageMap) === null || _c === void 0 ? void 0 : _c.gallery) || siteIdentity.galleryImages || [];
    galleryImages.forEach((img, index) => {
        registry.galleryImages.push({
            id: `[[ID_GALLERY_${index + 1}_HERE]]`,
            target: img.base64 || img.url || null,
        });
    });
    // Map team images
    const teamImages = ((_d = siteIdentity.semanticImageMap) === null || _d === void 0 ? void 0 : _d.about) || [];
    const teamMemberImages = ((_e = siteIdentity.teamMembers) === null || _e === void 0 ? void 0 : _e.filter(m => m.imageUrl).map(m => ({ url: m.imageUrl }))) || [];
    const allTeamImages = [...teamImages, ...teamMemberImages];
    allTeamImages.forEach((img, index) => {
        registry.teamImages.push({
            id: `[[ID_TEAM_${index + 1}_HERE]]`,
            target: img.base64 || img.url || img.url || null,
        });
    });
    return registry;
}
// ============================================
// INJECTION FUNCTIONS
// ============================================
/**
 * Inject logo into HTML, replacing [[ID_REAL_LOGO_HERE]]
 */
function injectLogo(html, logoBase64, logoUrl) {
    const logoSrc = logoBase64 || logoUrl || '';
    if (!logoSrc) {
        console.warn('[PostProcessor] No logo available for injection');
        // Remove placeholder or replace with empty
        return html.replace(PLACEHOLDER_PATTERNS.logo, '');
    }
    console.log(`[PostProcessor] Injecting logo: ${logoSrc.substring(0, 50)}...`);
    return html.replace(PLACEHOLDER_PATTERNS.logo, logoSrc);
}
/**
 * Inject hero images, replacing [[ID_HERO_N_HERE]]
 */
function injectHeroImages(html, heroImages) {
    return html.replace(PLACEHOLDER_PATTERNS.heroImage, (match, indexStr) => {
        const index = parseInt(indexStr, 10) - 1; // Convert 1-based to 0-based
        const img = heroImages[index];
        if (!img) {
            console.warn(`[PostProcessor] No hero image for index ${index + 1}`);
            return '';
        }
        return img.base64 || img.url || '';
    });
}
/**
 * Inject service images, replacing [[ID_SERVICE_IMG_N_HERE]]
 */
function injectServiceImages(html, serviceImages, fallbackImages = []) {
    return html.replace(PLACEHOLDER_PATTERNS.serviceImage, (match, indexStr) => {
        const index = parseInt(indexStr, 10) - 1;
        const img = serviceImages[index] || fallbackImages[index];
        if (!img) {
            console.warn(`[PostProcessor] No service image for index ${index + 1}`);
            return '';
        }
        return img.base64 || img.url || '';
    });
}
/**
 * Inject gallery images, replacing [[ID_GALLERY_N_HERE]]
 */
function injectGalleryImages(html, galleryImages) {
    return html.replace(PLACEHOLDER_PATTERNS.galleryImage, (match, indexStr) => {
        const index = parseInt(indexStr, 10) - 1;
        const img = galleryImages[index];
        if (!img) {
            console.warn(`[PostProcessor] No gallery image for index ${index + 1}`);
            return '';
        }
        return img.base64 || img.url || '';
    });
}
/**
 * Inject team images, replacing [[ID_TEAM_N_HERE]]
 */
function injectTeamImages(html, teamImages) {
    return html.replace(PLACEHOLDER_PATTERNS.teamImage, (match, indexStr) => {
        const index = parseInt(indexStr, 10) - 1;
        const img = teamImages[index];
        if (!img) {
            console.warn(`[PostProcessor] No team image for index ${index + 1}`);
            return '';
        }
        return img.base64 || img.url || img.imageUrl || '';
    });
}
/**
 * Inject color placeholders and CSS variables
 */
function injectColorVariables(html, primaryColors, accentColor) {
    let result = html;
    // Replace color placeholders
    const primary = primaryColors[0] || '#3B82F6';
    const secondary = primaryColors[1] || '#1E40AF';
    const accent = accentColor || primaryColors[2] || '#60A5FA';
    result = result.replace(PLACEHOLDER_PATTERNS.primaryColor, primary);
    result = result.replace(PLACEHOLDER_PATTERNS.secondaryColor, secondary);
    result = result.replace(PLACEHOLDER_PATTERNS.accentColor, accent);
    // Inject CSS variables in <head> if not already present
    if (!result.includes('--color-primary')) {
        const cssVariables = `
<style>
  :root {
    --color-primary: ${primary};
    --color-secondary: ${secondary};
    --color-accent: ${accent};
    --color-primary-rgb: ${hexToRgb(primary)};
    --color-secondary-rgb: ${hexToRgb(secondary)};
    --color-accent-rgb: ${hexToRgb(accent)};
  }
</style>`;
        // Insert before closing </head> tag
        if (result.includes('</head>')) {
            result = result.replace('</head>', `${cssVariables}\n</head>`);
        }
        else {
            // Prepend if no head tag
            result = cssVariables + result;
        }
    }
    return result;
}
/**
 * Convert hex color to RGB string for use in rgba()
 */
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result)
        return '59, 130, 246'; // Default blue
    return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
}
// ============================================
// MAIN INJECTION FUNCTION
// ============================================
/**
 * Main post-processing function - replaces all placeholders with real assets
 */
function injectRealAssets(html, siteIdentity, registry) {
    var _a, _b, _c, _d, _e;
    console.log('[PostProcessor] Starting asset injection...');
    // Create registry if not provided (reserved for future per-placeholder tracking)
    if (!registry) {
        void createPlaceholderRegistry(siteIdentity);
    }
    let result = html;
    // 1. Inject logo
    result = injectLogo(result, siteIdentity.logoBase64, siteIdentity.logoUrl);
    // 2. Inject hero images
    const heroImages = ((_a = siteIdentity.semanticImageMap) === null || _a === void 0 ? void 0 : _a.hero) || siteIdentity.heroImages || [];
    result = injectHeroImages(result, heroImages);
    // 3. Inject service images (with gallery as fallback)
    const serviceImages = ((_b = siteIdentity.semanticImageMap) === null || _b === void 0 ? void 0 : _b.services) || [];
    const galleryFallback = siteIdentity.galleryImages || [];
    result = injectServiceImages(result, serviceImages, galleryFallback);
    // 4. Inject gallery images
    const galleryImages = ((_c = siteIdentity.semanticImageMap) === null || _c === void 0 ? void 0 : _c.gallery) || siteIdentity.galleryImages || [];
    result = injectGalleryImages(result, galleryImages);
    // 5. Inject team images
    const teamImages = ((_d = siteIdentity.semanticImageMap) === null || _d === void 0 ? void 0 : _d.about) || [];
    const teamMemberImages = ((_e = siteIdentity.teamMembers) === null || _e === void 0 ? void 0 : _e.filter(m => m.imageUrl)) || [];
    result = injectTeamImages(result, [...teamImages, ...teamMemberImages]);
    // 6. Inject color variables
    result = injectColorVariables(result, siteIdentity.primaryColors, siteIdentity.accentColor);
    console.log('[PostProcessor] Asset injection complete');
    return result;
}
// ============================================
// VALIDATION
// ============================================
/**
 * Validate that no placeholders remain in the HTML
 */
function validateNoPlaceholders(html) {
    const matches = html.match(PLACEHOLDER_PATTERNS.anyPlaceholder) || [];
    const uniqueMatches = [...new Set(matches)];
    if (uniqueMatches.length > 0) {
        console.warn(`[PostProcessor] Found ${uniqueMatches.length} unresolved placeholders:`, uniqueMatches);
    }
    return {
        valid: uniqueMatches.length === 0,
        remaining: uniqueMatches,
        count: uniqueMatches.length,
    };
}
/**
 * Clean up any remaining placeholders by removing them
 */
function cleanupRemainingPlaceholders(html) {
    return html.replace(PLACEHOLDER_PATTERNS.anyPlaceholder, '');
}
// ============================================
// ANIMATION INJECTION
// ============================================
/**
 * Inject SaaS Glossy animation styles if not present
 */
function injectAnimationStyles(html) {
    if (html.includes('animate-fade-in-up')) {
        // Already has animation classes, check if styles exist
        if (!html.includes('@keyframes fadeInUp')) {
            const animationStyles = `
<style>
  /* SaaS Glossy Animations */
  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideInLeft {
    from {
      opacity: 0;
      transform: translateX(-30px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .animate-fade-in-up {
    animation: fadeInUp 0.8s ease-out forwards;
  }

  .animate-fade-in {
    animation: fadeIn 0.6s ease-out forwards;
  }

  .animate-slide-in-left {
    animation: slideInLeft 0.8s ease-out forwards;
  }

  .animate-float {
    animation: float 3s ease-in-out infinite;
  }

  /* Staggered animation delays */
  .animation-delay-100 { animation-delay: 100ms; opacity: 0; }
  .animation-delay-200 { animation-delay: 200ms; opacity: 0; }
  .animation-delay-300 { animation-delay: 300ms; opacity: 0; }
  .animation-delay-400 { animation-delay: 400ms; opacity: 0; }
  .animation-delay-500 { animation-delay: 500ms; opacity: 0; }
  .animation-delay-600 { animation-delay: 600ms; opacity: 0; }

  /* Smooth scroll */
  html {
    scroll-behavior: smooth;
  }
</style>`;
            if (html.includes('</head>')) {
                return html.replace('</head>', `${animationStyles}\n</head>`);
            }
        }
    }
    return html;
}
// ============================================
// GLASS & GLOW STYLE INJECTION (v4.0)
// ============================================
/**
 * Inject Glass & Glow CSS styles for Total Content Modernization
 */
function injectGlassGlowStyles(html) {
    if (html.includes('glass-glow-injected') || html.includes('.animate-glow-pulse')) {
        return html; // Already has Glass & Glow styles
    }
    const glassGlowStyles = `
<style class="glass-glow-injected">
  /* Glass & Glow Aesthetic - Total Content v4.0 */

  /* Glassmorphism Utilities */
  .glass {
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .glass-dark {
    backdrop-filter: blur(24px) saturate(150%);
    -webkit-backdrop-filter: blur(24px) saturate(150%);
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .glass-card {
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
    background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 24px;
  }

  /* Glow Effects */
  .glow {
    box-shadow: 0 0 30px rgba(var(--color-accent-rgb, 96, 165, 250), 0.3);
  }
  .glow-lg {
    box-shadow: 0 0 60px rgba(var(--color-accent-rgb, 96, 165, 250), 0.4);
  }
  .glow-text {
    text-shadow: 0 0 20px rgba(var(--color-accent-rgb, 96, 165, 250), 0.5);
  }

  /* Glow Pulse Animation */
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 20px rgba(var(--color-accent-rgb, 96, 165, 250), 0.3); }
    50% { box-shadow: 0 0 40px rgba(var(--color-accent-rgb, 96, 165, 250), 0.6); }
  }
  .animate-glow-pulse {
    animation: glowPulse 2s ease-in-out infinite;
  }

  /* Mesh Gradient Background */
  .mesh-bg {
    background-image:
      radial-gradient(at 40% 20%, rgba(var(--color-accent-rgb, 96, 165, 250), 0.3) 0px, transparent 50%),
      radial-gradient(at 80% 0%, rgba(var(--color-primary-rgb, 59, 130, 246), 0.2) 0px, transparent 50%),
      radial-gradient(at 0% 50%, rgba(var(--color-accent-rgb, 96, 165, 250), 0.2) 0px, transparent 50%);
  }

  /* Additional Entry Animations */
  @keyframes fadeInLeft {
    from { opacity: 0; transform: translateX(-40px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes fadeInRight {
    from { opacity: 0; transform: translateX(40px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(60px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .animate-fade-in-left { animation: fadeInLeft 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
  .animate-fade-in-right { animation: fadeInRight 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
  .animate-scale-in { animation: scaleIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
  .animate-slide-up { animation: slideUp 1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }

  /* Extended Staggered Delays */
  .delay-700 { animation-delay: 700ms; opacity: 0; }
  .delay-800 { animation-delay: 800ms; opacity: 0; }
  .delay-900 { animation-delay: 900ms; opacity: 0; }
  .delay-1000 { animation-delay: 1000ms; opacity: 0; }

  /* Premium Button Styles */
  .btn-glow {
    background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
    box-shadow: 0 4px 20px rgba(var(--color-accent-rgb, 96, 165, 250), 0.3);
    transition: all 0.3s ease;
  }
  .btn-glow:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 40px rgba(var(--color-accent-rgb, 96, 165, 250), 0.5);
  }

  /* Gradient Text Enhancement */
  .gradient-text-glow {
    background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 0 20px rgba(var(--color-accent-rgb, 96, 165, 250), 0.3));
  }

  /* Card Hover Effects */
  .card-hover {
    transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .card-hover:hover {
    transform: translateY(-8px) scale(1.02);
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  }

  /* Image Reveal Effect */
  .img-reveal {
    overflow: hidden;
    border-radius: 24px;
  }
  .img-reveal img {
    transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .img-reveal:hover img {
    transform: scale(1.05);
  }
</style>`;
    // Insert before closing </head> or at the beginning
    if (html.includes('</head>')) {
        return html.replace('</head>', `${glassGlowStyles}\n</head>`);
    }
    else if (html.includes('</style>')) {
        // Insert after last style tag
        const lastStyleIndex = html.lastIndexOf('</style>');
        return html.slice(0, lastStyleIndex + 8) + glassGlowStyles + html.slice(lastStyleIndex + 8);
    }
    return glassGlowStyles + html;
}
/**
 * Inject semantic image placeholders based on caption matching
 * Maps images to appropriate sections using their semantic captions
 */
function injectSemanticImages(html, semanticImageMap) {
    let result = html;
    // Hero images
    if (semanticImageMap.hero) {
        semanticImageMap.hero.forEach((img, i) => {
            const placeholder = `[[ID_HERO_${i + 1}_HERE]]`;
            const src = img.base64 || img.url || '';
            result = result.replace(new RegExp(placeholder.replace(/[[\]]/g, '\\$&'), 'g'), src);
        });
    }
    // Service images
    if (semanticImageMap.services) {
        semanticImageMap.services.forEach((img, i) => {
            const placeholder = `[[ID_SERVICE_IMG_${i + 1}_HERE]]`;
            const src = img.base64 || img.url || '';
            result = result.replace(new RegExp(placeholder.replace(/[[\]]/g, '\\$&'), 'g'), src);
        });
    }
    // About/Team images
    if (semanticImageMap.about) {
        semanticImageMap.about.forEach((img, i) => {
            const placeholder = `[[ID_TEAM_${i + 1}_HERE]]`;
            const src = img.base64 || img.url || '';
            result = result.replace(new RegExp(placeholder.replace(/[[\]]/g, '\\$&'), 'g'), src);
        });
    }
    // Gallery images
    if (semanticImageMap.gallery) {
        semanticImageMap.gallery.forEach((img, i) => {
            const placeholder = `[[ID_GALLERY_${i + 1}_HERE]]`;
            const src = img.base64 || img.url || '';
            result = result.replace(new RegExp(placeholder.replace(/[[\]]/g, '\\$&'), 'g'), src);
        });
    }
    return result;
}
// ============================================
// FULL POST-PROCESSING PIPELINE
// ============================================
/**
 * Run the complete post-processing pipeline
 * Enhanced for Total Content Modernization v4.0
 */
function runPostProcessingPipeline(html, siteIdentity) {
    let result = html;
    // Step 1: Inject all real assets
    result = injectRealAssets(result, siteIdentity);
    // Step 2: Inject semantic images if semantic map exists
    if (siteIdentity.semanticImageMap) {
        result = injectSemanticImages(result, siteIdentity.semanticImageMap);
    }
    // Step 3: Inject animation styles if needed
    result = injectAnimationStyles(result);
    // Step 4: Inject Glass & Glow styles (v4.0)
    result = injectGlassGlowStyles(result);
    // Step 5: Validate and clean up
    const validation = validateNoPlaceholders(result);
    if (!validation.valid) {
        console.warn('[PostProcessor] Cleaning up remaining placeholders');
        result = cleanupRemainingPlaceholders(result);
    }
    return {
        html: result,
        validation,
    };
}
//# sourceMappingURL=postProcessor.js.map