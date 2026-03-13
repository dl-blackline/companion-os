/**
 * SettingsContext — Centralized settings provider for the entire application.
 *
 * Combines two layers:
 *  1. CompanionSettings (model config, memory, privacy, AI name) — persisted to localStorage
 *  2. UserPreferences (AI behavior, appearance, voice, notifications) — persisted to Supabase backend
 *
 * All components read settings through useSettings().  Writes go through
 * updateSettings() / updatePreferences() which apply optimistic updates,
 * persist to the appropriate storage, show toast feedback, and rollback on failure.
 *
 * Slider-heavy controls use a debounced save so the backend is not hammered on
 * every drag event while the UI remains responsive.
 */
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import type { CompanionSettings, ConversationMode, UserPreferences } from '@/types';
import { DEFAULT_USER_PREFERENCES } from '@/types';
import { setModelSetting } from '@/utils/model-cache';
import { useAuth } from '@/context/auth-context';

// ── Default CompanionSettings ────────────────────────────────────────────────
export const DEFAULT_SETTINGS: CompanionSettings = {
  aiName: 'Companion OS',
  defaultMode: 'neutral',
  memorySettings: {
    autoCapture: true,
    requireApproval: false,
    summarization: true,
  },
  modelSettings: {
    defaultModel: 'gpt-5.4',
    fallbackModel: 'gpt-4.1-mini',
    imageModel: 'openai-image',
    videoModel: 'sora',
    musicModel: 'suno',
    voiceModel: 'elevenlabs',
    temperature: 0.7,
    maxLength: 2000,
    citationPreference: 'when-available',
    toolUseAggressiveness: 0.5,
    memoryRetrievalIntensity: 0.7,
  },
  privacySettings: {
    dataStorage: true,
    exportEnabled: true,
    auditTrail: true,
  },
};

const SETTINGS_STORAGE_KEY = 'companion-settings';

// ── Helpers ──────────────────────────────────────────────────────────────────
function loadSettingsFromStorage(): CompanionSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistSettingsToStorage(s: CompanionSettings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(s));
  } catch (err) {
    console.error('Failed to persist settings to localStorage', err);
  }
}

// Model-field → cache-type mapping (shared with model-cache utility)
const FIELD_TO_CACHE_TYPE: Record<string, string> = {
  defaultModel: 'chat',
  fallbackModel: 'fallback',
  imageModel: 'image',
  videoModel: 'video',
  musicModel: 'music',
  voiceModel: 'voice',
};

// ── Context types ────────────────────────────────────────────────────────────
interface SettingsContextType {
  // CompanionSettings (localStorage)
  settings: CompanionSettings;
  updateSettings: (patch: Partial<CompanionSettings>) => void;
  updateModelSettings: (patch: Partial<CompanionSettings['modelSettings']>) => void;
  updateMemorySettings: (patch: Partial<CompanionSettings['memorySettings']>) => void;
  updatePrivacySettings: (patch: Partial<CompanionSettings['privacySettings']>) => void;

