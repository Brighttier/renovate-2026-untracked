/**
 * Edit Intent Analyzer - Classifies user prompts to improve AI accuracy
 * Inspired by Open Lovable's edit-intent-analyzer.ts
 */

export type EditIntent =
  | 'CHANGE_COLOR'
  | 'CHANGE_STYLE'
  | 'ADD_SECTION'
  | 'REMOVE_SECTION'
  | 'UPDATE_TEXT'
  | 'CHANGE_LAYOUT'
  | 'CHANGE_FONT'
  | 'UPDATE_NAVBAR'
  | 'UPDATE_FOOTER'
  | 'REORDER_SECTIONS'
  | 'GENERAL_EDIT';

interface IntentPattern {
  intent: EditIntent;
  patterns: RegExp[];
  baseConfidence: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: 'CHANGE_COLOR',
    patterns: [
      /\b(change|make|set|update|use)\b.*\b(color|colours?|theme|scheme)\b/i,
      /\b(blue|red|green|yellow|purple|pink|orange|black|white|gray|grey|navy|teal|emerald|gold|silver)\b/i,
      /\b(primary|secondary|accent|background)\s*(color)?\b/i,
      /\b(darker|lighter|brighter|more vibrant|muted)\b/i,
      /#[0-9a-fA-F]{3,6}\b/,
    ],
    baseConfidence: 0.85,
  },
  {
    intent: 'CHANGE_STYLE',
    patterns: [
      /\b(make|more|less)\s*(modern|elegant|professional|playful|minimalist|bold|clean|sleek)\b/i,
      /\b(style|look|feel|aesthetic|vibe|design)\b/i,
      /\b(corporate|business|startup|creative|luxury|casual|friendly)\b/i,
      /\b(glassmorphism|neumorphism|brutalist|flat|material)\b/i,
    ],
    baseConfidence: 0.8,
  },
  {
    intent: 'ADD_SECTION',
    patterns: [
      /\b(add|create|include|insert|put)\b.*\b(section|block|area|component)\b/i,
      /\b(add|create|include)\b.*\b(testimonial|pricing|faq|contact|about|hero|feature|service|team|gallery|portfolio|cta|footer|header|navigation|menu)\b/i,
      /\bnew\s+(section|block|area)\b/i,
    ],
    baseConfidence: 0.9,
  },
  {
    intent: 'REMOVE_SECTION',
    patterns: [
      /\b(remove|delete|hide|get rid of)\b.*\b(section|block|area|component)\b/i,
      /\b(remove|delete|hide)\b.*\b(testimonial|pricing|faq|contact|about|hero|feature|service|team|gallery|portfolio|cta|footer|header|navigation|menu)\b/i,
    ],
    baseConfidence: 0.9,
  },
  {
    intent: 'UPDATE_TEXT',
    patterns: [
      /\b(change|update|edit|modify|rewrite)\b.*\b(text|headline|title|heading|subtitle|description|content|copy|wording)\b/i,
      /\b(headline|title|heading|subtitle)\b.*\bto\b/i,
      /\bsay\s*["'].*["']/i,
      /\b(shorter|longer|more concise|friendlier|professional)\s+(text|copy|content)\b/i,
    ],
    baseConfidence: 0.85,
  },
  {
    intent: 'CHANGE_LAYOUT',
    patterns: [
      /\b(full\s*width|centered|left\s*align|right\s*align|justify)\b/i,
      /\b(layout|grid|columns?|rows?|spacing|padding|margin)\b/i,
      /\b(wider|narrower|bigger|smaller|larger|compact|spread\s*out)\b/i,
      /\b(stack|horizontal|vertical|side\s*by\s*side)\b/i,
    ],
    baseConfidence: 0.75,
  },
  {
    intent: 'CHANGE_FONT',
    patterns: [
      /\b(font|typeface|typography)\b/i,
      /\b(serif|sans-serif|sans\s*serif|monospace|display|script)\b/i,
      /\b(inter|outfit|poppins|roboto|arial|helvetica|georgia|playfair|montserrat|lato|open\s*sans)\b/i,
      /\b(bolder|thinner|lighter|heavier)\s*(font|text)?\b/i,
    ],
    baseConfidence: 0.85,
  },
  {
    intent: 'UPDATE_NAVBAR',
    patterns: [
      /\b(navbar|navigation|nav|menu|header)\b/i,
      /\b(add|remove|change|update)\b.*\b(link|menu|navigation)\b/i,
      /\b(sticky|fixed|transparent|glass)\b.*\b(nav|header|menu)\b/i,
      /\b(logo|brand)\b.*\b(nav|header|top)\b/i,
      /\b(cta|button)\b.*\b(nav|header|menu)\b/i,
    ],
    baseConfidence: 0.9,
  },
  {
    intent: 'UPDATE_FOOTER',
    patterns: [
      /\b(footer|bottom)\b/i,
      /\b(social|facebook|instagram|twitter|linkedin)\b.*\b(link|icon)\b/i,
      /\b(copyright|newsletter|subscribe)\b/i,
      /\b(footer)\s*(columns?|links?|section)\b/i,
    ],
    baseConfidence: 0.9,
  },
  {
    intent: 'REORDER_SECTIONS',
    patterns: [
      /\b(reorder|rearrange|move|swap)\b.*\b(section|block)\b/i,
      /\b(section|block)\b.*\b(before|after|above|below)\b/i,
      /\b(first|last|top|bottom)\b.*\b(section|block)\b/i,
    ],
    baseConfidence: 0.85,
  },
];

/**
 * Analyzes a user prompt to determine editing intent
 */
