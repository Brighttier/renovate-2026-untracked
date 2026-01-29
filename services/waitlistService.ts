import { WaitlistStats, WaitlistEntry, WaitlistSettings } from "../types";

// Cloud Functions base URL
const FUNCTIONS_BASE_URL = 'https://us-central1-renovatemysite-app.cloudfunctions.net';

// ==========================================
// PUBLIC FUNCTIONS (No auth required)
// ==========================================

/**
 * Join the waitlist with an email address.
 * Returns the user's position and current stats.
 */
export const joinWaitlist = async (
  email: string,
  source: string = 'landing_page',
  referredBy?: string
): Promise<{
  success: boolean;
  id?: string;
  position?: number;
  stats?: WaitlistStats;
  error?: string;
  alreadyExists?: boolean;
}> => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/joinWaitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { email, source, referredBy }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      // Check if it's an "already exists" error
      if (result.error?.status === 'ALREADY_EXISTS' || result.error?.message?.includes('already')) {
        return {
          success: false,
          alreadyExists: true,
          position: result.error?.details?.position,
          error: 'Email already on waitlist'
        };
      }
      return {
        success: false,
        error: result.error?.message || 'Failed to join waitlist'
      };
    }

    return {
      success: true,
      id: result.result?.id,
      position: result.result?.position,
      stats: result.result?.stats
    };
  } catch (e: any) {
    console.error("Join waitlist failed:", e?.message || e);
    return {
      success: false,
      error: e?.message || 'Failed to join waitlist'
    };
  }
};

/**
 * Get current waitlist stats (spots remaining, total entries, etc.)
 */
export const getWaitlistStats = async (): Promise<WaitlistStats | null> => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getWaitlistStats`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get waitlist stats');
    }

    const result = await response.json();
    return result.result as WaitlistStats;
  } catch (e: any) {
    console.error("Get waitlist stats failed:", e?.message || e);
    return null;
  }
};

/**
 * Get waitlist position for an email address.
 */
export const getWaitlistPosition = async (email: string): Promise<{
  found: boolean;
  position?: number;
  status?: string;
  inviteCode?: string;
}> => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getWaitlistPosition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { email }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get waitlist position');
    }

    const result = await response.json();
    return result.result;
  } catch (e: any) {
    console.error("Get waitlist position failed:", e?.message || e);
    return { found: false };
  }
};

// ==========================================
// ADMIN FUNCTIONS
// ==========================================

/**
 * Get all waitlist entries (admin only).
 */
export const getWaitlistEntries = async (
  options?: {
    status?: 'waiting' | 'invited' | 'converted';
    limit?: number;
    offset?: number;
    search?: string;
  }
): Promise<{
  entries: WaitlistEntry[];
  total: number;
  hasMore: boolean;
}> => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/getWaitlistEntries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: options || {}
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to get waitlist entries');
    }

    const result = await response.json();
    return result.result;
  } catch (e: any) {
    console.error("Get waitlist entries failed:", e?.message || e);
    return { entries: [], total: 0, hasMore: false };
  }
};

/**
 * Invite a user from the waitlist (admin only).
 * Generates an invite code for them.
 */
export const inviteFromWaitlist = async (entryId: string): Promise<{
  success: boolean;
  inviteCode?: string;
  email?: string;
  error?: string;
}> => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/inviteFromWaitlist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { entryId }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: result.error?.message || 'Failed to invite from waitlist'
      };
    }

    return {
      success: true,
      inviteCode: result.result?.inviteCode,
      email: result.result?.email
    };
  } catch (e: any) {
    console.error("Invite from waitlist failed:", e?.message || e);
    return {
      success: false,
      error: e?.message || 'Failed to invite from waitlist'
    };
  }
};

/**
 * Update waitlist settings (admin only).
 */
export const updateWaitlistSettings = async (
  settings: Partial<WaitlistSettings>
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/updateWaitlistSettings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: settings
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Failed to update waitlist settings'
      };
    }

    return { success: true };
  } catch (e: any) {
    console.error("Update waitlist settings failed:", e?.message || e);
    return {
      success: false,
      error: e?.message || 'Failed to update waitlist settings'
    };
  }
};

/**
 * Mark a waitlist entry as converted (when user signs up).
 */
export const markWaitlistConverted = async (
  email: string,
  inviteCode?: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const response = await fetch(`${FUNCTIONS_BASE_URL}/markWaitlistConverted`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { email, inviteCode }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error?.message || 'Failed to mark as converted'
      };
    }

    return { success: true };
  } catch (e: any) {
    console.error("Mark waitlist converted failed:", e?.message || e);
    return {
      success: false,
      error: e?.message || 'Failed to mark as converted'
    };
  }
};
