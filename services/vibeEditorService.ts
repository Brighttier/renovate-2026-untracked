/**
 * Vibe Editor Service
 *
 * Frontend service for vibe editor operations:
 * - Submit edit prompts
 * - Get edit history
 * - Apply/revert edits
 * - Upload assets
 * - Get project index
 */

import { getFirebaseFunctions } from './firebase';
import { httpsCallable } from 'firebase/functions';

// ============================================================================
// TYPES
// ============================================================================

export interface VibeEditRequest {
  projectId: string;
  prompt: string;
  assetUrl?: string; // For logo/image uploads
}

export interface VibeEditResponse {
  success: boolean;
  editId?: string;
  preview?: string; // HTML preview with changes applied
  validation?: {
    valid: boolean;
    errors: any[];
    warnings: any[];
  };
  intent?: {
    intent_type: string;
    target: string | null;
    confidence: number;
    needs_clarification: boolean;
    clarification_questions?: string[];
  };
  diff?: string;
  cost?: number;
  latency?: number;
  error?: string;
}

export interface EditHistoryItem {
  editId: string;
  timestamp: string;
  prompt: string;
  summary: string;
  status: 'pending' | 'applied' | 'reverted' | 'failed';
  cost?: number;
  latency?: number;
}

export interface ProjectIndexResponse {
  projectId: string;
  framework: string;
  components: string[];
  lastIndexedAt: string;
}

export interface AssetUploadRequest {
  projectId: string;
  file: File;
  type: 'logo' | 'image' | 'icon';
  alt?: string;
}

export interface AssetUploadResponse {
  success: boolean;
  assetId?: string;
  url?: string;
  error?: string;
}

// ============================================================================
// VIBE EDITOR SERVICE
// ============================================================================

class VibeEditorService {
  private getFunctions() {
    const functions = getFirebaseFunctions();
    if (!functions) throw new Error('Firebase Functions not initialized');
    return functions;
  }

  /**
   * Submit edit prompt
   */
  async submitEdit(projectId: string, userId: string, prompt: string, html: string, assetUrl?: string): Promise<VibeEditResponse> {
    try {
      const submitEditFn = httpsCallable<any, any>(
        this.getFunctions(),
        'submitEdit'
      );

      const result = await submitEditFn({ projectId, userId, prompt, html, assetUrl });
      return result.data;
    } catch (error: any) {
      console.error('Failed to submit vibe edit:', error);
      return {
        success: false,
        error: error.message || 'Failed to submit edit',
      };
    }
  }

  /**
   * Get edit history for project
   */
  async getEditHistory(
    projectId: string,
    options?: { limit?: number; status?: string }
  ): Promise<EditHistoryItem[]> {
    try {
      const getHistoryFn = httpsCallable<
        { projectId: string; limit?: number; status?: string },
        { edits: EditHistoryItem[] }
      >(this.getFunctions(), 'getEditHistory');

      const result = await getHistoryFn({ projectId, ...options });
      return result.data.edits;
    } catch (error: any) {
      console.error('Failed to get edit history:', error);
      return [];
    }
  }

