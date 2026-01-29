---
description: RenovateMySite 2.0 UI Blueprint & Development Rules
---

# RenovateMySite 2.0 Blueprint

This document serves as the official design system guide and development rulebook for **RenovateMySite 2.0**. All future modifications and additions MUST adhere to these standards to maintain the premium, high-fidelity "Alpha Access" aesthetic.

## 1. Core Visual Identity

### A. Color Palette
- **Deep Background**: `#08080A` (Zinc-950 equivalent)
- **Alt Background**: `#0F0F12` (Used for headers and sidebars)
- **Primary Accent**: `#10b981` (Emerald 500) - Used for primary buttons, highlights, and "Growth" indicators.
- **Secondary Accent**: `#059669` (Emerald 600) - Used for hovers and depth.
- **Borders**: `white/5` (Subtle) or `emerald-500/20` (Active/Highlighted).
- **Text**:
  - Primary: `white`
  - Secondary: `zinc-400` / `zinc-500`
  - Accents: `emerald-400`

### B. Typography
- **Primary Font**: `Outfit`, sans-serif.
- **Header Style**: Bold, tracking-tighter, often italicized for the "Premium" feel.
- **Label Style**: `text-[10px]`, font-black, uppercase, tracking-widest (used for captions and small labels).

### C. UI Geometry & Effects
- **Rounded Corners**: Ultra-large corners are a signature.
  - Containers: `rounded-[40px]` or `rounded-[48px]`.
  - Buttons/Cards: `rounded-2xl` or `rounded-3xl`.
- **Glassmorphism**: Extensive use of `backdrop-blur-2xl` and `bg-zinc-900/40`.
- **Depth**: Soft `shadow-3xl`, often with a hint of color (e.g., `shadow-emerald-500/20`).
- **Animations**: Driven by `framer-motion`. Staggered children, smooth fades, and subtle scales on hover.

## 2. Infrastructure & Component Architecture

- **Main Hub**: `App.tsx` handles state and high-level routing (Wizard Steps).
- **Renderer**: `WebsiteRenderer.tsx` handles the visual output of the AI-generated sites.
- **Constants**: `constants.tsx` stores industry defaults and pricing plans.
- **Services**: `services/geminiService.ts` handles AI interactions.

## 3. IMMUTABLE DEVELOPMENT RULES

> **CRITICAL**: These rules are mandatory for all AI-assisted and manual coding.

### RULE 1: NO DELETIONS
- **NEVER** delete an existing UI component, section, or feature unless specifically asked to "remove" or "delete" it by the user.
- If a component seems redundant, keep it. If a section is "old", keep it.

### RULE 2: NO UNSOLICITED RESTYLING
- **DO NOT** change the CSS, Tailwind classes, or inline styles of existing components unless directed to fix a specific visual bug or update the theme globally.
- Preserving the "Vibe" is more important than "Refactoring" CSS that is already working.

### RULE 3: THEME ADHERENCE
- Every new component MUST use the established palette:
  - Dark background (`#08080A`).
  - Emerald accents (`#10b981`).
  - `Outfit` font family.
  - Large rounded corners.
- Refer to `App.tsx` and `WebsiteRenderer.tsx` for implementation examples of the theme.

### RULE 4: PREMIUM POLISH
- All new UI elements should feel "Alive".
- Add hover states.
- Use `AnimatePresence` for entries/exits.
- Ensure proper spacing (8px / 16px / 32px increments).

### RULE 5: STATE PRESERVATION
- When adding features, ensure existing state (leads, blueprint, tokens) is never reset or corrupted.
- Always use `Functional Updates` for React State (e.g., `setLeads(prev => [...prev, newLead])`).

---
**Status**: ACTIVE
**Last Updated**: 2026-01-05
