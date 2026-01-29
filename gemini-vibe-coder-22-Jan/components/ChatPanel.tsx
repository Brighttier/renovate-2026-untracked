import React, { useState, useRef, useEffect } from 'react';
import { Send, Rocket, Sparkles, Terminal, Code, Mic, Paperclip, Plus, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Message, DeploymentStatus } from '../types';

interface ChatPanelProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (text: string) => void;
  deploymentStatus: DeploymentStatus;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ 
  messages, 
  isLoading, 
  onSendMessage, 
  deploymentStatus 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
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
    if ((inputValue.trim() || attachments.length > 0) && !isLoading) {
      // In a real app, we would upload the attachments here
      const fullMessage = attachments.length > 0 
        ? `${inputValue}\n[Attached: ${attachments.map(f => f.name).join(', ')}]`
        : inputValue;
        
      onSendMessage(fullMessage);
      setInputValue('');
      setAttachments([]);
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

  // --- File Logic ---
  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setAttachments(prev => [...prev, ...Array.from(e.target.files || [])]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const renderMessageContent = (content: string) => {
    // Simple markdown-like parsing for the thoughts
    if (content.includes('<thought>')) {
        const thoughtMatch = content.match(/<thought>([\s\S]*?)<\/thought>/);
        const thought = thoughtMatch ? thoughtMatch[1] : '';
        const rest = content.replace(/<thought>[\s\S]*?<\/thought>/, '');
        
        return (
            <div className="space-y-2">
                {thought && (
                    <div className="bg-blue-900/20 border-l-2 border-blue-500 p-3 rounded-r text-sm text-blue-200 font-mono">
                        <div className="flex items-center gap-2 mb-1 text-xs uppercase tracking-wider opacity-70">
                            <Sparkles className="w-3 h-3" /> Gemini Thought
                        </div>
                        {thought}
                    </div>
                )}
                {rest && <div className="text-gray-200 whitespace-pre-wrap">{rest}</div>}
            </div>
        );
    }
    return <div className="text-gray-200 whitespace-pre-wrap">{content}</div>;
  };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-white border-r border-gray-800">
      {/* Header */}
      <div className="p-4 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-blue-500 to-purple-500 p-2 rounded-lg">
                <Terminal className="w-5 h-5 text-white" />
            </div>
            <div>
                <h1 className="font-bold text-lg tracking-tight">Vibe Coder</h1>
                <p className="text-xs text-gray-400 font-mono">Gemini 3 Pro Engine</p>
            </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
            <Code className="w-12 h-12 text-gray-500" />
            <div className="max-w-xs text-sm text-gray-400">
              <p className="mb-2">Start by describing your dream website.</p>
              <p className="font-mono text-xs bg-gray-800 p-2 rounded">"Build a site for a high-end Law Firm in New York."</p>
            </div>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-1">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            )}
            
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-gray-800 text-gray-100 rounded-bl-none'
            }`}>
              {renderMessageContent(msg.content)}
            </div>
            
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0 mt-1">
                <div className="text-xs font-bold">YOU</div>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div className="bg-gray-800 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2">
                 <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                 <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                 <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                 <span className="text-xs text-gray-500 font-mono ml-2">Thinking (High)</span>
              </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-[#0f172a] border-t border-gray-800">
        
        {/* Attachment Previews */}
        {attachments.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto pb-2">
                {attachments.map((file, idx) => (
                    <div key={idx} className="relative group bg-gray-800 border border-gray-700 rounded-lg p-2 flex items-center gap-2 pr-8 flex-shrink-0">
                        <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center">
                            <ImageIcon className="w-4 h-4 text-gray-400" />
                        </div>
                        <div className="text-xs">
                            <p className="text-gray-200 font-medium truncate max-w-[100px]">{file.name}</p>
                            <p className="text-gray-500">{(file.size / 1024).toFixed(0)}KB</p>
                        </div>
                        <button 
                            onClick={() => removeAttachment(idx)}
                            className="absolute top-1 right-1 p-1 hover:bg-gray-600 rounded-full text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                ))}
            </div>
        )}

        {/* Deployment Status Bar (Info only) */}
        {deploymentStatus.step !== 'idle' && (
            <div className="mb-4 bg-gray-900 border border-gray-700 rounded-lg p-3 flex items-center gap-3">
                {deploymentStatus.step === 'complete' ? (
                    <div className="flex items-center gap-2 text-green-400">
                        <Rocket className="w-4 h-4" />
                        <span className="text-sm font-medium">Live at:</span>
                        <a href="#" className="text-sm underline hover:text-green-300 font-mono">{deploymentStatus.url}</a>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border-2 border-t-transparent border-blue-500 animate-spin" />
                        <span className="text-sm text-gray-300 font-mono animate-pulse">{deploymentStatus.message}</span>
                    </div>
                )}
            </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <div className={`relative flex items-center gap-2 bg-gray-800 border ${isListening ? 'border-red-500 ring-1 ring-red-500/50' : 'border-gray-700'} rounded-xl px-2 py-2 focus-within:ring-2 focus-within:ring-blue-500 transition-all`}>
                
                {/* Attachment Button */}
                <input 
                    type="file" 
                    multiple 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileChange}
                    accept="image/*"
                />
                <button
                    type="button"
                    onClick={handleFileClick}
                    className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
                    title="Upload Reference Image"
                >
                    <Plus className="w-5 h-5" />
                </button>

                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={isListening ? "Listening..." : (messages.length === 0 ? "Describe your site..." : "Ask for a vibe edit...")}
                    className="flex-1 bg-transparent border-none text-white focus:outline-none placeholder-gray-500 font-light"
                    disabled={isLoading}
                />

                {/* Mic Button */}
                <button
                    type="button"
                    onClick={handleMicClick}
                    className={`p-2 rounded-lg transition-all ${
                        isListening 
                            ? 'text-white bg-red-600 animate-pulse' 
                            : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                    title="Voice Input"
                >
                    {isListening ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Send Button */}
                <button
                    type="submit"
                    disabled={(!inputValue.trim() && attachments.length === 0) || isLoading}
                    className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors shadow-lg shadow-blue-900/20"
                >
                    <Send className="w-4 h-4" />
                </button>
            </div>
        </form>
        <div className="mt-2 text-center">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest">
                Powered by Gemini 3 Pro
            </p>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;