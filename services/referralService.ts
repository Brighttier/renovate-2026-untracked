import { UserReferralStats, Referral } from "../types";

// Cloud Functions base URL
const FUNCTIONS_BASE_URL = 'https://us-central1-renovatemysite-app.cloudfunctions.net';

/**
 * Get or create referral stats for a user.
 * Automatically generates a unique referral code if one doesn't exist.
 */
export const getReferralStats = async (userId: string): Promise<UserReferralStats> => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getReferralStats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get referral stats');
    }

    return await response.json();
  } catch (e: any) {
    console.error("Get referral stats failed:", e?.message || e);
    throw e;
  }
};

/**
 * Validate a referral code and get the referrer's user ID.
 */
export const validateReferralCode = async (referralCode: string): Promise<{ valid: boolean; referrerUserId: string | null }> => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/validateReferralCode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referralCode })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to validate referral code');
    }

    return await response.json();
  } catch (e: any) {
    console.error("Validate referral code failed:", e?.message || e);
    return { valid: false, referrerUserId: null };
  }
};

/**
 * Process a referral when a new user signs up with a referral code.
 */
export const processReferralSignup = async (
  referralCode: string,
  newUserId: string,
  newUserEmail: string
): Promise<{ success: boolean; tokensAwarded?: number; error?: string }> => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/processReferralSignup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referralCode, newUserId, newUserEmail })
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to process referral' };
    }

    return { success: true, tokensAwarded: result.tokensAwarded };
  } catch (e: any) {
    console.error("Process referral signup failed:", e?.message || e);
    return { success: false, error: e?.message || 'Failed to process referral' };
  }
};

/**
 * Claim a milestone reward when user reaches the target.
 */
export const claimMilestoneReward = async (
  userId: string,
  milestoneTarget: number
): Promise<{ success: boolean; reward?: string; bonusTokens?: number; error?: string }> => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/claimMilestoneReward`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, milestoneTarget })
    });

    const result = await response.json();

    if (!response.ok) {
      return { success: false, error: result.error || 'Failed to claim milestone' };
    }

    return {
      success: true,
      reward: result.reward,
      bonusTokens: result.bonusTokens
    };
  } catch (e: any) {
    console.error("Claim milestone reward failed:", e?.message || e);
    return { success: false, error: e?.message || 'Failed to claim milestone' };
  }
};

/**
 * Get list of referrals made by a user.
 */
export const getUserReferrals = async (userId: string, limit: number = 50): Promise<Referral[]> => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getUserReferrals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, limit })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get user referrals');
    }

    const result = await response.json();
    return result.referrals || [];
  } catch (e: any) {
    console.error("Get user referrals failed:", e?.message || e);
    return [];
  }
};

/**
 * Generate the full referral link from a referral code.
 */
export const generateReferralLink = (referralCode: string): string => {
  return `https://renovatemysite.app/join?ref=${referralCode}`;
};

/**
 * Extract referral code from URL if present.
 */
export const extractReferralCodeFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get('ref');
};

/**
 * Store pending referral code in localStorage.
 */
export const storePendingReferralCode = (code: string): void => {
  localStorage.setItem('pendingReferralCode', code);
};

/**
 * Get and clear pending referral code from localStorage.
 */
export const getPendingReferralCode = (): string | null => {
  const code = localStorage.getItem('pendingReferralCode');
  return code;
};

/**
 * Clear pending referral code from localStorage.
 */
export const clearPendingReferralCode = (): void => {
  localStorage.removeItem('pendingReferralCode');
};
