# Claude Code Rules for RENOVATEMYSITE 2.0

## UI/UX Rules
- **DO NOT** modify UI/UX components unless explicitly asked by the user
- Preserve existing layouts, spacing, animations, and visual hierarchy
- Stick to the established theme colors:
  - Primary: Emerald (`#10b981`, `emerald-500`, `emerald-600`)
  - Background: Dark (`#08080A`, `#0F0F12`, `zinc-900`, `zinc-950`)
  - Text: White/Zinc shades
  - Accents: Zinc borders (`white/5`, `white/10`)

## Code Quality Rules
- All code must pass TypeScript checks (`npx tsc --noEmit`)
- All code must build successfully (`npm run build`)
- No lint errors allowed
- Maintain existing code patterns and conventions

## Theme Colors Reference
```
Background:    #08080A, #0F0F12, zinc-900, zinc-950
Primary:       emerald-500 (#10b981), emerald-600
Secondary:     zinc-800, zinc-700
Text Primary:  white
Text Secondary: zinc-400, zinc-500, zinc-600
Borders:       white/5, white/10, zinc-800
```

## File Structure
- `App.tsx` - Main application component
- `components/` - Reusable UI components
- `services/` - API and business logic
- `types.ts` - TypeScript interfaces
- `constants.tsx` - App configuration

## Before Making Changes
1. Read the relevant files first
2. Understand existing patterns
3. Ask for clarification if requirements are unclear
4. Run `npx tsc --noEmit` after changes
5. Run `npm run build` to verify

## Users Website hosting
1. Firebase only

---

# Deep-Multimodal Pipeline v3.0

## Architecture Overview

The site modernization system uses a **Deep-Multimodal Monolithic Pipeline** for zero-hallucination, high-fidelity "SaaS-Glossy" website redesigns.

```
[INPUT: URL]
    │
    ▼
┌─────────────────────────────────────────┐
│     PHASE 1: DEEP SCOUT                 │
│     (Vision + Multimodal)               │
├─────────────────────────────────────────┤
│ 1. Multi-page crawl (up to 8 pages)     │
│ 2. Vision API TEXT_DETECTION → facts[]  │
│ 3. Vision API IMAGE_PROPERTIES → colors │
│ 4. Gemini Flash semanticCaption (10 words)│
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│     PHASE 2: MODERN BUILD               │
│     (Gemini 2.5 Flash + Thinking)       │
├─────────────────────────────────────────┤
│ 1. thinking_level: HIGH                 │
│ 2. Placeholder: [[ID_REAL_LOGO_HERE]]   │
│ 3. Zero hallucination policy            │
│ 4. Semantic image placement             │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│     PHASE 3: POST-PROCESSING            │
│     (Regex Replace + Injection)         │
├─────────────────────────────────────────┤
│ 1. Replace [[ID_*_HERE]] placeholders   │
│ 2. Inject logoBase64, image URLs        │
│ 3. Inject CSS color variables           │
│ 4. Validate no remaining placeholders   │
└─────────────────────────────────────────┘
    │
    ▼
[OUTPUT: Modernized HTML]
```

## Key Files

### Backend (Firebase Functions)

| File | Purpose |
|------|---------|
| `functions/src/vision/deepVision.ts` | Google Cloud Vision API integration (OCR, colors, Gemini captions) |
| `functions/src/processing/postProcessor.ts` | Placeholder injection and asset replacement |
| `functions/src/scraping/deepScraper.ts` | Multi-page crawling with Vision API enrichment |
| `functions/src/gemini/index.ts` | Gemini 2.5 Flash integration with thinking mode |

### Frontend

| File | Purpose |
|------|---------|
| `services/geminiService.ts` | Frontend API calls to modernization endpoints |
| `services/previewDeployService.ts` | HTML preview deployment with Tailwind 4.0 |
| `types.ts` | TypeScript interfaces for Deep-Multimodal types |

## Deep Vision Module (`functions/src/vision/deepVision.ts`)

