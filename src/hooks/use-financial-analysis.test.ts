import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFinancialAnalysis } from '@/hooks/use-financial-analysis';

const mockGetAccessToken = vi.fn(() => 'mock-token');
const mockUser = { id: 'user-123' };

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    getAccessToken: mockGetAccessToken,
    user: mockUser,
  }),
}));

function makeDashboard(overrides = {}) {
  return {
    success: true,
    data: {
      incomeSignals: [],
      expenseSignals: [],
      cashFlowPeriods: [],
      incomeAnalysis: null,
      balanceSnapshots: [],
      goals: [],
      summary: {
        estimatedMonthlyIncome: 0,
        estimatedMonthlyExpenses: 0,
        estimatedMonthlySurplus: 0,
        incomeSourceCount: 0,
        recurringExpenseCount: 0,
        incomeConfidence: 0,
        lastAnalyzedAt: null,
      },
      ...overrides,
    },
  };
}

describe('useFinancialAnalysis', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('loads analysis dashboard on mount', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makeDashboard({ incomeSignals: [{ id: 'sig-1', signal_name: 'payroll' }] }),
    } as Response);

    const { result } = renderHook(() => useFinancialAnalysis());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.dashboard.incomeSignals).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/.netlify/functions/financial-analysis',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
      }),
    );
  });

  it('sends auth header with all requests', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => makeDashboard(),
    } as Response);

    const { result } = renderHook(() => useFinancialAnalysis());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toHaveProperty('Authorization', 'Bearer mock-token');
  });

  it('runs full analysis via POST', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard(),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard({
          summary: {
            estimatedMonthlyIncome: 5000,
            estimatedMonthlyExpenses: 3000,
            estimatedMonthlySurplus: 2000,
            incomeSourceCount: 2,
            recurringExpenseCount: 5,
            incomeConfidence: 0.85,
            lastAnalyzedAt: '2026-04-01T00:00:00Z',
          },
        }),
      } as Response);

    const { result } = renderHook(() => useFinancialAnalysis());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.runAnalysis();
    });

    expect(result.current.dashboard.summary.estimatedMonthlyIncome).toBe(5000);
    expect(result.current.dashboard.summary.incomeSourceCount).toBe(2);

    const postCall = fetchMock.mock.calls[1];
    expect(postCall[0]).toBe('/.netlify/functions/financial-analysis');
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({ action: 'run_analysis' });
  });

  it('confirms an income signal', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard(),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard({
          incomeSignals: [{ id: 'sig-1', signal_name: 'payroll', is_user_confirmed: true }],
        }),
      } as Response);

    const { result } = renderHook(() => useFinancialAnalysis());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.confirmIncomeSignal('sig-1', 'My Payroll');
    });

    const postCall = fetchMock.mock.calls[1];
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: 'confirm_income_signal',
      signalId: 'sig-1',
      userLabel: 'My Payroll',
    });

    expect(result.current.dashboard.incomeSignals[0].is_user_confirmed).toBe(true);
  });

  it('dismisses a signal', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard(),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard({ expenseSignals: [] }),
      } as Response);

    const { result } = renderHook(() => useFinancialAnalysis());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.dismissSignal('exp-1', 'expense');
    });

    const postCall = fetchMock.mock.calls[1];
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: 'dismiss_signal',
      signalId: 'exp-1',
      signalType: 'expense',
    });
  });

  it('confirms an expense signal with obligation link', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard(),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard(),
      } as Response);

    const { result } = renderHook(() => useFinancialAnalysis());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.confirmExpenseSignal('exp-1', 'Netflix', true);
    });

    const postCall = fetchMock.mock.calls[1];
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: 'confirm_expense_signal',
      signalId: 'exp-1',
      userLabel: 'Netflix',
      linkToObligation: true,
    });
  });

  it('handles API error gracefully', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: 'Server error' }),
    } as Response);

    const { result } = renderHook(() => useFinancialAnalysis());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Server error');
  });

  it('handles analysis failure gracefully', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard(),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: 'Analysis timeout' }),
      } as Response);

    const { result } = renderHook(() => useFinancialAnalysis());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      try { await result.current.runAnalysis(); } catch { /* expected */ }
    });

    expect(result.current.error).toBe('Analysis timeout');
    expect(result.current.analyzing).toBe(false);
  });

  it('sets analyzing state during analysis', async () => {
    const fetchMock = vi.mocked(fetch);
    let resolveAnalysis: (value: Response) => void;
    const analysisPromise = new Promise<Response>((r) => { resolveAnalysis = r; });

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard(),
      } as Response)
      .mockReturnValueOnce(analysisPromise as unknown as Promise<Response>);

    const { result } = renderHook(() => useFinancialAnalysis());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    let analysisFinished = false;
    act(() => {
      result.current.runAnalysis().then(() => { analysisFinished = true; });
    });

    expect(result.current.analyzing).toBe(true);

    await act(async () => {
      resolveAnalysis!({
        ok: true,
        json: async () => makeDashboard(),
      } as Response);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.analyzing).toBe(false);
  });
});
