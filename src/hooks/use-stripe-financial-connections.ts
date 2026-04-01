import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type {
  StripeFinancialAccount,
  StripeFinancialConnectionsState,
  CreateSessionResult,
} from '@/types/stripe-financial';

const ENDPOINT = '/.netlify/functions/stripe-financial-connections';

const EMPTY_STATE: StripeFinancialConnectionsState = {
  configured: false,
  accounts: [],
  count: 0,
};

export function useStripeFinancialConnections() {
  const { getAccessToken, user } = useAuth();
  const [state, setState] = useState<StripeFinancialConnectionsState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authedFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      const token = getAccessToken();
      if (!token) {
        throw new Error('You must be signed in to access financial connections.');
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
        throw new Error(payload?.error || 'Financial connections request failed.');
      }

      return payload.data;
    },
    [getAccessToken],
  );

  /** Load the list of linked accounts from the backend. */
  const refresh = useCallback(async () => {
    if (!user) {
      setState(EMPTY_STATE);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await authedFetch(ENDPOINT);
      setState(data as StripeFinancialConnectionsState);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load linked accounts.');
    } finally {
      setLoading(false);
    }
  }, [authedFetch, user]);

  /**
   * Start the bank linking flow:
   * 1. Create a Financial Connections Session on the backend
   * 2. Return the client secret for the frontend to launch Stripe.js
   */
  const createSession = useCallback(async (): Promise<CreateSessionResult> => {
    setError(null);
    const data = await authedFetch(ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({ action: 'create_session' }),
    });
    return data as CreateSessionResult;
  }, [authedFetch]);

  /**
   * After the user completes the Stripe FC flow, send the session ID
   * to the backend to retrieve and persist the linked accounts.
   */
  const completeSession = useCallback(
    async (sessionId: string) => {
      setLinking(true);
      setError(null);
      try {
        const data = await authedFetch(ENDPOINT, {
          method: 'POST',
          body: JSON.stringify({ action: 'complete_session', sessionId }),
        });
        setState(data as StripeFinancialConnectionsState);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to complete account linking.');
        throw err;
      } finally {
        setLinking(false);
      }
    },
    [authedFetch],
  );

  /** Disconnect a linked account by its internal DB id. */
  const disconnect = useCallback(
    async (accountId: string) => {
      setError(null);
      try {
        const data = await authedFetch(ENDPOINT, {
          method: 'POST',
          body: JSON.stringify({ action: 'disconnect', accountId }),
        });
        setState(data as StripeFinancialConnectionsState);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to disconnect account.');
        throw err;
      }
    },
    [authedFetch],
  );

  /** Refresh account metadata from Stripe. Pass accountId to refresh one, or omit for all. */
  const refreshAccount = useCallback(
    async (accountId?: string) => {
      setError(null);
      try {
        const data = await authedFetch(ENDPOINT, {
          method: 'POST',
          body: JSON.stringify({ action: 'refresh', accountId }),
        });
        setState(data as StripeFinancialConnectionsState);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to refresh account data.');
      }
    },
    [authedFetch],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    /** Current state (configured, accounts, count) */
    state,
    /** Individual accounts for convenience */
    accounts: state.accounts,
    /** Whether initial load is in progress */
    loading,
    /** Whether a linking session is being completed */
    linking,
    /** Last error message */
    error,
    /** Reload accounts from backend */
    refresh,
    /** Create a new FC session for linking */
    createSession,
    /** Complete a session after user finishes Stripe flow */
    completeSession,
    /** Disconnect an account */
    disconnect,
    /** Refresh account metadata from Stripe */
    refreshAccount,
  };
}

export type { StripeFinancialAccount };
