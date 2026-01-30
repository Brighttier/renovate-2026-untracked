"use strict";
/**
 * Vibe Editor Cloud Functions
 *
 * Main orchestration layer for the surgical diff-based editing system.
 * Per ENTERPRISE_ARCHITECTURE.md: Zero-hallucination, reversible edits.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getErrorLogsFn = exports.getMetrics = exports.generateImageFn = exports.uploadAssetFn = exports.reindexProject = exports.getProjectIndexFn = exports.getEditHistory = exports.revertEdit = exports.applyEdit = exports.submitEdit = void 0;
const https_1 = require("firebase-functions/v2/https");
const intentParser_1 = require("./intentParser");
const projectIndexer_1 = require("./projectIndexer");
const contextSelector_1 = require("./contextSelector");
const editGenerator_1 = require("./editGenerator");
const validator_1 = require("./validator");
const database_1 = require("./database");
const assetService_1 = require("./assetService");
// ============================================================================
// MAIN EDIT SUBMISSION FUNCTION
// ============================================================================
exports.submitEdit = (0, https_1.onCall)(async (request) => {
    try {
        const { projectId, userId, prompt, html } = request.data;
        if (!projectId || !userId || !prompt || !html) {
            throw new https_1.HttpsError('invalid-argument', 'Missing required fields');
        }
        // 1. Get or build project index
        let projectIndex = await (0, projectIndexer_1.getProjectIndex)(projectId);
        if (!projectIndex) {
            projectIndex = await (0, projectIndexer_1.buildProjectIndex)(html, projectId);
            await (0, projectIndexer_1.saveProjectIndex)(projectIndex);
        }
        // 2. Parse intent (Gemini 3 Flash)
        const intent = await (0, intentParser_1.parseIntent)(prompt);
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
        const context = (0, contextSelector_1.selectContext)(intent, projectIndex);
        if (context.components.length === 0) {
            throw new https_1.HttpsError('not-found', 'No relevant components found for this edit');
        }
        // 5. Prepare asset URLs if needed (placeholder for now)
        const assetUrls = {};
        if (intent.requires_asset && request.data.assetUrl) {
            assetUrls[intent.asset_type || 'asset'] = request.data.assetUrl;
        }
        // 6. Generate edit (Gemini 3 Pro)
        const editResult = await (0, editGenerator_1.generateEdit)({
            intent,
            context,
            originalPrompt: prompt,
            assetUrls,
        });
        if (!editResult.success) {
            // Log error
            await (0, database_1.logError)(projectId, userId, 'edit_generation_failed', editResult.error || 'Unknown error', prompt);
            // Update metrics
            await (0, database_1.updateMetrics)(editResult);
            return {
                success: false,
                error: editResult.error,
                retryCount: editResult.retryCount,
            };
        }
        // 7. Validate edit (apply diff to get modified HTML)
        const modifiedHTML = applyDiffToHTML(projectIndex.html, editResult.diff);
        const validation = (0, validator_1.validateEdit)(modifiedHTML);
        if (!validation.valid) {
            // Validation failed - retry with error context (not implemented yet)
            const errorMessages = validation.errors.map(e => e.message).join(', ');
            await (0, database_1.logError)(projectId, userId, 'validation_failed', errorMessages, prompt);
            editResult.error = 'Validation failed: ' + errorMessages;
            editResult.success = false;
            await (0, database_1.updateMetrics)(editResult);
            return {
                success: false,
                error: errorMessages,
                validation,
            };
        }
        // 8. Save edit to history
        const editId = await (0, database_1.saveEdit)(projectId, userId, intent, prompt, editResult);
        // 9. Update metrics
        await (0, database_1.updateMetrics)(editResult);
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
    }
    catch (error) {
        console.error('submitEdit error:', error);
        if (error instanceof https_1.HttpsError) {
            throw error;
        }
        throw new https_1.HttpsError('internal', error.message);
    }
});
// ============================================================================
// EDIT HISTORY MANAGEMENT
// ============================================================================
exports.applyEdit = (0, https_1.onCall)(async (request) => {
    try {
        const { projectId, editId } = request.data;
        if (!projectId || !editId) {
            throw new https_1.HttpsError('invalid-argument', 'Missing projectId or editId');
        }
        // Update edit status to 'applied'
        await (0, database_1.updateEditStatus)(projectId, editId, 'applied');
        return { success: true };
    }
    catch (error) {
        console.error('applyEdit error:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
exports.revertEdit = (0, https_1.onCall)(async (request) => {
    try {
        const { projectId, editId } = request.data;
        if (!projectId || !editId) {
            throw new https_1.HttpsError('invalid-argument', 'Missing projectId or editId');
        }
        // Update edit status to 'reverted'
        await (0, database_1.updateEditStatus)(projectId, editId, 'reverted');
        return { success: true };
    }
    catch (error) {
        console.error('revertEdit error:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
exports.getEditHistory = (0, https_1.onCall)(async (request) => {
    try {
        const { projectId, limit } = request.data;
        if (!projectId) {
            throw new https_1.HttpsError('invalid-argument', 'Missing projectId');
        }
        const edits = await (0, database_1.getEditHistory)(projectId, limit || 20);
        return { success: true, edits };
    }
    catch (error) {
        console.error('getEditHistory error:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
// ============================================================================
// PROJECT INDEXING
// ============================================================================
exports.getProjectIndexFn = (0, https_1.onCall)(async (request) => {
    try {
        const { projectId } = request.data;
        if (!projectId) {
            throw new https_1.HttpsError('invalid-argument', 'Missing projectId');
        }
        const index = await (0, projectIndexer_1.getProjectIndex)(projectId);
        if (!index) {
            return { success: false, error: 'Project index not found' };
        }
        return { success: true, index };
    }
    catch (error) {
        console.error('getProjectIndexFn error:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
exports.reindexProject = (0, https_1.onCall)(async (request) => {
    try {
        const { projectId, html } = request.data;
        if (!projectId || !html) {
            throw new https_1.HttpsError('invalid-argument', 'Missing projectId or html');
        }
        const index = await (0, projectIndexer_1.buildProjectIndex)(html, projectId);
        await (0, projectIndexer_1.saveProjectIndex)(index);
        return { success: true, index };
    }
    catch (error) {
        console.error('reindexProject error:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
// ============================================================================
// ASSET MANAGEMENT
// ============================================================================
exports.uploadAssetFn = (0, https_1.onCall)(async (request) => {
    try {
        const { projectId, userId, base64, filename, mimeType, type } = request.data;
        if (!projectId || !userId || !base64 || !filename || !mimeType || !type) {
            throw new https_1.HttpsError('invalid-argument', 'Missing required asset fields');
        }
        const result = await (0, assetService_1.uploadAsset)({
            projectId,
            userId,
            base64,
            filename,
            mimeType,
            type,
        });
        return result;
    }
    catch (error) {
        console.error('uploadAssetFn error:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
exports.generateImageFn = (0, https_1.onCall)(async (request) => {
    try {
        const { prompt, type, projectId, userId } = request.data;
        if (!prompt || !type || !projectId || !userId) {
            throw new https_1.HttpsError('invalid-argument', 'Missing required image generation fields');
        }
        const result = await (0, assetService_1.generateImage)({
            prompt,
            type,
            projectId,
            userId,
        });
        return result;
    }
    catch (error) {
        console.error('generateImageFn error:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
// ============================================================================
// ADMIN & METRICS
// ============================================================================
exports.getMetrics = (0, https_1.onCall)(async (request) => {
    try {
        const metrics = await (0, database_1.getMetrics)();
        return { success: true, metrics };
    }
    catch (error) {
        console.error('getMetrics error:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
exports.getErrorLogsFn = (0, https_1.onCall)(async (request) => {
    try {
        const { limit } = request.data;
        const errors = await (0, database_1.getErrorLogs)(limit || 50);
        return { success: true, errors };
    }
    catch (error) {
        console.error('getErrorLogsFn error:', error);
        throw new https_1.HttpsError('internal', error.message);
    }
});
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
function applyDiffToHTML(originalHTML, diff) {
    // Simple placeholder implementation
    // In production, use a proper diff parser and patch library
    // For now, just return the original HTML
    // This should be replaced with actual diff application logic
    return originalHTML;
}
//# sourceMappingURL=index.js.map