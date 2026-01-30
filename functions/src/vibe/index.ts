/**
 * Vibe Editor Cloud Functions
 *
 * Main orchestration layer for the surgical diff-based editing system.
 * Per ENTERPRISE_ARCHITECTURE.md: Zero-hallucination, reversible edits.
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { parseIntent } from './intentParser';
import { buildProjectIndex, saveProjectIndex, getProjectIndex } from './projectIndexer';
import { selectContext } from './contextSelector';
import { generateEdit } from './editGenerator';
import { validateEdit } from './validator';
import {
  saveEdit,
  getEditHistory as dbGetEditHistory,
  updateEditStatus,
  getMetrics as dbGetMetrics,
  updateMetrics,
  logError as dbLogError,
  getErrorLogs as dbGetErrorLogs
} from './database';
import { uploadAsset, generateImage } from './assetService';

// ============================================================================
// MAIN EDIT SUBMISSION FUNCTION
// ============================================================================

export const submitEdit = onCall(async (request) => {
  try {
    const { projectId, userId, prompt, html } = request.data;

    if (!projectId || !userId || !prompt || !html) {
      throw new HttpsError('invalid-argument', 'Missing required fields');
    }

    // 1. Get or build project index
    let projectIndex = await getProjectIndex(projectId);
    if (!projectIndex) {
      projectIndex = await buildProjectIndex(html, projectId);
      await saveProjectIndex(projectIndex);
    }

    // 2. Parse intent (Gemini 3 Flash)
    const intent = await parseIntent(prompt);

    // 3. Check if clarification needed
    if (intent.needs_clarification) {
      return {
        success: false,
        needsClarification: true,
        intent,
        error: 'Please provide more specific information about what you want to change',
      };
    }

    // 4. Select context (rule-based)
    const context = selectContext(intent, projectIndex);

    if (context.components.length === 0) {
      throw new HttpsError('not-found', 'No relevant components found for this edit');
    }

    // 5. Prepare asset URLs if needed (placeholder for now)
    const assetUrls: Record<string, string> = {};
    if (intent.requires_asset && request.data.assetUrl) {
      assetUrls[intent.asset_type || 'asset'] = request.data.assetUrl;
    }

    // 6. Generate edit (Gemini 3 Pro)
    const editResult = await generateEdit({
      intent,
      context,
      originalPrompt: prompt,
      assetUrls,
    });

    if (!editResult.success) {
      // Log error
      await dbLogError(projectId, userId, 'edit_generation_failed', editResult.error || 'Unknown error', prompt);

      // Update metrics
      await updateMetrics(editResult);

      return {
        success: false,
        error: editResult.error,
        retryCount: editResult.retryCount,
      };
    }

    // 7. Validate edit (apply diff to get modified HTML)
    const modifiedHTML = applyDiffToHTML(projectIndex.html, editResult.diff);
    const validation = validateEdit(modifiedHTML);

    if (!validation.valid) {
      // Validation failed - retry with error context (not implemented yet)
      const errorMessages = validation.errors.map(e => e.message).join(', ');

      await dbLogError(projectId, userId, 'validation_failed', errorMessages, prompt);

      editResult.error = 'Validation failed: ' + errorMessages;
      editResult.success = false;
      await updateMetrics(editResult);

      return {
        success: false,
        error: errorMessages,
        validation,
      };
    }

    // 8. Save edit to history
    const editId = await saveEdit(projectId, userId, intent, prompt, editResult);

    // 9. Update metrics
    await updateMetrics(editResult);

    // 10. Return success
    return {
      success: true,
      editId,
      diff: editResult.diff,
      summary: editResult.summary,
      intent,
      validation,
      warnings: validation.warnings,
    };

  } catch (error) {
    console.error('submitEdit error:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', (error as Error).message);
  }
});

// ============================================================================
// EDIT HISTORY MANAGEMENT
// ============================================================================

export const applyEdit = onCall(async (request) => {
  try {
    const { projectId, editId } = request.data;

    if (!projectId || !editId) {
      throw new HttpsError('invalid-argument', 'Missing projectId or editId');
    }

    // Update edit status to 'applied'
    await updateEditStatus(projectId, editId, 'applied');

    return { success: true };
  } catch (error) {
    console.error('applyEdit error:', error);
    throw new HttpsError('internal', (error as Error).message);
  }
});

export const revertEdit = onCall(async (request) => {
  try {
    const { projectId, editId } = request.data;

    if (!projectId || !editId) {
      throw new HttpsError('invalid-argument', 'Missing projectId or editId');
    }

    // Update edit status to 'reverted'
    await updateEditStatus(projectId, editId, 'reverted');

    return { success: true };
  } catch (error) {
    console.error('revertEdit error:', error);
    throw new HttpsError('internal', (error as Error).message);
  }
});

export const getEditHistory = onCall(async (request) => {
  try {
    const { projectId, limit } = request.data;

    if (!projectId) {
      throw new HttpsError('invalid-argument', 'Missing projectId');
    }

    const edits = await dbGetEditHistory(projectId, limit || 20);

    return { success: true, edits };
  } catch (error) {
    console.error('getEditHistory error:', error);
    throw new HttpsError('internal', (error as Error).message);
  }
});

// ============================================================================
// PROJECT INDEXING
// ============================================================================

export const getProjectIndexFn = onCall(async (request) => {
  try {
    const { projectId } = request.data;

    if (!projectId) {
      throw new HttpsError('invalid-argument', 'Missing projectId');
    }

    const index = await getProjectIndex(projectId);

    if (!index) {
      return { success: false, error: 'Project index not found' };
    }

    return { success: true, index };
  } catch (error) {
    console.error('getProjectIndexFn error:', error);
    throw new HttpsError('internal', (error as Error).message);
  }
});

export const reindexProject = onCall(async (request) => {
  try {
    const { projectId, html } = request.data;

    if (!projectId || !html) {
      throw new HttpsError('invalid-argument', 'Missing projectId or html');
    }

    const index = await buildProjectIndex(html, projectId);
    await saveProjectIndex(index);

    return { success: true, index };
  } catch (error) {
    console.error('reindexProject error:', error);
    throw new HttpsError('internal', (error as Error).message);
  }
});

// ============================================================================
// ASSET MANAGEMENT
// ============================================================================

export const uploadAssetFn = onCall(async (request) => {
  try {
    const { projectId, userId, base64, filename, mimeType, type } = request.data;

    if (!projectId || !userId || !base64 || !filename || !mimeType || !type) {
      throw new HttpsError('invalid-argument', 'Missing required asset fields');
    }

    const result = await uploadAsset({
      projectId,
      userId,
      base64,
      filename,
      mimeType,
      type,
    });

    return result;
  } catch (error) {
    console.error('uploadAssetFn error:', error);
    throw new HttpsError('internal', (error as Error).message);
  }
});

export const generateImageFn = onCall(async (request) => {
  try {
    const { prompt, type, projectId, userId } = request.data;

    if (!prompt || !type || !projectId || !userId) {
      throw new HttpsError('invalid-argument', 'Missing required image generation fields');
    }

    const result = await generateImage({
      prompt,
      type,
      projectId,
      userId,
    });

    return result;
  } catch (error) {
    console.error('generateImageFn error:', error);
    throw new HttpsError('internal', (error as Error).message);
  }
});

// ============================================================================
// ADMIN & METRICS
// ============================================================================

export const getMetrics = onCall(async (request) => {
  try {
    const metrics = await dbGetMetrics();
    return { success: true, metrics };
  } catch (error) {
    console.error('getMetrics error:', error);
    throw new HttpsError('internal', (error as Error).message);
  }
});

export const getErrorLogsFn = onCall(async (request) => {
  try {
    const { limit } = request.data;
    const errors = await dbGetErrorLogs(limit || 50);
    return { success: true, errors };
  } catch (error) {
    console.error('getErrorLogsFn error:', error);
    throw new HttpsError('internal', (error as Error).message);
  }
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function applyDiffToHTML(originalHTML: string, diff: string): string {
  // Simple placeholder implementation
  // In production, use a proper diff parser and patch library

  // For now, just return the original HTML
  // This should be replaced with actual diff application logic
  return originalHTML;
}
