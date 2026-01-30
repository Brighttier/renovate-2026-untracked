/**
 * Vibe Editor UI Component
 *
 * Surgical, diff-based website editing interface with:
 * - Prompt input with intent classification
 * - Diff viewer with syntax highlighting
 * - Preview pane with before/after comparison
 * - Edit history with undo/redo
 * - Asset upload and AI generation
 */

import React, { useState, useEffect } from 'react';
import { vibeEditorService, VibeEditResponse, EditHistoryItem } from '../services/vibeEditorService';
import { Icons } from './Icons';

// ============================================================================
// TYPES
// ============================================================================

interface VibeEditorUIProps {
  projectId: string;
  userId: string;
  currentHTML: string;
  onHTMLUpdate: (html: string) => void;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const VibeEditorUI: React.FC<VibeEditorUIProps> = ({
  projectId,
  userId,
  currentHTML,
  onHTMLUpdate,
}) => {
  // State
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentEdit, setCurrentEdit] = useState<VibeEditResponse | null>(null);
  const [editHistory, setEditHistory] = useState<EditHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Load edit history on mount
  useEffect(() => {
    loadEditHistory();
  }, [projectId]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const loadEditHistory = async () => {
    const history = await vibeEditorService.getEditHistory(projectId, { limit: 20 });
    setEditHistory(history);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isProcessing) return;

    setIsProcessing(true);
    setCurrentEdit(null);

    try {
      const response = await vibeEditorService.submitEdit(
        projectId,
        userId,
        prompt.trim(),
        currentHTML,
        assetFile ? URL.createObjectURL(assetFile) : undefined
      );

      setCurrentEdit(response);

      if (response.success && response.diff) {
        // Show diff, wait for user to apply
        setShowDiff(true);
      }

      // Reload history
      await loadEditHistory();
    } catch (error) {
      console.error('Failed to submit edit:', error);
      setCurrentEdit({
        success: false,
        error: 'Failed to submit edit. Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyEdit = async () => {
    if (!currentEdit?.editId) return;

    setIsProcessing(true);

    try {
      const result = await vibeEditorService.applyEdit(projectId, currentEdit.editId);

      if (result.success && currentEdit.preview) {
        onHTMLUpdate(currentEdit.preview);
        setPrompt('');
        setCurrentEdit(null);
        setShowDiff(false);
        await loadEditHistory();
      }
    } catch (error) {
      console.error('Failed to apply edit:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectEdit = () => {
    setCurrentEdit(null);
    setShowDiff(false);
    setPrompt('');
  };

  const handleUndo = async (editId: string) => {
    setIsProcessing(true);

    try {
      const result = await vibeEditorService.revertEdit(projectId, editId);

      if (result.success) {
        // Reload current HTML from server
        await loadEditHistory();
      }
    } catch (error) {
      console.error('Failed to undo edit:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAssetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAssetFile(file);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="vibe-editor-container w-full h-full flex flex-col bg-zinc-950 text-white">
      {/* Header */}
      <div className="vibe-header px-6 py-4 border-b border-white/10 backdrop-blur-xl bg-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Vibe Editor</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Surgical, diff-based editing powered by AI
            </p>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium border border-white/10 flex items-center gap-2"
          >
            <Icons.History size={16} />
            History {editHistory.length > 0 && `(${editHistory.length})`}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Prompt & Controls */}
        <div className="w-1/2 flex flex-col border-r border-white/10">
          {/* Prompt Input */}
          <div className="p-6 border-b border-white/10">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  What would you like to change?
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g., Change the navbar background to blue, Add my company logo, Make the hero section pop more..."
                  className="w-full h-32 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                  disabled={isProcessing}
                />
              </div>

              {/* Asset Upload */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Upload Asset (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAssetUpload}
                  className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-500 file:text-white hover:file:bg-emerald-600 cursor-pointer"
                  disabled={isProcessing}
                />
                {assetFile && (
                  <p className="mt-2 text-sm text-zinc-400">
                    Selected: {assetFile.name}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={!prompt.trim() || isProcessing}
                className="w-full py-3 px-6 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-medium hover:from-emerald-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Icons.Sparkles size={18} />
                    Generate Edit
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Intent Classification Result */}
          {currentEdit?.intent && (
            <div className="p-6 border-b border-white/10 bg-white/5">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">
                Intent Classification
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">
                    {vibeEditorService.getIntentIcon(currentEdit.intent.intent_type)}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {currentEdit.intent.intent_type.replace(/_/g, ' ')}
                    </p>
                    {currentEdit.intent.target && (
                      <p className="text-xs text-zinc-400">
                        Target: {currentEdit.intent.target}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400">Confidence:</span>
                  <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${(currentEdit.intent.confidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-white font-medium">
                    {(currentEdit.intent.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                {currentEdit.intent.needs_clarification && currentEdit.intent.clarification_questions && (
                  <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <p className="text-xs font-medium text-amber-400 mb-2">
                      Needs Clarification:
                    </p>
                    <ul className="text-xs text-amber-300 space-y-1">
                      {currentEdit.intent.clarification_questions.map((q, i) => (
                        <li key={i}>• {q}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Validation Results */}
          {currentEdit?.validation && !currentEdit.validation.valid && (
            <div className="p-6 border-b border-white/10 bg-red-500/10">
              <h3 className="text-sm font-medium text-red-400 mb-3">
                Validation Errors
              </h3>
              <div className="space-y-2">
                {currentEdit.validation.errors.slice(0, 5).map((error, i) => (
                  <div key={i} className="text-xs text-red-300 flex items-start gap-2">
                    <span className="text-red-400">•</span>
                    <span>{error.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {currentEdit?.error && (
            <div className="p-6 border-b border-white/10 bg-red-500/10">
              <p className="text-sm text-red-400">{currentEdit.error}</p>
            </div>
          )}

          {/* Metrics */}
          {currentEdit?.cost !== undefined && (
            <div className="p-6 border-t border-white/10 mt-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-zinc-400">Cost</p>
                  <p className="text-sm font-medium text-white">
                    {vibeEditorService.formatCost(currentEdit.cost)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400">Latency</p>
                  <p className="text-sm font-medium text-white">
                    {currentEdit.latency ? vibeEditorService.formatLatency(currentEdit.latency) : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel: Diff & Preview */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {showDiff && currentEdit?.diff ? (
            <>
              {/* Diff Viewer */}
              <div className="flex-1 overflow-auto p-6">
                <h3 className="text-sm font-medium text-zinc-300 mb-3">
                  Changes Preview
                </h3>
                <DiffViewer diff={currentEdit.diff} />
              </div>

              {/* Apply/Reject Buttons */}
              <div className="p-6 border-t border-white/10 bg-white/5">
                <div className="flex gap-3">
                  <button
                    onClick={handleApplyEdit}
                    disabled={isProcessing}
                    className="flex-1 py-3 px-6 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Icons.Check size={18} />
                    Apply Changes
                  </button>
                  <button
                    onClick={handleRejectEdit}
                    disabled={isProcessing}
                    className="flex-1 py-3 px-6 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors border border-white/10 flex items-center justify-center gap-2"
                  >
                    <Icons.X size={18} />
                    Reject
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500">
              <div className="text-center">
                <Icons.Code size={48} className="mx-auto mb-4 opacity-50" />
                <p className="text-sm">No changes to preview</p>
                <p className="text-xs mt-1">Submit a prompt to see diff</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* History Sidebar (Overlay) */}
      {showHistory && (
        <div className="absolute inset-y-0 right-0 w-96 bg-zinc-900 border-l border-white/10 shadow-2xl z-50 flex flex-col">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Edit History</h3>
            <button
              onClick={() => setShowHistory(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <Icons.X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-auto p-6 space-y-3">
            {editHistory.length === 0 ? (
              <div className="text-center text-zinc-500 py-12">
                <p className="text-sm">No edit history yet</p>
              </div>
            ) : (
              editHistory.map((edit) => (
                <div
                  key={edit.editId}
                  className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium text-white line-clamp-2">
                      {edit.summary}
                    </p>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${vibeEditorService.getStatusColor(
                        edit.status
                      )} bg-current/10`}
                    >
                      {vibeEditorService.getStatusLabel(edit.status)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 mb-3">
                    {new Date(edit.timestamp).toLocaleString()}
                  </p>
                  {edit.status === 'applied' && (
                    <button
                      onClick={() => handleUndo(edit.editId)}
                      disabled={isProcessing}
                      className="text-xs text-zinc-400 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <Icons.Undo size={14} />
                      Undo
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// DIFF VIEWER COMPONENT
// ============================================================================

const DiffViewer: React.FC<{ diff: string }> = ({ diff }) => {
  const lines = diff.split('\n');

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/10 overflow-hidden">
      <div className="p-4 bg-white/5 border-b border-white/10">
        <p className="text-xs font-mono text-zinc-400">Unified Diff Format</p>
      </div>
      <div className="p-4 font-mono text-xs overflow-x-auto">
        {lines.map((line, i) => {
          let bgColor = '';
          let textColor = 'text-zinc-300';

          if (line.startsWith('+') && !line.startsWith('+++')) {
            bgColor = 'bg-emerald-500/10';
            textColor = 'text-emerald-400';
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            bgColor = 'bg-red-500/10';
            textColor = 'text-red-400';
          } else if (line.startsWith('@@')) {
            bgColor = 'bg-blue-500/10';
            textColor = 'text-blue-400';
          }

          return (
            <div key={i} className={`${bgColor} ${textColor} py-0.5 px-2`}>
              {line || ' '}
            </div>
          );
        })}
      </div>
    </div>
  );
};
