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
  OrbColorTheme,
  OrbPreferencePayload,
  EmojiOrbFeatureSet,
  EmojiOrbStyleMode,
} from '@/types/emoji-orb';
import { DEFAULT_ORB_PREFERENCE } from '@/types/emoji-orb';
import { useAuth } from '@/context/auth-context';

// ── Local storage key (fallback when not authenticated) ──────────────────────
const ORB_PREF_STORAGE_KEY = 'companion-orb-preference';

function scheduleIdleTask(task: () => void): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(task, { timeout: 1500 });
    return () => window.cancelIdleCallback(id);
  }

  const timeoutId = window.setTimeout(task, 220);
  return () => window.clearTimeout(timeoutId);
}

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
  /** Active orb color theme. */
  orbColor: OrbColorTheme;
  /** Whether the preference is currently being loaded. */
  loading: boolean;
  /** Apply an emoji orb configuration and persist it. */
  applyEmojiOrb: (features: EmojiOrbFeatureSet, styleMode: EmojiOrbStyleMode, emoji: string) => Promise<void>;
  /** Set orb color theme and persist it. */
  setOrbColor: (theme: OrbColorTheme) => Promise<void>;
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
  const orbColor: OrbColorTheme = pref.orbColor ?? 'silver';

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
        const json = await res.json();
        const { prefs } = json.data ?? json;
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

    const cancelScheduledLoad = scheduleIdleTask(() => {
      if (!cancelled) {
        loadFromBackend();
      }
    });

    return () => {
      cancelled = true;
      cancelScheduledLoad();
    };
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
      orbColor,
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
  }, [persistPreference, orbColor]);

  const setOrbColor = useCallback(async (theme: OrbColorTheme) => {
    if (pref.orbColor === theme) return;
    try {
      await persistPreference({
        ...pref,
        orbColor: theme,
      });
    } catch {
      toast.error('Failed to save orb color');
      setPref(loadFromLocalStorage());
    }
  }, [persistPreference, pref]);

  const resetToDefault = useCallback(async () => {
    try {
      await persistPreference({
        ...DEFAULT_ORB_PREFERENCE,
        orbColor: pref.orbColor ?? 'silver',
      });
      toast.success('Orb reset to default');
    } catch {
      toast.error('Failed to reset orb appearance');
      const old = loadFromLocalStorage();
      setPref(old);
    }
  }, [persistPreference, pref.orbColor]);

  return (
    <OrbAppearanceContext.Provider
      value={{
        mode,
        emojiFeatures,
        styleMode,
        emoji,
        orbColor,
        loading,
        applyEmojiOrb,
        setOrbColor,
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
