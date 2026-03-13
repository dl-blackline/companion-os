/**
 * Tests for the Settings system — SettingsContext, useSettings hook,
 * and real-time propagation across components.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import {
  SettingsProvider,
  useSettings,
  DEFAULT_SETTINGS,
} from '@/context/settings-context';
import { DEFAULT_USER_PREFERENCES } from '@/types';

// ── Mock Supabase client ────────────────────────────────────────────────────
vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'test-token' } },
      }),
    },
  },
  supabaseConfigured: true,
}));

// ── localStorage mock ───────────────────────────────────────────────────────
const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear()),
  get length() { return storage.size; },
  key: vi.fn((i: number) => Array.from(storage.keys())[i] ?? null),
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// ── Fetch mock ──────────────────────────────────────────────────────────────
const fetchMock = vi.fn();
globalThis.fetch = fetchMock;

// ── Helpers ─────────────────────────────────────────────────────────────────
function wrapper({ children }: { children: ReactNode }) {
  return <SettingsProvider>{children}</SettingsProvider>;
}

function mockFetchSuccess(prefs = {}) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ prefs }),
  });
}

function mockFetchFailure(error = 'Server error') {
  fetchMock.mockResolvedValue({
    ok: false,
    json: async () => ({ error }),
  });
}

// ── Setup / Teardown ────────────────────────────────────────────────────────
beforeEach(() => {
  storage.clear();
  fetchMock.mockReset();
  mockFetchSuccess();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

// ─────────────────────────────────────────────────────────────────────────────
// CompanionSettings (localStorage layer)
// ─────────────────────────────────────────────────────────────────────────────
describe('CompanionSettings (localStorage)', () => {
  it('initializes with defaults when nothing stored', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('loads previously stored settings from localStorage', () => {
    const custom = { ...DEFAULT_SETTINGS, aiName: 'My AI' };
    storage.set('companion-settings', JSON.stringify(custom));

    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings.aiName).toBe('My AI');
  });

  it('updateSettings merges patch and persists to localStorage', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => {
      result.current.updateSettings({ aiName: 'Nova' });
    });

    expect(result.current.settings.aiName).toBe('Nova');
    // Check localStorage was updated
    const stored = JSON.parse(storage.get('companion-settings')!);
    expect(stored.aiName).toBe('Nova');
  });

  it('updateModelSettings updates nested model config and localStorage', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => {
      result.current.updateModelSettings({ temperature: 0.9 });
    });

    expect(result.current.settings.modelSettings.temperature).toBe(0.9);
    const stored = JSON.parse(storage.get('companion-settings')!);
    expect(stored.modelSettings.temperature).toBe(0.9);
  });

  it('updateMemorySettings updates nested memory config', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => {
      result.current.updateMemorySettings({ autoCapture: false });
    });

    expect(result.current.settings.memorySettings.autoCapture).toBe(false);
  });

  it('updatePrivacySettings updates nested privacy config', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    act(() => {
      result.current.updatePrivacySettings({ auditTrail: false });
    });

    expect(result.current.settings.privacySettings.auditTrail).toBe(false);
  });

  it('persists settings across re-renders (same context)', () => {
    const { result, rerender } = renderHook(() => useSettings(), { wrapper });

    act(() => {
      result.current.updateSettings({ aiName: 'Persisted' });
    });

    rerender();
    expect(result.current.settings.aiName).toBe('Persisted');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UserPreferences (backend layer)
// ─────────────────────────────────────────────────────────────────────────────
describe('UserPreferences (backend)', () => {
  it('initializes with default preferences', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.prefs.ai_personality).toBe(DEFAULT_USER_PREFERENCES.ai_personality);
  });

  it('loads preferences from backend on mount', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ prefs: { ai_personality: 'direct' } }),
    });

    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => {
      expect(result.current.prefs.ai_personality).toBe('direct');
    });
  });

  it('updatePreferences applies optimistic update immediately', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    // Need initial load to complete
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Reset mock for save call
    mockFetchSuccess();

    await act(async () => {
      result.current.updatePreferences({ ai_tone: 'formal' });
    });

    // Should see the new value immediately (optimistic)
    expect(result.current.prefs.ai_tone).toBe('formal');
  });

  it('rolls back on save failure', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Make the save fail
    mockFetchFailure('Save failed');

    const originalTone = result.current.prefs.ai_tone;

    await act(async () => {
      await result.current.updatePreferences({ ai_tone: 'casual' });
    });

    // Should have rolled back
    expect(result.current.prefs.ai_tone).toBe(originalTone);
  });

  it('rolls back on network error', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    fetchMock.mockRejectedValueOnce(new Error('Network offline'));
    const originalPersonality = result.current.prefs.ai_personality;

    await act(async () => {
      await result.current.updatePreferences({ ai_personality: 'analytical' });
    });

    expect(result.current.prefs.ai_personality).toBe(originalPersonality);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Debounced preference saves
// ─────────────────────────────────────────────────────────────────────────────
describe('Debounced saves', () => {
  it('debounces rapid slider changes into one backend call', async () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    // Reset mock to track save calls
    fetchMock.mockClear();
    mockFetchSuccess();

    // Fire multiple rapid updates
    act(() => {
      result.current.updatePreferencesDebounced({ creativity_level: 0.5 });
      result.current.updatePreferencesDebounced({ creativity_level: 0.6 });
      result.current.updatePreferencesDebounced({ creativity_level: 0.7 });
    });

    // UI should show latest value immediately
    expect(result.current.prefs.creativity_level).toBe(0.7);

    // Backend should NOT have been called yet (debounce pending)
    const saveCallsBefore = fetchMock.mock.calls.filter(
      ([, opts]) => opts?.method === 'POST'
    ).length;
    expect(saveCallsBefore).toBe(0);

    // Advance past debounce timer
    await act(async () => {
      vi.advanceTimersByTime(700);
    });

    // Now one save should have been fired
    const saveCalls = fetchMock.mock.calls.filter(
      ([, opts]) => opts?.method === 'POST'
    );
    expect(saveCalls.length).toBe(1);

    // And it should contain the latest value
    const body = JSON.parse(saveCalls[0][1].body);
    expect(body.prefs.creativity_level).toBe(0.7);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Real-time propagation across components
// ─────────────────────────────────────────────────────────────────────────────
describe('Real-time propagation', () => {
  it('settings changes are visible to all consumers of useSettings', () => {
    // Two hooks sharing the same provider
    function ComponentA() {
      const { settings } = useSettings();
      return <div data-testid="comp-a">{settings.aiName}</div>;
    }

    function ComponentB() {
      const { settings, updateSettings } = useSettings();
      return (
        <div>
          <div data-testid="comp-b">{settings.aiName}</div>
          <button onClick={() => updateSettings({ aiName: 'Updated' })}>
            Change
          </button>
        </div>
      );
    }

    render(
      <SettingsProvider>
        <ComponentA />
        <ComponentB />
      </SettingsProvider>
    );

    expect(screen.getByTestId('comp-a').textContent).toBe(DEFAULT_SETTINGS.aiName);
    expect(screen.getByTestId('comp-b').textContent).toBe(DEFAULT_SETTINGS.aiName);

    // Trigger update from component B
    fireEvent.click(screen.getByText('Change'));

    // Both components should see the new value
    expect(screen.getByTestId('comp-a').textContent).toBe('Updated');
    expect(screen.getByTestId('comp-b').textContent).toBe('Updated');
  });

  it('preference changes propagate to all consumers', async () => {
    function PrefsReader() {
      const { prefs } = useSettings();
      return <div data-testid="reader">{prefs.ai_personality}</div>;
    }

    function PrefsWriter() {
      const { updatePreferences } = useSettings();
      return (
        <button onClick={() => updatePreferences({ ai_personality: 'coach' })}>
          Update
        </button>
      );
    }

    render(
      <SettingsProvider>
        <PrefsReader />
        <PrefsWriter />
      </SettingsProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('reader').textContent).toBe('warm');
    });

    mockFetchSuccess();
    fireEvent.click(screen.getByText('Update'));

    // Optimistic update should show immediately
    expect(screen.getByTestId('reader').textContent).toBe('coach');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Persistence across reloads (localStorage)
// ─────────────────────────────────────────────────────────────────────────────
describe('Persistence', () => {
  it('settings survive simulated reload (new provider with same storage)', () => {
    // First render — change settings
    const { result, unmount } = renderHook(() => useSettings(), { wrapper });

    act(() => {
      result.current.updateSettings({ aiName: 'Reloaded AI' });
      result.current.updateModelSettings({ temperature: 0.3 });
    });

    unmount();

    // Second render — new provider reads from localStorage
    const { result: result2 } = renderHook(() => useSettings(), { wrapper });
    expect(result2.current.settings.aiName).toBe('Reloaded AI');
    expect(result2.current.settings.modelSettings.temperature).toBe(0.3);
  });
});