  // UserPreferences (backend)
  prefs: UserPreferences;
  prefsLoading: boolean;
  prefsSaving: boolean;
  prefsError: string | null;
  updatePreferences: (patch: Partial<UserPreferences>) => Promise<void>;
  /** Debounced preference save — use for sliders and fast-changing controls */
  updatePreferencesDebounced: (patch: Partial<UserPreferences>) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

// ── Provider ─────────────────────────────────────────────────────────────────
export function SettingsProvider({ children }: { children: ReactNode }) {
  // ── CompanionSettings (localStorage) ───────────────────────────────────────
  const [settings, setSettingsState] = useState<CompanionSettings>(loadSettingsFromStorage);

  const updateSettings = useCallback((patch: Partial<CompanionSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      persistSettingsToStorage(next);
      return next;
    });
  }, []);

  const updateModelSettings = useCallback(
    (patch: Partial<CompanionSettings['modelSettings']>) => {
      setSettingsState((prev) => {
        const next = {
          ...prev,
          modelSettings: { ...prev.modelSettings, ...patch },
        };
        persistSettingsToStorage(next);

        // Sync model-cache utility
        for (const [field, cacheType] of Object.entries(FIELD_TO_CACHE_TYPE)) {
          if (field in patch) {
            setModelSetting(cacheType, (patch as Record<string, string>)[field]);
          }
        }

        return next;
      });
    },
    [],
  );

  const updateMemorySettings = useCallback(
    (patch: Partial<CompanionSettings['memorySettings']>) => {
      setSettingsState((prev) => {
        const next = {
          ...prev,
          memorySettings: { ...prev.memorySettings, ...patch },
        };
        persistSettingsToStorage(next);
        return next;
      });
    },
    [],
  );

  const updatePrivacySettings = useCallback(
    (patch: Partial<CompanionSettings['privacySettings']>) => {
      setSettingsState((prev) => {
        const next = {
          ...prev,
          privacySettings: { ...prev.privacySettings, ...patch },
        };
        persistSettingsToStorage(next);
        return next;
      });
    },
    [],
  );

  // ── UserPreferences (backend) ──────────────────────────────────────────────
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  // Ref to the latest prefs for rollback inside async callbacks (avoids stale closure)
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // Save-sequence counter to prevent out-of-order responses overwriting newer state
  const saveSeq = useRef(0);

  // Use the auth context's synchronous token getter.  This reads from the
  // session kept in memory by onAuthStateChange — no extra async round-trip
  // and no race with Supabase's internal session hydration.
  const { getAccessToken, user: authUser } = useAuth();

  const getToken = useCallback((): string | null => {
    return getAccessToken();
  }, [getAccessToken]);

  // Load preferences from backend when the authenticated user changes
  // (login, logout, token refresh).  Using authUser?.id as the dependency
  // ensures we re-fetch whenever the identity changes.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = getToken();
      if (!token) return;
      setPrefsLoading(true);
      try {
        const res = await fetch('/.netlify/functions/user-preferences', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { prefs: loaded } = await res.json();
        if (!cancelled && loaded) {
          setPrefs((prev) => ({ ...prev, ...loaded }));
        }
      } catch {
        // Defaults are fine
      } finally {
        if (!cancelled) setPrefsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  const updatePreferences = useCallback(
    async (patch: Partial<UserPreferences>) => {
      // Snapshot current prefs for rollback (from ref to avoid stale closure)
      const prevPrefs = prefsRef.current;
      // Optimistic update
      setPrefs((prev) => ({ ...prev, ...patch }));
      setPrefsSaving(true);
      setPrefsError(null);

      const seq = ++saveSeq.current;

      try {
        const token = getToken();
        if (!token) {
          toast.error('Not authenticated — settings not saved');
          setPrefs(prevPrefs);
          return;
        }
        const res = await fetch('/.netlify/functions/user-preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ prefs: patch }),
        });

        // Stale response guard
        if (seq !== saveSeq.current) return;

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const msg = data.error || 'Failed to save preferences';
          setPrefsError(msg);
          setPrefs(prevPrefs);
          toast.error(msg);
        } else {
          toast.success('Settings saved');
        }
      } catch {
        if (seq !== saveSeq.current) return;
        setPrefsError('Network error');
        setPrefs(prevPrefs);
        toast.error('Network error — settings not saved');
      } finally {
        if (seq === saveSeq.current) setPrefsSaving(false);
      }
    },
    [getToken],
  );

  // ── Debounced preference save (for sliders / rapid-fire controls) ──────────
  const pendingPatch = useRef<Partial<UserPreferences>>({});
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  const updatePreferencesDebounced = useCallback(
    (patch: Partial<UserPreferences>) => {
      // Immediate optimistic UI update
      setPrefs((prev) => ({ ...prev, ...patch }));
      // Accumulate patches
      pendingPatch.current = { ...pendingPatch.current, ...patch };

      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        const merged = { ...pendingPatch.current };
        pendingPatch.current = {};
        // Fire actual save (uses latest prefs via closure)
        updatePreferences(merged);
      }, 600);
    },
    [updatePreferences],
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        updateModelSettings,
        updateMemorySettings,
        updatePrivacySettings,
        prefs,
        prefsLoading,
        prefsSaving,
        prefsError,
        updatePreferences,
        updatePreferencesDebounced,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (ctx === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return ctx;
}
