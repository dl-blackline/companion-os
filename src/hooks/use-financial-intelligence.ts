import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import { supabase, supabaseConfigured } from '@/lib/supabase-client';
import type {
  FinancialDocumentSourceType,
  FinancialIntelligenceDashboard,
  FinancialObligationStatus,
  FinancialGoalPriority,
  FinancialGoalStatus,
  FinancialCalendarEventType,
} from '@/types/financial-intelligence';

const EMPTY_DASHBOARD: FinancialIntelligenceDashboard = {
  snapshot: {
    totalUpcomingObligations: 0,
    minimumPaymentsThisMonth: 0,
    totalRevolvingBalances: 0,
    utilizationPercent: 0,
    overdueCount: 0,
    dueSoonCount: 0,
    pressure7d: 0,
    pressure30d: 0,
  },
  documents: [],
  obligations: [],
  goals: [],
  calendarEvents: [],
  insights: [],
};

interface UpsertObligationInput {
  id?: string;
  institutionName?: string;
  accountLabel?: string;
  category?: string;
  dueDate?: string;
  amountDue?: number;
  minimumDue?: number;
  plannedPayment?: number;
  status?: FinancialObligationStatus;
  isRecurring?: boolean;
  notes?: string;
}

interface UpsertGoalInput {
  id?: string;
  name: string;
  targetAmount: number;
  targetDate?: string;
  priority?: FinancialGoalPriority;
  currentAmount?: number;
  monthlyContributionTarget?: number;
  recommendedContributionRate?: number;
  fundingRule?: string;
  status?: FinancialGoalStatus;
  notes?: string;
}

interface UpsertCalendarEventInput {
  id?: string;
  title: string;
  eventType?: FinancialCalendarEventType;
  scheduledDate: string;
  amount?: number;
  status?: 'scheduled' | 'completed' | 'skipped' | 'overdue';
  reminderOffsetDays?: number;
  notes?: string;
}

export function useFinancialIntelligence() {
  const { getAccessToken, user } = useAuth();
  const [dashboard, setDashboard] = useState<FinancialIntelligenceDashboard>(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const token = getAccessToken();
    if (!token) {
      throw new Error('You must be signed in to access financial intelligence tools.');
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
      throw new Error(payload?.error || 'Financial intelligence request failed.');
    }

    return payload.data as FinancialIntelligenceDashboard;
  }, [getAccessToken]);

  const refresh = useCallback(async () => {
    if (!user) {
      setDashboard(EMPTY_DASHBOARD);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/financial-intelligence');
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load financial dashboard.');
    } finally {
      setLoading(false);
    }
  }, [authedFetch, user]);

  const uploadAndIngestDocument = useCallback(async (file: File, sourceType: FinancialDocumentSourceType) => {
    if (!user) {
      throw new Error('You must be signed in to upload financial documents.');
    }

    setSaving(true);
    setError(null);
    try {
      if (!supabaseConfigured) {
        throw new Error('Supabase storage is not configured. Financial document upload is unavailable.');
      }

      const ext = file.name.split('.').pop() || 'bin';
      const storagePath = `${user.id}/financial/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: uploadError } = await supabase
        .storage
        .from('financial_documents')
        .upload(storagePath, file, { upsert: false, cacheControl: '3600' });

      if (uploadError) {
        throw new Error(uploadError.message || 'Failed to upload financial document.');
      }

      const data = await authedFetch('/.netlify/functions/financial-intelligence', {
        method: 'POST',
        body: JSON.stringify({
          action: 'ingest_document',
          sourceType,
          storagePath,
          filename: file.name,
          mimeType: file.type,
          fileSizeBytes: file.size,
        }),
      });

      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to ingest financial document.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [authedFetch, user]);

  const saveObligation = useCallback(async (input: UpsertObligationInput) => {
    setSaving(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/financial-intelligence', {
        method: 'POST',
        body: JSON.stringify({ action: 'upsert_obligation', ...input }),
      });
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save obligation.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [authedFetch]);

  const saveGoal = useCallback(async (input: UpsertGoalInput) => {
    setSaving(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/financial-intelligence', {
        method: 'POST',
        body: JSON.stringify({ action: 'upsert_goal', ...input }),
      });
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goal.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [authedFetch]);

  const saveCalendarEvent = useCallback(async (input: UpsertCalendarEventInput) => {
    setSaving(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/financial-intelligence', {
        method: 'POST',
        body: JSON.stringify({ action: 'upsert_calendar_event', ...input }),
      });
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save calendar event.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [authedFetch]);

  const refreshInsights = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await authedFetch('/.netlify/functions/financial-intelligence', {
        method: 'POST',
        body: JSON.stringify({ action: 'refresh_insights' }),
      });
      setDashboard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh financial insights.');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [authedFetch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    dashboard,
    loading,
    saving,
    error,
    refresh,
    uploadAndIngestDocument,
    saveObligation,
    saveGoal,
    saveCalendarEvent,
    refreshInsights,
  };
}
