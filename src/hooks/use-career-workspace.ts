import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { CareerWorkspace, CareerTargetStatus } from '@/types/careers';

const EMPTY_WORKSPACE: CareerWorkspace = {
  resumeVersions: [],
  jobTargets: [],
};

interface SaveResumeInput {
  id?: string;
  title?: string;
  targetRole?: string;
  jobDescription?: string;
  resumeText: string;
  notes?: string;
  isPrimary?: boolean;
}

interface SaveJobTargetInput {
  id?: string;
  company?: string;
  role: string;
  location?: string;
  seniority?: string;
  jobUrl?: string;
  status?: CareerTargetStatus;
  priority?: number;
  notes?: string;
}

export function useCareerWorkspace() {
  const { user, getAccessToken } = useAuth();
  const [workspace, setWorkspace] = useState<CareerWorkspace>(EMPTY_WORKSPACE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const token = getAccessToken();
    if (!token) {
      throw new Error('You must be signed in to access career tools.');
    }

    const response = await fetch(input, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.headers ?? {}),
      },
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || 'Career workspace request failed.');
    }

    return payload.data as CareerWorkspace;
  }, [getAccessToken]);

  const refresh = useCallback(async () => {
    if (!user) {
      setWorkspace(EMPTY_WORKSPACE);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/career-management');
      setWorkspace(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load career workspace.');
    } finally {
      setLoading(false);
    }
  }, [authedFetch, user]);

  const saveResumeVersion = useCallback(async (input: SaveResumeInput) => {
    setSaving(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/career-management', {
        method: 'POST',
        body: JSON.stringify({ action: 'save_resume_version', ...input }),
      });
      setWorkspace(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save resume version.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [authedFetch]);

  const saveJobTarget = useCallback(async (input: SaveJobTargetInput) => {
    setSaving(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/career-management', {
        method: 'POST',
        body: JSON.stringify({ action: 'save_job_target', ...input }),
      });
      setWorkspace(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save job target.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [authedFetch]);

  const deleteResumeVersion = useCallback(async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/career-management', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_resume_version', id }),
      });
      setWorkspace(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete resume version.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [authedFetch]);

  const deleteJobTarget = useCallback(async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/career-management', {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_job_target', id }),
      });
      setWorkspace(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete job target.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    workspace,
    loading,
    saving,
    error,
    refresh,
    saveResumeVersion,
    saveJobTarget,
    deleteResumeVersion,
    deleteJobTarget,
  };
}
