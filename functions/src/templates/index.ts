/**
 * Design Templates System
 * Re-exports all template-related functions
 */

export {
  DESIGN_TEMPLATES,
  getDesignTemplate,
  getAllTemplateIds,
  getTemplatesForIndustry,
} from './designTemplates';

export {
  autoSelectTemplate,
  getTemplateRecommendations,
  isValidTemplateId,
} from './templateSelector';

export {
  buildTemplatePrompt,
  buildCompactTemplatePrompt,
  getTemplateCSS,
} from './templatePromptBuilder';
