import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/auth-context';
import type {
  NormalizedTransaction,
  TransactionFeedResponse,
  TransactionFilters,
  TransactionPagination,
  CategoriesDashboard,
  TransactionCategory,
} from '@/types/stripe-financial';

const TX_URL = '/.netlify/functions/transaction-manager';

const EMPTY_PAGINATION: TransactionPagination = {
  limit: 50,
  offset: 0,
  total: 0,
  hasMore: false,
};

export function useTransactionFeed() {
  const { getAccessToken, user } = useAuth();
  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
  const [pagination, setPagination] = useState<TransactionPagination>(EMPTY_PAGINATION);
  const [categories, setCategories] = useState<TransactionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TransactionFilters>({});

  const authedFetch = useCallback(
    async (input: string, init?: RequestInit) => {
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
        throw new Error(payload?.error || 'Request failed.');
      }
      return payload.data;
    },
    [getAccessToken],
  );

  const loadTransactions = useCallback(
    async (f: TransactionFilters = {}, append = false) => {
      if (!user) return;

      if (!append) setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (f.connectionId) params.set('connectionId', f.connectionId);
        if (f.institution) params.set('institution', f.institution);
        if (f.category) params.set('category', f.category);
        if (f.userCategory) params.set('userCategory', f.userCategory);
        if (f.dateFrom) params.set('dateFrom', f.dateFrom);
        if (f.dateTo) params.set('dateTo', f.dateTo);
        if (f.amountMin) params.set('amountMin', f.amountMin);
        if (f.amountMax) params.set('amountMax', f.amountMax);
        if (f.direction) params.set('direction', f.direction);
        if (f.hasNotes) params.set('hasNotes', f.hasNotes);
        if (f.search) params.set('search', f.search);
        if (f.limit) params.set('limit', String(f.limit));
        if (f.offset) params.set('offset', String(f.offset));

        const qs = params.toString();
        const url = qs ? `${TX_URL}?${qs}` : TX_URL;

        const data = (await authedFetch(url)) as TransactionFeedResponse;

        if (append) {
          setTransactions((prev) => [...prev, ...data.transactions]);
        } else {
          setTransactions(data.transactions);
        }
        setPagination(data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load transactions.');
      } finally {
        setLoading(false);
      }
    },
    [authedFetch, user],
  );

  const loadMore = useCallback(() => {
    if (!pagination.hasMore) return;
    const nextFilters = { ...filters, offset: pagination.offset + pagination.limit };
    void loadTransactions(nextFilters, true);
  }, [filters, pagination, loadTransactions]);

  const applyFilters = useCallback(
    (newFilters: TransactionFilters) => {
      const merged = { ...newFilters, offset: 0 };
      setFilters(merged);
      void loadTransactions(merged);
    },
    [loadTransactions],
  );

  const updateCategory = useCallback(
    async (transactionId: string, category: string) => {
      setError(null);
      try {
        await authedFetch(TX_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'update_category', transactionId, category }),
        });
        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === transactionId ? { ...tx, user_category_override: category } : tx,
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update category.');
      }
    },
    [authedFetch],
  );

  const updateNotes = useCallback(
    async (transactionId: string, notes: string) => {
      setError(null);
      try {
        await authedFetch(TX_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'update_notes', transactionId, notes }),
        });
        setTransactions((prev) =>
          prev.map((tx) =>
            tx.id === transactionId ? { ...tx, notes: notes || null } : tx,
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update notes.');
      }
    },
    [authedFetch],
  );

  const loadCategories = useCallback(async () => {
    try {
      const data = (await authedFetch(TX_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'list_categories' }),
      })) as CategoriesDashboard;
      setCategories(data.categories);
    } catch {
      // Categories are not critical
    }
  }, [authedFetch]);

  const createCategory = useCallback(
    async (name: string, icon?: string, color?: string) => {
      setError(null);
      try {
        await authedFetch(TX_URL, {
          method: 'POST',
          body: JSON.stringify({ action: 'create_category', name, icon, color }),
        });
        await loadCategories();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create category.');
      }
    },
    [authedFetch, loadCategories],
  );

  useEffect(() => {
    void loadTransactions({});
    void loadCategories();
  }, [loadTransactions, loadCategories]);

  return {
    transactions,
    pagination,
    categories,
    loading,
    error,
    filters,
    applyFilters,
    loadMore,
    updateCategory,
    updateNotes,
    createCategory,
    refresh: () => loadTransactions(filters),
  };
}
