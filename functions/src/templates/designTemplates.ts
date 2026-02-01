/**
 * Design Templates Registry
 * 12 distinct visual styles for website generation
 */

import type { DesignTemplate, DesignTemplateId } from '../../../types';

export const DESIGN_TEMPLATES: Record<DesignTemplateId, DesignTemplate> = {
  // ============================================
  // 1. GLASS AURORA - Ethereal glassmorphism
  // ============================================
  'glass-aurora': {
    id: 'glass-aurora',
    name: 'Glass Aurora',
    description: 'Ethereal glassmorphism with aurora gradient backgrounds',

    typography: {
      hero: 'text-5xl md:text-6xl lg:text-7xl',
      h1: 'text-4xl md:text-5xl',
      h2: 'text-2xl md:text-3xl',
      h3: 'text-xl md:text-2xl',
      body: 'text-base md:text-lg',
      small: 'text-sm',
      lineHeight: 'leading-tight',
      letterSpacing: 'tracking-tight',
    },

    spacing: {
      sectionPadding: 'py-24 md:py-32',
      elementGap: 'space-y-6',
      containerWidth: 'max-w-7xl',
      containerPadding: 'px-6 lg:px-8',
    },

    visual: {
      borderRadius: 'rounded-3xl',
      shadowDepth: 'shadow-2xl',
      borderStyle: 'border border-white/10',
      cardStyle: 'rounded-3xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl',
      buttonStyle: 'rounded-xl px-8 py-4 bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] text-white font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:scale-105 transition-all',
      imageStyle: 'rounded-3xl overflow-hidden shadow-2xl',
    },

    animation: {
      entranceAnimation: 'fadeInUp',
      duration: '0.8s',
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      staggerDelay: 100,
      hoverEffect: 'hover:scale-105 hover:shadow-glow',
    },

    color: {
      backgroundMode: 'dark',
      heroBackground: 'bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950',
      sectionAlternation: true,
      accentUsage: 'buttons-and-highlights',
      gradientStyle: 'from-[var(--color-primary)] to-[var(--color-accent)]',
      glassEffect: true,
      glowEffect: true,
    },

    layout: {
      heroLayout: 'centered',
      servicesLayout: 'grid-3',
      testimonialsLayout: 'grid',
      ctaLayout: 'centered',
      navbarStyle: 'glass',
      footerStyle: 'dark-gradient',
    },

    fonts: {
      headlineFont: 'Inter',
      bodyFont: 'Inter',
      headlineWeight: 'font-bold',
      bodyWeight: 'font-normal',
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
    },

    sectionOrder: ['hero', 'services', 'about', 'testimonials', 'cta', 'contact'],

    industryScores: {
      'tech': 0.95, 'saas': 0.95, 'software': 0.9, 'startup': 0.9,
      'agency': 0.85, 'crypto': 0.9, 'fintech': 0.85, 'ai': 0.95,
    },

    vibeKeywords: ['modern', 'futuristic', 'sleek', 'tech', 'innovative', 'cutting-edge', 'digital'],

    trendYear: 2024,
    trendTags: ['glassmorphism', 'aurora-gradients', 'dark-mode'],

    promptFragment: `Create an ethereal, futuristic design using:
- Dark gradient backgrounds (slate-950 to indigo-950)
- Glassmorphism cards: bg-white/5 backdrop-blur-xl border-white/10
- Aurora gradient accents on CTAs and highlights
- Floating elements with subtle glow effects (shadow-glow)
- Large bold headlines with tight letter-spacing
- Smooth fadeInUp animations with staggered delays`,
  },

  // ============================================
  // 2. BOLD BRUTALIST - High contrast geometric
  // ============================================
  'bold-brutalist': {
    id: 'bold-brutalist',
    name: 'Bold Brutalist',
    description: 'High contrast with geometric shapes and strong typography',

    typography: {
      hero: 'text-6xl md:text-8xl lg:text-9xl',
      h1: 'text-5xl md:text-6xl',
      h2: 'text-3xl md:text-4xl',
      h3: 'text-2xl md:text-3xl',
      body: 'text-lg md:text-xl',
      small: 'text-sm',
      lineHeight: 'leading-none',
      letterSpacing: 'tracking-tighter',
    },

    spacing: {
      sectionPadding: 'py-16 md:py-24',
      elementGap: 'space-y-4',
      containerWidth: 'max-w-6xl',
      containerPadding: 'px-4 lg:px-6',
    },

    visual: {
      borderRadius: 'rounded-none',
      shadowDepth: 'shadow-none',
      borderStyle: 'border-4 border-black',
      cardStyle: 'border-4 border-black bg-white p-6 hover:bg-black hover:text-white transition-all',
      buttonStyle: 'px-8 py-4 bg-black text-white font-black uppercase tracking-widest border-4 border-black hover:bg-white hover:text-black transition-all',
      imageStyle: 'border-4 border-black grayscale hover:grayscale-0 transition-all',
    },

    animation: {
      entranceAnimation: 'slideInLeft',
      duration: '0.4s',
      easing: 'ease-out',
      staggerDelay: 50,
      hoverEffect: 'hover:-translate-y-1 hover:shadow-[8px_8px_0_0_black]',
    },

    color: {
      backgroundMode: 'light',
      heroBackground: 'bg-white',
      sectionAlternation: false,
      accentUsage: 'buttons-only',
      gradientStyle: null,
      glassEffect: false,
      glowEffect: false,
    },

    layout: {
      heroLayout: 'left-aligned',
      servicesLayout: 'grid-2',
      testimonialsLayout: 'single-featured',
      ctaLayout: 'full-width-gradient',
      navbarStyle: 'solid',
      footerStyle: 'minimal',
    },

    fonts: {
      headlineFont: 'Space Grotesk',
      bodyFont: 'Space Grotesk',
      headlineWeight: 'font-black',
      bodyWeight: 'font-medium',
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap',
    },

    sectionOrder: ['hero', 'about', 'services', 'testimonials', 'contact'],

    industryScores: {
      'creative': 0.95, 'design': 0.95, 'architecture': 0.9, 'art': 0.9,
      'fashion': 0.85, 'music': 0.8, 'agency': 0.8, 'gallery': 0.9,
    },

    vibeKeywords: ['bold', 'edgy', 'artistic', 'unconventional', 'strong', 'impactful', 'raw'],

    trendYear: 2024,
    trendTags: ['neubrutalism', 'anti-design', 'high-contrast'],

    promptFragment: `Create a striking, high-contrast design using:
- Black and white primary palette with sharp borders
- NO border radius (squared corners everywhere)
- Heavy black borders (border-4 border-black)
- MASSIVE uppercase typography with tracking-tighter
- Hover effects: color inversions, offset shadows [8px_8px_0_0_black]
- Raw, honest aesthetic - no decorative elements
- Asymmetric layouts, strong grid structure`,
  },

  // ============================================
  // 3. SOFT ORGANIC - Natural and gentle
  // ============================================
  'soft-organic': {
    id: 'soft-organic',
    name: 'Soft Organic',
    description: 'Rounded corners, natural colors, and gentle gradients',

    typography: {
      hero: 'text-4xl md:text-5xl lg:text-6xl',
      h1: 'text-3xl md:text-4xl',
      h2: 'text-2xl md:text-3xl',
      h3: 'text-xl md:text-2xl',
      body: 'text-base md:text-lg',
      small: 'text-sm',
      lineHeight: 'leading-relaxed',
      letterSpacing: 'tracking-normal',
    },

    spacing: {
      sectionPadding: 'py-20 md:py-28',
      elementGap: 'space-y-8',
      containerWidth: 'max-w-5xl',
      containerPadding: 'px-6 lg:px-12',
    },

    visual: {
      borderRadius: 'rounded-[2rem]',
      shadowDepth: 'shadow-lg shadow-emerald-500/10',
      borderStyle: 'border border-emerald-100',
      cardStyle: 'rounded-[2rem] bg-gradient-to-br from-white to-emerald-50/50 border border-emerald-100 shadow-lg shadow-emerald-500/10 p-8',
      buttonStyle: 'rounded-full px-8 py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium shadow-lg shadow-emerald-500/25 hover:shadow-xl transition-all',
      imageStyle: 'rounded-[2rem] overflow-hidden',
    },

    animation: {
      entranceAnimation: 'fadeIn',
      duration: '1s',
      easing: 'ease-out',
      staggerDelay: 150,
      hoverEffect: 'hover:scale-[1.02] hover:shadow-xl',
    },

    color: {
      backgroundMode: 'light',
      heroBackground: 'bg-gradient-to-br from-emerald-50 via-white to-teal-50',
      sectionAlternation: true,
      accentUsage: 'buttons-and-highlights',
      gradientStyle: 'from-emerald-500 to-teal-500',
      glassEffect: false,
      glowEffect: false,
    },

    layout: {
      heroLayout: 'centered',
      servicesLayout: 'cards-stacked',
      testimonialsLayout: 'carousel',
      ctaLayout: 'centered',
      navbarStyle: 'transparent',
      footerStyle: 'centered',
    },

    fonts: {
      headlineFont: 'DM Sans',
      bodyFont: 'DM Sans',
      headlineWeight: 'font-semibold',
      bodyWeight: 'font-normal',
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap',
    },

    sectionOrder: ['hero', 'about', 'services', 'testimonials', 'cta', 'contact'],

    industryScores: {
      'wellness': 0.95, 'spa': 0.95, 'yoga': 0.9, 'organic': 0.9,
      'health': 0.85, 'skincare': 0.85, 'eco': 0.9, 'nutrition': 0.85,
    },

    vibeKeywords: ['natural', 'calming', 'organic', 'gentle', 'wellness', 'peaceful', 'serene'],

    trendYear: 2024,
    trendTags: ['organic-shapes', 'soft-gradients', 'nature-inspired'],

    promptFragment: `Create a calming, nature-inspired design using:
- Soft earthy gradients (emerald, teal, sage tones)
- Extra-rounded corners (rounded-[2rem] or rounded-full)
- Gentle shadows with color tints (shadow-emerald-500/10)
- Generous whitespace and breathing room
- Flowing, organic shapes
- Relaxed typography with leading-relaxed
- Subtle animations, no jarring movements`,
  },

  // ============================================
  // 4. DARK LUXURY - Premium dark mode
  // ============================================
  'dark-luxury': {
    id: 'dark-luxury',
    name: 'Dark Luxury',
    description: 'Sophisticated dark mode with gold accents and premium feel',

    typography: {
      hero: 'text-5xl md:text-6xl lg:text-7xl',
      h1: 'text-4xl md:text-5xl',
      h2: 'text-2xl md:text-3xl',
      h3: 'text-xl md:text-2xl',
      body: 'text-base md:text-lg',
      small: 'text-sm',
      lineHeight: 'leading-snug',
      letterSpacing: 'tracking-wide',
    },

    spacing: {
      sectionPadding: 'py-28 md:py-40',
      elementGap: 'space-y-10',
      containerWidth: 'max-w-6xl',
      containerPadding: 'px-8 lg:px-16',
    },

    visual: {
      borderRadius: 'rounded-sm',
      shadowDepth: 'shadow-2xl shadow-black/50',
      borderStyle: 'border border-amber-500/20',
      cardStyle: 'rounded-sm bg-zinc-900/80 border border-amber-500/20 shadow-2xl p-10',
      buttonStyle: 'rounded-sm px-10 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold uppercase tracking-widest hover:from-amber-400 hover:to-amber-500 transition-all',
      imageStyle: 'rounded-sm overflow-hidden grayscale-[30%]',
    },

    animation: {
      entranceAnimation: 'fadeIn',
      duration: '1.2s',
      easing: 'ease-out',
      staggerDelay: 200,
      hoverEffect: 'hover:border-amber-500/50 hover:shadow-amber-500/10',
    },

    color: {
      backgroundMode: 'dark',
      heroBackground: 'bg-gradient-to-b from-black via-zinc-950 to-zinc-900',
      sectionAlternation: false,
      accentUsage: 'buttons-and-highlights',
      gradientStyle: 'from-amber-500 to-amber-600',
      glassEffect: false,
      glowEffect: true,
    },

    layout: {
      heroLayout: 'centered',
      servicesLayout: 'grid-2',
      testimonialsLayout: 'single-featured',
      ctaLayout: 'centered',
      navbarStyle: 'transparent',
      footerStyle: 'minimal',
    },

    fonts: {
      headlineFont: 'Playfair Display',
      bodyFont: 'Inter',
      headlineWeight: 'font-medium',
      bodyWeight: 'font-light',
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap',
    },

    sectionOrder: ['hero', 'about', 'services', 'testimonials', 'contact'],

    industryScores: {
      'luxury': 0.95, 'jewelry': 0.95, 'real-estate': 0.9, 'law': 0.85,
      'finance': 0.85, 'hotel': 0.9, 'fine-dining': 0.85, 'watches': 0.95,
    },

    vibeKeywords: ['luxury', 'premium', 'exclusive', 'sophisticated', 'elegant', 'high-end', 'opulent'],

    trendYear: 2024,
    trendTags: ['dark-mode', 'gold-accents', 'luxury-minimal'],

    promptFragment: `Create a sophisticated, premium design using:
- Deep black/zinc backgrounds with subtle gradients
- Gold/amber accents (#D4AF37, amber-500/600)
- Serif headlines (Playfair Display) for elegance
- Minimal rounded corners (rounded-sm)
- Generous spacing and breathing room (py-28 to py-40)
- Subtle image desaturation for cohesion
- Slow, deliberate animations (1.2s duration)`,
  },

  // ============================================
  // 5. CLEAN MINIMAL - Maximum whitespace
  // ============================================
  'clean-minimal': {
    id: 'clean-minimal',
    name: 'Clean Minimal',
    description: 'Maximum whitespace with thin lines and subtle elegance',

    typography: {
      hero: 'text-4xl md:text-5xl lg:text-6xl',
      h1: 'text-3xl md:text-4xl',
      h2: 'text-xl md:text-2xl',
      h3: 'text-lg md:text-xl',
      body: 'text-base',
      small: 'text-xs',
      lineHeight: 'leading-loose',
      letterSpacing: 'tracking-normal',
    },

    spacing: {
      sectionPadding: 'py-32 md:py-48',
      elementGap: 'space-y-12',
      containerWidth: 'max-w-4xl',
      containerPadding: 'px-8 lg:px-12',
    },

    visual: {
      borderRadius: 'rounded',
      shadowDepth: 'shadow-none',
      borderStyle: 'border-b border-gray-100',
      cardStyle: 'border-b border-gray-100 pb-8',
      buttonStyle: 'rounded px-6 py-3 border border-black text-black font-medium hover:bg-black hover:text-white transition-all',
      imageStyle: 'rounded overflow-hidden',
    },

    animation: {
      entranceAnimation: 'fadeIn',
      duration: '0.6s',
      easing: 'ease-out',
      staggerDelay: 100,
      hoverEffect: 'hover:opacity-70',
    },

    color: {
      backgroundMode: 'light',
      heroBackground: 'bg-white',
      sectionAlternation: false,
      accentUsage: 'buttons-only',
      gradientStyle: null,
      glassEffect: false,
      glowEffect: false,
    },

    layout: {
      heroLayout: 'left-aligned',
      servicesLayout: 'list',
      testimonialsLayout: 'single-featured',
      ctaLayout: 'left-with-image',
      navbarStyle: 'transparent',
      footerStyle: 'minimal',
    },

    fonts: {
      headlineFont: 'Inter',
      bodyFont: 'Inter',
      headlineWeight: 'font-normal',
      bodyWeight: 'font-light',
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap',
    },

    sectionOrder: ['hero', 'services', 'about', 'contact'],

    industryScores: {
      'architecture': 0.95, 'design': 0.9, 'photography': 0.9, 'consulting': 0.85,
      'agency': 0.8, 'studio': 0.9, 'portfolio': 0.9,
    },

    vibeKeywords: ['minimal', 'clean', 'simple', 'understated', 'refined', 'zen', 'elegant'],

    trendYear: 2024,
    trendTags: ['minimalism', 'whitespace', 'less-is-more'],

    promptFragment: `Create a refined, minimalist design using:
- Maximum whitespace (py-32 to py-48 sections)
- Thin hairline borders, NO heavy shadows
- Neutral sans-serif fonts (Inter)
- Black text on white, minimal accent color
- Subtle hover states (opacity changes only)
- No decorative elements, content-focused
- Narrow container width (max-w-4xl) for readability`,
  },

  // ============================================
  // 6. BENTO PLAYFUL - Asymmetric cards
  // ============================================
  'bento-playful': {
    id: 'bento-playful',
    name: 'Bento Playful',
    description: 'Asymmetric card layouts with mixed sizes and colorful accents',

    typography: {
      hero: 'text-5xl md:text-6xl lg:text-7xl',
      h1: 'text-4xl md:text-5xl',
      h2: 'text-2xl md:text-3xl',
      h3: 'text-xl md:text-2xl',
      body: 'text-base md:text-lg',
      small: 'text-sm',
      lineHeight: 'leading-snug',
      letterSpacing: 'tracking-tight',
    },

    spacing: {
      sectionPadding: 'py-20 md:py-28',
      elementGap: 'space-y-6 gap-4',
      containerWidth: 'max-w-7xl',
      containerPadding: 'px-4 lg:px-8',
    },

    visual: {
      borderRadius: 'rounded-[24px]',
      shadowDepth: 'shadow-xl',
      borderStyle: 'border-none',
      cardStyle: 'rounded-[24px] bg-white shadow-xl p-6 hover:shadow-2xl hover:-translate-y-1 transition-all',
      buttonStyle: 'rounded-full px-8 py-4 bg-[var(--color-primary)] text-white font-semibold shadow-lg hover:shadow-xl hover:scale-105 transition-all',
      imageStyle: 'rounded-[24px] overflow-hidden',
    },

    animation: {
      entranceAnimation: 'fadeInUp',
      duration: '0.6s',
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      staggerDelay: 75,
      hoverEffect: 'hover:-translate-y-2 hover:shadow-2xl',
    },

    color: {
      backgroundMode: 'light',
      heroBackground: 'bg-gradient-to-br from-violet-50 via-white to-pink-50',
      sectionAlternation: true,
      accentUsage: 'everywhere',
      gradientStyle: 'from-violet-500 to-pink-500',
      glassEffect: false,
      glowEffect: false,
    },

    layout: {
      heroLayout: 'centered',
      servicesLayout: 'bento',
      testimonialsLayout: 'masonry',
      ctaLayout: 'centered',
      navbarStyle: 'floating',
      footerStyle: 'columns',
    },

    fonts: {
      headlineFont: 'Plus Jakarta Sans',
      bodyFont: 'Plus Jakarta Sans',
      headlineWeight: 'font-bold',
      bodyWeight: 'font-normal',
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
    },

    sectionOrder: ['hero', 'services', 'features', 'testimonials', 'cta', 'contact'],

    industryScores: {
      'retail': 0.9, 'ecommerce': 0.9, 'startup': 0.85, 'saas': 0.8,
      'app': 0.9, 'product': 0.85, 'marketplace': 0.85,
    },

    vibeKeywords: ['playful', 'colorful', 'dynamic', 'fun', 'modern', 'energetic', 'friendly'],

    trendYear: 2024,
    trendTags: ['bento-grid', 'asymmetric-layout', 'colorful'],

    promptFragment: `Create a dynamic, playful design using:
- Bento grid layout with MIXED card sizes (span-2, span-1)
- Extra-rounded corners (rounded-[24px])
- Colorful gradient backgrounds per section
- Floating navigation bar
- Quick, bouncy animations (0.6s with cubic-bezier)
- Shadow-based depth (shadow-xl to shadow-2xl)
- Playful hover effects (-translate-y-2)`,
  },

  // ============================================
  // 7. EDITORIAL MAGAZINE - Serif headlines
  // ============================================
  'editorial-magazine': {
    id: 'editorial-magazine',
    name: 'Editorial Magazine',
    description: 'Serif headlines with editorial layouts and image-heavy design',

    typography: {
      hero: 'text-5xl md:text-7xl lg:text-8xl',
      h1: 'text-4xl md:text-6xl',
      h2: 'text-2xl md:text-3xl',
      h3: 'text-xl md:text-2xl',
      body: 'text-lg md:text-xl',
      small: 'text-sm',
      lineHeight: 'leading-relaxed',
      letterSpacing: 'tracking-normal',
    },

    spacing: {
      sectionPadding: 'py-24 md:py-36',
      elementGap: 'space-y-8',
      containerWidth: 'max-w-6xl',
      containerPadding: 'px-6 lg:px-12',
    },

    visual: {
      borderRadius: 'rounded-lg',
      shadowDepth: 'shadow-lg',
      borderStyle: 'border-b-2 border-black',
      cardStyle: 'bg-white border-b-2 border-black p-8',
      buttonStyle: 'rounded-none px-8 py-4 bg-black text-white font-medium tracking-wider hover:bg-gray-900 transition-all',
      imageStyle: 'rounded-none overflow-hidden',
    },

    animation: {
      entranceAnimation: 'fadeIn',
      duration: '0.8s',
      easing: 'ease-out',
      staggerDelay: 150,
      hoverEffect: 'hover:opacity-80',
    },

    color: {
      backgroundMode: 'light',
      heroBackground: 'bg-stone-50',
      sectionAlternation: true,
      accentUsage: 'buttons-only',
      gradientStyle: null,
      glassEffect: false,
      glowEffect: false,
    },

    layout: {
      heroLayout: 'split',
      servicesLayout: 'grid-2',
      testimonialsLayout: 'single-featured',
      ctaLayout: 'left-with-image',
      navbarStyle: 'solid',
      footerStyle: 'columns',
    },

    fonts: {
      headlineFont: 'Playfair Display',
      bodyFont: 'Source Serif 4',
      headlineWeight: 'font-bold',
      bodyWeight: 'font-normal',
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700;800&family=Source+Serif+4:wght@400;500;600&display=swap',
    },

    sectionOrder: ['hero', 'about', 'services', 'gallery', 'testimonials', 'contact'],

    industryScores: {
      'media': 0.95, 'publishing': 0.95, 'magazine': 0.95, 'editorial': 0.95,
      'blog': 0.9, 'news': 0.9, 'journalism': 0.9, 'content': 0.85,
    },

    vibeKeywords: ['editorial', 'sophisticated', 'classic', 'literary', 'refined', 'traditional', 'elegant'],

    trendYear: 2024,
    trendTags: ['editorial-design', 'serif-fonts', 'image-heavy'],

    promptFragment: `Create a sophisticated editorial design using:
- Large serif headlines (Playfair Display)
- Magazine-style layouts with asymmetric image placement
- Stone/cream background tones
- Strong typography hierarchy (text-7xl to text-8xl heroes)
- Split hero layouts with text and image side-by-side
- NO rounded corners (squared, editorial aesthetic)
- Black bottom borders as dividers`,
  },

  // ============================================
  // 8. NEON CYBER - Futuristic neon
  // ============================================
  'neon-cyber': {
    id: 'neon-cyber',
    name: 'Neon Cyber',
    description: 'Dark background with neon accents and futuristic aesthetic',

    typography: {
      hero: 'text-5xl md:text-6xl lg:text-7xl',
      h1: 'text-4xl md:text-5xl',
      h2: 'text-2xl md:text-3xl',
      h3: 'text-xl md:text-2xl',
      body: 'text-base md:text-lg',
      small: 'text-sm',
      lineHeight: 'leading-tight',
      letterSpacing: 'tracking-wide',
    },

    spacing: {
      sectionPadding: 'py-24 md:py-32',
      elementGap: 'space-y-6',
      containerWidth: 'max-w-7xl',
      containerPadding: 'px-6 lg:px-8',
    },

    visual: {
      borderRadius: 'rounded-xl',
      shadowDepth: 'shadow-2xl shadow-cyan-500/20',
      borderStyle: 'border border-cyan-500/30',
      cardStyle: 'rounded-xl bg-black/50 backdrop-blur-lg border border-cyan-500/30 shadow-2xl shadow-cyan-500/20 p-6',
      buttonStyle: 'rounded-lg px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold shadow-lg shadow-cyan-500/50 hover:shadow-xl hover:shadow-cyan-400/60 transition-all',
      imageStyle: 'rounded-xl overflow-hidden border border-cyan-500/20',
    },

    animation: {
      entranceAnimation: 'fadeInUp',
      duration: '0.6s',
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      staggerDelay: 100,
      hoverEffect: 'hover:shadow-cyan-400/40 hover:border-cyan-400/50',
    },

    color: {
      backgroundMode: 'dark',
      heroBackground: 'bg-gradient-to-b from-black via-slate-950 to-purple-950',
      sectionAlternation: false,
      accentUsage: 'everywhere',
      gradientStyle: 'from-cyan-500 to-purple-500',
      glassEffect: true,
      glowEffect: true,
    },

    layout: {
      heroLayout: 'centered',
      servicesLayout: 'grid-3',
      testimonialsLayout: 'grid',
      ctaLayout: 'centered',
      navbarStyle: 'glass',
      footerStyle: 'dark-gradient',
    },

    fonts: {
      headlineFont: 'Orbitron',
      bodyFont: 'Inter',
      headlineWeight: 'font-bold',
      bodyWeight: 'font-normal',
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600&display=swap',
    },

    sectionOrder: ['hero', 'features', 'services', 'testimonials', 'cta', 'contact'],

    industryScores: {
      'gaming': 0.95, 'esports': 0.95, 'tech': 0.85, 'crypto': 0.9,
      'nft': 0.9, 'metaverse': 0.95, 'vr': 0.9, 'music': 0.8,
    },

    vibeKeywords: ['futuristic', 'cyber', 'neon', 'tech', 'gaming', 'edgy', 'digital', 'cutting-edge'],

    trendYear: 2024,
    trendTags: ['cyberpunk', 'neon-glow', 'dark-mode'],

    promptFragment: `Create a futuristic cyberpunk design using:
- Deep black/purple gradient backgrounds
- Neon cyan and purple accents (#06B6D4, #A855F7)
- Glowing borders (border-cyan-500/30) and shadows (shadow-cyan-500/20)
- Futuristic fonts (Orbitron for headlines)
- Glassmorphism with neon tints
- Grid-based layouts with tech aesthetic
- Animated glow effects on hover`,
  },

  // ============================================
  // 9. WARM ARTISAN - Handcrafted feel
  // ============================================
  'warm-artisan': {
    id: 'warm-artisan',
    name: 'Warm Artisan',
    description: 'Earthy tones with handcrafted feel and textured elements',

    typography: {
      hero: 'text-4xl md:text-5xl lg:text-6xl',
      h1: 'text-3xl md:text-4xl',
      h2: 'text-2xl md:text-3xl',
      h3: 'text-xl md:text-2xl',
      body: 'text-base md:text-lg',
      small: 'text-sm',
      lineHeight: 'leading-relaxed',
      letterSpacing: 'tracking-normal',
    },

    spacing: {
      sectionPadding: 'py-20 md:py-28',
      elementGap: 'space-y-8',
      containerWidth: 'max-w-5xl',
      containerPadding: 'px-6 lg:px-10',
    },

    visual: {
      borderRadius: 'rounded-2xl',
      shadowDepth: 'shadow-lg shadow-amber-900/10',
      borderStyle: 'border border-amber-200',
      cardStyle: 'rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 shadow-lg shadow-amber-900/10 p-8',
      buttonStyle: 'rounded-xl px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-semibold shadow-lg shadow-amber-600/25 hover:shadow-xl transition-all',
      imageStyle: 'rounded-2xl overflow-hidden',
    },

    animation: {
      entranceAnimation: 'fadeIn',
      duration: '0.8s',
      easing: 'ease-out',
      staggerDelay: 150,
      hoverEffect: 'hover:shadow-xl hover:scale-[1.02]',
    },

    color: {
      backgroundMode: 'light',
      heroBackground: 'bg-gradient-to-br from-amber-50 via-white to-orange-50',
      sectionAlternation: true,
      accentUsage: 'buttons-and-highlights',
      gradientStyle: 'from-amber-600 to-orange-600',
      glassEffect: false,
      glowEffect: false,
    },

    layout: {
      heroLayout: 'split',
      servicesLayout: 'grid-2',
      testimonialsLayout: 'carousel',
      ctaLayout: 'centered',
      navbarStyle: 'solid',
      footerStyle: 'columns',
    },

    fonts: {
      headlineFont: 'Fraunces',
      bodyFont: 'Lora',
      headlineWeight: 'font-semibold',
      bodyWeight: 'font-normal',
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600;700&family=Lora:wght@400;500;600&display=swap',
    },

    sectionOrder: ['hero', 'about', 'services', 'gallery', 'testimonials', 'contact'],

    industryScores: {
      'restaurant': 0.95, 'cafe': 0.95, 'bakery': 0.95, 'food': 0.9,
      'catering': 0.9, 'artisan': 0.95, 'craft': 0.9, 'brewery': 0.9,
    },

    vibeKeywords: ['warm', 'artisan', 'handcrafted', 'cozy', 'rustic', 'authentic', 'homemade'],

    trendYear: 2024,
    trendTags: ['earthy-tones', 'artisan-aesthetic', 'warm-colors'],

    promptFragment: `Create a warm, artisan-inspired design using:
- Earthy warm tones (amber, orange, terracotta)
- Soft gradients from amber-50 to orange-50
- Handcrafted feel with rounded corners
- Serif fonts for headlines (Fraunces)
- Gallery sections to showcase products/food
- Cozy, inviting atmosphere
- Split hero with image emphasis`,
  },

  // ============================================
  // 10. CORPORATE TRUST - Professional blues
  // ============================================
  'corporate-trust': {
    id: 'corporate-trust',
    name: 'Corporate Trust',
    description: 'Professional design with trust-building blue palette',

    typography: {
      hero: 'text-4xl md:text-5xl lg:text-6xl',
      h1: 'text-3xl md:text-4xl',
      h2: 'text-2xl md:text-3xl',
      h3: 'text-xl md:text-2xl',
      body: 'text-base md:text-lg',
      small: 'text-sm',
      lineHeight: 'leading-normal',
      letterSpacing: 'tracking-normal',
    },

    spacing: {
      sectionPadding: 'py-20 md:py-28',
      elementGap: 'space-y-6',
      containerWidth: 'max-w-6xl',
      containerPadding: 'px-6 lg:px-8',
    },

    visual: {
      borderRadius: 'rounded-lg',
      shadowDepth: 'shadow-md',
      borderStyle: 'border border-blue-100',
      cardStyle: 'rounded-lg bg-white border border-blue-100 shadow-md p-6 hover:shadow-lg transition-all',
      buttonStyle: 'rounded-lg px-6 py-3 bg-blue-600 text-white font-medium hover:bg-blue-700 transition-all',
      imageStyle: 'rounded-lg overflow-hidden',
    },

    animation: {
      entranceAnimation: 'fadeIn',
      duration: '0.6s',
      easing: 'ease-out',
      staggerDelay: 100,
      hoverEffect: 'hover:shadow-lg hover:border-blue-200',
    },

    color: {
      backgroundMode: 'light',
      heroBackground: 'bg-gradient-to-br from-blue-50 via-white to-slate-50',
      sectionAlternation: true,
      accentUsage: 'buttons-only',
      gradientStyle: null,
      glassEffect: false,
      glowEffect: false,
    },

    layout: {
      heroLayout: 'left-aligned',
      servicesLayout: 'grid-3',
      testimonialsLayout: 'grid',
      ctaLayout: 'left-with-image',
      navbarStyle: 'solid',
      footerStyle: 'columns',
    },

    fonts: {
      headlineFont: 'Inter',
      bodyFont: 'Inter',
      headlineWeight: 'font-semibold',
      bodyWeight: 'font-normal',
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    },

    sectionOrder: ['hero', 'services', 'about', 'testimonials', 'faq', 'contact'],

    industryScores: {
      'law': 0.95, 'finance': 0.95, 'insurance': 0.9, 'healthcare': 0.9,
      'consulting': 0.9, 'accounting': 0.9, 'banking': 0.9, 'corporate': 0.95,
    },

    vibeKeywords: ['professional', 'trustworthy', 'reliable', 'corporate', 'established', 'credible'],

    trendYear: 2024,
    trendTags: ['corporate', 'trust-signals', 'professional'],

    promptFragment: `Create a professional, trust-building design using:
- Blue color palette (blue-600, blue-700) for trust
- Clean, structured layouts
- Moderate rounded corners (rounded-lg)
- Professional sans-serif fonts (Inter)
- Left-aligned hero with clear value proposition
- FAQ section for credibility
- Subtle shadows and borders
- Grid-3 for services to show breadth`,
  },

  // ============================================
  // 11. VIBRANT STARTUP - Energetic gradients
  // ============================================
  'vibrant-startup': {
    id: 'vibrant-startup',
    name: 'Vibrant Startup',
    description: 'Energetic design with gradient CTAs and modern SaaS feel',

    typography: {
      hero: 'text-5xl md:text-6xl lg:text-7xl',
      h1: 'text-4xl md:text-5xl',
      h2: 'text-2xl md:text-3xl',
      h3: 'text-xl md:text-2xl',
      body: 'text-base md:text-lg',
      small: 'text-sm',
      lineHeight: 'leading-snug',
      letterSpacing: 'tracking-tight',
    },

    spacing: {
      sectionPadding: 'py-20 md:py-28',
      elementGap: 'space-y-6',
      containerWidth: 'max-w-7xl',
      containerPadding: 'px-6 lg:px-8',
    },

    visual: {
      borderRadius: 'rounded-2xl',
      shadowDepth: 'shadow-xl',
      borderStyle: 'border border-indigo-100',
      cardStyle: 'rounded-2xl bg-white border border-indigo-100 shadow-xl p-8 hover:shadow-2xl transition-all',
      buttonStyle: 'rounded-xl px-8 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-600/25 hover:shadow-xl hover:scale-105 transition-all',
      imageStyle: 'rounded-2xl overflow-hidden shadow-lg',
    },

    animation: {
      entranceAnimation: 'fadeInUp',
      duration: '0.6s',
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      staggerDelay: 100,
      hoverEffect: 'hover:scale-105 hover:shadow-2xl',
    },

    color: {
      backgroundMode: 'light',
      heroBackground: 'bg-gradient-to-br from-indigo-50 via-white to-purple-50',
      sectionAlternation: true,
      accentUsage: 'buttons-and-highlights',
      gradientStyle: 'from-indigo-600 to-purple-600',
      glassEffect: false,
      glowEffect: true,
    },

    layout: {
      heroLayout: 'centered',
      servicesLayout: 'grid-3',
      testimonialsLayout: 'grid',
      ctaLayout: 'centered',
      navbarStyle: 'floating',
      footerStyle: 'columns',
    },

    fonts: {
      headlineFont: 'Plus Jakarta Sans',
      bodyFont: 'Plus Jakarta Sans',
      headlineWeight: 'font-bold',
      bodyWeight: 'font-normal',
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
    },

    sectionOrder: ['hero', 'features', 'services', 'testimonials', 'pricing', 'cta'],

    industryScores: {
      'startup': 0.95, 'saas': 0.95, 'app': 0.9, 'tech': 0.9,
      'product': 0.9, 'software': 0.85, 'agency': 0.8,
    },

    vibeKeywords: ['energetic', 'modern', 'dynamic', 'innovative', 'bold', 'ambitious', 'growth'],

    trendYear: 2024,
    trendTags: ['startup-aesthetic', 'gradient-ctas', 'modern-saas'],

    promptFragment: `Create an energetic startup design using:
- Vibrant indigo-to-purple gradients
- Large, gradient CTA buttons with shadows
- Floating navigation bar
- Pricing section with comparison
- Features section with icons
- Bouncy hover animations (scale-105)
- Light backgrounds with subtle gradient tints
- Modern SaaS aesthetic`,
  },

  // ============================================
  // 12. RETRO NOSTALGIC - Vintage vibes
  // ============================================
  'retro-nostalgic': {
    id: 'retro-nostalgic',
    name: 'Retro Nostalgic',
    description: 'Vintage-inspired with retro colors and classic typography',

    typography: {
      hero: 'text-5xl md:text-6xl lg:text-7xl',
      h1: 'text-4xl md:text-5xl',
      h2: 'text-2xl md:text-3xl',
      h3: 'text-xl md:text-2xl',
      body: 'text-base md:text-lg',
      small: 'text-sm',
      lineHeight: 'leading-relaxed',
      letterSpacing: 'tracking-wide',
    },

    spacing: {
      sectionPadding: 'py-20 md:py-28',
      elementGap: 'space-y-8',
      containerWidth: 'max-w-5xl',
      containerPadding: 'px-6 lg:px-10',
    },

    visual: {
      borderRadius: 'rounded-lg',
      shadowDepth: 'shadow-md',
      borderStyle: 'border-2 border-amber-800/20',
      cardStyle: 'rounded-lg bg-amber-50 border-2 border-amber-800/20 p-8 shadow-md',
      buttonStyle: 'rounded-lg px-8 py-4 bg-amber-800 text-amber-50 font-semibold tracking-wider uppercase hover:bg-amber-900 transition-all',
      imageStyle: 'rounded-lg overflow-hidden sepia-[.15]',
    },

    animation: {
      entranceAnimation: 'fadeIn',
      duration: '0.8s',
      easing: 'ease-out',
      staggerDelay: 150,
      hoverEffect: 'hover:opacity-90',
    },

    color: {
      backgroundMode: 'light',
      heroBackground: 'bg-gradient-to-br from-amber-100 via-orange-50 to-rose-50',
      sectionAlternation: true,
      accentUsage: 'buttons-only',
      gradientStyle: null,
      glassEffect: false,
      glowEffect: false,
    },

    layout: {
      heroLayout: 'centered',
      servicesLayout: 'grid-2',
      testimonialsLayout: 'single-featured',
      ctaLayout: 'centered',
      navbarStyle: 'solid',
      footerStyle: 'centered',
    },

    fonts: {
      headlineFont: 'Libre Baskerville',
      bodyFont: 'Libre Baskerville',
      headlineWeight: 'font-bold',
      bodyWeight: 'font-normal',
      googleFontsUrl: 'https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&display=swap',
    },

    sectionOrder: ['hero', 'about', 'services', 'gallery', 'testimonials', 'contact'],

    industryScores: {
      'boutique': 0.95, 'vintage': 0.95, 'antique': 0.95, 'craft': 0.9,
      'bakery': 0.85, 'bookstore': 0.9, 'record': 0.9, 'barber': 0.85,
    },

    vibeKeywords: ['retro', 'vintage', 'nostalgic', 'classic', 'timeless', 'traditional', 'heritage'],

    trendYear: 2024,
    trendTags: ['retro-aesthetic', 'vintage-colors', 'nostalgic'],

    promptFragment: `Create a vintage-inspired design using:
- Warm, muted color palette (amber, terracotta, rose)
- Serif fonts (Libre Baskerville) for classic feel
- Subtle sepia filter on images (sepia-[.15])
- Uppercase tracking-wider buttons
- Cream/amber background tones
- Traditional layouts without modern effects
- Gallery to showcase vintage collections
- Nostalgic, timeless aesthetic`,
  },
};

/**
 * Get template by ID with fallback
 */
export function getDesignTemplate(id: DesignTemplateId): DesignTemplate {
  return DESIGN_TEMPLATES[id] || DESIGN_TEMPLATES['glass-aurora'];
}

/**
 * Get all template IDs
 */
export function getAllTemplateIds(): DesignTemplateId[] {
  return Object.keys(DESIGN_TEMPLATES) as DesignTemplateId[];
}

/**
 * Get templates filtered by industry
 */
export function getTemplatesForIndustry(industry: string, limit: number = 3): DesignTemplate[] {
  const industryLower = industry.toLowerCase();

  return Object.values(DESIGN_TEMPLATES)
    .map(template => ({
      template,
      score: template.industryScores[industryLower] || 0.5,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.template);
}
