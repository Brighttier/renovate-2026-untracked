/**
 * Template Prompt Builder
 * Generates AI prompts from template definitions
 */

import type { DesignTemplate } from '../../../types';

/**
 * Build CSS animation keyframes for a template
 */
function buildAnimationCSS(template: DesignTemplate): string {
  const animations: string[] = [];

  // Base entrance animation
  switch (template.animation.entranceAnimation) {
    case 'fadeInUp':
      animations.push(`
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-up { animation: fadeInUp ${template.animation.duration} ${template.animation.easing} forwards; }`);
      break;
    case 'fadeIn':
      animations.push(`
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
.animate-fade-in { animation: fadeIn ${template.animation.duration} ${template.animation.easing} forwards; }`);
      break;
    case 'slideInLeft':
      animations.push(`
@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}
.animate-slide-in-left { animation: slideInLeft ${template.animation.duration} ${template.animation.easing} forwards; }`);
      break;
    case 'scaleIn':
      animations.push(`
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.9); }
  to { opacity: 1; transform: scale(1); }
}
.animate-scale-in { animation: scaleIn ${template.animation.duration} ${template.animation.easing} forwards; }`);
      break;
  }

  // Add stagger delay classes
  const delays = [1, 2, 3, 4, 5, 6].map(i =>
    `.animation-delay-${i * template.animation.staggerDelay} { animation-delay: ${i * template.animation.staggerDelay}ms; opacity: 0; }`
  );
  animations.push(delays.join('\n'));

  // Add glow effect if enabled
  if (template.color.glowEffect) {
    animations.push(`
.shadow-glow { box-shadow: 0 0 20px rgba(var(--color-primary-rgb), 0.3); }
.shadow-glow-lg { box-shadow: 0 0 40px rgba(var(--color-primary-rgb), 0.4); }`);
  }

  return animations.join('\n');
}

/**
 * Build the full template prompt fragment for AI generation
 */
export function buildTemplatePrompt(template: DesignTemplate): string {
  return `
# DESIGN TEMPLATE: ${template.name.toUpperCase()}
${template.description}

## CRITICAL: Follow these design tokens EXACTLY

### TYPOGRAPHY SYSTEM (MANDATORY)
Use these EXACT Tailwind classes:
- Hero headlines: ${template.typography.hero}
- Section headers (H1): ${template.typography.h1}
- Card titles (H2): ${template.typography.h2}
- Subheadings (H3): ${template.typography.h3}
- Body text: ${template.typography.body}
- Small text: ${template.typography.small}
- Line height: ${template.typography.lineHeight}
- Letter spacing: ${template.typography.letterSpacing}

### SPACING RHYTHM (MANDATORY)
- Section padding: ${template.spacing.sectionPadding}
- Element gaps: ${template.spacing.elementGap}
- Container width: ${template.spacing.containerWidth}
- Container padding: ${template.spacing.containerPadding}

### VISUAL ELEMENTS (MANDATORY)
- Border radius: ${template.visual.borderRadius}
- Shadow depth: ${template.visual.shadowDepth}
- Border style: ${template.visual.borderStyle}
- Card classes: ${template.visual.cardStyle}
- Button classes: ${template.visual.buttonStyle}
- Image treatment: ${template.visual.imageStyle}

### ANIMATIONS (MANDATORY)
- Entrance animation: ${template.animation.entranceAnimation}
- Duration: ${template.animation.duration}
- Easing: ${template.animation.easing}
- Stagger delay: ${template.animation.staggerDelay}ms between elements
- Hover effects: ${template.animation.hoverEffect}

### COLOR STRATEGY
- Background mode: ${template.color.backgroundMode.toUpperCase()}
- Hero background: ${template.color.heroBackground}
- Section alternation: ${template.color.sectionAlternation ? 'YES - alternate background colors between sections' : 'NO - consistent background'}
- Accent usage: ${template.color.accentUsage}
- Gradient style: ${template.color.gradientStyle || 'None - use solid colors'}
- Glassmorphism: ${template.color.glassEffect ? 'YES - use backdrop-blur-xl and bg-white/5' : 'NO - do not use blur effects'}
- Glow effects: ${template.color.glowEffect ? 'YES - add shadow-glow on CTAs' : 'NO - standard shadows only'}

### LAYOUT PATTERNS
- Hero layout: ${template.layout.heroLayout}
- Services section: ${template.layout.servicesLayout}
- Testimonials: ${template.layout.testimonialsLayout}
- CTA section: ${template.layout.ctaLayout}
- Navbar style: ${template.layout.navbarStyle}
- Footer style: ${template.layout.footerStyle}

### FONTS
Include this Google Fonts URL in the <head>:
${template.fonts.googleFontsUrl}

Headlines: font-family: '${template.fonts.headlineFont}', sans-serif; ${template.fonts.headlineWeight}
Body: font-family: '${template.fonts.bodyFont}', sans-serif; ${template.fonts.bodyWeight}

### SECTION ORDER
Follow this section order: ${template.sectionOrder.join(' → ')}

## TEMPLATE-SPECIFIC INSTRUCTIONS
${template.promptFragment}

## CSS ANIMATIONS TO INCLUDE
\`\`\`css
${buildAnimationCSS(template)}
\`\`\`
`;
}

/**
 * Build a compact prompt fragment (for token efficiency)
 */
export function buildCompactTemplatePrompt(template: DesignTemplate): string {
  return `
DESIGN: ${template.name} - ${template.description}

TOKENS:
- Typography: hero=${template.typography.hero}, h1=${template.typography.h1}, body=${template.typography.body}
- Spacing: sections=${template.spacing.sectionPadding}, gaps=${template.spacing.elementGap}
- Visual: radius=${template.visual.borderRadius}, shadow=${template.visual.shadowDepth}
- Cards: ${template.visual.cardStyle}
- Buttons: ${template.visual.buttonStyle}
- Colors: mode=${template.color.backgroundMode}, hero=${template.color.heroBackground}
- Glass: ${template.color.glassEffect}, Glow: ${template.color.glowEffect}
- Layout: hero=${template.layout.heroLayout}, nav=${template.layout.navbarStyle}
- Animation: ${template.animation.entranceAnimation} ${template.animation.duration}

STYLE NOTES:
${template.promptFragment}
`;
}

/**
 * Get CSS that should be injected into the generated HTML
 */
export function getTemplateCSS(template: DesignTemplate): string {
  return `
<style>
  /* ${template.name} Template Styles */
  :root {
    --template-radius: ${template.visual.borderRadius.replace('rounded-', '')};
  }

  ${buildAnimationCSS(template)}

  /* Font import */
  ${template.fonts.googleFontsUrl ? `@import url('${template.fonts.googleFontsUrl}');` : ''}

  body {
    font-family: '${template.fonts.bodyFont}', system-ui, sans-serif;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: '${template.fonts.headlineFont}', system-ui, sans-serif;
  }
</style>
`;
}
