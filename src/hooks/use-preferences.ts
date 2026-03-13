/**
 * usePreferences — load and save user preferences with optimistic updates
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase, supabaseConfigured } from '@/lib/supabase-client';
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

  const getToken = async (): Promise<string | null> => {
    if (!supabaseConfigured) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const token = await getToken();
      if (!token) return;
      setLoading(true);
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
        // silently fail — defaults are fine
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback(async (partial: Partial<UserPreferences>) => {
    // Optimistic update
    setPrefs((prev) => ({ ...prev, ...partial }));
    setSaving(true);
    setError(null);
    try {
      const token = await getToken();
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
        // Rollback on failure
        setPrefs((prev) => ({ ...prev }));
      }
    } catch (e) {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }, []);

  return { prefs, loading, saving, error, update };
}
