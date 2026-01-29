import React, { useState } from 'react';
import { Search, MapPin, Globe, Upload, ArrowRight, Loader2, Sparkles, Scan, Check, AlertTriangle, Star, ExternalLink, RefreshCw, Filter } from 'lucide-react';
import { searchBusiness, analyzeBrand, BusinessResult, SearchStrategy } from '../services/gemini';

interface OnboardingProps {
  onComplete: (analysis: string) => void;
  onSkip: () => void;
}

const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onSkip }) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Data State
  const [businessQuery, setBusinessQuery] = useState('');
  const [strategy, setStrategy] = useState<SearchStrategy>('has_website');
  const [results, setResults] = useState<BusinessResult[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessResult | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessQuery.trim()) return;
    
    setLoading(true);
    setStatusMessage('Scanning Google Maps for leads...');
    
    try {
      const businesses = await searchBusiness(businessQuery, strategy);
      setResults(businesses);
      setStep(2); // Go to selection screen
    } catch (error) {
      console.error(error);
      setStatusMessage('Error scanning maps.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAndAnalyze = async (biz: BusinessResult) => {
    setSelectedBusiness(biz);
    setStep(3);
    setLoading(true);
    setStatusMessage(`Analyzing ${biz.name}...`);
    
    try {
      // Reconstruct summary for the analysis agent
      // We explicitly include the phone number here so the analyzer can put it in the Content Data Sheet
      const summary = `
          Business Name: ${biz.name}
          Address: ${biz.address}
          Phone: ${biz.phoneNumber || 'Not listed'}
          Website: ${biz.website || 'Not found'}
          Rating: ${biz.rating || 'N/A'}
          Description: ${biz.description}
      `;

      // Pass null for logo as we are doing auto-flow
      const analysis = await analyzeBrand(summary, null, biz.website || '');
      onComplete(analysis);
      
    } catch (error) {
      console.error(error);
      onComplete("Could not complete full analysis. Starting with blank canvas.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen w-full bg-[#0f172a] text-white p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[128px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[128px]"></div>
      </div>

      <div className="max-w-4xl w-full z-10">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-xl shadow-blue-900/40 mb-4">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Initialize Project</h1>
          <p className="text-gray-400">Let Gemini map your business and analyze your brand assets.</p>
        </div>

        {/* Card */}
        <div className={`bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-2xl p-8 shadow-2xl transition-all duration-500 flex flex-col justify-center ${step === 2 ? 'min-h-[600px]' : 'min-h-[400px]'}`}>
          
          {/* STEP 1: SEARCH INPUT */}
          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500 max-w-xl mx-auto w-full">
              <div className="flex items-center gap-3 text-blue-400 mb-2">
                <MapPin className="w-5 h-5" />
                <span className="text-sm font-mono uppercase tracking-wider">Step 1: Locate Business</span>
              </div>
              
              <form onSubmit={handleSearch} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Search Area / Business Type</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={businessQuery}
                      onChange={(e) => setBusinessQuery(e.target.value)}
                      placeholder="e.g. Italian Restaurants in Brooklyn, NY"
                      className="w-full bg-gray-950 border border-gray-700 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder-gray-600"
                      autoFocus
                    />
                    <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-500" />
                  </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5 flex items-center gap-2">
                         <Filter className="w-3 h-3 text-blue-400" /> Targeting Strategy
                    </label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                            { id: 'mix', label: 'Mixed Results' },
                            { id: 'no_website', label: 'No Website (Leads)' },
                            { id: 'has_website', label: 'Has Website (Reno)' },
                            { id: 'low_rated', label: 'Low Rated' }
                        ].map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setStrategy(opt.id as SearchStrategy)}
                                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                                    strategy === opt.id 
                                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/50' 
                                    : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                  type="submit"
                  disabled={!businessQuery || loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {statusMessage || 'Scanning Maps...'}
                    </>
                  ) : (
                    <>
                      Find Leads <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
              
              <div className="pt-4 border-t border-gray-800 text-center">
                 <button onClick={onSkip} className="text-sm text-gray-500 hover:text-gray-300 transition-colors">
                    Skip Setup (Blank Canvas)
                 </button>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT RESULT */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500 w-full h-full flex flex-col">
               <div className="flex items-center justify-between mb-4 border-b border-gray-800 pb-4">
                    <div className="flex items-center gap-3 text-green-400">
                        <Check className="w-5 h-5" />
                        <span className="text-sm font-mono uppercase tracking-wider">Step 2: Select Target ({results.length} Found)</span>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => { setResults([]); handleSearch({ preventDefault: () => {} } as any); }} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" /> Refresh
                        </button>
                        <button onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-white">
                            Back to Search
                        </button>
                    </div>
               </div>
               
               <p className="text-sm text-gray-400 mb-2">
                 Select a business to generate a design upgrade. 
                 <span className="text-red-400 ml-2 font-medium">• No Website = Hot Lead</span>
                 <span className="text-blue-400 ml-2 font-medium">• Website = Renovation Candidate</span>
               </p>

               {/* Results Grid - Pagination simulated by scroll */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-2 custom-scrollbar flex-1 min-h-[400px]">
                   {results.length === 0 ? (
                       <div className="col-span-2 text-center py-16 text-gray-500">
                           No results found. Try a different query.
                       </div>
                   ) : (
                       results.map((biz, idx) => {
                           // Determine "Lead Status"
                           const isNoWebsite = !biz.website;
                           const isLowRated = (biz.rating || 5) < 4.0;
                           
                           return (
                           <div 
                             key={idx}
                             className={`group flex flex-col relative w-full bg-gray-950 border rounded-xl transition-all overflow-hidden ${
                                 selectedBusiness?.name === biz.name 
                                 ? 'border-blue-500 ring-1 ring-blue-500' 
                                 : 'border-gray-800 hover:border-gray-600'
                             }`}
                           >
                               <div className="p-4 flex flex-col h-full">
                                   <div className="flex justify-between items-start w-full mb-2">
                                       <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors text-lg line-clamp-1">{biz.name}</h3>
                                       {biz.rating && (
                                           <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium ${isLowRated ? 'bg-yellow-500/10 text-yellow-500' : 'bg-gray-800 text-gray-300'}`}>
                                               <Star className="w-3 h-3 fill-current" />
                                               {biz.rating}
                                               {biz.userRatingCount ? <span className="text-gray-500 ml-1">({biz.userRatingCount})</span> : ''}
                                           </div>
                                       )}
                                   </div>
                                   
                                   <p className="text-sm text-gray-400 mb-3 truncate w-full flex items-center gap-1">
                                     <MapPin className="w-3 h-3 text-gray-600" />
                                     {biz.address}
                                   </p>

                                   <p className="text-xs text-gray-500 mb-4 line-clamp-2 italic">
                                     "{biz.description}"
                                   </p>
                                   
                                   <div className="mt-auto flex items-center justify-between pt-3 border-t border-gray-900">
                                        <div className="flex items-center gap-2">
                                            {isNoWebsite ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wide bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
                                                    <AlertTriangle className="w-3 h-3" /> No Website
                                                </span>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <a 
                                                        href={biz.website!} 
                                                        target="_blank" 
                                                        rel="noreferrer"
                                                        onClick={(e) => e.stopPropagation()} 
                                                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-gray-800 hover:bg-gray-700 text-blue-400 border border-gray-700 transition-colors z-10 relative"
                                                    >
                                                        <Globe className="w-3 h-3" /> Visit <ExternalLink className="w-2.5 h-2.5" />
                                                    </a>
                                                    {isLowRated && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                                            Needs Reno
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <button 
                                            onClick={() => handleSelectAndAnalyze(biz)}
                                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors flex items-center gap-1 shadow-lg shadow-blue-900/20"
                                        >
                                            Generate Vibe <ArrowRight className="w-3 h-3" />
                                        </button>
                                   </div>
                               </div>
                           </div>
                       )})
                   )}
               </div>
            </div>
          )}

          {/* STEP 3: LOADING / ANALYSIS VISUALIZATION */}
          {step === 3 && (
            <div className="py-12 flex flex-col items-center text-center animate-in fade-in zoom-in duration-500 max-w-sm mx-auto">
                <div className="relative w-24 h-24 mb-6">
                    {/* Outer Ring */}
                    <div className="absolute inset-0 border-4 border-gray-800 rounded-full"></div>
                    
                    {/* Spinning Gradient Ring */}
                    <div className="absolute inset-0 border-4 border-t-blue-500 border-r-purple-500 border-b-pink-500 border-l-transparent rounded-full animate-spin duration-1000"></div>
                    
                    {/* Inner Icon */}
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Sparkles className="w-10 h-10 text-white animate-pulse" />
                    </div>
                </div>
                
                <h3 className="text-2xl font-bold text-white mb-3">Synthesizing Vibe</h3>
                
                <div className="bg-gray-950/50 px-6 py-4 rounded-xl border border-gray-800 w-full">
                    <div className="flex flex-col gap-3 text-left">
                         <div className="flex items-center gap-3 text-sm text-green-400">
                             <Check className="w-4 h-4" /> 
                             <span>Target: {selectedBusiness?.name}</span>
                         </div>
                         <div className="flex items-center gap-3 text-sm text-blue-400 animate-pulse">
                             <Globe className="w-4 h-4" /> 
                             <span>Scanning Online Presence...</span>
                         </div>
                         <div className="flex items-center gap-3 text-sm text-purple-400 animate-pulse delay-150">
                             <Scan className="w-4 h-4" /> 
                             <span>Generating Design System...</span>
                         </div>
                    </div>
                </div>
                
                <p className="mt-6 text-xs text-gray-500 font-mono">
                    Powered by Gemini 3 Pro + Google Search
                </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Onboarding;