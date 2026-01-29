/**
 * Blueprint Validator - Validates AI responses before applying
 * Inspired by Open Lovable's build-validator.ts
 */

import { WebsiteBlueprint, WebsiteSection, WebsiteSectionType, WebsiteNavbar, WebsiteFooter } from '../types';

// Valid section types
const VALID_SECTION_TYPES: WebsiteSectionType[] = [
  'hero', 'services', 'about', 'contact', 'trust',
  'testimonials', 'pricing', 'faq', 'gallery', 'team', 'features', 'cta'
];

// Valid navbar styles and positions
const VALID_NAVBAR_STYLES = ['transparent', 'solid', 'glass'];
const VALID_NAVBAR_POSITIONS = ['fixed', 'static'];

// Valid footer styles
const VALID_FOOTER_STYLES = ['minimal', 'standard', 'detailed'];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  recoverable: boolean;
}

/**
 * Validates a blueprint structure
 */
export function validateBlueprint(blueprint: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if blueprint exists
  if (!blueprint || typeof blueprint !== 'object') {
    return {
      valid: false,
      errors: ['Blueprint is missing or not an object'],
      warnings: [],
      recoverable: false,
    };
  }

  const bp = blueprint as Record<string, unknown>;

  // Check brand object
  if (!bp.brand) {
    errors.push('Missing brand object');
  } else if (typeof bp.brand !== 'object') {
    errors.push('brand must be an object');
  } else {
    const brand = bp.brand as Record<string, unknown>;

    // Required brand fields
    if (!brand.name || typeof brand.name !== 'string') {
      warnings.push('Missing or invalid brand.name');
    }

    if (!brand.primaryColor || typeof brand.primaryColor !== 'string') {
      errors.push('Missing or invalid brand.primaryColor');
    } else if (!/^#[0-9A-Fa-f]{6}$/.test(brand.primaryColor as string)) {
      warnings.push(`Invalid primaryColor format: ${brand.primaryColor} (should be #XXXXXX)`);
    }

    if (!brand.secondaryColor || typeof brand.secondaryColor !== 'string') {
      warnings.push('Missing brand.secondaryColor');
    } else if (!/^#[0-9A-Fa-f]{6}$/.test(brand.secondaryColor as string)) {
      warnings.push(`Invalid secondaryColor format: ${brand.secondaryColor}`);
    }

    if (!brand.fontFamily || typeof brand.fontFamily !== 'string') {
      warnings.push('Missing brand.fontFamily');
    }

    if (!brand.tone || typeof brand.tone !== 'string') {
      warnings.push('Missing brand.tone');
    }
  }

  // Check sections array
  if (!bp.sections) {
    errors.push('Missing sections array');
  } else if (!Array.isArray(bp.sections)) {
    errors.push('sections must be an array');
  } else if (bp.sections.length === 0) {
    warnings.push('sections array is empty');
  } else {
    // Validate each section
    (bp.sections as unknown[]).forEach((section, index) => {
      if (!section || typeof section !== 'object') {
        errors.push(`Section ${index} is invalid`);
        return;
      }

      const s = section as Record<string, unknown>;

      if (!s.id || typeof s.id !== 'string') {
        warnings.push(`Section ${index} missing id`);
      }

      if (!s.type || typeof s.type !== 'string') {
        warnings.push(`Section ${index} missing type`);
      } else if (!VALID_SECTION_TYPES.includes(s.type as WebsiteSectionType)) {
        warnings.push(`Section ${index} has unknown type: ${s.type}`);
      }

      // Validate title - should exist and be a string (not null/undefined)
      if (!s.title || typeof s.title !== 'string') {
        warnings.push(`Section ${index} missing or invalid title`);
      }

      // Validate content - should exist and be a string (not null/undefined)
      if (s.content === null || s.content === undefined || typeof s.content !== 'string') {
        warnings.push(`Section ${index} missing or invalid content`);
      }
    });
  }

  // Check plugins array (optional but should be array if present)
  if (bp.plugins !== undefined && !Array.isArray(bp.plugins)) {
    warnings.push('plugins should be an array');
  }

  // Validate navbar (optional)
  if (bp.navbar !== undefined) {
    if (typeof bp.navbar !== 'object') {
      warnings.push('navbar should be an object');
    } else {
      const navbar = bp.navbar as Record<string, unknown>;

      if (navbar.enabled !== undefined && typeof navbar.enabled !== 'boolean') {
        warnings.push('navbar.enabled should be a boolean');
      }

      if (navbar.style && !VALID_NAVBAR_STYLES.includes(navbar.style as string)) {
        warnings.push(`Invalid navbar.style: ${navbar.style} (should be one of: ${VALID_NAVBAR_STYLES.join(', ')})`);
      }

      if (navbar.position && !VALID_NAVBAR_POSITIONS.includes(navbar.position as string)) {
        warnings.push(`Invalid navbar.position: ${navbar.position} (should be one of: ${VALID_NAVBAR_POSITIONS.join(', ')})`);
      }

      if (navbar.links !== undefined && !Array.isArray(navbar.links)) {
        warnings.push('navbar.links should be an array');
      }

      if (navbar.ctaButton !== undefined && typeof navbar.ctaButton !== 'object') {
        warnings.push('navbar.ctaButton should be an object');
      }
    }
  }

  // Validate footer (optional)
  if (bp.footer !== undefined) {
    if (typeof bp.footer !== 'object') {
      warnings.push('footer should be an object');
    } else {
      const footer = bp.footer as Record<string, unknown>;

      if (footer.enabled !== undefined && typeof footer.enabled !== 'boolean') {
        warnings.push('footer.enabled should be a boolean');
      }

      if (footer.style && !VALID_FOOTER_STYLES.includes(footer.style as string)) {
        warnings.push(`Invalid footer.style: ${footer.style} (should be one of: ${VALID_FOOTER_STYLES.join(', ')})`);
      }

      if (footer.columns !== undefined && !Array.isArray(footer.columns)) {
        warnings.push('footer.columns should be an array');
      }

      if (footer.socialLinks !== undefined && typeof footer.socialLinks !== 'object') {
        warnings.push('footer.socialLinks should be an object');
      }

      if (footer.showNewsletter !== undefined && typeof footer.showNewsletter !== 'boolean') {
        warnings.push('footer.showNewsletter should be a boolean');
      }
    }
  }

  // Determine if errors are recoverable
  const recoverable = errors.length <= 2 && !errors.includes('Blueprint is missing or not an object');

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    recoverable,
  };
}

