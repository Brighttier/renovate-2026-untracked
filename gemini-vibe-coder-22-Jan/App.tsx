import React, { useState, useEffect } from 'react';
import ChatPanel from './components/ChatPanel';
import AISandbox from './components/AISandbox';
import Onboarding from './components/Onboarding';
import { generateSiteUpdate } from './services/gemini';
import { deployToProductionMock } from './services/deploy';
import { Message, DeploymentStatus, Version } from './types';
import { Sparkles, Key, ExternalLink } from 'lucide-react';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentCode, setCurrentCode] = useState<string>('');
  const [deploymentStatus, setDeploymentStatus] = useState<DeploymentStatus>({ step: 'idle' });
  const [hasApiKey, setHasApiKey] = useState(false);
  
  // App Mode State
  const [appMode, setAppMode] = useState<'auth' | 'onboarding' | 'builder'>('auth');
  
  // Version History State
  const [versions, setVersions] = useState<Version[]>([]);
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if ((window as any).aistudio?.hasSelectedApiKey) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (hasKey) {
            setHasApiKey(true);
            setAppMode('onboarding');
        }
      }
    };
    checkKey();
  }, []);

  const handleConnect = async () => {
     if ((window as any).aistudio) {
        await (window as any).aistudio.openSelectKey();
        // Assuming success as per instructions to mitigate race condition
        setHasApiKey(true);
        setAppMode('onboarding');
     }
  };

  const handleOnboardingComplete = (analysisContext: string) => {
    setAppMode('builder');
    // Auto-seed the chat with the analysis
    const initialPrompt = `Create a high-end website based on this Design Brief:\n\n${analysisContext}`;
    handleSendMessage(initialPrompt);
  };

  const handleSkipOnboarding = () => {
    setAppMode('builder');
  };

  const handleSendMessage = async (text: string) => {
    // Add user message
    const userMessage: Message = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Call Gemini Service
      const response = await generateSiteUpdate(messages, text, currentCode);

      // Add Model Message
      const modelMessage: Message = {
        role: 'model',
        content: response.text,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, modelMessage]);

      // Update Sandbox if code was returned
      if (response.code) {
        setCurrentCode(response.code);
        
        // Create new version
        const newVersion: Version = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            prompt: text,
            code: response.code
        };
        
        setVersions(prev => [newVersion, ...prev]);
        setCurrentVersionId(newVersion.id);
      }

    } catch (error) {
      console.error("Failed to generate:", error);
      const errorMessage: Message = {
        role: 'model',
        content: "Sorry, I encountered an error while processing your request.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!currentCode) return;
    
    // Simulate deployment process
    const siteId = `vibe-site-${Math.random().toString(36).substring(7)}`;
    
    try {
      await deployToProductionMock(siteId, (status) => {
        setDeploymentStatus(status);
      });
    } catch (error) {
       setDeploymentStatus({ step: 'error', message: 'Deployment failed.' });
    }
  };

  const handleRevert = (version: Version) => {
    setCurrentCode(version.code);
    setCurrentVersionId(version.id);
  };

  // 1. AUTH SCREEN
  if (appMode === 'auth') {
    return (
      <div className="flex flex-col items-center justify-center h-screen w-full bg-[#0f172a] text-white p-4">
        <div className="max-w-md w-full bg-gray-900 border border-gray-800 rounded-2xl p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto shadow-lg shadow-blue-900/50">
             <Sparkles className="w-8 h-8 text-white" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Vibe Coder Access</h1>
            <p className="text-gray-400">
              To use the Gemini 3 Pro Engine and Nano Banana Pro image generation, you must connect a Google Cloud Project with billing enabled.
            </p>
          </div>

          <button 
            onClick={handleConnect}
            className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-xl font-medium shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Key className="w-4 h-4" />
            Connect API Key
          </button>

          <div className="pt-4 border-t border-gray-800">
             <a 
               href="https://ai.google.dev/gemini-api/docs/billing" 
               target="_blank" 
               rel="noreferrer"
               className="text-xs text-gray-500 hover:text-gray-300 flex items-center justify-center gap-1 transition-colors"
             >
                Learn more about Gemini API Billing <ExternalLink className="w-3 h-3" />
             </a>
          </div>
        </div>
      </div>
    );
  }

  // 2. ONBOARDING SCREEN
  if (appMode === 'onboarding') {
      return <Onboarding onComplete={handleOnboardingComplete} onSkip={handleSkipOnboarding} />;
  }

  // 3. MAIN BUILDER SCREEN
  return (
    <div className="flex h-screen w-full bg-black overflow-hidden">
      {/* Left Panel: Chat Interface */}
      <div className="w-[400px] lg:w-[450px] h-full flex-shrink-0 z-10 shadow-2xl">
        <ChatPanel 
          messages={messages} 
          isLoading={isLoading} 
          onSendMessage={handleSendMessage}
          deploymentStatus={deploymentStatus}
        />
      </div>

      {/* Right Panel: Sandbox Preview */}
      <div className="flex-1 h-full p-4 bg-gray-900">
         <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border border-gray-800 bg-gray-900">
            <AISandbox 
              aiGeneratedCode={currentCode} 
              isUpdating={isLoading && messages.length > 0} 
              versions={versions}
              currentVersionId={currentVersionId}
              onRevert={handleRevert}
              onDeploy={handleDeploy}
              deploymentStatus={deploymentStatus}
            />
         </div>
      </div>
    </div>
  );
}

export default App;