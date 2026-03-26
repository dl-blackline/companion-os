import { useCallback, useEffect, useState } from 'react';
import type { EntitlementPlan, EntitlementStatus } from '@/types';
import { useAuth } from '@/context/auth-context';

interface SubscriptionState {
  loading: boolean;
  error: string | null;
  customerId: string | null;
  stripeSubscriptionId: string | null;
  currentPlan: EntitlementPlan;
  status: EntitlementStatus;
  trialEndsAt: string | null;
  expiresAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canManageBilling: boolean;
  usage: Record<string, {
    used: number;
    limit: number | null;
    remaining: number | null;
    windowStart: string;
  }>;
}

const INITIAL_STATE: SubscriptionState = {
  loading: false,
  error: null,
  customerId: null,
  stripeSubscriptionId: null,
  currentPlan: 'free',
  status: 'none',
  trialEndsAt: null,
  expiresAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  canManageBilling: false,
  usage: {},
};

export function useSubscription() {
  const { user, configured, getAccessToken, plan } = useAuth();
  const [state, setState] = useState<SubscriptionState>({
    ...INITIAL_STATE,
    currentPlan: plan,
  });

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const token = getAccessToken();
    if (!token) {
      throw new Error('You must be signed in to manage subscriptions.');
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
      throw new Error(payload?.error || 'Subscription request failed.');
    }

    return payload.data;
  }, [getAccessToken]);

  const refresh = useCallback(async () => {
    if (!configured || !user) {
      setState((prev) => ({ ...prev, loading: false, currentPlan: plan }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const data = await authedFetch('/.netlify/functions/billing-subscription');
      setState({
        loading: false,
        error: null,
        customerId: data.customerId ?? null,
        stripeSubscriptionId: data.stripeSubscriptionId ?? null,
        currentPlan: data.currentPlan ?? plan,
        status: data.status ?? 'none',
        trialEndsAt: data.trialEndsAt ?? null,
        expiresAt: data.expiresAt ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: Boolean(data.cancelAtPeriodEnd),
        canManageBilling: Boolean(data.canManageBilling),
        usage: data.usage ?? {},
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to fetch subscription details.',
      }));
    }
  }, [authedFetch, configured, plan, user]);

  const startCheckout = useCallback(async (targetPlan: Extract<EntitlementPlan, 'pro' | 'enterprise'>) => {
    const data = await authedFetch('/.netlify/functions/billing-subscription', {
      method: 'POST',
      body: JSON.stringify({ action: 'checkout', plan: targetPlan }),
    });

    if (!data?.checkoutUrl) {
      throw new Error('Missing checkout URL from billing service.');
    }

    return String(data.checkoutUrl);
  }, [authedFetch]);

  const openBillingPortal = useCallback(async () => {
    const data = await authedFetch('/.netlify/functions/billing-subscription', {
      method: 'POST',
      body: JSON.stringify({ action: 'portal' }),
    });

    if (!data?.portalUrl) {
      throw new Error('Missing billing portal URL from billing service.');
    }

    return String(data.portalUrl);
  }, [authedFetch]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setState((prev) => ({ ...prev, currentPlan: plan }));
  }, [plan]);

  return {
    ...state,
    refresh,
    startCheckout,
    openBillingPortal,
  };
}