  /**
   * Apply edit (commit changes)
   */
  async applyEdit(projectId: string, editId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const applyEditFn = httpsCallable<
        { projectId: string; editId: string },
        { success: boolean; error?: string }
      >(this.getFunctions(), 'applyEdit');

      const result = await applyEditFn({ projectId, editId });
      return result.data;
    } catch (error: any) {
      console.error('Failed to apply edit:', error);
      return {
        success: false,
        error: error.message || 'Failed to apply edit',
      };
    }
  }

  /**
   * Revert edit (undo)
   */
  async revertEdit(projectId: string, editId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const revertEditFn = httpsCallable<
        { projectId: string; editId: string },
        { success: boolean; error?: string }
      >(this.getFunctions(), 'revertEdit');

      const result = await revertEditFn({ projectId, editId });
      return result.data;
    } catch (error: any) {
      console.error('Failed to revert edit:', error);
      return {
        success: false,
        error: error.message || 'Failed to revert edit',
      };
    }
  }

  /**
   * Get project index (component map)
   */
  async getProjectIndex(projectId: string): Promise<ProjectIndexResponse | null> {
    try {
      const getIndexFn = httpsCallable<
        { projectId: string },
        ProjectIndexResponse | null
      >(this.getFunctions(), 'getProjectIndexFn');

      const result = await getIndexFn({ projectId });
      return result.data;
    } catch (error: any) {
      console.error('Failed to get project index:', error);
      return null;
    }
  }

  /**
   * Re-index project (rebuild component map)
   */
  async reindexProject(projectId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const reindexFn = httpsCallable<
        { projectId: string },
        { success: boolean; error?: string }
      >(this.getFunctions(), 'reindexProject');

      const result = await reindexFn({ projectId });
      return result.data;
    } catch (error: any) {
      console.error('Failed to reindex project:', error);
      return {
        success: false,
        error: error.message || 'Failed to reindex project',
      };
    }
  }

  /**
   * Upload asset (logo, image)
   */
  async uploadAsset(request: AssetUploadRequest): Promise<AssetUploadResponse> {
    try {
      // Convert file to base64
      const base64 = await this.fileToBase64(request.file);

      const uploadAssetFn = httpsCallable<
        {
          projectId: string;
          userId: string;
          filename: string;
          base64: string;
          mimeType: string;
          type: string;
          alt?: string;
        },
        AssetUploadResponse
      >(this.getFunctions(), 'uploadAssetFn');

      const result = await uploadAssetFn({
        projectId: request.projectId,
        userId: 'current-user', // TODO: Get from auth context
        filename: request.file.name,
        base64,
        mimeType: request.file.type,
        type: request.type,
        alt: request.alt,
      });

      return result.data;
    } catch (error: any) {
      console.error('Failed to upload asset:', error);
      return {
        success: false,
        error: error.message || 'Failed to upload asset',
      };
    }
  }

  /**
   * Generate AI image (using Nano Banana Pro)
   */
  async generateImage(
    projectId: string,
    prompt: string,
    type: 'logo' | 'image'
  ): Promise<AssetUploadResponse> {
    try {
      const generateImageFn = httpsCallable<
        { projectId: string; userId: string; prompt: string; type: string },
        AssetUploadResponse
      >(this.getFunctions(), 'generateImageFn');

      const result = await generateImageFn({ projectId, userId: 'current-user', prompt, type });
      return result.data;
    } catch (error: any) {
      console.error('Failed to generate image:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate image',
      };
    }
  }

  /**
   * Get vibe editor metrics (admin only)
   */
  async getMetrics(): Promise<{
    totalEdits: number;
    successRate: number;
    avgLatency: number;
    totalCost: number;
    costPerEdit: number;
  } | null> {
    try {
      const getMetricsFn = httpsCallable<
        {},
        {
          totalEdits: number;
          successRate: number;
          avgLatency: number;
          totalCost: number;
          costPerEdit: number;
        }
      >(this.getFunctions(), 'getMetrics');

      const result = await getMetricsFn({});
      return result.data;
    } catch (error: any) {
      console.error('Failed to get metrics:', error);
      return null;
    }
  }

  /**
   * Get error logs (admin only)
   */
  async getErrorLogs(options?: {
    resolved?: boolean;
    limit?: number;
  }): Promise<any[]> {
    try {
      const getErrorLogsFn = httpsCallable<
        { resolved?: boolean; limit?: number },
        { errors: any[] }
      >(this.getFunctions(), 'getErrorLogsFn');

      const result = await getErrorLogsFn(options || {});
      return result.data.errors;
    } catch (error: any) {
      console.error('Failed to get error logs:', error);
      return [];
    }
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  /**
   * Convert File to base64
   */
  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = (error) => reject(error);
    });
  }

  /**
   * Format cost for display
   */
  formatCost(cost: number): string {
    if (cost < 0.01) {
      return `$${(cost * 1000).toFixed(4)}k`; // Show in thousandths of cents
    }
    return `$${cost.toFixed(4)}`;
  }

  /**
   * Format latency for display
   */
  formatLatency(latency: number): string {
    if (latency < 1000) {
      return `${latency.toFixed(0)}ms`;
    }
    return `${(latency / 1000).toFixed(2)}s`;
  }

  /**
   * Parse diff for display
   */
  parseDiff(diff: string): { added: string[]; removed: string[] } {
    const lines = diff.split('\n');
    const added: string[] = [];
    const removed: string[] = [];

    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        added.push(line.substring(1));
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        removed.push(line.substring(1));
      }
    }

    return { added, removed };
  }

  /**
   * Check if user has vibe editor enabled (feature flag)
   */
  isVibeEditorEnabled(user: any): boolean {
    // Check user document for vibeEditorEnabled field
    return user?.vibeEditorEnabled === true;
  }

  /**
   * Get intent icon
   */
  getIntentIcon(intentType: string): string {
    const icons: Record<string, string> = {
      add_logo: '🎨',
      replace_logo: '🔄',
      update_styles: '💅',
      change_colors: '🎨',
      update_layout: '📐',
      add_section: '➕',
      remove_section: '➖',
      content_edit: '✏️',
      update_text: '📝',
      fix_bug: '🐛',
      generate_image: '🖼️',
      add_animation: '✨',
      unknown: '❓',
    };

    return icons[intentType] || '📝';
  }

  /**
   * Get status color
   */
  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      pending: 'text-yellow-500',
      applied: 'text-emerald-500',
      reverted: 'text-zinc-400',
      failed: 'text-red-500',
    };

    return colors[status] || 'text-zinc-500';
  }

  /**
   * Get status label
   */
  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Pending',
      applied: 'Applied',
      reverted: 'Reverted',
      failed: 'Failed',
    };

    return labels[status] || status;
  }
}

// Export singleton instance
export const vibeEditorService = new VibeEditorService();
