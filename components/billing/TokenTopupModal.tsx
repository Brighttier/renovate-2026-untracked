import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '../Icons';
import { stripeService } from '../../services/stripeService';
import { TOPUP_PACKS } from '../../constants';

interface TokenTopupModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const TokenTopupModal: React.FC<TokenTopupModalProps> = ({ isOpen, onClose }) => {
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handlePurchase = async (packId: string) => {
        setLoading(packId);
        setError(null);

        try {
            await stripeService.redirectToCheckout(packId, 'topup');
        } catch (err: any) {
            console.error('Error creating checkout:', err);
            setError(err.message || 'Failed to start checkout');
            setLoading(null);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white border border-[#9B8CF7]/20 rounded-[20px] w-full max-w-lg overflow-hidden shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-[#9B8CF7]/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-[#F5F3FF] rounded-xl flex items-center justify-center">
                                    <Icons.Sparkles size={20} className="text-[#9B8CF7]" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-[#1E1B4B] headline-font">Buy More Tokens</h2>
                                    <p className="text-sm text-[#6B7280]">One-time purchase, no subscription</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-lg bg-[#F5F3FF] hover:bg-[#EDE9FE] flex items-center justify-center transition-colors"
                            >
                                <Icons.Close size={16} className="text-[#6B7280]" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                        {error && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-500">
                                {error}
                            </div>
                        )}

                        {TOPUP_PACKS.map((pack) => (
                            <div
                                key={pack.id}
                                className="p-4 bg-[#F5F3FF] border border-[#9B8CF7]/10 rounded-[20px] hover:border-[#9B8CF7]/30 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                            pack.id === 'edit-50'
                                                ? 'bg-blue-100 text-blue-600'
                                                : 'bg-purple-100 text-purple-600'
                                        }`}>
                                            {pack.id === 'edit-50' ? (
                                                <Icons.Sparkles size={24} />
                                            ) : (
                                                <Icons.Rocket size={24} />
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-[#1E1B4B] font-semibold">{pack.name}</div>
                                            <div className="text-sm text-[#6B7280]">
                                                {pack.id === 'edit-50'
                                                    ? 'Use for AI-powered edits'
                                                    : 'Use for new site generations'}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-2xl font-bold text-[#1E1B4B] headline-font">${pack.price}</div>
                                        <button
                                            onClick={() => handlePurchase(pack.id)}
                                            disabled={loading === pack.id}
                                            className="mt-2 px-4 py-2 bg-[#9B8CF7] hover:bg-[#8B5CF6] disabled:bg-[#9B8CF7]/50 text-white text-sm font-semibold rounded-lg transition-colors"
                                        >
                                            {loading === pack.id ? (
                                                <span className="flex items-center gap-2">
                                                    <Icons.Loader size={14} className="animate-spin" />
                                                    Loading...
                                                </span>
                                            ) : (
                                                'Buy Now'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}

                        <div className="p-4 bg-[#F5F3FF] rounded-xl">
                            <div className="flex items-start gap-3">
                                <Icons.Shield size={18} className="text-[#9B8CF7] mt-0.5" />
                                <div className="text-sm text-[#6B7280]">
                                    <span className="text-[#1E1B4B] font-medium">Secure checkout</span> powered by Stripe.
                                    Tokens are added instantly after purchase and never expire.
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default TokenTopupModal;
