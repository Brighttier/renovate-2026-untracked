import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icons } from '../Icons';
import { stripeService } from '../../services/stripeService';
import { PLATFORM_PLANS } from '../../constants';

interface PlanUpgradeModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPlanId: string;
}

const PlanUpgradeModal: React.FC<PlanUpgradeModalProps> = ({ isOpen, onClose, currentPlanId }) => {
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleUpgrade = async (planId: string) => {
        if (planId === currentPlanId || planId === 'free') return;

        setLoading(planId);
        setError(null);

        try {
            await stripeService.redirectToCheckout(planId, 'subscription');
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
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="bg-white border border-[#9B8CF7]/20 rounded-[20px] w-full max-w-4xl overflow-hidden shadow-xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="p-6 border-b border-[#9B8CF7]/10">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-xl font-bold text-[#1E1B4B] headline-font">Upgrade Your Plan</h2>
                                <p className="text-sm text-[#6B7280] mt-1">Choose the plan that fits your needs</p>
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
                    <div className="p-6">
                        {error && (
                            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                                {error}
                            </div>
                        )}

                        <div className="grid grid-cols-4 gap-4">
                            {PLATFORM_PLANS.map((plan) => {
                                const isCurrent = plan.id === currentPlanId;
                                const isPopular = plan.id === 'growth';
                                const isFree = plan.id === 'free';

                                return (
                                    <div
                                        key={plan.id}
                                        className={`relative p-5 rounded-[20px] border transition-all ${
                                            isCurrent
                                                ? 'bg-[#F5F3FF] border-[#9B8CF7]/50'
                                                : isPopular
                                                ? 'bg-[#F5F3FF] border-[#9B8CF7]/30'
                                                : 'bg-white border-[#9B8CF7]/10 hover:border-[#9B8CF7]/30'
                                        }`}
                                    >
                                        {isPopular && !isCurrent && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#9B8CF7] text-white text-xs font-bold rounded-full">
                                                POPULAR
                                            </div>
                                        )}

                                        {isCurrent && (
                                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-[#9B8CF7] text-white text-xs font-bold rounded-full">
                                                CURRENT
                                            </div>
                                        )}

                                        <div className="text-center mb-4">
                                            <h3 className="text-lg font-bold text-[#1E1B4B] headline-font">{plan.name}</h3>
                                            <div className="mt-2">
                                                <span className="text-3xl font-bold text-[#1E1B4B] headline-font">${plan.price}</span>
                                                {plan.price > 0 && (
                                                    <span className="text-[#6B7280] text-sm">/mo</span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="space-y-3 mb-6">
                                            <div className="flex items-center gap-2 text-sm">
                                                <Icons.Check size={16} className="text-[#9B8CF7]" />
                                                <span className="text-[#6B7280]">
                                                    {plan.limits.sites} site{plan.limits.sites > 1 ? 's' : ''}{isFree ? ' (one-time)' : '/mo'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Icons.Check size={16} className="text-[#9B8CF7]" />
                                                <span className="text-[#6B7280]">
                                                    {plan.limits.editTokens} edit tokens{isFree ? ' (one-time)' : '/mo'}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm">
                                                <Icons.Check size={16} className="text-[#9B8CF7]" />
                                                <span className="text-[#6B7280]">AI Website Generation</span>
                                            </div>
                                            {plan.price >= 149 && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Icons.Check size={16} className="text-[#9B8CF7]" />
                                                    <span className="text-[#6B7280]">Priority Support</span>
                                                </div>
                                            )}
                                            {plan.price >= 399 && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <Icons.Check size={16} className="text-[#9B8CF7]" />
                                                    <span className="text-[#6B7280]">White Label</span>
                                                </div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => handleUpgrade(plan.id)}
                                            disabled={isCurrent || isFree || loading === plan.id}
                                            className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                                                isCurrent
                                                    ? 'bg-[#9B8CF7]/20 text-[#9B8CF7] cursor-default'
                                                    : isFree
                                                    ? 'bg-[#EDE9FE] text-[#6B7280] cursor-not-allowed'
                                                    : 'bg-[#9B8CF7] hover:bg-[#8B5CF6] text-white'
                                            }`}
                                        >
                                            {loading === plan.id ? (
                                                <span className="flex items-center justify-center gap-2">
                                                    <Icons.Loader size={14} className="animate-spin" />
                                                    Loading...
                                                </span>
                                            ) : isCurrent ? (
                                                'Current Plan'
                                            ) : isFree ? (
                                                'Free Plan'
                                            ) : (
                                                `Upgrade to ${plan.name}`
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-6 p-4 bg-[#262033]/50 rounded-xl">
                            <div className="flex items-start gap-3">
                                <Icons.Shield size={18} className="text-[#9B8CF7] mt-0.5" />
                                <div className="text-sm text-[#A8A3B3]">
                                    <span className="text-white font-medium">Cancel anytime.</span> You can downgrade
                                    or cancel your subscription at any time. Your access continues until the end
                                    of your billing period.
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default PlanUpgradeModal;
