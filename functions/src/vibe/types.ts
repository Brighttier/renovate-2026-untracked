/**
 * Vibe Editor Type Definitions
 */

// ============================================================================
// PROJECT INDEX (Minimal - stores HTML sections as strings)
// ============================================================================

export interface ProjectIndex {
  projectId: string;
  html: string; // Full HTML stored as string
  components: Record<string, ComponentSection>;
  styleSystem: 'tailwind' | 'css';
  lastIndexedAt: string;
}

export interface ComponentSection {
  name: string;
  html: string; // HTML snippet for this section
  startLine?: number;
  endLine?: number;
}

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

export interface IntentClassification {
  intent_type: 'add_logo' | 'replace_logo' | 'update_styles' | 'update_layout' | 'add_section' | 'content_edit' | 'fix_bug';
  target: string | null; // e.g., "navbar", "hero", "footer"
  requires_asset: boolean;
  asset_type?: 'logo' | 'hero' | 'image' | 'icon';
  style_system: 'tailwind' | 'css' | 'unknown';
  scope: 'component' | 'page' | 'global';
  risk: 'low' | 'medium' | 'high';
  needs_clarification: boolean;
}

// ============================================================================
// CONTEXT SELECTION
// ============================================================================

export interface SelectedContext {
  components: Array<{
    name: string;
    html: string;
  }>;
  assetPaths?: string[];
  constraints: string[];
}

// ============================================================================
// EDIT GENERATION
// ============================================================================

export interface EditRequest {
  intent: IntentClassification;
  context: SelectedContext;
  originalPrompt: string;
  assetUrls?: Record<string, string>;
}

export interface EditResult {
  success: boolean;
  diff: string;
  summary: string;
  error?: string;
  retryCount: number;
  tokenCount?: number;
  cost?: number;
  latency?: number;
}

// ============================================================================
// VALIDATION
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  severity: 'critical' | 'error';
  category: 'syntax' | 'security' | 'accessibility' | 'layout';
  message: string;
  line?: number;
}

export interface ValidationWarning {
  category: 'style' | 'performance' | 'best-practice';
  message: string;
}