### Features
- **Firestore Caching**: 24-hour TTL for Vision API results
- **Retry Logic**: Exponential backoff (3 retries, 500ms initial delay)
- **Gemini Multimodal Captioning**: 10-word semantic captions via image fetch → base64 → Gemini

### Key Functions

```typescript
// OCR text extraction with caching & retry
detectTextInImage(imageUrl: string, useCache?: boolean): Promise<TextDetectionResult>

// Color extraction with caching & retry
extractDominantColors(imageUrl: string, useCache?: boolean): Promise<ColorExtractionResult>

// Gemini-based semantic captioning
generateSemanticCaption(imageUrl: string): Promise<string | null>

// Batch processing with rate limiting
batchAnalyzeImages(imageUrls: string[], options?: {
  enableOCR?: boolean;
  enableColorExtraction?: boolean;
  enableSemanticCaptions?: boolean;
  maxImages?: number;
  concurrency?: number;
}): Promise<VisionAnalysisResultWithCaption[]>

// Extract facts from OCR (slogans, dates, awards)
extractFactsFromOCR(fullText: string, imageUrl: string, source: string): ExtractedFact[]
```

### Caching Configuration
```typescript
const VISION_CACHE_COLLECTION = 'visionApiCache';
const VISION_CACHE_TTL_HOURS = 24;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 500;
```

## Post-Processor Module (`functions/src/processing/postProcessor.ts`)

### Placeholder Patterns

| Placeholder | Target |
|-------------|--------|
| `[[ID_REAL_LOGO_HERE]]` | `logoBase64` or `logoUrl` |
| `[[ID_HERO_1_HERE]]` | `heroImages[0].url` |
| `[[ID_SERVICE_IMG_N_HERE]]` | `services[N].imageUrl` |
| `[[ID_GALLERY_N_HERE]]` | `galleryImages[N].url` |
| `[[ID_TEAM_N_HERE]]` | `teamImages[N].url` |
| `[[ID_PRIMARY_COLOR_HERE]]` | Primary brand color |
| `[[ID_ACCENT_COLOR_HERE]]` | Accent color from Vision API |

### Key Functions

```typescript
// Main asset injection
injectRealAssets(html: string, siteIdentity: SiteIdentity, registry?: PlaceholderRegistry): string

// Full pipeline with validation
runPostProcessingPipeline(html: string, siteIdentity: SiteIdentity): {
  html: string;
  validation: { valid: boolean; remaining: string[]; count: number };
}

// Individual injection functions
injectLogo(html, logoBase64, logoUrl): string
injectHeroImages(html, heroImages): string
injectServiceImages(html, serviceImages, fallbackImages): string
injectGalleryImages(html, galleryImages): string
injectTeamImages(html, teamImages): string
injectColorVariables(html, primaryColors, accentColor): string
injectAnimationStyles(html): string
```

## Types (`types.ts`)

### New v3.0 Interfaces

```typescript
// OCR-extracted facts
interface ExtractedFact {
  source: 'logo' | 'flyer' | 'hero' | 'signage';
  text: string;
  confidence: number;
  imageUrl: string;
}

// Semantic image mapping
interface SemanticImageMap {
  hero: ExtractedImage[];
  services: ExtractedImage[];
  about: ExtractedImage[];
  testimonials: ExtractedImage[];
  gallery: ExtractedImage[];
}

// Pipeline configuration
interface DeepMultimodalConfig {
  maxPages: number;                 // Default: 8
  crawlTimeout: number;             // Default: 120000ms
  priorityPaths: string[];
  enableOCR: boolean;
  enableColorExtraction: boolean;
  maxImagesForVision: number;       // Default: 15
  thinkingLevel: 'none' | 'low' | 'high';
  model: string;                    // 'gemini-2.5-flash-preview-05-20'
  maxOutputTokens: number;          // 65536
  placeholderPrefix: string;
  placeholderSuffix: string;
  injectBase64: boolean;
}

// Placeholder registry
interface PlaceholderRegistry {
  logo: { id: string; target: string | null };
  heroImages: { id: string; target: string | null }[];
  serviceImages: { id: string; target: string | null }[];
  galleryImages: { id: string; target: string | null }[];
  teamImages: { id: string; target: string | null }[];
}
```

