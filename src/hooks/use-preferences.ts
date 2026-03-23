/**
 * usePreferences — load and save user preferences with optimistic updates
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import type { UserPreferences } from '@/types';
import { DEFAULT_USER_PREFERENCES } from '@/types';

interface UsePreferencesReturn {
  prefs: UserPreferences;
  loading: boolean;
  saving: boolean;
  error: string | null;
  update: (partial: Partial<UserPreferences>) => Promise<void>;
}

export function usePreferences(): UsePreferencesReturn {
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { getAccessToken } = useAuth();

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = getAccessToken();
      if (!token) return;
      setLoading(true);
      try {
        const res = await fetch('/.netlify/functions/user-preferences', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const json = await res.json();
        const { prefs: loaded } = json.data ?? json;
        if (!cancelled && loaded) {
          setPrefs((prev) => ({ ...prev, ...loaded }));
        }
      } catch {
        // silently fail — defaults are fine
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [getAccessToken]);

  const update = useCallback(async (partial: Partial<UserPreferences>) => {
    // Save previous state for rollback on failure
    const prevPrefs = prefs;
    // Optimistic update
    setPrefs((prev) => ({ ...prev, ...partial }));
    setSaving(true);
    setError(null);
    try {
      const token = getAccessToken();
      if (!token) return;
      const res = await fetch('/.netlify/functions/user-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prefs: partial }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json();
        setError(msg || 'Failed to save');
        // Rollback to previous state on failure
        setPrefs(prevPrefs);
      }
    } catch (e) {
      setError('Network error');
      // Rollback to previous state on network error
      setPrefs(prevPrefs);
    } finally {
      setSaving(false);
    }
  }, [prefs, getAccessToken]);

  return { prefs, loading, saving, error, update };
}
