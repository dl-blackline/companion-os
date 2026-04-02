import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type { BillDecoderDashboard, DecodedBill } from '@/types/premium-finance';

const EMPTY: BillDecoderDashboard = {
  bills: [],
  pendingReviewCount: 0,
  confirmedCount: 0,
  rejectedCount: 0,
  mergedCount: 0,
};

export function useBillDecoder() {
  const { getAccessToken, user } = useAuth();
  const [dashboard, setDashboard] = useState<BillDecoderDashboard>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [decoding, setDecoding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const authedFetch = useCallback(async (input: string, init?: RequestInit) => {
    const token = getAccessToken();
    if (!token) throw new Error('You must be signed in.');
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
      throw new Error(payload?.error || 'Bill decoder request failed.');
    }
    return payload.data;
  }, [getAccessToken]);

  const refresh = useCallback(async () => {
    if (!user) {
      setDashboard(EMPTY);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await authedFetch('/.netlify/functions/bill-decoder');
      setDashboard(data as BillDecoderDashboard);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load decoded bills.');
    } finally {
      setLoading(false);
    }
  }, [user, authedFetch]);

  useEffect(() => { void refresh(); }, [refresh]);

  const decodeDocument = useCallback(async (documentId: string): Promise<DecodedBill | null> => {
    try {
      setDecoding(true);
      setError(null);
      const data = await authedFetch('/.netlify/functions/bill-decoder', {
        method: 'POST',
        body: JSON.stringify({ action: 'decode_document', documentId }),
      });
      await refresh();
      return (data as { bill: DecodedBill }).bill;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decoding failed.');
      return null;
    } finally {
      setDecoding(false);
    }
  }, [authedFetch, refresh]);

  const confirmBill = useCallback(async (billId: string, createObligation = true) => {
    await authedFetch('/.netlify/functions/bill-decoder', {
      method: 'POST',
      body: JSON.stringify({ action: 'confirm_bill', billId, createObligation }),
    });
    await refresh();
  }, [authedFetch, refresh]);

  const rejectBill = useCallback(async (billId: string) => {
    await authedFetch('/.netlify/functions/bill-decoder', {
      method: 'POST',
      body: JSON.stringify({ action: 'reject_bill', billId }),
    });
    await refresh();
  }, [authedFetch, refresh]);

  const updateBillField = useCallback(async (billId: string, fieldName: string, fieldValue: unknown) => {
    await authedFetch('/.netlify/functions/bill-decoder', {
      method: 'POST',
      body: JSON.stringify({ action: 'update_bill_field', billId, fieldName, fieldValue }),
    });
    await refresh();
  }, [authedFetch, refresh]);

  const mergeBillToObligation = useCallback(async (billId: string, obligationId: string) => {
    await authedFetch('/.netlify/functions/bill-decoder', {
      method: 'POST',
      body: JSON.stringify({ action: 'merge_to_obligation', billId, obligationId }),
    });
    await refresh();
  }, [authedFetch, refresh]);

  return {
    dashboard,
    loading,
    decoding,
    error,
    refresh,
    decodeDocument,
    confirmBill,
    rejectBill,
    updateBillField,
    mergeBillToObligation,
  };
}
