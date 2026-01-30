/**
 * Validator - Safety checks before commit
 *
 * Validates HTML syntax, Tailwind classes, security, and accessibility.
 * Per newlogic.md: Cheap but critical validation loop.
 */

import { ValidationResult, ValidationError, ValidationWarning } from './types';

export function validateEdit(modifiedHTML: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // 1. HTML Syntax validation (basic)
  if (!isValidHTML(modifiedHTML)) {
    errors.push({
      severity: 'critical',
      category: 'syntax',
      message: 'Invalid HTML syntax detected',
    });
  }

  // 2. Security validation (XSS prevention)
  if (containsInlineScript(modifiedHTML)) {
    errors.push({
      severity: 'critical',
      category: 'security',
      message: 'Inline JavaScript detected - potential XSS vulnerability',
    });
  }

  // 3. Accessibility validation
  const accessibilityIssues = checkAccessibility(modifiedHTML);
  errors.push(...accessibilityIssues);

  // 4. Tailwind validation (warn if using inline styles)
  if (modifiedHTML.includes('style=')) {
    warnings.push({
      category: 'style',
      message: 'Inline styles detected - prefer Tailwind utility classes',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function isValidHTML(html: string): boolean {
  // Basic HTML validation - check for unclosed tags
  const openTags = html.match(/<(\w+)[^>]*>/g) || [];
  const closeTags = html.match(/<\/(\w+)>/g) || [];

  const selfClosingTags = ['img', 'br', 'hr', 'input', 'meta', 'link'];

  const openTagNames = openTags
    .map(tag => tag.match(/<(\w+)/)?.[1])
    .filter(tag => tag && !selfClosingTags.includes(tag.toLowerCase()));

  const closeTagNames = closeTags.map(tag => tag.match(/<\/(\w+)>/)?.[1]);

  // Basic check: similar number of open/close tags
  return Math.abs(openTagNames.length - closeTagNames.length) <= 2;
}

function containsInlineScript(html: string): boolean {
  // Check for inline JS
  return /<script/i.test(html) || /on\w+\s*=/i.test(html) || /javascript:/i.test(html);
}

function checkAccessibility(html: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for images without alt text
  const imgTags = html.match(/<img[^>]*>/gi) || [];
  for (const img of imgTags) {
    if (!img.includes('alt=')) {
      errors.push({
        severity: 'error',
        category: 'accessibility',
        message: 'Image tag missing alt attribute',
      });
    }
  }

  // Check for buttons without text or aria-label
  const buttonTags = html.match(/<button[^>]*>[\s\S]*?<\/button>/gi) || [];
  for (const button of buttonTags) {
    const hasText = button.match(/<button[^>]*>(.*?)<\/button>/i)?.[1]?.trim();
    const hasAriaLabel = button.includes('aria-label=');
    if (!hasText && !hasAriaLabel) {
      errors.push({
        severity: 'error',
        category: 'accessibility',
        message: 'Button missing text content or aria-label',
      });
    }
  }

  return errors;
}
