import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Icons } from './Icons';
import { AIEditorMessage, AIEditorMessageAttachment, AIDeploymentStatus } from '../types';

interface AIChatPanelProps {
  messages: AIEditorMessage[];
  isLoading: boolean;
  onSendMessage: (text: string, attachments?: AIEditorMessageAttachment[]) => void;
  deploymentStatus?: AIDeploymentStatus;
  businessName?: string;
  category?: string;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({
  messages,
  isLoading,
  onSendMessage,
  deploymentStatus,
  businessName,
  category
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [attachedImage, setAttachedImage] = useState<AIEditorMessageAttachment | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ref to store the text that was in the input before speaking started
  const baseInputRef = useRef('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((inputValue.trim() || attachedImage) && !isLoading) {
      const attachments = attachedImage ? [attachedImage] : undefined;
      onSendMessage(inputValue, attachments);
      setInputValue('');
      setAttachedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // --- Image Upload Logic ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      alert('Please upload a PNG, JPG, GIF, or WebP image');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      // Extract base64 data without the data: prefix
      const matches = dataUrl.match(/^data:(.+);base64,(.+)$/);
      if (matches) {
        setAttachedImage({
          type: 'image',
          mimeType: matches[1],
          base64Data: matches[2],
          previewUrl: dataUrl,
          fileName: file.name
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // --- Voice Logic ---
  const handleMicClick = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    // Basic browser support check for Web Speech API
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    // Freeze the current input value as the base
    baseInputRef.current = inputValue;

    // @ts-ignore - Typescript doesn't know about webkitSpeechRecognition by default
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true; // Keep listening even if the user pauses
    recognition.interimResults = true; // Show results immediately as they are spoken
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let speechTranscript = '';

      // Reconstruct the full transcript from the current session
      for (let i = 0; i < event.results.length; i++) {
        speechTranscript += event.results[i][0].transcript;
      }

      // Combine the frozen base input with the new speech transcript
      const base = baseInputRef.current;
      // Add a space if we have a base value and the speech doesn't start with one
      const spacer = (base && speechTranscript && !speechTranscript.startsWith(' ')) ? ' ' : '';

      setInputValue(base + spacer + speechTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  const renderMessageContent = (content: string) => {
    // Helper to clean code from text
    const cleanCodeFromText = (text: string): string => {
        let cleaned = text
            .replace(/```[\s\S]*?```/g, '')
            .replace(/\[CODE_UPDATE\][\s\S]*?\[\/CODE_UPDATE\]/g, '')
            .replace(/<!\-\-[\s\S]*?\-\->/g, '')
            .trim();

        // If remaining text looks like HTML/code, replace with generic message
        if (cleaned.includes('<!DOCTYPE') || cleaned.includes('<html') ||
            cleaned.includes('<div class=') || cleaned.includes('tailwind.config') ||
            cleaned.includes('<link rel=') || cleaned.includes('<script')) {
            return "I've made the changes. Check the preview!";
        }
        return cleaned;
    };

    // Handle thought blocks
    if (content.includes('<thought>')) {
        const thoughtMatch = content.match(/<thought>([\s\S]*?)<\/thought>/);
        const thought = thoughtMatch ? thoughtMatch[1] : '';
        let rest = content.replace(/<thought>[\s\S]*?<\/thought>/, '').trim();

        // Clean any code from the response
        rest = cleanCodeFromText(rest);

        return (
            <div className="space-y-2">
                {thought && (
                    <div className="bg-[#9B8CF7]/10 border-l-2 border-[#9B8CF7] p-3 rounded-r text-sm text-[#1E1B4B]">
                        <div className="flex items-center gap-2 mb-1 text-xs uppercase tracking-wider text-[#9B8CF7] font-semibold">
                            <Icons.Sparkles size={12} /> AI Thinking
                        </div>
                        <p className="text-[#6B7280] italic">{thought}</p>
                    </div>
                )}
                {rest && <div className="text-[#1E1B4B]">{rest}</div>}
            </div>
        );
    }

    // Clean code from non-thought responses
    const cleanContent = cleanCodeFromText(content);
    return <div className="text-[#1E1B4B]">{cleanContent}</div>;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white text-[#1E1B4B] border-r border-[#9B8CF7]/10">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-[#9B8CF7]/10 bg-[#F5F3FF]">
        <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-[#9B8CF7] to-[#8B5CF6] p-2.5 rounded-xl">
                <Icons.Sparkles size={20} className="text-white" />
            </div>
            <div>
                <h1 className="font-bold text-lg text-[#1E1B4B]">AI Design Studio</h1>
                <p className="text-xs text-[#6B7280]">
                  {businessName ? `Editing ${businessName}` : 'Gemini 3 Pro Engine'}
                </p>
            </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-12">
            <div className="w-16 h-16 bg-[#F5F3FF] rounded-2xl flex items-center justify-center">
              <Icons.Code size={32} className="text-[#9B8CF7]" />
            </div>
            <div className="max-w-xs text-sm text-[#6B7280]">
              <p className="mb-3">Describe what you want to change or add to your website.</p>
              <div className="space-y-2">
                <p className="bg-[#F5F3FF] p-3 rounded-xl text-[#1E1B4B] text-left text-xs">
                  "Make the hero section more dramatic with a darker background"
                </p>
                <p className="bg-[#F5F3FF] p-3 rounded-xl text-[#1E1B4B] text-left text-xs">
                  "Add a pricing section with 3 plans"
                </p>
                <p className="bg-[#F5F3FF] p-3 rounded-xl text-[#1E1B4B] text-left text-xs">
                  "Change the primary color to blue"
                </p>
              </div>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#9B8CF7] to-[#8B5CF6] flex items-center justify-center flex-shrink-0 mt-1">
                <Icons.Sparkles size={14} className="text-white" />
              </div>
            )}

            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-[#9B8CF7] text-white rounded-br-none'
                : 'bg-[#F5F3FF] text-[#1E1B4B] rounded-bl-none border border-[#9B8CF7]/10'
            }`}>
              {/* Display attached images */}
              {msg.attachments?.map((attachment, attachIdx) => (
                attachment.type === 'image' && (
                  <img
                    key={attachIdx}
                    src={attachment.previewUrl || `data:${attachment.mimeType};base64,${attachment.base64Data}`}
                    alt="Attached"
                    className="max-w-full max-h-32 rounded-lg mb-2 object-contain"
                  />
                )
              ))}
              {msg.role === 'user' ? (
                <div className="text-white whitespace-pre-wrap">{msg.content}</div>
              ) : (
                renderMessageContent(msg.content)
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-[#1E1B4B] flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-[10px] font-bold text-white">YOU</span>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#9B8CF7] to-[#8B5CF6] flex items-center justify-center flex-shrink-0">
                <Icons.Sparkles size={14} className="text-white animate-pulse" />
              </div>
              <div className="bg-[#F5F3FF] rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2 border border-[#9B8CF7]/10">
                 <span className="w-2 h-2 bg-[#9B8CF7] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                 <span className="w-2 h-2 bg-[#9B8CF7] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                 <span className="w-2 h-2 bg-[#9B8CF7] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                 <span className="text-xs text-[#6B7280] ml-2">Designing...</span>
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 bg-[#F5F3FF] border-t border-[#9B8CF7]/10">

        {/* Deployment Status Bar (Info only) */}
        {deploymentStatus && deploymentStatus.step !== 'idle' && (
            <div className="mb-4 bg-white border border-[#9B8CF7]/20 rounded-xl p-3 flex items-center gap-3">
                {deploymentStatus.step === 'complete' ? (
                    <div className="flex items-center gap-2 text-[#9B8CF7]">
                        <Icons.Rocket size={16} />
                        <span className="text-sm font-medium">Live at:</span>
                        <a href={deploymentStatus.url} target="_blank" rel="noreferrer" className="text-sm underline hover:text-[#8B5CF6]">{deploymentStatus.url}</a>
                    </div>
                ) : deploymentStatus.step === 'error' ? (
                    <div className="flex items-center gap-2 text-red-500">
                        <Icons.AlertCircle size={16} />
                        <span className="text-sm">{deploymentStatus.message || 'Deployment failed'}</span>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <Icons.Loader size={16} className="animate-spin text-[#9B8CF7]" />
                        <span className="text-sm text-[#6B7280]">{deploymentStatus.message || 'Deploying...'}</span>
                    </div>
                )}
            </div>
        )}

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* Image Preview (when attached) */}
        {attachedImage && (
          <div className="mb-3 relative group">
            <img
              src={attachedImage.previewUrl}
              alt="Attached"
              className="w-full max-h-32 object-contain rounded-xl border border-[#9B8CF7]/20 bg-white"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              disabled={isLoading}
              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
            >
              <Icons.X size={14} />
            </button>
            <span className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded text-xs text-white truncate max-w-[80%]">
              {attachedImage.fileName}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className={`relative flex items-center gap-2 bg-white border ${isListening ? 'border-red-500 ring-2 ring-red-500/20' : 'border-[#9B8CF7]/20'} rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-[#9B8CF7]/30 transition-all`}>

                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={isListening ? "Listening..." : (messages.length === 0 ? "Describe your changes..." : "Ask for a design edit...")}
                    className="flex-1 bg-transparent border-none text-[#1E1B4B] focus:outline-none placeholder-[#6B7280] text-sm"
                    disabled={isLoading}
                />

                {/* Image Attachment Button */}
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className={`p-2 rounded-lg transition-all ${
                        attachedImage
                            ? 'text-[#9B8CF7] bg-[#9B8CF7]/10'
                            : 'text-[#6B7280] hover:text-[#1E1B4B] hover:bg-[#F5F3FF]'
                    }`}
                    title="Attach Image"
                >
                    <Icons.Image size={18} />
                </button>

                {/* Mic Button */}
                <button
                    type="button"
                    onClick={handleMicClick}
                    className={`p-2 rounded-lg transition-all ${
                        isListening
                            ? 'text-white bg-red-500 animate-pulse'
                            : 'text-[#6B7280] hover:text-[#1E1B4B] hover:bg-[#F5F3FF]'
                    }`}
                    title="Voice Input"
                >
                    {isListening ? <Icons.Loader size={18} className="animate-spin" /> : <Icons.Mic size={18} />}
                </button>

                {/* Send Button */}
                <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
                    className="p-2 bg-[#9B8CF7] hover:bg-[#8B5CF6] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-sm"
                >
                    <Icons.Send size={16} />
                </button>
            </div>
        </form>
        <div className="mt-2 text-center">
            <p className="text-[10px] text-[#6B7280] uppercase tracking-widest">
                Powered by Gemini 3 Pro
            </p>
        </div>
      </div>
    </div>
  );
};

export default AIChatPanel;
