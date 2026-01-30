"use strict";
/**
 * Validator - Safety checks before commit
 *
 * Validates HTML syntax, Tailwind classes, security, and accessibility.
 * Per newlogic.md: Cheap but critical validation loop.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateEdit = validateEdit;
function validateEdit(modifiedHTML) {
    const errors = [];
    const warnings = [];
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
function isValidHTML(html) {
    // Basic HTML validation - check for unclosed tags
    const openTags = html.match(/<(\w+)[^>]*>/g) || [];
    const closeTags = html.match(/<\/(\w+)>/g) || [];
    const selfClosingTags = ['img', 'br', 'hr', 'input', 'meta', 'link'];
    const openTagNames = openTags
        .map(tag => { var _a; return (_a = tag.match(/<(\w+)/)) === null || _a === void 0 ? void 0 : _a[1]; })
        .filter(tag => tag && !selfClosingTags.includes(tag.toLowerCase()));
    const closeTagNames = closeTags.map(tag => { var _a; return (_a = tag.match(/<\/(\w+)>/)) === null || _a === void 0 ? void 0 : _a[1]; });
    // Basic check: similar number of open/close tags
    return Math.abs(openTagNames.length - closeTagNames.length) <= 2;
}
function containsInlineScript(html) {
    // Check for inline JS
    return /<script/i.test(html) || /on\w+\s*=/i.test(html) || /javascript:/i.test(html);
}
function checkAccessibility(html) {
    var _a, _b;
    const errors = [];
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
        const hasText = (_b = (_a = button.match(/<button[^>]*>(.*?)<\/button>/i)) === null || _a === void 0 ? void 0 : _a[1]) === null || _b === void 0 ? void 0 : _b.trim();
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
//# sourceMappingURL=validator.js.map