/**
 * Attempts to recover a malformed blueprint by merging with original
 */
export function attemptRecovery(
  malformedBlueprint: unknown,
  originalBlueprint: WebsiteBlueprint
): WebsiteBlueprint | null {
  if (!malformedBlueprint || typeof malformedBlueprint !== 'object') {
    return null;
  }

  const bp = malformedBlueprint as Record<string, unknown>;

  try {
    // Start with original as base
    const recovered: WebsiteBlueprint = { ...originalBlueprint };

    // Try to extract valid brand properties
    if (bp.brand && typeof bp.brand === 'object') {
      const newBrand = bp.brand as Record<string, unknown>;
      recovered.brand = {
        ...originalBlueprint.brand,
        // Only override if valid
        ...(typeof newBrand.name === 'string' && { name: newBrand.name }),
        ...(typeof newBrand.primaryColor === 'string' &&
          /^#[0-9A-Fa-f]{6}$/.test(newBrand.primaryColor) && {
            primaryColor: newBrand.primaryColor,
          }),
        ...(typeof newBrand.secondaryColor === 'string' &&
          /^#[0-9A-Fa-f]{6}$/.test(newBrand.secondaryColor) && {
            secondaryColor: newBrand.secondaryColor,
          }),
        ...(typeof newBrand.fontFamily === 'string' && { fontFamily: newBrand.fontFamily }),
        ...(typeof newBrand.tone === 'string' && { tone: newBrand.tone }),
      };
    }

    // Try to extract valid sections with fallbacks for missing fields
    if (Array.isArray(bp.sections) && bp.sections.length > 0) {
      const validSections = (bp.sections as unknown[])
        .filter((s) => s && typeof s === 'object')
        .map((s, index) => {
          const section = s as Record<string, unknown>;
          const sectionType = (section.type as string) || 'hero';

          // Provide fallback values for missing fields
          return {
            id: (section.id as string) || `section-${index}`,
            type: sectionType,
            title: (section.title as string) ||
              (sectionType === 'hero' ? 'Welcome' :
               sectionType === 'services' ? 'Our Services' :
               sectionType === 'trust' ? 'Why Choose Us' :
               sectionType === 'contact' ? 'Contact Us' : 'About Us'),
            content: (section.content as string) || '',
            cta: section.cta as string | undefined,
            imageUrl: section.imageUrl as string | undefined,
            imagePrompt: section.imagePrompt as string | undefined,
          } as WebsiteSection;
        });

      if (validSections.length > 0) {
        recovered.sections = validSections;
      }
    }

    // Try to extract valid plugins
    if (Array.isArray(bp.plugins)) {
      recovered.plugins = bp.plugins;
    }

    // Try to extract valid navbar
    if (bp.navbar && typeof bp.navbar === 'object') {
      const navbar = bp.navbar as Record<string, unknown>;
      recovered.navbar = {
        enabled: typeof navbar.enabled === 'boolean' ? navbar.enabled : false,
        style: (VALID_NAVBAR_STYLES.includes(navbar.style as string) ? navbar.style : 'solid') as 'transparent' | 'solid' | 'glass',
        position: (VALID_NAVBAR_POSITIONS.includes(navbar.position as string) ? navbar.position : 'static') as 'fixed' | 'static',
        links: Array.isArray(navbar.links) ? navbar.links : [],
        ...(navbar.ctaButton && typeof navbar.ctaButton === 'object' && { ctaButton: navbar.ctaButton }),
      } as WebsiteNavbar;
    }

    // Try to extract valid footer
    if (bp.footer && typeof bp.footer === 'object') {
      const footer = bp.footer as Record<string, unknown>;
      recovered.footer = {
        enabled: typeof footer.enabled === 'boolean' ? footer.enabled : true,
        style: (VALID_FOOTER_STYLES.includes(footer.style as string) ? footer.style : 'minimal') as 'minimal' | 'standard' | 'detailed',
        ...(Array.isArray(footer.columns) && { columns: footer.columns }),
        ...(footer.socialLinks && typeof footer.socialLinks === 'object' && { socialLinks: footer.socialLinks }),
        ...(typeof footer.copyright === 'string' && { copyright: footer.copyright }),
        ...(typeof footer.showNewsletter === 'boolean' && { showNewsletter: footer.showNewsletter }),
      } as WebsiteFooter;
    }

    return recovered;
  } catch (e) {
    console.error('Recovery failed:', e);
    return null;
  }
}

/**
 * Validates and optionally recovers a blueprint
 */
export function validateAndRecover(
  blueprint: unknown,
  originalBlueprint: WebsiteBlueprint
): { blueprint: WebsiteBlueprint; wasRecovered: boolean; validation: ValidationResult } {
  const validation = validateBlueprint(blueprint);

  if (validation.valid) {
    return {
      blueprint: blueprint as WebsiteBlueprint,
      wasRecovered: false,
      validation,
    };
  }

  if (validation.recoverable) {
    const recovered = attemptRecovery(blueprint, originalBlueprint);
    if (recovered) {
      const revalidation = validateBlueprint(recovered);
      if (revalidation.valid || revalidation.errors.length < validation.errors.length) {
        console.log('Blueprint recovered successfully');
        return {
          blueprint: recovered,
          wasRecovered: true,
          validation: revalidation,
        };
      }
    }
  }

  // Return original if recovery failed
  console.warn('Blueprint validation failed, returning original');
  return {
    blueprint: originalBlueprint,
    wasRecovered: false,
    validation,
  };
}