export function analyzeEditIntent(prompt: string): {
  intent: EditIntent;
  confidence: number;
  enhancedPrompt: string;
} {
  const normalizedPrompt = prompt.toLowerCase().trim();

  // Check each intent pattern
  for (const { intent, patterns, baseConfidence } of INTENT_PATTERNS) {
    let matchCount = 0;
    for (const pattern of patterns) {
      if (pattern.test(normalizedPrompt)) {
        matchCount++;
      }
    }

    if (matchCount > 0) {
      // Confidence increases with more pattern matches
      const confidence = Math.min(baseConfidence + (matchCount - 1) * 0.05, 0.95);
      const enhancedPrompt = getEnhancedPrompt(intent, prompt);

      console.log(`Intent detected: ${intent} (confidence: ${confidence.toFixed(2)})`);
      return { intent, confidence, enhancedPrompt };
    }
  }

  // Default fallback
  return {
    intent: 'GENERAL_EDIT',
    confidence: 0.5,
    enhancedPrompt: prompt,
  };
}

/**
 * Generates an enhanced prompt based on the detected intent
 */
function getEnhancedPrompt(intent: EditIntent, originalPrompt: string): string {
  switch (intent) {
    case 'CHANGE_COLOR':
      return `COLOR CHANGE REQUEST: ${originalPrompt}. Focus on updating brand.primaryColor and brand.secondaryColor with harmonious hex values.`;

    case 'CHANGE_STYLE':
      return `STYLE UPDATE REQUEST: ${originalPrompt}. Adjust the overall design aesthetic while maintaining brand consistency.`;

    case 'ADD_SECTION':
      return `ADD SECTION REQUEST: ${originalPrompt}. Create a new section with appropriate id, type, title, content, and cta that matches the existing tone.`;

    case 'REMOVE_SECTION':
      return `REMOVE SECTION REQUEST: ${originalPrompt}. Remove the specified section from the sections array.`;

    case 'UPDATE_TEXT':
      return `TEXT UPDATE REQUEST: ${originalPrompt}. Update the specified text content while maintaining the brand tone.`;

    case 'CHANGE_LAYOUT':
      return `LAYOUT CHANGE REQUEST: ${originalPrompt}. Adjust the layout properties as requested.`;

    case 'CHANGE_FONT':
      return `FONT CHANGE REQUEST: ${originalPrompt}. Update brand.fontFamily with the requested font.`;

    case 'UPDATE_NAVBAR':
      return `NAVBAR UPDATE REQUEST: ${originalPrompt}. Update the navbar object with the requested changes (style, position, links, ctaButton).`;

    case 'UPDATE_FOOTER':
      return `FOOTER UPDATE REQUEST: ${originalPrompt}. Update the footer object with the requested changes (style, columns, socialLinks, newsletter).`;

    case 'REORDER_SECTIONS':
      return `REORDER SECTIONS REQUEST: ${originalPrompt}. Rearrange the sections array as requested while keeping section content intact.`;

    default:
      return originalPrompt;
  }
}

/**
 * Gets intent-specific instructions for the AI
 */
export function getIntentInstructions(intent: EditIntent): string {
  switch (intent) {
    case 'CHANGE_COLOR':
      return `
FOCUS: Update colors only.
- Modify brand.primaryColor with the requested color (hex format)
- Set brand.secondaryColor to a complementary shade
- Keep all sections, text, and layout unchanged`;

    case 'CHANGE_STYLE':
      return `
FOCUS: Adjust design aesthetic.
- Update brand.tone to reflect the new style
- Adjust colors if needed to match the new aesthetic
- Keep section content and structure unchanged`;

    case 'ADD_SECTION':
      return `
FOCUS: Add a new section.
- Create a new section object with unique id
- Set appropriate type (hero, features, testimonials, pricing, faq, contact, etc.)
- Write compelling title, content, and cta matching the brand tone
- Place it logically in the sections array`;

    case 'REMOVE_SECTION':
      return `
FOCUS: Remove a section.
- Find and remove the matching section from the sections array
- Keep all other sections intact`;

    case 'UPDATE_TEXT':
      return `
FOCUS: Update text content.
- Modify only the specified title, content, or cta
- Maintain the brand tone
- Keep colors, layout, and other sections unchanged`;

    case 'CHANGE_LAYOUT':
      return `
FOCUS: Adjust layout.
- Modify section properties as requested
- Keep text content and colors unchanged`;

    case 'CHANGE_FONT':
      return `
FOCUS: Update typography.
- Change brand.fontFamily to the requested font
- Keep all other properties unchanged`;

    case 'UPDATE_NAVBAR':
      return `
FOCUS: Update navigation bar.
- Set navbar.enabled to true if adding a navbar
- Choose style: 'transparent' | 'solid' | 'glass'
- Choose position: 'fixed' (stays at top) | 'static' (scrolls with page)
- Add/update links array with objects: { id, label, href }
- Use href="#section-id" for smooth scrolling to sections
- Optionally add ctaButton: { label, href }
- Keep all sections and other properties unchanged`;

    case 'UPDATE_FOOTER':
      return `
FOCUS: Update footer.
- Set footer.enabled to true if adding a footer
- Choose style: 'minimal' | 'standard' | 'detailed'
- For 'standard'/'detailed' style, add columns array with: { id, title, links: [{ label, href }] }
- Add socialLinks object: { facebook?, instagram?, twitter?, linkedin? }
- Optionally set copyright text and showNewsletter boolean
- Keep all sections and other properties unchanged`;

    case 'REORDER_SECTIONS':
      return `
FOCUS: Rearrange sections.
- Move sections in the array as requested
- Keep all section content, ids, and properties intact
- Only change the order of items in the sections array`;

    default:
      return `
Apply the requested changes while maintaining the overall structure and brand consistency.`;
  }
}
