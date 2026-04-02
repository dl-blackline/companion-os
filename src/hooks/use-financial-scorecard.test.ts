import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFinancialScorecard } from '@/hooks/use-financial-scorecard';

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
      scorecard: null,
      vehicles: [],
      equitySnapshots: [],
      ...overrides,
    },
  };
}

const mockScorecard = {
  id: 'sc-1',
  user_id: 'user-123',
  overall_score: 72,
  overall_label: 'stable',
  liquidity_score: 80,
  liquidity_label: 'strong',
  bill_pressure_score: 65,
  bill_pressure_label: 'moderate',
  debt_pressure_score: 55,
  debt_pressure_label: 'under pressure',
  savings_health_score: 70,
  savings_health_label: 'stable',
  organization_score: 85,
  organization_label: 'strong',
  vehicle_position_score: 60,
  vehicle_position_label: 'moderate',
  strongest_area: 'organization',
  most_urgent_area: 'debt_pressure',
  next_actions: [{ type: 'review_bill', priority: 1, label: 'Review 2 pending bills' }],
  insights: [{ type: 'utilization', message: 'Credit utilization at 45%' }],
};

const mockVehicle = {
  id: 'veh-1',
  user_id: 'user-123',
  year: 2022,
  make: 'Toyota',
  model: 'Camry',
  trim: 'SE',
  mileage: 35000,
  condition: 'good',
  current_payoff: 18000,
  monthly_payment: 450,
  estimated_value: 24000,
  equity_position: 6000,
  status: 'active',
};

describe('useFinancialScorecard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('loads scorecard dashboard on mount', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makeDashboard({
        scorecard: mockScorecard,
        vehicles: [mockVehicle],
      }),
    } as Response);

    const { result } = renderHook(() => useFinancialScorecard());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.dashboard.scorecard).toBeTruthy();
    expect(result.current.dashboard.scorecard?.overall_score).toBe(72);
    expect(result.current.dashboard.vehicles).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/.netlify/functions/financial-scorecard',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
      }),
    );
  });

  it('computes scorecard via POST', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard(),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { scorecard: mockScorecard } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard({ scorecard: mockScorecard }),
      } as Response);

    const { result } = renderHook(() => useFinancialScorecard());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.computeScorecard();
    });

    const postCall = fetchMock.mock.calls[1];
    expect(postCall[0]).toBe('/.netlify/functions/financial-scorecard');
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: 'compute_scorecard',
    });
  });

  it('upserts a vehicle', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard(),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard({ vehicles: [mockVehicle] }),
      } as Response);

    const { result } = renderHook(() => useFinancialScorecard());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.upsertVehicle({
        year: 2022,
        make: 'Toyota',
        model: 'Camry',
        trim: 'SE',
        mileage: 35000,
        current_payoff: 18000,
        monthly_payment: 450,
        estimated_value: 24000,
      });
    });

    const postCall = fetchMock.mock.calls[1];
    const body = JSON.parse(postCall[1]?.body as string);
    expect(body.action).toBe('upsert_vehicle');
    expect(body.year).toBe(2022);
    expect(body.make).toBe('Toyota');
    expect(body.model).toBe('Camry');

    expect(result.current.dashboard.vehicles).toHaveLength(1);
  });

  it('deletes a vehicle', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard({ vehicles: [mockVehicle] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard({ vehicles: [] }),
      } as Response);

    const { result } = renderHook(() => useFinancialScorecard());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.dashboard.vehicles).toHaveLength(1);

    await act(async () => {
      await result.current.deleteVehicle('veh-1');
    });

    const postCall = fetchMock.mock.calls[1];
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: 'delete_vehicle',
      vehicleId: 'veh-1',
    });

    expect(result.current.dashboard.vehicles).toHaveLength(0);
  });

  it('handles API error gracefully on mount', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: 'Server error' }),
    } as Response);

    const { result } = renderHook(() => useFinancialScorecard());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Server error');
  });

  it('handles compute failure gracefully', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard(),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: 'Computation timeout' }),
      } as Response);

    const { result } = renderHook(() => useFinancialScorecard());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.computeScorecard();
    });

    expect(result.current.error).toBe('Computation timeout');
    expect(result.current.computing).toBe(false);
  });

  it('sets computing state during scorecard computation', async () => {
    const fetchMock = vi.mocked(fetch);
    let resolveCompute: (value: Response) => void;
    const computePromise = new Promise<Response>((r) => { resolveCompute = r; });

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard(),
      } as Response)
      .mockReturnValueOnce(computePromise as unknown as Promise<Response>);

    const { result } = renderHook(() => useFinancialScorecard());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    act(() => {
      result.current.computeScorecard();
    });

    expect(result.current.computing).toBe(true);

    await act(async () => {
      resolveCompute!({
        ok: true,
        json: async () => ({ success: true, data: { scorecard: mockScorecard } }),
      } as Response);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.computing).toBe(false);
  });

  it('requires auth token for actions', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makeDashboard(),
    } as Response);

    const { result } = renderHook(() => useFinancialScorecard());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    mockGetAccessToken.mockReturnValueOnce(null as unknown as string);

    await act(async () => {
      await result.current.computeScorecard();
    });

    expect(result.current.error).toBe('You must be signed in.');
  });

  it('returns empty dashboard when no scorecard exists', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makeDashboard(),
    } as Response);

    const { result } = renderHook(() => useFinancialScorecard());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.dashboard.scorecard).toBeNull();
    expect(result.current.dashboard.vehicles).toEqual([]);
    expect(result.current.dashboard.equitySnapshots).toEqual([]);
  });
});
