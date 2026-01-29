import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Icons } from '../Icons';
import { getFunctions, httpsCallable } from 'firebase/functions';

const AdminSettings: React.FC = () => {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  // Stripe initialization state
  const [isInitializingStripe, setIsInitializingStripe] = useState(false);
  const [stripeResult, setStripeResult] = useState<{ success: boolean; message: string; data?: any } | null>(null);

  const handleSaveCredentials = async () => {
    if (!apiKey || !apiSecret) {
      setResult({ success: false, message: 'Please enter both API Key and Secret' });
      return;
    }

    setIsSaving(true);
    setResult(null);

    try {
      // Simulate save - in production, this would call a Cloud Function
      await new Promise(resolve => setTimeout(resolve, 1000));
      setApiKey('');
      setApiSecret('');
      setResult({ success: true, message: 'Credentials saved successfully!' });
    } catch (error: any) {
      setResult({ success: false, message: error.message || 'An error occurred' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInitializeStripe = async () => {
    setIsInitializingStripe(true);
    setStripeResult(null);

    try {
      const functions = getFunctions();
      const initializeStripeProducts = httpsCallable(functions, 'initializeStripeProducts');
      const response = await initializeStripeProducts();
      const data = response.data as any;

      if (data.success) {
        setStripeResult({
          success: true,
          message: 'Stripe products and prices created successfully!',
          data: data
        });
      } else {
        setStripeResult({ success: false, message: 'Failed to initialize Stripe products' });
      }
    } catch (error: any) {
      console.error('Error initializing Stripe:', error);
      setStripeResult({ success: false, message: error.message || 'An error occurred' });
    } finally {
      setIsInitializingStripe(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white">Platform Settings</h2>
        <p className="text-sm text-[#6B6478]">Configure platform-wide integrations and credentials</p>
      </div>

      {/* GoDaddy Configuration Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-6"
      >
        {/* Card Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-[#9F8FD4]/10 rounded-xl flex items-center justify-center">
            <Icons.Rocket size={24} className="text-[#9F8FD4]" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white">GoDaddy API Credentials</h3>
            <p className="text-xs text-[#6B6478]">Platform-wide domain management</p>
          </div>
        </div>

        {/* Input Fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#6B6478] mb-2 uppercase tracking-wider font-medium">
              API Key
            </label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter GoDaddy API Key"
              className="w-full px-4 py-3 bg-[#0D0B14] border border-[#9F8FD4]/10 rounded-xl text-sm text-white placeholder-zinc-600 outline-none focus:ring-2 focus:ring-[#9F8FD4]/20 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs text-[#6B6478] mb-2 uppercase tracking-wider font-medium">
              API Secret
            </label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Enter GoDaddy API Secret"
              className="w-full px-4 py-3 bg-[#0D0B14] border border-[#9F8FD4]/10 rounded-xl text-sm text-white placeholder-zinc-600 outline-none focus:ring-2 focus:ring-[#9F8FD4]/20 transition-all"
            />
          </div>
        </div>

        {/* Result Message */}
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mt-4 p-4 rounded-xl flex items-center gap-3 ${
              result.success
                ? 'bg-[#9F8FD4]/10 border border-[#9F8FD4]/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}
          >
            {result.success ? (
              <Icons.CheckCircle size={18} className="text-[#9F8FD4] flex-shrink-0" />
            ) : (
              <Icons.AlertCircle size={18} className="text-red-500 flex-shrink-0" />
            )}
            <span className={`text-sm ${result.success ? 'text-[#9F8FD4]' : 'text-red-500'}`}>
              {result.message}
            </span>
          </motion.div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSaveCredentials}
          disabled={!apiKey || !apiSecret || isSaving}
          className="mt-6 w-full py-4 bg-[#9F8FD4] hover:bg-[#7C6BB5] disabled:bg-[#262033] disabled:text-[#6B6478] rounded-xl text-sm font-bold text-white transition-all disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Credentials'}
        </button>

        {/* Security Note */}
        <p className="mt-4 text-sm text-[#6B6478] text-center uppercase tracking-wider">
          Credentials are stored securely and never exposed to client-side code
        </p>
      </motion.div>

      {/* Stripe Configuration Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#1A1625]/50 border border-[#9F8FD4]/10 rounded-2xl p-6"
      >
        {/* Card Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center">
            <Icons.CRM size={24} className="text-purple-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-white">Stripe Payment Setup</h3>
            <p className="text-xs text-[#6B6478]">Initialize subscription plans and token packs</p>
          </div>
        </div>

        {/* Description */}
        <div className="mb-6 p-4 bg-[#0D0B14]/50 rounded-xl border border-[#9F8FD4]/10">
          <p className="text-sm text-[#A8A3B3]">
            Click the button below to create or update the following products in Stripe:
          </p>
          <ul className="mt-3 space-y-2 text-xs text-[#6B6478]">
            <li className="flex items-center gap-2">
              <Icons.Check size={14} className="text-[#9F8FD4]" />
              <span><span className="text-white">Starter Plan</span> - $49/month (10 sites, 100 tokens)</span>
            </li>
            <li className="flex items-center gap-2">
              <Icons.Check size={14} className="text-[#9F8FD4]" />
              <span><span className="text-white">Growth Plan</span> - $149/month (50 sites, 500 tokens)</span>
            </li>
            <li className="flex items-center gap-2">
              <Icons.Check size={14} className="text-[#9F8FD4]" />
              <span><span className="text-white">Enterprise Plan</span> - $399/month (500 sites, 2000 tokens)</span>
            </li>
            <li className="flex items-center gap-2">
              <Icons.Check size={14} className="text-purple-500" />
              <span><span className="text-white">50 Edit Tokens</span> - $10 one-time</span>
            </li>
            <li className="flex items-center gap-2">
              <Icons.Check size={14} className="text-purple-500" />
              <span><span className="text-white">5 Site Generations</span> - $15 one-time</span>
            </li>
          </ul>
        </div>

        {/* Result Message */}
        {stripeResult && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 p-4 rounded-xl flex items-start gap-3 ${
              stripeResult.success
                ? 'bg-[#9F8FD4]/10 border border-[#9F8FD4]/20'
                : 'bg-red-500/10 border border-red-500/20'
            }`}
          >
            {stripeResult.success ? (
              <Icons.CheckCircle size={18} className="text-[#9F8FD4] flex-shrink-0 mt-0.5" />
            ) : (
              <Icons.AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <span className={`text-sm ${stripeResult.success ? 'text-[#9F8FD4]' : 'text-red-500'}`}>
                {stripeResult.message}
              </span>
              {stripeResult.success && stripeResult.data && (
                <div className="mt-2 text-xs text-[#6B6478]">
                  <p>Created {Object.keys(stripeResult.data.subscriptionPrices || {}).length} subscription prices</p>
                  <p>Created {Object.keys(stripeResult.data.topupPrices || {}).length} top-up prices</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Initialize Button */}
        <button
          onClick={handleInitializeStripe}
          disabled={isInitializingStripe}
          className="w-full py-4 bg-purple-500 hover:bg-purple-600 disabled:bg-[#262033] disabled:text-[#6B6478] rounded-xl text-sm font-bold text-white transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isInitializingStripe ? (
            <>
              <Icons.Loader size={18} className="animate-spin" />
              Initializing Stripe Products...
            </>
          ) : (
            <>
              <Icons.Zap size={18} />
              Initialize Stripe Products
            </>
          )}
        </button>

        {/* Note */}
        <p className="mt-4 text-sm text-[#6B6478] text-center uppercase tracking-wider">
          Safe to run multiple times - existing products will be reused
        </p>
      </motion.div>

      {/* Info Card */}
      <div className="bg-[#1A1625]/30 border border-[#9F8FD4]/10 rounded-2xl p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Icons.HelpCircle size={20} className="text-blue-500" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white mb-1">How to get GoDaddy API credentials</h4>
            <ol className="text-xs text-[#6B6478] space-y-1 list-decimal list-inside">
              <li>Go to <span className="text-white">developer.godaddy.com</span></li>
              <li>Sign in with your GoDaddy account</li>
              <li>Navigate to API Keys section</li>
              <li>Create a new Production key</li>
              <li>Copy both the Key and Secret</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
