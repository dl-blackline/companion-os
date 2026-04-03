import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRuntimeHealth } from '@/hooks/use-runtime-health';

function okPayload() {
  return {
    data: {
      openai: 'ok',
      supabase: 'ok',
      vector_search: 'ok',
      media: 'ok',
      leonardo: 'ok',
    },
  };
}

describe('useRuntimeHealth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
    (window as typeof window & { SpeechRecognition?: unknown }).SpeechRecognition = function MockSpeechRecognition() {} as unknown as typeof SpeechRecognition;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('retries transient failures and eventually reports healthy', async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock
      .mockRejectedValueOnce(new Error('network-1'))
      .mockRejectedValueOnce(new Error('network-2'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => okPayload(),
      } as Response);

    const { result } = renderHook(() => useRuntimeHealth(60000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(result.current.state).toBe('healthy');

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('keeps previous healthy state during a single failed poll cycle', async () => {
    const fetchMock = vi.mocked(fetch);

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => okPayload(),
      } as Response)
      .mockRejectedValue(new Error('network-down'));

    const { result } = renderHook(() => useRuntimeHealth(10000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(result.current.state).toBe('healthy');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(12000);
    });

    expect(result.current.state).toBe('healthy');
  });

  it('reports down after repeated failed poll cycles', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new Error('network-down'));

    const { result } = renderHook(() => useRuntimeHealth(3000));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(13000);
    });

    expect(result.current.state).toBe('down');
    expect(result.current.unavailableServices).toContain('health-check');
  });
});
