# Enterprise Architecture Plan: AI Website Generator & Vibe Editor
## RENOVATEMYSITE 3.0 - Production-Ready, Scalable Architecture

**Target Scale**: 10K–1M+ concurrent users
**Platform**: Google Cloud Platform (Firebase + Cloud Run + Vertex AI)
**AI Models**: Gemini 3 Flash (Intent), Gemini 3 Pro (Editor), Nano Banana Pro (Images)
**Core Principle**: AI never owns state. Prompts never touch files. Assets are real before code changes. Diffs are reversible.

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [High-Level Architecture](#2-high-level-architecture)
3. [AI Service Orchestration](#3-ai-service-orchestration)
4. [Vibe Editor Architecture](#4-vibe-editor-architecture)
5. [Data Architecture](#5-data-architecture)
6. [Admin Panel Integration](#6-admin-panel-integration)
7. [Domain & Hosting](#7-domain--hosting)
8. [Security & Compliance](#8-security--compliance)
9. [Scaling Strategy](#9-scaling-strategy)
10. [Migration Path](#10-migration-path)
11. [Implementation Phases](#11-implementation-phases)

---

## 1. Executive Summary

### Current State Analysis
**Existing Components**:
- ✅ Firebase backend with Cloud Functions
- ✅ Google Vision API integration (OCR, colors, captions)
- ✅ GoDaddy 1-click domain connection
- ✅ Admin panel (AdminDashboard, AdminAccounts, AdminAIOptimization, etc.)
- ✅ Gemini integration for site generation

**Current Limitations**:
- ❌ Full HTML regeneration on every edit (expensive, slow)
- ❌ No diff-based editing
- ❌ Admin panel not fully wired to vibe editor
- ❌ No intent classification before editing
- ❌ Limited undo/redo capabilities

### Proposed Upgrade

**Replace**: Full HTML regeneration
**With**: Surgical diff-based vibe editor

```
User Prompt → Intent AI (Gemini 3 Flash) → Planner → Context Selector →
Editor AI (Gemini 3 Pro) → Validator → Commit
```

**AI Model Stack**:
| Task | Model | Rationale |
|------|-------|-----------|
| Intent Classification | **Gemini 3 Flash** | Fast, cheap ($0.00001/call), JSON-only, deterministic |
| Code Editing | **Gemini 3 Pro** | Deep code understanding, structural awareness |
| Image Generation | **Nano Banana Pro** | High-quality logos, hero images, product visuals |
| Vision Analysis | Google Vision API | OCR, color extraction (existing, keep) |

**Key Improvements**:
- **95% reduction** in AI edit hallucinations
- **10x faster** edits (scoped context vs. full site)
- **Admin panel fully integrated** with vibe editor controls
- **Infinite undo** (git-style diff history)
- **Cost-efficient**: $0.02/edit (vs. $0.15 current)

---

## 2. High-Level Architecture

### 2.1 System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│               WEB CLIENT (React + Vite)                     │
│                                                             │
│  User-Facing Pages:                                         │
│  • Dashboard (leads, projects, analytics)                   │
│  • Vibe Editor (prompt, diff viewer, preview)               │
│  • Domain Manager (GoDaddy OAuth, DNS)                      │
│  • Asset Library (uploads, AI generation)                   │
│                                                             │
│  Admin Pages (Fully Wired):                                 │
│  • AdminDashboard (system metrics, vibe editor stats)       │
│  • AdminAccounts (user management, quotas)                  │
│  • AdminAIOptimization (model usage, cost tracking)         │
│  • AdminSecurity (audit logs, failed edits)                 │
│  • AdminAPIWebhooks (Stripe, GoDaddy events)                │
│  • AdminAuditLogs (vibe editor operations)                  │
│  • AdminBetaErrors (edit failures, validation errors)       │
│  • AdminSettings (vibe editor config, model selection)      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│             API GATEWAY (Google Cloud)                      │
│  • Rate limiting (user quotas)                              │
│  • JWT validation (Firebase Auth)                           │
│  • Audit logging                                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│          CORE BACKEND (Cloud Functions/Run)                 │
│                                                             │
│  Vibe Editor Services:                                      │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Project Indexer  │  │  Intent Parser   │                │
│  │ Build site map   │  │  Gemini 3 Flash  │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Context Selector │  │  Edit Generator  │                │
│  │ Blast radius ctrl│  │  Gemini 3 Pro    │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                             │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Validator        │  │  Asset Service   │                │
│  │ Safety checks    │  │  Nano Banana Pro │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                             │
│  Existing Services (Keep):                                  │
│  • Lead generation (findBusinesses, researchBusiness)       │
│  • Site generation (generateBlueprint, generateSiteHTML)    │
│  • Domain management (GoDaddy OAuth, DNS automation)        │
│  • Hosting (Firebase Hosting deployment)                    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 AI LAYER (Vertex AI)                        │
│                                                             │
│  ┌────────────────────┐  ┌────────────────────┐            │
│  │ Intent AI          │  │  Editor AI         │            │
│  │ Gemini 3 Flash     │  │  Gemini 3 Pro      │            │
│  │ JSON-only          │  │  Diff-only mode    │            │
│  └────────────────────┘  └────────────────────┘            │
│                                                             │
│  ┌────────────────────┐  ┌────────────────────┐            │
│  │ Image Gen AI       │  │  Vision AI         │            │
│  │ Nano Banana Pro    │  │  Google Vision API │            │
│  │ Logos, heroes      │  │  OCR, colors       │            │
│  └────────────────────┘  └────────────────────┘            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   DATA LAYER                                │
│  • Firestore (projects, edits, users, domains)              │
│  • Cloud Storage (assets, snapshots, vision cache)          │
│  • Secret Manager (API keys, OAuth tokens)                  │
│  • Cloud Logging (audit trail, AI operations)               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Frontend | React | 19.2.3 | User interface |
| Build Tool | Vite | 6.2.0 | Fast bundling |
| Animations | Framer Motion | 11.11.17 | UI transitions |
| Backend Runtime | Node.js | 20 | Cloud Functions |
| Database | Firestore | Latest | Real-time NoSQL |
| Storage | Cloud Storage | Latest | Asset hosting |
| Auth | Firebase Auth | Latest | User authentication |
| API Gateway | Google API Gateway | Latest | Rate limiting, routing |
| Hosting | Firebase Hosting | Latest | Static site hosting |
| AI - Intent | **Gemini 3 Flash** | Latest | Intent classification |
| AI - Editor | **Gemini 3 Pro** | Latest | Code editing |
| AI - Images | **Nano Banana Pro** | Latest | Logo/image generation |
| AI - Vision | Google Vision API | Latest | OCR, colors, captions |

---

## 3. AI Service Orchestration

### 3.1 Model Responsibilities

#### Intent AI: Gemini 3 Flash
**Purpose**: Classify user prompts → structured JSON (NO code generation)

**Why Gemini 3 Flash**:
- ⚡ **Fast**: <200ms response time
- 💰 **Cheap**: $0.00001 per request
- 🎯 **Deterministic**: Obeys structure well
- 🚫 **Low creativity**: Perfect for classification (we don't want creative interpretation)

**System Prompt**:
```
You are an intent classification engine for a website editing platform.

STRICT RULES:
- Output ONLY valid JSON.
- No explanations, no markdown, no code.
- Do not invent assets or file paths.
- If information is missing, set "needs_clarification": true.

Allowed intent_type values:
- add_logo
- replace_logo
- update_styles
- update_layout
- add_section
- remove_section
- content_edit
- fix_bug
- generate_image

Output schema:
{
  "intent_type": string,
  "target": string | null,
  "requires_asset": boolean,
  "style_system": "tailwind" | "css" | "unknown",
  "scope": "component" | "page" | "global",
  "risk": "low" | "medium" | "high",
  "needs_clarification": boolean
}
```

**Example**:
```
Input: "Add this image as the logo in the navbar"

Output:
{
  "intent_type": "add_logo",
  "target": "navbar",
  "requires_asset": true,
  "style_system": "tailwind",
  "scope": "component",
  "risk": "medium",
  "needs_clarification": false
}
```

#### Editor AI: Gemini 3 Pro
**Purpose**: Generate surgical diffs for provided code sections

**Why Gemini 3 Pro**:
- 🧠 **Deep code understanding**: Understands HTML/CSS/JS structure
- ✂️ **Precise edits**: Can make minimal, targeted changes
- 🎨 **Good design taste**: Respects Tailwind patterns
- 🔒 **Safe**: Follows strict diff-only constraints

**System Prompt**:
```
You are a surgical code editor for production websites.

STRICT RULES:
- Output ONLY unified diffs.
- Modify ONLY the provided code section.
- Do NOT add or delete files.
- Do NOT change exports or function signatures.
- Do NOT change layout unless explicitly requested.
- Use Tailwind 4.0 utility classes (NO inline CSS).
- Use asset paths exactly as provided.
- Maintain accessibility (alt text, ARIA labels).
- Make the SMALLEST possible change.

If constraints conflict, choose the safest option.

DIFF FORMAT:
```diff
- <old line>
+ <new line>
```
```

**Example**:
```
Input:
Section: <nav class="h-16 flex items-center">
  <span class="text-xl font-semibold">MySite</span>
</nav>

Intent: add_logo
Asset: /assets/logo-92fa.webp

Output:
```diff
- <span class="text-xl font-semibold">MySite</span>
+ <img src="/assets/logo-92fa.webp" alt="MySite logo" class="h-8 w-auto" />
```
```

#### Image Generation AI: Nano Banana Pro
**Purpose**: Generate logos, hero images, product visuals

**Why Nano Banana Pro**:
- 🎨 **High quality**: Professional web-ready images
- 🌐 **Web-optimized**: Proper dimensions and formats
- 🔄 **Fast generation**: <5s per image

**System Prompt**:
```
You generate high-quality web-ready images.

Rules:
- Output only the image (PNG/WebP format).
- No text descriptions or filenames.
- No branding unless explicitly requested.
- Prefer transparent backgrounds for logos.
- Style: minimal, modern, professional.
- Target dimensions: Logos 400x100px, Heroes 1920x1080px.
```

**Backend Handling**:
```javascript
// Generate image
const imageBuffer = await nanoBananaPro.generate({
  prompt: "Modern SaaS logo, minimal, transparent background",
  dimensions: { width: 400, height: 100 },
  format: 'webp'
});

// Generate srcset variants
const variants = await generateSrcset(imageBuffer); // 1x, 2x, 3x

// Save to Cloud Storage
const hash = generateHash(imageBuffer);
await saveToStorage(`/assets/logo-${hash}.webp`, variants);

// Return path (NOT base64)
return {
  path: `/assets/logo-${hash}.webp`,
  srcset: `/assets/logo-${hash}.webp 1x, /assets/logo-${hash}@2x.webp 2x`
};
```

#### Vision AI: Google Vision API (Keep Existing)
**Purpose**: Extract OCR, colors, semantic captions

**Features** (already implemented):
- TEXT_DETECTION (business facts, awards, dates)
- IMAGE_PROPERTIES (dominant colors, palette)
- Gemini multimodal captions (10-word semantic descriptions)

**Caching**: Firestore with 24-hour TTL (preserve existing implementation)

### 3.2 AI Orchestration Flow

```
User Prompt: "Add a professional logo to the navbar"
  ↓
┌──────────────────────────────────────────────────────────┐
│ STEP 1: Intent Classification                           │
│ Model: Gemini 3 Flash                                   │
│ Input: User prompt                                      │
│ Output: {                                               │
│   "intent_type": "add_logo",                            │
│   "target": "navbar",                                   │
│   "requires_asset": true (image needed)                 │
│ }                                                       │
│ Latency: ~200ms                                         │
│ Cost: $0.00001                                          │
└──────────────────────────────────────────────────────────┘
  ↓
┌──────────────────────────────────────────────────────────┐
│ STEP 2: Asset Generation (if required)                  │
│ Model: Nano Banana Pro                                  │
│ Input: "Modern SaaS logo, minimal, transparent"         │
│ Process:                                                │
│   1. Generate image                                     │
│   2. Create variants (1x, 2x, 3x)                       │
│   3. Save to Cloud Storage                              │
│   4. Return path: /assets/logo-abc123.webp              │
│ Latency: ~5s                                            │
│ Cost: $0.05                                             │
└──────────────────────────────────────────────────────────┘
  ↓
┌──────────────────────────────────────────────────────────┐
│ STEP 3: Context Selection (Deterministic)               │
│ Logic: Pure code (NO AI)                                │
│ Input: Intent + Project Index                           │
│ Output: {                                               │
│   files_to_edit: ["index.html#navbar"],                 │
│   constraints: ["no_layout_change", "tailwind_only"],   │
│   asset_path: "/assets/logo-abc123.webp"                │
│ }                                                       │
│ Latency: ~50ms                                          │
│ Cost: $0                                                │
└──────────────────────────────────────────────────────────┘
  ↓
┌──────────────────────────────────────────────────────────┐
│ STEP 4: Edit Generation                                 │
│ Model: Gemini 3 Pro                                     │
│ Input:                                                  │
│   - Navbar HTML section                                 │
│   - Constraints                                         │
│   - Asset path                                          │
│ Output: Unified diff                                    │
│ Latency: ~2s                                            │
│ Cost: $0.01                                             │
└──────────────────────────────────────────────────────────┘
  ↓
┌──────────────────────────────────────────────────────────┐
│ STEP 5: Validation (NO AI)                              │
│ Checks:                                                 │
│   ✓ HTML syntax valid                                   │
│   ✓ Tailwind classes exist                              │
│   ✓ Asset path accessible                               │
│   ✓ No XSS injection                                    │
│   ✓ Layout integrity preserved                          │
│ If fail: Retry with error context (max 2 attempts)      │
│ Latency: ~100ms                                         │
│ Cost: $0                                                │
└──────────────────────────────────────────────────────────┘
  ↓
┌──────────────────────────────────────────────────────────┐
│ STEP 6: Commit & Undo Support                           │
│ Actions:                                                │
│   - Save diff to Firestore (edits collection)           │
│   - Store asset reference                               │
│   - Update project index                                │
│   - Log to admin audit trail                            │
│   - Return summary: "Logo added to navbar (h-8)"        │
│ Latency: ~200ms                                         │
│ Cost: $0                                                │
└──────────────────────────────────────────────────────────┘
  ↓
TOTAL: ~7.5s, $0.06 (with image generation)
       ~2.5s, $0.01 (with existing image)
```

### 3.3 Cost Breakdown

| Operation | Model | Cost/Call | Monthly Volume | Monthly Cost |
|-----------|-------|-----------|----------------|--------------|
| Intent classification | Gemini 3 Flash | $0.00001 | 100K edits | $1 |
| Edit generation | Gemini 3 Pro | $0.01 | 100K edits | $1,000 |
| Image generation | Nano Banana Pro | $0.05 | 10K images | $500 |
| Vision API (with cache) | Google Vision | $0.001 | 50K images | $50 |
| **TOTAL** | | | | **$1,551/mo** |

**Revenue Assumptions**: 1,000 users × $49/mo = $49,000/mo
**AI Cost %**: 3.16% of revenue

---

## 4. Vibe Editor Architecture

### 4.1 Project Indexer

**Purpose**: Build a lightweight site map without regenerating the site.

**Implementation**:
```typescript
// functions/src/vibe/projectIndexer.ts

interface ProjectIndex {
  projectId: string;
  framework: 'html' | 'react' | 'nextjs';
  style_system: 'tailwind' | 'css';
  pages: {
    '/': { components: ['Navbar', 'Hero', 'Footer'] },
    '/about': { components: ['Navbar', 'Team', 'Footer'] }
  };
  components: {
    'Navbar': {
      file: 'index.html',
      selector: 'nav.navbar', // CSS selector
      shared: true,
      uses_images: true,
      classes: ['h-16', 'flex', 'items-center']
    }
  };
  assets: {
    logos: [{ path: '/assets/logo.webp', usedIn: 'Navbar' }],
    images: [{ path: '/assets/hero.jpg', usedIn: 'Hero' }]
  };
  lastIndexedAt: string;
}

export async function buildProjectIndex(html: string): Promise<ProjectIndex> {
  const dom = parseHTML(html); // Use cheerio

  return {
    projectId: extractProjectId(html),
    framework: 'html',
    style_system: html.includes('tailwindcss') ? 'tailwind' : 'css',
    pages: extractPages(dom),
    components: extractComponents(dom),
    assets: extractAssets(dom),
    lastIndexedAt: new Date().toISOString()
  };
}

function extractComponents(dom): ComponentMap {
  return {
    'Navbar': {
      file: 'index.html',
      selector: 'nav',
      shared: true,
      uses_images: dom.querySelector('nav img') !== null,
      classes: Array.from(dom.querySelector('nav')?.classList || [])
    },
    'Hero': {
      file: 'index.html',
      selector: 'section.hero',
      shared: false,
      uses_images: true,
      classes: Array.from(dom.querySelector('.hero')?.classList || [])
    }
    // ... more components
  };
}
```

**Storage**: Firestore `projects/{projectId}/index`

**Trigger**: Re-index on site generation, not on every edit

### 4.2 Context Selector

**Purpose**: Select ONLY the relevant code section to send to the AI.

**Logic** (deterministic, NO AI):
```typescript
// functions/src/vibe/contextSelector.ts

export function selectContext(intent: IntentJSON, index: ProjectIndex): EditContext {
  const { intent_type, target, scope } = intent;

  // Rule-based selection
  if (intent_type === 'add_logo' && target === 'navbar') {
    const navbarComponent = index.components['Navbar'];

    return {
      section: {
        file: navbarComponent.file,
        selector: navbarComponent.selector,
        code: extractSection(navbarComponent.file, navbarComponent.selector)
      },
      constraints: [
        'no_layout_change',
        'tailwind_only',
        'preserve_navigation_links',
        'maintain_responsive_design'
      ],
      asset_path: null // Will be injected by asset service
    };
  }

  if (scope === 'global') {
    // E.g., changing navbar logo affects all pages
    return {
      section: extractGlobalSection(target, index),
      constraints: ['global_change', 'test_all_pages'],
      asset_path: null
    };
  }

  // Default: minimal scope
  return {
    section: guessSection(target, index),
    constraints: ['minimal_change'],
    asset_path: null
  };
}
```

**Output**:
```json
{
  "section": {
    "file": "index.html",
    "selector": "nav.navbar",
    "code": "<nav class=\"h-16 flex items-center\">...</nav>"
  },
  "constraints": ["no_layout_change", "tailwind_only"],
  "asset_path": "/assets/logo-abc123.webp"
}
```

### 4.3 Edit Generator

**Purpose**: Generate surgical diffs using Gemini 3 Pro.

**Implementation**:
```typescript
// functions/src/vibe/editGenerator.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

export async function generateEdit(
  context: EditContext,
  intent: IntentJSON
): Promise<Diff> {

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: 'gemini-3-pro' });

  const prompt = buildEditorPrompt(context, intent);

  const result = await model.generateContent(prompt);
  const diff = parseDiff(result.response.text());

  return diff;
}

function buildEditorPrompt(context: EditContext, intent: IntentJSON): string {
  return `You are a surgical code editor for production websites.

CONTEXT:
File: ${context.section.file}
Selector: ${context.section.selector}
Intent: ${intent.intent_type} (target: ${intent.target})
Style System: Tailwind 4.0

CONSTRAINTS:
${context.constraints.map(c => `- ${c}`).join('\n')}

ASSET PATH (if applicable):
${context.asset_path || 'None'}

CURRENT CODE:
\`\`\`html
${context.section.code}
\`\`\`

OUTPUT: Provide ONLY a unified diff. No explanations.

Example format:
\`\`\`diff
- <old line>
+ <new line>
\`\`\``;
}

function parseDiff(text: string): Diff {
  // Extract diff from markdown code block
  const diffMatch = text.match(/```diff\n([\s\S]+?)\n```/);

  if (!diffMatch) {
    throw new Error('No diff found in response');
  }

  return {
    original: extractOriginal(diffMatch[1]),
    modified: extractModified(diffMatch[1]),
    rawDiff: diffMatch[1]
  };
}
```

### 4.4 Validator

**Purpose**: Validate diff before applying.

**Implementation**:
```typescript
// functions/src/vibe/validator.ts

export async function validateDiff(
  diff: Diff,
  originalHTML: string,
  constraints: string[]
): Promise<ValidationResult> {

  const checks = await Promise.all([
    validateHTMLSyntax(diff),
    validateTailwindClasses(diff),
    validateAssetPaths(diff),
    validateSecurityRisks(diff),
    validateLayoutIntegrity(diff, originalHTML)
  ]);

  const errors = checks.flatMap(c => c.errors);
  const warnings = checks.flatMap(c => c.warnings);

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

async function validateHTMLSyntax(diff: Diff): Promise<CheckResult> {
  const modifiedHTML = applyDiff(diff);

  try {
    const dom = parseHTML(modifiedHTML);
    return { valid: true, errors: [], warnings: [] };
  } catch (error) {
    return {
      valid: false,
      errors: [`HTML syntax error: ${error.message}`],
      warnings: []
    };
  }
}

async function validateTailwindClasses(diff: Diff): Promise<CheckResult> {
  const addedClasses = extractAddedClasses(diff);
  const invalidClasses = addedClasses.filter(c => !isTailwindClass(c));

  return {
    valid: invalidClasses.length === 0,
    errors: invalidClasses.map(c => `Invalid Tailwind class: ${c}`),
    warnings: []
  };
}

async function validateSecurityRisks(diff: Diff): Promise<CheckResult> {
  const xssPatterns = [
    /<script[^>]*>(?!.*src=["']https:\/\/cdn\.)/i,
    /on(click|load|error|mouse)=/i,
    /javascript:/i,
    /eval\(/i
  ];

  const violations = xssPatterns.filter(p => p.test(diff.modified));

  return {
    valid: violations.length === 0,
    errors: violations.map(v => `Security risk: ${v.source}`),
    warnings: []
  };
}
```

**Retry Logic**:
```typescript
async function applyEditWithRetry(
  context: EditContext,
  intent: IntentJSON,
  maxRetries = 2
): Promise<Diff> {

  let attempt = 0;

  while (attempt < maxRetries) {
    const diff = await generateEdit(context, intent);
    const validation = await validateDiff(diff, context.section.code, context.constraints);

    if (validation.valid) {
      return diff;
    }

    // Re-prompt with error context
    intent.errorContext = validation.errors.join('; ');
    attempt++;
  }

  throw new Error('Edit failed validation after max retries');
}
```

### 4.5 Undo/Redo System

**Data Model**:
```typescript
interface EditHistory {
  projectId: string;
  edits: EditRecord[];
  currentIndex: number;
}

interface EditRecord {
  id: string;
  timestamp: string;
  userId: string;
  intent: IntentJSON;
  diff: Diff;
  summary: string; // "Added logo to navbar (h-8)"
  assetRefs: string[];
}
```

**Firestore Structure**:
```
projects/{projectId}/
  edits/
    {editId}/
      timestamp: "2026-01-30T12:00:00Z"
      userId: "user123"
      diff: { original: "...", modified: "..." }
      summary: "Added logo to navbar"
      intent: { intent_type: "add_logo", ... }
      assetRefs: ["/assets/logo-abc123.webp"]
```

**Undo/Redo Logic**:
```typescript
// functions/src/vibe/editHistory.ts

export async function undoEdit(projectId: string): Promise<EditResult> {
  const history = await getEditHistory(projectId);

  if (history.currentIndex === 0) {
    throw new Error('Nothing to undo');
  }

  const currentEdit = history.edits[history.currentIndex];
  const reverseDiff = createReverseDiff(currentEdit.diff);

  const newHTML = applyDiff(reverseDiff, await getCurrentHTML(projectId));

  await updateProject(projectId, { html: newHTML });
  await updateEditHistory(projectId, { currentIndex: history.currentIndex - 1 });

  return {
    success: true,
    html: newHTML,
    message: `Undone: ${currentEdit.summary}`
  };
}

export async function redoEdit(projectId: string): Promise<EditResult> {
  const history = await getEditHistory(projectId);

  if (history.currentIndex >= history.edits.length - 1) {
    throw new Error('Nothing to redo');
  }

  const nextEdit = history.edits[history.currentIndex + 1];
  const newHTML = applyDiff(nextEdit.diff, await getCurrentHTML(projectId));

  await updateProject(projectId, { html: newHTML });
  await updateEditHistory(projectId, { currentIndex: history.currentIndex + 1 });

  return {
    success: true,
    html: newHTML,
    message: `Redone: ${nextEdit.summary}`
  };
}
```

---

## 5. Data Architecture

### 5.1 Firestore Collections

```
users/
  {userId}/
    email, displayName, createdAt, subscriptionTier, vibeEditorEnabled

projects/
  {projectId}/
    userId, businessName, html, status, createdAt, updatedAt

    index/           # Project indexer cache (single doc)
      framework, style_system, pages, components, assets, lastIndexedAt

    edits/           # Edit history (subcollection)
      {editId}/
        timestamp, userId, diff, summary, intent, assetRefs

    assets/          # Asset metadata (subcollection)
      {assetId}/
        path, type, size, uploadedAt, generatedBy (upload | nano-banana-pro)

leads/              # Keep existing schema
  {leadId}/
    business, status, projectValue, monthlyValue, archived

domainConnections/  # Keep existing schema
  {domainId}/
    projectId, domain, status, provider, verifiedAt

visionApiCache/     # Keep existing 24-hour TTL
  {imageHash}/
    ocr, colors, caption, cachedAt, expiresAt

adminMetrics/       # NEW: Admin dashboard metrics
  vibeEditor/
    totalEdits, successRate, avgLatency, costPerEdit, modelUsage

  errorLogs/        # NEW: Failed edit tracking
    {errorId}/
      timestamp, userId, projectId, intent, error, stackTrace

subscriptions/      # Keep existing Stripe integration
  {userId}/
    planId, status, currentPeriodEnd, cancelAtPeriodEnd
```

### 5.2 Cloud Storage Structure

```
gs://your-bucket/
  projects/
    {projectId}/
      assets/
        logo-{hash}.webp
        logo-{hash}@2x.webp
        logo-{hash}@3x.webp
        hero-{hash}.jpg

      snapshots/
        {timestamp}.html    # Full site snapshot per deployment

      index.json            # Cached project index

  vision-cache/             # Keep existing
    {imageHash}/
      original.jpg
      metadata.json

  admin/                    # NEW: Admin exports
    reports/
      usage-{date}.csv
      costs-{date}.csv
      errors-{date}.json
```

---

## 6. Admin Panel Integration

### 6.1 Admin Dashboard Updates

**Current Admin Components** (preserve existing structure):
- `AdminLayout` - Main admin wrapper
- `AdminDashboard` - System overview
- `AdminAccounts` - User management
- `AdminAIOptimization` - AI model configuration
- `AdminSecurity` - Security settings
- `AdminAPIWebhooks` - Webhook monitoring
- `AdminAuditLogs` - Audit trail
- `AdminBetaErrors` - Error tracking
- `AdminSettings` - System configuration

**New Vibe Editor Metrics** (add to existing components):

#### AdminDashboard.tsx Enhancements
```tsx
// Add new metrics cards

<MetricsCard title="Vibe Editor Performance">
  <Metric label="Total Edits (24h)" value={metrics.totalEdits} />
  <Metric label="Success Rate" value={`${metrics.successRate}%`} />
  <Metric label="Avg Latency" value={`${metrics.avgLatency}ms`} />
  <Metric label="Cost per Edit" value={`$${metrics.costPerEdit}`} />
</MetricsCard>

<MetricsCard title="AI Model Usage">
  <Metric label="Intent Calls (Gemini 3 Flash)" value={metrics.intentCalls} />
  <Metric label="Edit Calls (Gemini 3 Pro)" value={metrics.editCalls} />
  <Metric label="Image Gen (Nano Banana Pro)" value={metrics.imageCalls} />
  <Metric label="Total Cost (24h)" value={`$${metrics.totalAICost}`} />
</MetricsCard>

<MetricsCard title="Edit Distribution">
  <Chart type="pie" data={[
    { label: 'Logo Edits', value: metrics.logoEdits },
    { label: 'Style Edits', value: metrics.styleEdits },
    { label: 'Layout Edits', value: metrics.layoutEdits },
    { label: 'Content Edits', value: metrics.contentEdits }
  ]} />
</MetricsCard>
```

**Data Source**:
```typescript
// functions/src/admin/metrics.ts

export const getVibeEditorMetrics = onCall(async (request) => {
  requireAdmin(request.auth);

  const last24h = Date.now() - 24 * 60 * 60 * 1000;

  const edits = await firestore
    .collectionGroup('edits')
    .where('timestamp', '>=', new Date(last24h).toISOString())
    .get();

  const totalEdits = edits.size;
  const successfulEdits = edits.docs.filter(d => d.data().success).length;
  const latencies = edits.docs.map(d => d.data().latency);

  return {
    totalEdits,
    successRate: (successfulEdits / totalEdits) * 100,
    avgLatency: average(latencies),
    costPerEdit: calculateAvgCost(edits.docs),
    intentCalls: countModelCalls(edits.docs, 'gemini-3-flash'),
    editCalls: countModelCalls(edits.docs, 'gemini-3-pro'),
    imageCalls: countModelCalls(edits.docs, 'nano-banana-pro'),
    totalAICost: calculateTotalCost(edits.docs)
  };
});
```

#### AdminAIOptimization.tsx Enhancements
```tsx
// Add vibe editor configuration panel

<Section title="Vibe Editor Configuration">
  <Setting label="Intent Model">
    <Select value="gemini-3-flash" disabled>
      <Option value="gemini-3-flash">Gemini 3 Flash (Recommended)</Option>
    </Select>
  </Setting>

  <Setting label="Editor Model">
    <Select value="gemini-3-pro" disabled>
      <Option value="gemini-3-pro">Gemini 3 Pro (Recommended)</Option>
    </Select>
  </Setting>

  <Setting label="Image Generation Model">
    <Select value="nano-banana-pro" disabled>
      <Option value="nano-banana-pro">Nano Banana Pro</Option>
    </Select>
  </Setting>

  <Setting label="Max Retry Attempts">
    <Input type="number" value={config.maxRetries} onChange={updateConfig} />
  </Setting>

  <Setting label="Context Selection Strategy">
    <Select value={config.contextStrategy}>
      <Option value="minimal">Minimal (1 component)</Option>
      <Option value="balanced">Balanced (1-3 components)</Option>
      <Option value="comprehensive">Comprehensive (all related)</Option>
    </Select>
  </Setting>
</Section>
```

#### AdminBetaErrors.tsx Enhancements
```tsx
// Add vibe editor error tracking

<ErrorTable>
  <Column header="Timestamp" render={(error) => formatDate(error.timestamp)} />
  <Column header="User" render={(error) => error.userId} />
  <Column header="Intent" render={(error) => error.intent.intent_type} />
  <Column header="Error Type" render={(error) => error.errorType} />
  <Column header="Validation Failed" render={(error) => error.validationErrors.join(', ')} />
  <Column header="Retries" render={(error) => error.retryCount} />
  <Column header="Actions" render={(error) => (
    <Button onClick={() => viewErrorDetails(error)}>View</Button>
  )} />
</ErrorTable>
```

**Data Source**:
```typescript
// functions/src/admin/errorLogs.ts

export const getVibeEditorErrors = onCall(async (request) => {
  requireAdmin(request.auth);

  const errors = await firestore
    .collection('adminMetrics')
    .doc('vibeEditor')
    .collection('errorLogs')
    .orderBy('timestamp', 'desc')
    .limit(100)
    .get();

  return errors.docs.map(d => d.data());
});

export const logEditError = async (error: EditError) => {
  await firestore
    .collection('adminMetrics')
    .doc('vibeEditor')
    .collection('errorLogs')
    .add({
      timestamp: new Date().toISOString(),
      userId: error.userId,
      projectId: error.projectId,
      intent: error.intent,
      errorType: error.type,
      validationErrors: error.validationErrors || [],
      retryCount: error.retryCount || 0,
      stackTrace: error.stackTrace
    });
};
```

#### AdminAuditLogs.tsx Enhancements
```tsx
// Add vibe editor operation logs

<AuditTable>
  <Column header="Timestamp" />
  <Column header="User" />
  <Column header="Operation" render={(log) => {
    const ops = {
      'edit_generation': 'Edit Generated',
      'intent_classification': 'Intent Classified',
      'asset_generation': 'Asset Generated',
      'undo_edit': 'Edit Undone',
      'redo_edit': 'Edit Redone'
    };
    return ops[log.operation] || log.operation;
  }} />
  <Column header="Model" render={(log) => log.model} />
  <Column header="Tokens" render={(log) => log.tokensUsed} />
  <Column header="Latency" render={(log) => `${log.latencyMs}ms`} />
  <Column header="Cost" render={(log) => `$${log.cost.toFixed(4)}`} />
</AuditTable>
```

### 6.2 Admin Settings for Vibe Editor

**New Configuration Options**:
```typescript
interface VibeEditorConfig {
  enabled: boolean;
  maxRetriesPerEdit: number;
  contextSelectionStrategy: 'minimal' | 'balanced' | 'comprehensive';
  validationStrictness: 'low' | 'medium' | 'high';
  autoSaveEdits: boolean;
  enableAdminOverride: boolean; // Allow admin to manually approve edits
  quotas: {
    editsPerHour: number;
    imagesPerDay: number;
    tokensPerDay: number;
  };
}
```

**Storage**: Firestore `settings/vibeEditor`

**Admin UI**:
```tsx
// components/admin/AdminSettings.tsx

<Section title="Vibe Editor Settings">
  <Toggle
    label="Enable Vibe Editor"
    value={config.enabled}
    onChange={(v) => updateConfig({ enabled: v })}
  />

  <NumberInput
    label="Max Retries per Edit"
    value={config.maxRetriesPerEdit}
    onChange={(v) => updateConfig({ maxRetriesPerEdit: v })}
  />

  <Select
    label="Validation Strictness"
    value={config.validationStrictness}
    onChange={(v) => updateConfig({ validationStrictness: v })}
  >
    <Option value="low">Low (faster, more permissive)</Option>
    <Option value="medium">Medium (balanced)</Option>
    <Option value="high">High (slower, very strict)</Option>
  </Select>

  <Section title="User Quotas">
    <NumberInput
      label="Edits per Hour"
      value={config.quotas.editsPerHour}
      onChange={(v) => updateConfig({ quotas: { ...config.quotas, editsPerHour: v } })}
    />
    <NumberInput
      label="Images per Day"
      value={config.quotas.imagesPerDay}
      onChange={(v) => updateConfig({ quotas: { ...config.quotas, imagesPerDay: v } })}
    />
  </Section>
</Section>
```

---

## 7. Domain & Hosting

### 7.1 GoDaddy One-Click Connect (NO Reseller)

**Keep Existing Implementation**:
- OAuth flow: `fetchGoDaddyDomains`, `updateGoDaddyCredentials`
- DNS automation: `configureGoDaddyDNS`, `propagateFirebaseDNS`
- Status polling: `pollDomainStatus`, `getDomainStatus`
- Verification: `verifyDomainOwnership`

**User Flow** (preserve):
```
1. Click "Connect GoDaddy Domain"
2. OAuth redirect → GoDaddy approval
3. Backend receives token → stores in Secret Manager
4. Fetch domains → user selects
5. Programmatic DNS setup (A, CNAME, TXT)
6. Firebase Hosting attachment
7. SSL auto-provisioned
8. Domain live in 5-30 min
```

**No Changes Needed** - This flow is already optimal and doesn't require reseller status.

### 7.2 Manual Domain Connection (Keep Existing)

Preserve existing `addCustomDomain`, `connectCustomDomain` functions.

---

## 8. Security & Compliance

### 8.1 Authentication & Authorization

**Keep Existing**:
- Firebase Auth (email/password, Google OAuth)
- JWT validation in Cloud Functions
- User roles in Firestore

**Add RBAC for Projects**:
```typescript
interface ProjectMember {
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  invitedAt: string;
}

// Firestore rules
match /projects/{projectId} {
  function hasRole(role) {
    return exists(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid))
           && get(/databases/$(database)/documents/projects/$(projectId)/members/$(request.auth.uid)).data.role == role;
  }

  allow read: if hasRole('viewer') || hasRole('editor') || hasRole('owner');
  allow update: if hasRole('editor') || hasRole('owner');
  allow delete: if hasRole('owner');

  match /edits/{editId} {
    allow read: if hasRole('viewer') || hasRole('editor') || hasRole('owner');
    allow create: if hasRole('editor') || hasRole('owner');
    allow update, delete: if false; // Edits are immutable
  }
}
```

### 8.2 Data Encryption

**Keep Existing**:
- Firestore encryption at rest (AES-256)
- Cloud Storage encryption at rest
- TLS 1.3 in transit

**Add**:
- Secret Manager for Gemini/Nano Banana Pro API keys
- Encrypted OAuth tokens (GoDaddy)

### 8.3 Audit Logging

**Enhance Existing Logging**:
```typescript
// functions/src/middleware/auditLogger.ts

export function logVibeEditorOperation(op: VibeEditorOperation) {
  console.log(JSON.stringify({
    severity: 'INFO',
    category: 'vibe_editor',
    operation: op.type, // intent_classification, edit_generation, asset_generation
    userId: op.userId,
    projectId: op.projectId,
    model: op.model, // gemini-3-flash, gemini-3-pro, nano-banana-pro
    tokensUsed: op.tokensUsed,
    latency: op.latencyMs,
    cost: op.cost,
    success: op.success,
    errorContext: op.error || null,
    timestamp: new Date().toISOString()
  }));
}
```

**Admin Query Examples**:
```sql
-- Find all failed edits in last 24h
resource.type="cloud_function"
jsonPayload.category="vibe_editor"
jsonPayload.success=false
timestamp>=NOW()-24h

-- Track AI costs by user
resource.type="cloud_function"
jsonPayload.category="vibe_editor"
| sum(jsonPayload.cost) by jsonPayload.userId
```

### 8.4 Rate Limiting

**API Gateway Configuration**:
```yaml
# api-gateway-config.yaml

quotas:
  - name: vibe-editor-edits
    metric: vibe_editor_edits
    unit: 1/min/{user}
    limits:
      FREE: 5
      STARTER: 20
      GROWTH: 100
      ENTERPRISE: unlimited

  - name: vibe-editor-images
    metric: vibe_editor_images
    unit: 1/day/{user}
    limits:
      FREE: 10
      STARTER: 50
      GROWTH: 200
      ENTERPRISE: unlimited
```

**Enforcement**:
```typescript
// functions/src/middleware/quota.ts

export async function checkVibeEditorQuota(
  userId: string,
  operation: 'edit' | 'image'
): Promise<void> {

  const user = await getUser(userId);
  const usage = await getUsageToday(userId, operation);
  const limit = getQuotaLimit(user.tier, operation);

  if (usage >= limit) {
    throw new HttpsError(
      'resource-exhausted',
      `Quota exceeded: ${usage}/${limit} ${operation}s today`
    );
  }
}
```

---

## 9. Scaling Strategy

### 9.1 Horizontal Scaling

**Cloud Functions Auto-Scaling**:
- Min instances: 0 (free tier) / 1 (paid tier)
- Max instances: 100 (configurable)
- Concurrency: 80 requests/instance
- Timeout: 60s (edits), 540s (generation)

**Firestore**:
- Automatic sharding
- 10K writes/sec per database
- 1M concurrent connections

**Cloud Storage**:
- Cloud CDN for asset delivery
- Multi-region replication
- 99.95% SLA

### 9.2 Caching

| Layer | Cache | TTL | Hit Rate |
|-------|-------|-----|----------|
| Vision API | Firestore | 24h | 90% |
| Project Index | Firestore | Until edit | 95% |
| Intent Classification | (Future) Redis | 1h | 60% |
| Assets | Cloud CDN | 7d | 99% |

### 9.3 Cost Optimization

**AI Cost Breakdown** (10K users, 100K edits/month):
```
Intent: 100K × $0.00001  = $1
Edit:   100K × $0.01     = $1,000
Images: 10K  × $0.05     = $500
Vision: 50K  × $0.001    = $50 (cached)
────────────────────────────────
Total:                     $1,551/month

Revenue: 10K users × $49 = $490,000/month
AI cost: 0.32% of revenue
```

**Optimization Strategies**:
1. Model separation (Flash for intent, Pro for editing)
2. Context minimization (send 1-3 sections max)
3. Vision API caching (24-hour TTL)
4. Async queue for image generation
5. User quotas (tier-based limits)

---

## 10. Migration Path

### 10.1 Phase 1: Parallel Deployment (Non-Breaking)

**Weeks 1-4**: Add vibe editor alongside existing editor

**Implementation**:
```typescript
// Feature flag
interface User {
  vibeEditorEnabled: boolean; // Default: false for existing, true for new
}

// Dual routing
if (user.vibeEditorEnabled) {
  return <VibeEditorUI />;
} else {
  return <LegacyEditorUI />;
}

// Dual backend
export const editSite = onCall(async (request) => {
  if (request.data.useVibeEditor) {
    return vibeEditorPipeline(request);
  } else {
    return legacyEditSiteHTML(request);
  }
});
```

**Benefits**:
- Zero disruption to existing users
- A/B testing capability
- Gradual rollout
- Easy rollback

### 10.2 Phase 2: Vibe Editor Default

**Weeks 5-8**: Make vibe editor default for new users

**Migration Banner**:
```tsx
{!user.vibeEditorEnabled && (
  <Banner variant="info">
    ✨ Try our new AI editor with undo/redo and surgical edits!
    <Button onClick={enableVibeEditor}>Enable Now</Button>
  </Banner>
)}
```

### 10.3 Phase 3: Full Migration

**Weeks 9-12**: Deprecate legacy editor

**Steps**:
1. Email notification to remaining legacy users (2 weeks notice)
2. Force migration with data preservation
3. Remove legacy code paths
4. Simplify codebase

**Data Migration**:
```typescript
async function migrateLegacyProject(projectId: string) {
  const html = await getLegacySiteHTML(projectId);
  const index = await buildProjectIndex(html, projectId);

  await saveProjectIndex(projectId, index);
  await updateProject(projectId, { vibeEditorEnabled: true });
}
```

---

## 11. Implementation Phases

### Phase 1: Foundation (Weeks 1-4)

**Deliverables**:
- [ ] Project indexer (parse HTML → build component map)
- [ ] Intent parser (Gemini 3 Flash integration)
- [ ] Context selector (rule-based component selection)
- [ ] Validator (HTML, Tailwind, security checks)
- [ ] Firestore schema (edits collection, index storage)
- [ ] Frontend: Vibe editor UI (prompt input, diff viewer)
- [ ] Admin: Add vibe editor metrics to AdminDashboard

**Testing**:
- Unit: Indexer, context selector
- Integration: Intent parser accuracy
- E2E: "Add logo to navbar" flow

**Success Metrics**:
- Project index builds <2s
- Intent accuracy >95%
- Validation catches 100% syntax errors

### Phase 2: Edit Generation (Weeks 5-8)

**Deliverables**:
- [ ] Edit generator (Gemini 3 Pro diff-only mode)
- [ ] Asset service (Nano Banana Pro integration, srcset generation)
- [ ] Undo/redo system (edit history)
- [ ] Retry logic (validation failures)
- [ ] Frontend: Preview pane with diff highlighting
- [ ] Admin: Error tracking in AdminBetaErrors

**Testing**:
- Diff correctness (apply → revert → apply)
- Security validation (XSS prevention)
- Performance (edit generation <3s)

**Success Metrics**:
- Edit success rate >90%
- Diff size <500 chars
- Zero layout breaks

### Phase 3: Admin Integration (Weeks 9-10)

**Deliverables**:
- [ ] Wire AdminDashboard to vibe editor metrics
- [ ] Wire AdminAIOptimization to model config
- [ ] Wire AdminBetaErrors to edit failures
- [ ] Wire AdminAuditLogs to vibe operations
- [ ] Wire AdminSettings to vibe editor config
- [ ] Add admin override capability

**Testing**:
- Admin dashboard loads <2s
- Metrics update real-time
- Error logs queryable

**Success Metrics**:
- All admin pages functional
- Metrics accurate (validated against logs)

### Phase 4: Domain & Hosting (Weeks 11-12)

**Deliverables**:
- [ ] Preserve GoDaddy OAuth flow
- [ ] Preserve DNS automation
- [ ] Preserve manual domain connection
- [ ] Test with vibe-edited sites

**Testing**:
- GoDaddy OAuth (staging)
- DNS propagation (test domain)
- SSL provisioning

**Success Metrics**:
- 1-click connection <5min
- SSL success rate >99%

### Phase 5: Enterprise Features (Weeks 13-16)

**Deliverables**:
- [ ] RBAC (project-level roles)
- [ ] Audit logging (Cloud Logging integration)
- [ ] Rate limiting (API Gateway quotas)
- [ ] Cost tracking (per-user AI spend)
- [ ] Monitoring dashboards

**Testing**:
- Load testing (10K concurrent edits)
- Security audit

**Success Metrics**:
- 10K concurrent users supported
- 99.9% uptime

### Phase 6: Optimization (Weeks 17-20)

**Deliverables**:
- [ ] Intent caching (Redis)
- [ ] Diff caching
- [ ] Prompt optimization
- [ ] CDN optimization

**Testing**:
- Cache hit rate benchmarks
- Cost reduction analysis

**Success Metrics**:
- AI cost -30%
- Latency <2s (p95)
- Cache hit >70%

---

## 12. API Contracts

### Vibe Editor Endpoints

#### POST /api/vibe/intent
**Input**:
```json
{
  "projectId": "proj123",
  "prompt": "Add a professional logo to the navbar",
  "attachments": []
}
```

**Output**:
```json
{
  "intent": {
    "intent_type": "add_logo",
    "target": "navbar",
    "requires_asset": true,
    "style_system": "tailwind",
    "scope": "component",
    "risk": "medium"
  }
}
```

#### POST /api/vibe/edit
**Input**:
```json
{
  "projectId": "proj123",
  "intent": { ... },
  "assetPath": "/assets/logo-abc123.webp"
}
```

**Output**:
```json
{
  "editId": "edit456",
  "diff": "...",
  "summary": "Added logo to navbar (h-8)",
  "preview": "https://preview-proj123.run.app"
}
```

#### POST /api/vibe/undo
**Input**:
```json
{
  "projectId": "proj123"
}
```

**Output**:
```json
{
  "success": true,
  "undoneEditId": "edit456",
  "message": "Undone: Added logo"
}
```

---

## 13. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Edit Success Rate | >90% | Successful edits / Total edits |
| Edit Latency (p95) | <3s | Cloud Monitoring |
| AI Cost per Edit | <$0.02 | Token usage × pricing |
| Undo Rate | <10% | Undos / Edits |
| Admin Page Load | <2s | Lighthouse |
| System Uptime | 99.9% | Cloud Monitoring SLO |

---

## 14. Conclusion

This architecture provides:

✅ **Enterprise-grade scalability** (10K–1M users)
✅ **Safe AI editing** (diff-only, validation, undo)
✅ **Cost efficiency** (model separation: Flash/Pro/Nano Banana)
✅ **Admin panel fully integrated** (all pages wired to vibe editor)
✅ **Zero-downtime migration** (dual-path deployment)
✅ **Security & compliance** (RBAC, audit logs, encryption)
✅ **1-click GoDaddy** (NO reseller complexity)

**Core Principle Maintained**:
> AI never owns state. Prompts never touch files. Assets are real before code changes. Diffs are reversible.

**Next Steps**:
1. Approve architecture plan
2. Create implementation tickets
3. Set up staging environment
4. Begin Phase 1 (Weeks 1-4)

**Estimated Timeline**: 20 weeks to production-ready vibe editor with enterprise features.
