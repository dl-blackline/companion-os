import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

/* ── Mocks ──────────────────────────────────────────────────────────── */

const mockGetAccessToken = vi.fn(() => 'test-token');
const mockUser = { id: 'user-123', email: 'test@example.com' };

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    getAccessToken: mockGetAccessToken,
    user: mockUser,
  }),
}));

import { useStripeFinancialConnections } from '@/hooks/use-stripe-financial-connections';

/* ── Helpers ────────────────────────────────────────────────────────── */

function makeAccount(overrides?: Record<string, unknown>) {
  return {
    id: 'db-uuid-1',
    stripe_financial_connection_account_id: 'fca_test_123',
    institution_name: 'Chase',
    account_display_name: 'Checking ••1234',
    account_type: 'checking',
    account_subtype: 'checking',
    account_status: 'active',
    last4: '1234',
    livemode: false,
    permissions: ['balances'],
    supported_payment_method_types: ['us_bank_account'],
    balance_refresh_status: null,
    ownership_refresh_status: null,
    transaction_refresh_status: null,
    linked_at: '2026-04-01T00:00:00Z',
    updated_at: '2026-04-01T00:00:00Z',
    disconnected_at: null,
    metadata: {},
    ...overrides,
  };
}

function successResponse(data: unknown) {
  return new Response(
    JSON.stringify({ success: true, data }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}

function errorResponse(error: string, code = 'ERR_TEST') {
  return new Response(
    JSON.stringify({ success: false, error, code }),
    { status: 500, headers: { 'Content-Type': 'application/json' } },
  );
}

/* ── Tests ──────────────────────────────────────────────────────────── */

describe('useStripeFinancialConnections', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAccessToken.mockReturnValue('test-token');
    // Restore user fields in case a previous test modified them
    mockUser.id = 'user-123';
    mockUser.email = 'test@example.com';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('loads linked accounts on mount', async () => {
    const account = makeAccount();
    globalThis.fetch = vi.fn(async () =>
      successResponse({ configured: true, accounts: [account], count: 1 }),
    );

    const { result } = renderHook(() => useStripeFinancialConnections());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accounts).toHaveLength(1);
    expect(result.current.accounts[0].institution_name).toBe('Chase');
    expect(result.current.state.configured).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('createSession calls backend with correct action', async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.method === 'POST') {
        capturedBody = JSON.parse(init.body as string);
      }
      return successResponse({
        configured: true,
        clientSecret: 'fcsess_secret_test',
        sessionId: 'fcsess_test_123',
      });
    });

    const { result } = renderHook(() => useStripeFinancialConnections());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let sessionResult: unknown;
    await act(async () => {
      sessionResult = await result.current.createSession();
    });

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.action).toBe('create_session');
    expect((sessionResult as { clientSecret: string }).clientSecret).toBe('fcsess_secret_test');
  });

  it('completeSession sends sessionId and updates state', async () => {
    const account = makeAccount();
    let callCount = 0;

    globalThis.fetch = vi.fn(async () => {
      callCount++;
      // First call is the initial GET load
      if (callCount === 1) {
        return successResponse({ configured: true, accounts: [], count: 0 });
      }
      // Second call is the complete_session POST
      return successResponse({ configured: true, accounts: [account], count: 1 });
    });

    const { result } = renderHook(() => useStripeFinancialConnections());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accounts).toHaveLength(0);

    await act(async () => {
      await result.current.completeSession('fcsess_test_123');
    });

    expect(result.current.accounts).toHaveLength(1);
    expect(result.current.accounts[0].institution_name).toBe('Chase');
    expect(result.current.linking).toBe(false);
  });

  it('disconnect removes account from state', async () => {
    const account = makeAccount();
    let callCount = 0;

    globalThis.fetch = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return successResponse({ configured: true, accounts: [account], count: 1 });
      }
      return successResponse({ configured: true, accounts: [], count: 0 });
    });

    const { result } = renderHook(() => useStripeFinancialConnections());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.accounts).toHaveLength(1);

    await act(async () => {
      await result.current.disconnect('db-uuid-1');
    });

    expect(result.current.accounts).toHaveLength(0);
  });

  it('sets error on failed fetch', async () => {
    globalThis.fetch = vi.fn(async () => errorResponse('Server error'));

    const { result } = renderHook(() => useStripeFinancialConnections());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Server error');
    expect(result.current.accounts).toHaveLength(0);
  });

  it('sends Authorization header with token', async () => {
    let capturedHeaders: Record<string, string> = {};

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = init?.headers as Record<string, string> | undefined;
      if (headers) capturedHeaders = headers;
      return successResponse({ configured: true, accounts: [], count: 0 });
    });

    renderHook(() => useStripeFinancialConnections());

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalled();
    });

    expect(capturedHeaders.Authorization).toBe('Bearer test-token');
  });

  it('sets error when user is not signed in', async () => {
    mockGetAccessToken.mockReturnValue(null as unknown as string);

    globalThis.fetch = vi.fn();

    const { result } = renderHook(() => useStripeFinancialConnections());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(typeof result.current.error).toBe('string');
  });
});