### Extended ExtractedImage Fields

```typescript
interface ExtractedImage {
  // Existing fields
  url: string;
  alt: string;
  type: 'logo' | 'hero' | 'gallery' | 'team' | 'product' | 'service' | 'other';
  storedUrl?: string;
  dimensions?: { width: number; height: number };

  // Deep-Multimodal fields (v3.0)
  semanticCaption?: string;        // 10-word AI caption
  extractedText?: string[];        // OCR text via TEXT_DETECTION
  dominantColors?: string[];       // Via IMAGE_PROPERTIES
  visionConfidence?: number;       // 0-1 confidence score
  base64?: string;                 // Inline for reliable injection
  placeholderId?: string;          // e.g., "[[ID_HERO_1_HERE]]"
}
```

### Extended SiteIdentity Fields

```typescript
interface SiteIdentity {
  // ... existing fields ...

  // Deep-Multimodal fields (v3.0)
  extractedFacts?: ExtractedFact[];
  accentColor?: string | null;
  visionAnalysisComplete?: boolean;
  semanticImageMap?: SemanticImageMap;
}
```

## Design System: SaaS-Glossy

### Tailwind 4.0 Configuration

The preview service (`services/previewDeployService.ts`) includes:

```javascript
tailwind.config = {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary, #10b981)',
        secondary: 'var(--color-secondary, #059669)',
        accent: 'var(--color-accent, #34d399)',
      },
      backdropBlur: { xl: '24px', '2xl': '40px' },
      borderRadius: { '3xl': '24px', '4xl': '32px' },
      boxShadow: {
        'glow': '0 0 20px rgba(var(--color-primary-rgb), 0.3)',
        'glow-lg': '0 0 40px rgba(var(--color-primary-rgb), 0.4)',
      },
    }
  }
}
```

### Animation Classes

```css
/* Keyframes */
@keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideInLeft { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
@keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }

/* Classes */
.animate-fade-in-up { animation: fadeInUp 0.8s ease-out forwards; }
.animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
.animate-slide-in-left { animation: slideInLeft 0.8s ease-out forwards; }
.animate-float { animation: float 3s ease-in-out infinite; }

/* Staggered delays */
.animation-delay-100 { animation-delay: 100ms; opacity: 0; }
.animation-delay-200 { animation-delay: 200ms; opacity: 0; }
.animation-delay-300 { animation-delay: 300ms; opacity: 0; }
.animation-delay-400 { animation-delay: 400ms; opacity: 0; }
.animation-delay-500 { animation-delay: 500ms; opacity: 0; }
.animation-delay-600 { animation-delay: 600ms; opacity: 0; }
```

### Glassmorphism Utilities

```css
.glass { background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.1); }
.glass-dark { background: rgba(0, 0, 0, 0.3); backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.1); }
```

### Component Patterns

```html
<!-- Glassmorphism Navbar -->
<nav class="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-white/5 border-b border-white/10">

<!-- Floating Card -->
<div class="rounded-3xl shadow-2xl bg-white/5 backdrop-blur-xl border border-white/10">

<!-- Gradient CTA -->
<a class="bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] shadow-xl shadow-primary/25">
```

## Cost Controls

| Resource | Limit |
|----------|-------|
| Vision API calls | Max 15 images per site |
| Gemini thinking mode | Only for premium modernization |
| Vision cache TTL | 24 hours |
| Max pages crawled | 8 sub-pages |

## Fallback Strategies

| Failure | Fallback |
|---------|----------|
| Vision TEXT_DETECTION fails | Skip OCR, use existing text extraction |
| Vision IMAGE_PROPERTIES fails | Fall back to node-vibrant |
| Gemini thinking mode fails | Retry without thinking |
| Placeholder not replaced | Log warning, use empty string |
| Image fetch fails | Skip caption, use alt text |

## Build Commands

```bash
# TypeScript check
npx tsc --noEmit

# Build frontend
npm run build

# Build functions
cd functions && npm run build
```
