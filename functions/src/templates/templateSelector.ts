/**
 * Template Selection Logic
 * Auto-selects the best template based on business category and visual vibe
 */

import type { DesignTemplateId, TemplateSelectionRequest } from '../../../types';
import { DESIGN_TEMPLATES } from './designTemplates';

/**
 * Category aliases for better matching
 */
const CATEGORY_ALIASES: Record<string, string[]> = {
  'tech': ['technology', 'software', 'it', 'digital', 'web'],
  'saas': ['software', 'app', 'platform', 'service'],
  'startup': ['startup', 'new business', 'entrepreneur'],
  'wellness': ['health', 'spa', 'yoga', 'meditation', 'fitness'],
  'restaurant': ['food', 'dining', 'eatery', 'bistro', 'kitchen'],
  'cafe': ['coffee', 'bakery', 'pastry'],
  'luxury': ['premium', 'high-end', 'exclusive', 'upscale'],
  'law': ['legal', 'attorney', 'lawyer', 'firm'],
  'finance': ['financial', 'banking', 'investment', 'accounting'],
  'healthcare': ['medical', 'clinic', 'doctor', 'dental', 'dentist'],
  'creative': ['design', 'art', 'studio', 'creative', 'agency'],
  'retail': ['shop', 'store', 'ecommerce', 'boutique'],
  'real-estate': ['property', 'realty', 'housing', 'homes'],
};

/**
 * Normalize category by checking aliases
 */
function normalizeCategory(category: string): string {
  const lower = category.toLowerCase();

  // Check direct match first
  for (const [key, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (key === lower || aliases.includes(lower)) {
      return key;
    }
  }

  // Check partial matches
  for (const [key, aliases] of Object.entries(CATEGORY_ALIASES)) {
    if (lower.includes(key) || aliases.some(alias => lower.includes(alias))) {
      return key;
    }
  }

  return lower;
}

/**
 * Auto-select the best template based on multiple signals
 */
export function autoSelectTemplate(request: TemplateSelectionRequest): DesignTemplateId {
  const {
    userSelected,
    category,
    visualVibe,
    brandPersonality,
    preferDarkMode,
    preferMinimal
  } = request;

  // If user explicitly selected a template, use it
  if (userSelected && DESIGN_TEMPLATES[userSelected]) {
    return userSelected;
  }

  let bestMatch: DesignTemplateId = 'glass-aurora'; // Default
  let bestScore = 0;

  const normalizedCategory = category ? normalizeCategory(category) : '';

  for (const template of Object.values(DESIGN_TEMPLATES)) {
    let score = 0;

    // Industry/category matching (40% weight)
    if (normalizedCategory) {
      const industryScore = template.industryScores[normalizedCategory] || 0;
      score += industryScore * 40;

      // Also check for partial matches in industry scores
      for (const [industry, indScore] of Object.entries(template.industryScores)) {
        if (normalizedCategory.includes(industry) || industry.includes(normalizedCategory)) {
          score += (indScore * 0.5) * 20; // Half weight for partial matches
        }
      }
    }

    // Vibe keyword matching (30% weight)
    if (visualVibe) {
      const vibeWords = visualVibe.toLowerCase().split(/[\s,]+/);
      const matchCount = template.vibeKeywords.filter(kw =>
        vibeWords.some(vw => vw.includes(kw) || kw.includes(vw))
      ).length;
      score += matchCount * 10; // Up to 30 points for 3 matches
    }

    // Brand personality matching (10% weight)
    if (brandPersonality) {
      const personalityWords = brandPersonality.toLowerCase().split(/[\s,]+/);
      const matchCount = template.vibeKeywords.filter(kw =>
        personalityWords.some(pw => pw.includes(kw) || kw.includes(pw))
      ).length;
      score += matchCount * 5;
    }

    // Dark mode preference (10% weight)
    if (preferDarkMode !== undefined) {
      if (preferDarkMode && template.color.backgroundMode === 'dark') {
        score += 10;
      } else if (!preferDarkMode && template.color.backgroundMode === 'light') {
        score += 10;
      }
    }

    // Minimal preference (10% weight)
    if (preferMinimal) {
      if (template.id === 'clean-minimal') {
        score += 15;
      } else if (['dark-luxury', 'editorial-magazine'].includes(template.id)) {
        score += 5;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = template.id;
    }
  }

  console.log(`[TemplateSelector] Selected: ${bestMatch} (score: ${bestScore.toFixed(1)})`);
  console.log(`[TemplateSelector] Inputs: category=${category}, vibe=${visualVibe?.substring(0, 50)}`);

  return bestMatch;
}

/**
 * Get template recommendations for a category
 * Returns top 3 matching templates with scores
 */
export function getTemplateRecommendations(
  category: string,
  visualVibe?: string
): Array<{ template: DesignTemplateId; score: number; name: string }> {
  const normalizedCategory = normalizeCategory(category);

  const scores: Array<{ template: DesignTemplateId; score: number; name: string }> = [];

  for (const template of Object.values(DESIGN_TEMPLATES)) {
    let score = 0;

    // Industry score
    score += (template.industryScores[normalizedCategory] || 0.3) * 50;

    // Vibe matching
    if (visualVibe) {
      const vibeWords = visualVibe.toLowerCase().split(/[\s,]+/);
      const matchCount = template.vibeKeywords.filter(kw =>
        vibeWords.some(vw => vw.includes(kw) || kw.includes(vw))
      ).length;
      score += matchCount * 15;
    }

    scores.push({
      template: template.id,
      score,
      name: template.name,
    });
  }

  return scores
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/**
 * Validate if a template ID is valid
 */
export function isValidTemplateId(id: string): id is DesignTemplateId {
  return id in DESIGN_TEMPLATES;
}
