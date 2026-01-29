import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '../Icons';
import { PLATFORM_PLANS } from '../../constants';

interface UsageLimitModalProps {
    isOpen: boolean;
    onClose: () => void;
    limitType: 'edits' | 'sites';
    currentPlanId: string;
    renewalDate?: string; // ISO date string for when tokens will be replenished
    onNavigateToCredits: () => void; // Navigate to Credits page
}

const UsageLimitModal: React.FC<UsageLimitModalProps> = ({
    isOpen,
    onClose,
    limitType,
    currentPlanId,
    renewalDate,
    onNavigateToCredits
}) => {
    const currentPlan = PLATFORM_PLANS.find(p => p.id === currentPlanId);
    const isFreePlan = currentPlanId === 'free';
    const isPaidPlan = ['starter', 'growth', 'enterprise'].includes(currentPlanId);

    const handleNavigateToCredits = () => {
        onClose();
        onNavigateToCredits();
    };

    const formatRenewalDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
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
                    <div className="p-6 border-b border-[#9B8CF7]/10 bg-gradient-to-r from-[#9B8CF7]/5 to-[#F5F3FF]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-[#FEF3C7] rounded-xl flex items-center justify-center">
                                    <Icons.AlertCircle size={24} className="text-[#F59E0B]" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-[#1E1B4B] headline-font">
                                        {limitType === 'edits' ? 'Out of Edit Tokens' : 'Out of Site Generations'}
                                    </h2>
                                    <p className="text-sm text-[#6B7280]">
                                        You've used all your {limitType === 'edits' ? 'AI edit tokens' : 'site generation credits'}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-lg bg-white hover:bg-[#F5F3FF] flex items-center justify-center transition-colors border border-[#9B8CF7]/10"
                            >
                                <Icons.Close size={16} className="text-[#6B7280]" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-5">
                        {/* Renewal Info for Paid Plans */}
                        {isPaidPlan && renewalDate && (
                            <div className="p-4 bg-[#F5F3FF] border border-[#9B8CF7]/20 rounded-[16px]">
                                <div className="flex items-start gap-3">
                                    <Icons.Clock size={20} className="text-[#9B8CF7] mt-0.5" />
                                    <div>
                                        <div className="text-[#1E1B4B] font-semibold">Your tokens will be replenished</div>
                                        <div className="text-sm text-[#6B7280] mt-1">
                                            On <span className="font-medium text-[#9B8CF7]">{formatRenewalDate(renewalDate)}</span>,
                                            your {currentPlan?.name} plan will renew and you'll receive{' '}
                                            <span className="font-medium text-[#1E1B4B]">
                                                {currentPlan?.limits.editTokens} edit tokens
                                            </span> and{' '}
                                            <span className="font-medium text-[#1E1B4B]">
                                                {currentPlan?.limits.sites} site generations
                                            </span>.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Free Plan Notice */}
                        {isFreePlan && (
                            <div className="p-4 bg-[#FEF3C7] border border-[#F59E0B]/20 rounded-[16px]">
                                <div className="flex items-start gap-3">
                                    <Icons.AlertCircle size={20} className="text-[#F59E0B] mt-0.5" />
                                    <div>
                                        <div className="text-[#1E1B4B] font-semibold">Free plan limits reached</div>
                                        <div className="text-sm text-[#6B7280] mt-1">
                                            The free plan includes 1 site generation and 5 edits as a one-time trial.
                                            Free tokens cannot be renewed. Purchase top-ups below or upgrade to a paid plan
                                            for monthly token replenishment.
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Options Summary */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-[#6B7280] uppercase tracking-wider">
                                Your Options
                            </h3>

                            {/* Option 1: Buy Tokens */}
                            <div className="p-4 bg-[#F5F3FF] border border-[#9B8CF7]/10 rounded-[16px]">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                        <Icons.Sparkles size={24} className="text-blue-600" />
                                    </div>
                                    <div>
                                        <div className="text-[#1E1B4B] font-semibold">Buy Token Packs</div>
                                        <div className="text-sm text-[#6B7280]">
                                            50 edit tokens for $10 • 5 site generations for $15
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Option 2: Upgrade Plan */}
                            {isFreePlan && (
                                <div className="p-4 bg-gradient-to-r from-[#9B8CF7]/10 to-[#8B5CF6]/10 border border-[#9B8CF7]/20 rounded-[16px]">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                                            <Icons.Rocket size={24} className="text-purple-600" />
                                        </div>
                                        <div>
                                            <div className="text-[#1E1B4B] font-semibold">Upgrade Your Plan</div>
                                            <div className="text-sm text-[#6B7280]">
                                                Get monthly token replenishment starting at $49/mo
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* CTA Button */}
                        <button
                            onClick={handleNavigateToCredits}
                            className="w-full py-4 bg-[#9B8CF7] hover:bg-[#8B5CF6] text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                        >
                            <Icons.DollarSign size={20} />
                            View Plans & Buy Tokens
                        </button>

                        {/* Info notice */}
                        <div className="p-3 bg-[#F9FAFB] rounded-xl">
                            <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                                <Icons.Shield size={14} className="text-[#9B8CF7]" />
                                <span>Secure checkout powered by Stripe. Tokens are added instantly and never expire.</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default UsageLimitModal;
