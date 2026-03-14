/**
 * OrbAppearanceContext — Provides orb appearance state to the entire application.
 *
 * Manages the active orb appearance mode (default gradient or emoji-styled).
 * Loads the saved preference on mount and provides functions to update/reset.
 * Persists the orb appearance via the existing UserPreferences backend
 * (user_preferences table, prefs JSONB column).
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import type {
  OrbAppearanceMode,
  OrbPreferencePayload,
  EmojiOrbFeatureSet,
  EmojiOrbStyleMode,
} from '@/types/emoji-orb';
import { DEFAULT_ORB_PREFERENCE } from '@/types/emoji-orb';
import { useAuth } from '@/context/auth-context';

// ── Local storage key (fallback when not authenticated) ──────────────────────
const ORB_PREF_STORAGE_KEY = 'companion-orb-preference';

// ── Context type ─────────────────────────────────────────────────────────────

interface OrbAppearanceContextType {
  /** Current appearance mode. */
  mode: OrbAppearanceMode;
  /** Active emoji orb features (null when mode is 'default'). */
  emojiFeatures: EmojiOrbFeatureSet | null;
  /** Active style mode name. */
  styleMode: EmojiOrbStyleMode | null;
  /** Active emoji character. */
  emoji: string | null;
  /** Whether the preference is currently being loaded. */
  loading: boolean;
  /** Apply an emoji orb configuration and persist it. */
  applyEmojiOrb: (features: EmojiOrbFeatureSet, styleMode: EmojiOrbStyleMode, emoji: string) => Promise<void>;
  /** Reset to the default orb appearance. */
  resetToDefault: () => Promise<void>;
}

const OrbAppearanceContext = createContext<OrbAppearanceContextType | undefined>(undefined);

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadFromLocalStorage(): OrbPreferencePayload {
  try {
    const raw = localStorage.getItem(ORB_PREF_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as OrbPreferencePayload;
      if (parsed && parsed.mode) return parsed;
    }
  } catch { /* fall through */ }
  return DEFAULT_ORB_PREFERENCE;
}

function saveToLocalStorage(pref: OrbPreferencePayload) {
  try {
    localStorage.setItem(ORB_PREF_STORAGE_KEY, JSON.stringify(pref));
  } catch (err) {
    console.error('Failed to persist orb preference to localStorage', err);
  }
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function OrbAppearanceProvider({ children }: { children: ReactNode }) {
  const { getAccessToken, user: authUser } = useAuth();

  const [pref, setPref] = useState<OrbPreferencePayload>(loadFromLocalStorage);
  const [loading, setLoading] = useState(false);

  // Derive convenience fields
  const mode = pref.mode;
  const emojiFeatures = pref.mode === 'emoji' ? (pref.emojiConfig ?? null) : null;
  const styleMode = pref.mode === 'emoji' ? (pref.styleMode ?? null) : null;
  const emoji = pref.mode === 'emoji' ? (pref.emoji ?? null) : null;

  // Load from backend when authenticated user changes
  useEffect(() => {
    let cancelled = false;
    async function loadFromBackend() {
      const token = getAccessToken();
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch('/.netlify/functions/user-preferences', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { prefs } = await res.json();
        if (!cancelled && prefs?.orb_appearance) {
          const loaded = prefs.orb_appearance as OrbPreferencePayload;
          setPref(loaded);
          saveToLocalStorage(loaded);
        }
      } catch {
        // Defaults are fine
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadFromBackend();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  // Save helper — persists to backend and localStorage
  const persistPreference = useCallback(async (newPref: OrbPreferencePayload) => {
    // Optimistic local update
    setPref(newPref);
    saveToLocalStorage(newPref);

    // Persist to backend
    const token = getAccessToken();
    if (!token) {
      // Not authenticated — localStorage is enough
      return;
    }

    try {
      const res = await fetch('/.netlify/functions/user-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prefs: { orb_appearance: newPref } }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save orb preference');
      }
    } catch (err) {
      console.error('Failed to persist orb preference to backend', err);
      throw err;
    }
  }, [getAccessToken]);

  const applyEmojiOrb = useCallback(async (
    features: EmojiOrbFeatureSet,
    styleModeVal: EmojiOrbStyleMode,
    emojiVal: string,
  ) => {
    const newPref: OrbPreferencePayload = {
      mode: 'emoji',
      emojiConfig: features,
      styleMode: styleModeVal,
      emoji: emojiVal,
    };
    try {
      await persistPreference(newPref);
      toast.success('Emoji orb applied!');
    } catch {
      toast.error('Failed to save orb appearance');
      // Rollback
      const old = loadFromLocalStorage();
      setPref(old);
    }
  }, [persistPreference]);

  const resetToDefault = useCallback(async () => {
    try {
      await persistPreference(DEFAULT_ORB_PREFERENCE);
      toast.success('Orb reset to default');
    } catch {
      toast.error('Failed to reset orb appearance');
      const old = loadFromLocalStorage();
      setPref(old);
    }
  }, [persistPreference]);

  return (
    <OrbAppearanceContext.Provider
      value={{
        mode,
        emojiFeatures,
        styleMode,
        emoji,
        loading,
        applyEmojiOrb,
        resetToDefault,
      }}
    >
      {children}
    </OrbAppearanceContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useOrbAppearance() {
  const ctx = useContext(OrbAppearanceContext);
  if (ctx === undefined) {
    throw new Error('useOrbAppearance must be used within an OrbAppearanceProvider');
  }
  return ctx;
}
