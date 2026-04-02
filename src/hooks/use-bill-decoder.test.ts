import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBillDecoder } from '@/hooks/use-bill-decoder';

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
      bills: [],
      pendingReviewCount: 0,
      confirmedCount: 0,
      rejectedCount: 0,
      mergedCount: 0,
      ...overrides,
    },
  };
}

const mockBill = {
  id: 'bill-1',
  user_id: 'user-123',
  document_id: 'doc-1',
  bill_type: 'utility',
  provider_name: 'City Power',
  total_due: 145.30,
  minimum_due: 145.30,
  due_date: '2026-04-15',
  extraction_confidence: 0.92,
  review_status: 'pending_review',
};

describe('useBillDecoder', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('loads bill decoder dashboard on mount', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makeDashboard({ bills: [mockBill], pendingReviewCount: 1 }),
    } as Response);

    const { result } = renderHook(() => useBillDecoder());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.dashboard.bills).toHaveLength(1);
    expect(result.current.dashboard.pendingReviewCount).toBe(1);
    expect(fetchMock).toHaveBeenCalledWith(
      '/.netlify/functions/bill-decoder',
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

    renderHook(() => useBillDecoder());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.headers).toHaveProperty('Authorization', 'Bearer mock-token');
  });

  it('decodes a document via POST', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard(),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { bill: mockBill } }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard({ bills: [mockBill], pendingReviewCount: 1 }),
      } as Response);

    const { result } = renderHook(() => useBillDecoder());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    let decodedBill: unknown;
    await act(async () => {
      decodedBill = await result.current.decodeDocument('doc-1');
    });

    expect(decodedBill).toEqual(mockBill);

    const postCall = fetchMock.mock.calls[1];
    expect(postCall[0]).toBe('/.netlify/functions/bill-decoder');
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: 'decode_document',
      documentId: 'doc-1',
    });
  });

  it('confirms a bill', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard({ bills: [mockBill] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard({ bills: [{ ...mockBill, review_status: 'confirmed' }], confirmedCount: 1 }),
      } as Response);

    const { result } = renderHook(() => useBillDecoder());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.confirmBill('bill-1', true);
    });

    const postCall = fetchMock.mock.calls[1];
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: 'confirm_bill',
      billId: 'bill-1',
      createObligation: true,
    });

    expect(result.current.dashboard.confirmedCount).toBe(1);
  });

  it('rejects a bill', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard({ bills: [mockBill] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: {} }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard({ rejectedCount: 1 }),
      } as Response);

    const { result } = renderHook(() => useBillDecoder());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.rejectBill('bill-1');
    });

    const postCall = fetchMock.mock.calls[1];
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: 'reject_bill',
      billId: 'bill-1',
    });
  });

  it('updates a bill field', async () => {
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
        json: async () => makeDashboard(),
      } as Response);

    const { result } = renderHook(() => useBillDecoder());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.updateBillField('bill-1', 'total_due', 150.00);
    });

    const postCall = fetchMock.mock.calls[1];
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: 'update_bill_field',
      billId: 'bill-1',
      fieldName: 'total_due',
      fieldValue: 150.00,
    });
  });

  it('merges a bill to an obligation', async () => {
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
        json: async () => makeDashboard({ mergedCount: 1 }),
      } as Response);

    const { result } = renderHook(() => useBillDecoder());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    await act(async () => {
      await result.current.mergeBillToObligation('bill-1', 'obl-99');
    });

    const postCall = fetchMock.mock.calls[1];
    expect(JSON.parse(postCall[1]?.body as string)).toEqual({
      action: 'merge_to_obligation',
      billId: 'bill-1',
      obligationId: 'obl-99',
    });

    expect(result.current.dashboard.mergedCount).toBe(1);
  });

  it('handles API error gracefully on mount', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ success: false, error: 'Server error' }),
    } as Response);

    const { result } = renderHook(() => useBillDecoder());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe('Server error');
  });

  it('handles decode failure gracefully', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard(),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ success: false, error: 'Extraction failed' }),
      } as Response);

    const { result } = renderHook(() => useBillDecoder());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    let bill: unknown;
    await act(async () => {
      bill = await result.current.decodeDocument('bad-doc');
    });

    expect(bill).toBeNull();
    expect(result.current.error).toBe('Extraction failed');
    expect(result.current.decoding).toBe(false);
  });

  it('sets decoding state during document decode', async () => {
    const fetchMock = vi.mocked(fetch);
    let resolveDecoding: (value: Response) => void;
    const decodingPromise = new Promise<Response>((r) => { resolveDecoding = r; });

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => makeDashboard(),
      } as Response)
      .mockReturnValueOnce(decodingPromise as unknown as Promise<Response>);

    const { result } = renderHook(() => useBillDecoder());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    let decodeFinished = false;
    act(() => {
      result.current.decodeDocument('doc-1').then(() => { decodeFinished = true; });
    });

    expect(result.current.decoding).toBe(true);

    await act(async () => {
      resolveDecoding!({
        ok: true,
        json: async () => ({ success: true, data: { bill: mockBill } }),
      } as Response);
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.decoding).toBe(false);
  });

  it('requires auth token', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => makeDashboard(),
    } as Response);

    const { result } = renderHook(() => useBillDecoder());

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    mockGetAccessToken.mockReturnValueOnce(null as unknown as string);

    let bill: unknown;
    await act(async () => {
      bill = await result.current.decodeDocument('doc-1');
    });

    expect(bill).toBeNull();
    expect(result.current.error).toBe('You must be signed in.');
  });
});
