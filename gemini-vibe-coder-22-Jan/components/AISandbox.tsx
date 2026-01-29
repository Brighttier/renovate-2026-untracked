import React, { useEffect, useState, useRef } from 'react';
import { Loader2, RefreshCw, Code, Eye, History, RotateCcw, X, Check, MousePointer2, Rocket, ExternalLink } from 'lucide-react';
import { Version, DeploymentStatus } from '../types';
import { generateImage } from '../services/gemini';

interface AISandboxProps {
  aiGeneratedCode: string;
  isUpdating: boolean;
  versions?: Version[];
  currentVersionId?: string | null;
  onRevert?: (version: Version) => void;
  onDeploy?: () => void;
  deploymentStatus?: DeploymentStatus;
}

const AISandbox: React.FC<AISandboxProps> = ({ 
  aiGeneratedCode, 
  isUpdating,
  versions = [],
  currentVersionId,
  onRevert,
  onDeploy,
  deploymentStatus
}) => {
  const [srcDoc, setSrcDoc] = useState('');
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [showHistory, setShowHistory] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
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

  // Image Hydration Logic & SrcDoc Generation
  useEffect(() => {
    if (!aiGeneratedCode) return;

    let hydratedCode = aiGeneratedCode;

    // 1. Find all data-prompt attributes
    const promptRegex = /data-prompt="([^"]+)"/g;
    let match;
    const foundPrompts: string[] = [];
    
    while ((match = promptRegex.exec(aiGeneratedCode)) !== null) {
      foundPrompts.push(match[1]);
    }

    // 2. Trigger generation for missing images
    foundPrompts.forEach(prompt => {
      if (!generatedImages[prompt] && !processingPrompts.current.has(prompt)) {
        processingPrompts.current.add(prompt);
        console.log("Generating image for prompt:", prompt);
        
        generateImage(prompt).then((base64Url) => {
          if (base64Url) {
            setGeneratedImages(prev => ({ ...prev, [prompt]: base64Url }));
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

    // We wrap the AI's code in a professional shell with Tailwind CSS 4.0
    // And inject the Editor Script for selection mode
    const blob = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://cdn.tailwindcss.com"></script>
          <script src="https://unpkg.com/framer-motion@10.16.4/dist/framer-motion.js"></script>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
          <style>
            body { 
              margin: 0; 
              padding: 0; 
              font-family: 'Inter', sans-serif; 
              overflow-x: hidden; 
            }
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }

            /* Vibe Editor Selection Styles */
            .vibe-editor-hover {
                outline: 2px dashed #60a5fa !important;
                background-color: rgba(96, 165, 250, 0.1) !important;
                cursor: crosshair !important;
            }
            .vibe-editor-selected {
                outline: 2px solid #2563eb !important;
            }
            .vibe-editor-selected::after {
                content: "Selected";
                position: absolute;
                top: 0;
                right: 0;
                transform: translateY(-100%);
                background: #2563eb;
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
        </head>
        <body>
          <div id="root">${hydratedCode}</div>
        </body>
      </html>
    `;
    setSrcDoc(blob);
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
        newWindow.document.title = "Vibe Coder Preview";
        newWindow.document.close();
    }
  };

  if (!aiGeneratedCode) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400">
        <div className="w-16 h-16 mb-4 rounded-xl bg-gray-200 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
        </div>
        <p className="font-mono text-sm">Waiting for generation...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 z-20 relative">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <div className="w-3 h-3 rounded-full bg-green-400"></div>
          </div>
          
          <div className="h-4 w-px bg-gray-300 mx-2"></div>

          {/* View Toggle */}
          <div className="flex bg-gray-200 rounded-lg p-1">
            <button
                onClick={() => setViewMode('preview')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'preview' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                <Eye className="w-3 h-3" />
                Preview
            </button>
            <button
                onClick={() => setViewMode('code')}
                className={`flex items-center gap-2 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'code' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
                <Code className="w-3 h-3" />
                Code
            </button>
          </div>

          {/* Component Selection Tool */}
          <button 
            onClick={() => setIsSelectionMode(!isSelectionMode)}
            className={`p-1.5 rounded-md transition-all ${
                isSelectionMode 
                    ? 'bg-blue-100 text-blue-600 ring-2 ring-blue-500 ring-offset-1' 
                    : 'text-gray-400 hover:bg-gray-200 hover:text-gray-600'
            }`}
            title={isSelectionMode ? "Exit Selection Mode" : "Select Component to Edit"}
          >
            <MousePointer2 className="w-4 h-4" />
          </button>

          {/* Popout Button */}
          <button
            onClick={handlePopout}
            className="p-1.5 rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-all"
            title="Open in New Tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3">
             {/* Status Indicator (Compact) */}
             {isUpdating && (
                <div className="flex items-center gap-2 mr-2">
                    <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                    <span className="text-xs font-mono text-gray-400">Generating...</span>
                </div>
             )}

            {/* History Toggle */}
            <button 
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-xs font-medium ${
                    showHistory 
                        ? 'bg-blue-50 border-blue-200 text-blue-600' 
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
            >
                <History className="w-3 h-3" />
                History
                <span className="bg-gray-100 text-gray-500 px-1.5 rounded-md text-[10px] border border-gray-200">
                    {versions.length}
                </span>
            </button>

            {/* Launch Button */}
            {onDeploy && (
                <button
                    onClick={onDeploy}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium shadow-sm transition-colors"
                >
                    <Rocket className="w-3 h-3" />
                    Launch
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
                    ref={iframeRef}
                    title="AI Preview"
                    srcDoc={srcDoc}
                    onLoad={handleIframeLoad}
                    sandbox="allow-scripts allow-modals" 
                    className={`w-full h-full border-none`}
                />
             ) : (
                 <div className="w-full h-full overflow-auto bg-[#1e293b] p-6 text-sm font-mono text-blue-100">
                     <pre className="whitespace-pre-wrap font-mono">{aiGeneratedCode}</pre>
                 </div>
             )}
             
             {/* Selection Mode Overlay Hint */}
             {isSelectionMode && viewMode === 'preview' && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600/90 backdrop-blur text-white px-4 py-2 rounded-full text-xs font-medium shadow-lg z-30 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 pointer-events-none">
                    <MousePointer2 className="w-3 h-3" />
                    Hover to highlight, Click to select
                </div>
             )}
            
            {/* Loading Overlay */}
            {isUpdating && viewMode === 'preview' && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10 transition-opacity duration-300">
                <div className="bg-white px-4 py-2 rounded-full shadow-lg border border-gray-100 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm font-medium text-gray-700">Refining Vibe...</span>
                </div>
            </div>
            )}
        </div>

        {/* History Sidebar */}
        <div 
            className={`absolute right-0 top-0 h-full bg-white border-l border-gray-200 shadow-xl transition-all duration-300 transform z-30 ${
                showHistory ? 'translate-x-0 w-80' : 'translate-x-full w-80'
            }`}
        >
            <div className="h-full flex flex-col">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
                    <h3 className="font-medium text-sm text-gray-700">Version History</h3>
                    <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {versions.map((version) => {
                        const isCurrent = version.id === currentVersionId;
                        return (
                            <div 
                                key={version.id}
                                className={`group p-3 rounded-lg border text-left transition-all ${
                                    isCurrent 
                                        ? 'bg-blue-50 border-blue-200 shadow-sm' 
                                        : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'
                                }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-mono text-gray-400">
                                        {new Date(version.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>
                                    {isCurrent && (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 rounded">
                                            <Check className="w-3 h-3" /> Active
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-700 line-clamp-2 mb-3 font-medium">
                                    "{version.prompt}"
                                </p>
                                {!isCurrent && onRevert && (
                                    <button 
                                        onClick={() => onRevert(version)}
                                        className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-medium transition-colors"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        Restore this version
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    {versions.length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-xs">
                            No history available yet.
                        </div>
                    )}
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default AISandbox;