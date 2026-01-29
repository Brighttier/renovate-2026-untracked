import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from './Icons';
import { AIEditorVersion, AIDeploymentStatus } from '../types';
import { generateAIImage, generateVibeImage } from '../services/geminiService';

interface AISandboxProps {
  aiGeneratedCode: string;
  isUpdating: boolean;
  versions?: AIEditorVersion[];
  currentVersionId?: string | null;
  onRevert?: (version: AIEditorVersion) => void;
  onDeploy?: () => void;
  deploymentStatus?: AIDeploymentStatus;
  isSelectionMode?: boolean;
  onSelectionModeToggle?: (enabled: boolean) => void;
  onElementSelected?: (tagName: string) => void;
}

const AISandbox: React.FC<AISandboxProps> = ({
  aiGeneratedCode,
  isUpdating,
  versions = [],
  currentVersionId,
  onRevert,
  onDeploy,
  deploymentStatus,
  isSelectionMode = false,
  onSelectionModeToggle,
  onElementSelected
}) => {
  const [srcDoc, setSrcDoc] = useState('');
  const [iframeKey, setIframeKey] = useState(0); // Force iframe refresh
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [showHistory, setShowHistory] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<Record<string, string>>({});
  const processingPrompts = useRef<Set<string>>(new Set());
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Sync Selection Mode state with iframe when it changes
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: 'TOGGLE_SELECTION_MODE',
        enabled: isSelectionMode
      }, '*');
    }
  }, [isSelectionMode]);

  // Listen for element selection from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'ELEMENT_SELECTED' && onElementSelected) {
        onElementSelected(event.data.tagName);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onElementSelected]);

  // Image Hydration Logic & SrcDoc Generation
  useEffect(() => {
    if (!aiGeneratedCode) return;

    // Debug: Log what we're receiving
    console.log('[AISandbox] Received code length:', aiGeneratedCode.length);
    console.log('[AISandbox] First 200 chars:', aiGeneratedCode.substring(0, 200));
    console.log('[AISandbox] Contains base64 image data:', aiGeneratedCode.includes('data:image'));
    console.log('[AISandbox] Base64 image count:', (aiGeneratedCode.match(/data:image/g) || []).length);

    let hydratedCode = aiGeneratedCode;

    // 1. Find all data-prompt attributes
    const promptRegex = /data-prompt="([^"]+)"/g;
    let match;
    const foundPrompts: string[] = [];

    while ((match = promptRegex.exec(aiGeneratedCode)) !== null) {
      foundPrompts.push(match[1]);
    }

    // 2. Trigger generation for missing images using Vibe Coder image generator
    foundPrompts.forEach(prompt => {
      if (!generatedImages[prompt] && !processingPrompts.current.has(prompt)) {
        processingPrompts.current.add(prompt);
        console.log("[VibeCoder] Generating image for prompt:", prompt);

        // Use Vibe Coder image generation (with photorealistic enhancement)
        generateVibeImage(prompt).then((base64Url) => {
          if (base64Url) {
            console.log("[VibeCoder] Image generated successfully for:", prompt.substring(0, 50));
            setGeneratedImages(prev => ({ ...prev, [prompt]: base64Url }));
          } else {
            // Fallback to legacy generateAIImage
            console.log("[VibeCoder] Falling back to legacy image generation");
            return generateAIImage(prompt);
          }
        }).then((fallbackUrl) => {
          if (fallbackUrl && typeof fallbackUrl === 'string' && !generatedImages[prompt]) {
            setGeneratedImages(prev => ({ ...prev, [prompt]: fallbackUrl }));
          }
          processingPrompts.current.delete(prompt);
        }).catch(() => {
           processingPrompts.current.delete(prompt);
        });
      }
    });

    // 3. Replace src in the code with generated images
    Object.entries(generatedImages).forEach(([prompt, url]) => {
      const regex = new RegExp(`(<img[^>]*?)data-prompt="${escapeRegExp(prompt)}"[^>]*?>`, 'g');
      hydratedCode = hydratedCode.replace(regex, (fullTag) => {
         return fullTag.replace(/src="[^"]*"/, `src="${url}"`);
      });
    });

    // Check if the code is already a complete HTML document
    const isCompleteDocument = hydratedCode.trim().toLowerCase().startsWith('<!doctype') ||
                               hydratedCode.trim().toLowerCase().startsWith('<html');

    // Vibe Editor selection mode script (injected into all documents)
    const vibeEditorScript = `
      <style>
        /* Vibe Editor Selection Styles */
        .vibe-editor-hover {
            outline: 2px dashed #9B8CF7 !important;
            background-color: rgba(155, 140, 247, 0.1) !important;
            cursor: crosshair !important;
        }
        .vibe-editor-selected {
            outline: 2px solid #9B8CF7 !important;
        }
        .vibe-editor-selected::after {
            content: "Selected";
            position: absolute;
            top: 0;
            right: 0;
            transform: translateY(-100%);
            background: #9B8CF7;
            color: white;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px 4px 0 0;
            z-index: 1000;
            pointer-events: none;
        }
      </style>
      <script>
         window.__VIBE_SELECTION_MODE = false;

         window.addEventListener('message', (e) => {
            if(e.data.type === 'TOGGLE_SELECTION_MODE') {
                window.__VIBE_SELECTION_MODE = e.data.enabled;
                if(!e.data.enabled) {
                    document.querySelectorAll('.vibe-editor-hover').forEach(el => el.classList.remove('vibe-editor-hover'));
                    document.querySelectorAll('.vibe-editor-selected').forEach(el => el.classList.remove('vibe-editor-selected'));
                }
            }
         });

         document.addEventListener('mouseover', (e) => {
            if(!window.__VIBE_SELECTION_MODE) return;
            e.stopPropagation();
            e.target.classList.add('vibe-editor-hover');
         }, true);

         document.addEventListener('mouseout', (e) => {
            if(!window.__VIBE_SELECTION_MODE) return;
            e.stopPropagation();
            e.target.classList.remove('vibe-editor-hover');
         }, true);

         document.addEventListener('click', (e) => {
            if(!window.__VIBE_SELECTION_MODE) return;
            e.preventDefault();
            e.stopPropagation();

            // Clear previous selection
            document.querySelectorAll('.vibe-editor-selected').forEach(el => el.classList.remove('vibe-editor-selected'));

            // Select clicked element
            e.target.classList.add('vibe-editor-selected');

            // Send info to parent
            window.parent.postMessage({ type: 'ELEMENT_SELECTED', tagName: e.target.tagName.toLowerCase() }, '*');
         }, true);
      </script>
    `;

    let blob: string;

    if (isCompleteDocument) {
      // The code is already a complete HTML document
      // Inject the Vibe Editor script before </head> or at the start of <body>
      if (hydratedCode.includes('</head>')) {
        blob = hydratedCode.replace('</head>', `${vibeEditorScript}</head>`);
      } else if (hydratedCode.includes('<body')) {
        blob = hydratedCode.replace(/<body([^>]*)>/i, `<body$1>${vibeEditorScript}`);
      } else {
        // Fallback: prepend the script
        blob = vibeEditorScript + hydratedCode;
      }
    } else {
      // Wrap fragment in a professional shell with Tailwind CSS 4.0
      blob = `
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.tailwindcss.com"></script>
            <script src="https://cdn.jsdelivr.net/npm/motion@11.15.0/dist/motion.min.js"></script>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
            <script>
              // Polyfill for Motion library - prevents errors if Motion doesn't load
              window.Motion = window.Motion || {
                animate: function(el, props, opts) {
                  if (el && props) Object.assign(el.style, props);
                  return { finished: Promise.resolve() };
                },
                scroll: function() { return function() {}; },
                inView: function() { return function() {}; },
                timeline: function() { return { play: function(){}, pause: function(){} }; }
              };
            </script>
            <style>
              body {
                margin: 0;
                padding: 0;
                font-family: 'Inter', sans-serif;
                overflow-x: hidden;
              }
              ::-webkit-scrollbar { width: 6px; }
              ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
            </style>
            ${vibeEditorScript}
          </head>
          <body>
            <div id="root">${hydratedCode}</div>
          </body>
        </html>
      `;
    }

    console.log('[AISandbox] isCompleteDocument:', isCompleteDocument);
    console.log('[AISandbox] Final blob length:', blob.length);
    console.log('[AISandbox] Blob first 500 chars:', blob.substring(0, 500));

    setSrcDoc(blob);
    setIframeKey(k => k + 1); // Increment key to force iframe refresh
  }, [aiGeneratedCode, generatedImages]);

  // Helper for regex safety
  function escapeRegExp(string: string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const handleIframeLoad = () => {
     // Re-apply selection mode when iframe reloads (e.g. after code update)
     if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.postMessage({
            type: 'TOGGLE_SELECTION_MODE',
            enabled: isSelectionMode
        }, '*');
     }
  };

  const handlePopout = () => {
    if (!srcDoc) return;
    const newWindow = window.open('', '_blank');
    if (newWindow) {
        newWindow.document.write(srcDoc);
        newWindow.document.title = "RMS Site Preview";
        newWindow.document.close();
    }
  };

  if (!aiGeneratedCode) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#F5F3FF] text-[#6B7280] rounded-2xl">
        <div className="w-16 h-16 mb-4 rounded-xl bg-white flex items-center justify-center border border-[#9B8CF7]/20">
          <Icons.Loader size={32} className="animate-spin text-[#9B8CF7]" />
        </div>
        <p className="font-medium text-sm">Waiting for generation...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-2xl shadow-sm border border-[#9B8CF7]/20 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#F5F3FF] border-b border-[#9B8CF7]/10 z-20 relative">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
          </div>

          <div className="h-4 w-px bg-[#9B8CF7]/20 mx-2"></div>

          {/* View Toggle */}
          <div className="flex bg-white rounded-lg p-1 border border-[#9B8CF7]/10">
            <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'preview' ? 'bg-[#9B8CF7] text-white shadow-sm' : 'text-[#6B7280] hover:text-[#1E1B4B]'
                }`}
            >
                <Icons.Eye size={12} />
                Preview
            </button>
            <button
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'code' ? 'bg-[#9B8CF7] text-white shadow-sm' : 'text-[#6B7280] hover:text-[#1E1B4B]'
                }`}
            >
                <Icons.Code size={12} />
                Code
            </button>
          </div>

          {/* Component Selection Tool */}
          {onSelectionModeToggle && (
            <button
              onClick={() => onSelectionModeToggle(!isSelectionMode)}
              className={`p-1.5 rounded-md transition-all ${
                  isSelectionMode
                      ? 'bg-[#9B8CF7] text-white ring-2 ring-[#9B8CF7] ring-offset-1'
                      : 'text-[#6B7280] hover:bg-white hover:text-[#1E1B4B] border border-transparent hover:border-[#9B8CF7]/20'
              }`}
              title={isSelectionMode ? "Exit Selection Mode" : "Select Component to Edit"}
            >
              <Icons.MousePointer size={16} />
            </button>
          )}

          {/* Popout Button */}
          <button
            onClick={handlePopout}
            className="p-1.5 rounded-md text-[#6B7280] hover:bg-white hover:text-[#1E1B4B] border border-transparent hover:border-[#9B8CF7]/20 transition-all"
            title="Open in New Tab"
          >
            <Icons.ExternalLink size={16} />
          </button>
        </div>

        <div className="flex items-center gap-3">
             {/* Status Indicator (Compact) */}
             {isUpdating && (
                <div className="flex items-center gap-2 mr-2">
                    <Icons.Loader size={12} className="animate-spin text-[#9B8CF7]" />
                    <span className="text-xs font-medium text-[#6B7280]">Generating...</span>
                </div>
             )}

            {/* History Toggle */}
            <button
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ${
                    showHistory
                        ? 'bg-[#9B8CF7] border-[#9B8CF7] text-white'
                        : 'bg-white border-[#9B8CF7]/20 text-[#1E1B4B] hover:bg-[#F5F3FF]'
                }`}
            >
                <Icons.Clock size={12} />
                History
                <span className={`px-1.5 rounded-md text-[10px] ${showHistory ? 'bg-white/20 text-white' : 'bg-[#F5F3FF] text-[#6B7280]'}`}>
                    {versions.length}
                </span>
            </button>

            {/* Launch Button - Made larger and more prominent */}
            {onDeploy && (
                <button
                    onClick={onDeploy}
                    className="group flex items-center gap-3 px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#9B8CF7] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#8B5CF6] text-white text-sm font-semibold shadow-lg shadow-[#9B8CF7]/30 hover:shadow-xl hover:shadow-[#9B8CF7]/40 transition-all duration-300 hover:scale-[1.02] animate-pulse-subtle"
                >
                    <span className="hidden sm:inline">Ready?</span>
                    <span className="w-px h-4 bg-white/30 hidden sm:block"></span>
                    <Icons.Rocket size={16} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    <span>Launch Site</span>
                    <Icons.ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
            )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative flex overflow-hidden">

        {/* Preview / Code View */}
        <div className={`flex-1 relative bg-white h-full overflow-hidden ${isSelectionMode ? 'cursor-crosshair' : ''}`}>
             {viewMode === 'preview' ? (
                 <iframe
                    key={iframeKey}
                    ref={iframeRef}
                    title="AI Preview"
                    srcDoc={srcDoc}
                    onLoad={handleIframeLoad}
                    sandbox="allow-scripts allow-modals"
                    className="w-full h-full border-none"
                />
             ) : (
                 <div className="w-full h-full overflow-auto bg-[#1E1B4B] p-6 text-sm font-mono text-[#F5F3FF]">
                     <pre className="whitespace-pre-wrap font-mono">{aiGeneratedCode}</pre>
                 </div>
             )}

             {/* Selection Mode Overlay Hint */}
             {isSelectionMode && viewMode === 'preview' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#9B8CF7]/90 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-medium shadow-lg z-30 flex items-center gap-2 pointer-events-none">
                    <Icons.MousePointer size={12} />
                    Hover to highlight, Click to select
                </div>
             )}

            {/* Loading Overlay */}
            {isUpdating && viewMode === 'preview' && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 transition-opacity duration-300">
                <div className="bg-white px-4 py-2 rounded-full shadow-lg border border-[#9B8CF7]/20 flex items-center gap-2">
                <Icons.Loader size={16} className="animate-spin text-[#9B8CF7]" />
                <span className="text-sm font-medium text-[#1E1B4B]">Refining Design...</span>
                </div>
            </div>
            )}
        </div>

        {/* History Sidebar */}
        <AnimatePresence>
          {showHistory && (
            <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="h-full bg-white border-l border-[#9B8CF7]/10 shadow-xl overflow-hidden z-30"
            >
                <div className="h-full flex flex-col w-80">
                    <div className="p-4 border-b border-[#9B8CF7]/10 flex items-center justify-between bg-[#F5F3FF]">
                        <h3 className="font-semibold text-sm text-[#1E1B4B]">Version History</h3>
                        <button onClick={() => setShowHistory(false)} className="text-[#6B7280] hover:text-[#1E1B4B]">
                            <Icons.Close size={16} />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {versions.map((version) => {
                            const isCurrent = version.id === currentVersionId;
                            return (
                                <div
                                    key={version.id}
                                    className={`group p-3 rounded-xl border text-left transition-all ${
                                        isCurrent
                                            ? 'bg-[#F5F3FF] border-[#9B8CF7]/30 shadow-sm'
                                            : 'bg-white border-[#9B8CF7]/10 hover:border-[#9B8CF7]/30 hover:shadow-sm'
                                    }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-[10px] font-mono text-[#6B7280]">
                                            {new Date(version.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                        {isCurrent && (
                                            <span className="flex items-center gap-1 text-[10px] font-bold text-[#9B8CF7] bg-white px-1.5 rounded border border-[#9B8CF7]/20">
                                                <Icons.Check size={10} /> Active
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-[#1E1B4B] line-clamp-2 mb-3 font-medium">
                                        "{version.prompt}"
                                    </p>
                                    {!isCurrent && onRevert && (
                                        <button
                                            onClick={() => onRevert(version)}
                                            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#F5F3FF] hover:bg-[#9B8CF7] hover:text-white text-[#1E1B4B] text-xs font-medium transition-colors"
                                        >
                                            <Icons.RotateCcw size={12} />
                                            Restore this version
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                        {versions.length === 0 && (
                            <div className="text-center py-8 text-[#6B7280] text-xs">
                                No history available yet.
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
};

export default AISandbox;
