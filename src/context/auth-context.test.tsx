/**
 * Tests for AuthContext — login, logout, session restore, auth state hydration,
 * and protection against false "unauthenticated" states.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React, { type ReactNode } from 'react';
import { AuthProvider, useAuth, useRequireAuth, useSessionRestore } from '@/context/auth-context';

// ── Supabase mock state ─────────────────────────────────────────────────────
let authChangeCallback: ((event: string, session: unknown) => void) | null = null;
const unsubscribe = vi.fn();

const mockGetSession = vi.fn();
const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockOnAuthStateChange = vi.fn((cb: (event: string, session: unknown) => void) => {
  authChangeCallback = cb;
  return { data: { subscription: { unsubscribe } } };
});

const mockSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }) });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

vi.mock('@/lib/supabase-client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signUp: (...args: unknown[]) => mockSignUp(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
      onAuthStateChange: (...args: unknown[]) => mockOnAuthStateChange(...args),
    },
    from: (...args: unknown[]) => mockFrom(...args),
  },
  supabaseConfigured: true,
}));

// ── Helpers ─────────────────────────────────────────────────────────────────
function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

const fakeUser = { id: 'user-123', email: 'test@example.com' };
const fakeSession = { access_token: 'abc-token', user: fakeUser };

// ── Setup ───────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  authChangeCallback = null;
  // Default: no existing session
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockSignIn.mockResolvedValue({ error: null });
  mockSignUp.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue({ error: null });
  mockResetPasswordForEmail.mockResolvedValue({ error: null });
});

// ─────────────────────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────────────────────
describe('Auth initialization', () => {
  it('starts in initializing state while session is being restored', () => {
    // Never resolve getSession so we stay in loading
    mockGetSession.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.loading).toBe(true);
    expect(result.current.authState.status).toBe('initializing');
    expect(result.current.user).toBeNull();
  });

  it('resolves to unauthenticated when no session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.authState.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(result.current.getAccessToken()).toBeNull();
  });

  it('registers onAuthStateChange listener', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalledOnce();
    });
  });

  it('cleans up auth listener on unmount', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { unmount } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(mockOnAuthStateChange).toHaveBeenCalledOnce();
    });

    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Session restore
// ─────────────────────────────────────────────────────────────────────────────
describe('Session restore', () => {
  it('restores user from existing session on mount', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.authState.status).toBe('authenticated');
    expect(result.current.user).toEqual(fakeUser);
    expect(result.current.getAccessToken()).toBe('abc-token');
  });

  it('getAccessToken returns current token synchronously', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Synchronous call — no await needed
    const token = result.current.getAccessToken();
    expect(token).toBe('abc-token');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────
describe('Login', () => {
  it('successful login transitions to authenticating, then authenticated via auth change', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockSignIn.mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Start login
    let loginResult: { error: unknown } | undefined;
    await act(async () => {
      loginResult = await result.current.login('test@example.com', 'password123');
    });

    expect(loginResult?.error).toBeNull();
    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });

    // Simulate Supabase firing auth state change after sign-in
    act(() => {
      authChangeCallback?.('SIGNED_IN', fakeSession);
    });

    expect(result.current.authState.status).toBe('authenticated');
    expect(result.current.user).toEqual(fakeUser);
    expect(result.current.getAccessToken()).toBe('abc-token');
  });

  it('failed login returns error and sets error auth state', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const authError = { message: 'Invalid login credentials' };
    mockSignIn.mockResolvedValue({ error: authError });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let loginResult: { error: unknown } | undefined;
    await act(async () => {
      loginResult = await result.current.login('bad@example.com', 'wrong');
    });

    expect(loginResult?.error).toEqual(authError);
    expect(result.current.authState.status).toBe('error');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────────────────────
describe('Logout', () => {
  it('clears auth state on logout', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.authState.status).toBe('authenticated');
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(result.current.authState.status).toBe('unauthenticated');
    // Token should be null after logout
    expect(result.current.getAccessToken()).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth state change listener
// ─────────────────────────────────────────────────────────────────────────────
describe('Auth state change', () => {
  it('updates state when onAuthStateChange fires with new session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.authState.status).toBe('unauthenticated');
    });

    // External sign-in detected
    act(() => {
      authChangeCallback?.('SIGNED_IN', fakeSession);
    });

    expect(result.current.authState.status).toBe('authenticated');
    expect(result.current.user?.id).toBe('user-123');
  });

  it('handles session expiry via auth state change', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.authState.status).toBe('authenticated');
    });

    // Session expired
    act(() => {
      authChangeCallback?.('SIGNED_OUT', null);
    });

    expect(result.current.authState.status).toBe('unauthenticated');
    expect(result.current.user).toBeNull();
    expect(result.current.getAccessToken()).toBeNull();
  });

  it('handles token refresh via auth state change without losing auth', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.authState.status).toBe('authenticated');
    });

    // Refreshed session arrives
    const refreshedSession = {
      access_token: 'refreshed-token',
      user: fakeUser,
    };

    act(() => {
      authChangeCallback?.('TOKEN_REFRESHED', refreshedSession);
    });

    // Should still be authenticated with new token
    expect(result.current.authState.status).toBe('authenticated');
    expect(result.current.getAccessToken()).toBe('refreshed-token');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Error handling
// ─────────────────────────────────────────────────────────────────────────────
describe('Error handling', () => {
  it('throws when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within an AuthProvider');
    spy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Password reset
// ─────────────────────────────────────────────────────────────────────────────
describe('Password reset', () => {
  it('calls supabase.auth.resetPasswordForEmail with the email', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let resetResult: { error: unknown } | undefined;
    await act(async () => {
      resetResult = await result.current.resetPassword('reset@test.com');
    });

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('reset@test.com');
    expect(resetResult?.error).toBeNull();
  });

  it('returns error when password reset fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const resetError = { message: 'Rate limit exceeded' };
    mockResetPasswordForEmail.mockResolvedValue({ error: resetError });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let resetResult: { error: unknown } | undefined;
    await act(async () => {
      resetResult = await result.current.resetPassword('reset@test.com');
    });

    expect(resetResult?.error).toEqual(resetError);
  });

  it('returns error for invalid email without calling API', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    let resetResult: { error: unknown } | undefined;
    await act(async () => {
      resetResult = await result.current.resetPassword('not-an-email');
    });

    expect(resetResult?.error).toEqual(expect.objectContaining({ message: expect.stringContaining('valid email') }));
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useRequireAuth hook
// ─────────────────────────────────────────────────────────────────────────────
describe('useRequireAuth', () => {
  it('returns isReady=false and isAuthenticated=false during initialization', () => {
    mockGetSession.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useRequireAuth(), { wrapper });

    expect(result.current.isReady).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.userId).toBeNull();
  });

  it('returns isReady=true and isAuthenticated=false when no session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { result } = renderHook(() => useRequireAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.userId).toBeNull();
    expect(result.current.email).toBeNull();
  });

  it('returns isReady=true and isAuthenticated=true when session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    const { result } = renderHook(() => useRequireAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.isReady).toBe(true);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.userId).toBe('user-123');
    expect(result.current.email).toBe('test@example.com');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// useSessionRestore hook
// ─────────────────────────────────────────────────────────────────────────────
describe('useSessionRestore', () => {
  it('returns isRestoring=true during initialization', () => {
    mockGetSession.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useSessionRestore(), { wrapper });

    expect(result.current.isRestoring).toBe(true);
    expect(result.current.isRestored).toBe(false);
    expect(result.current.status).toBe('initializing');
  });

  it('returns isRestored=true after session restore completes', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const { result } = renderHook(() => useSessionRestore(), { wrapper });

    await waitFor(() => {
      expect(result.current.isRestored).toBe(true);
    });

    expect(result.current.isRestoring).toBe(false);
    expect(result.current.status).toBe('unauthenticated');
  });

  it('returns isRestored=true with authenticated status when session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: fakeSession } });
    const { result } = renderHook(() => useSessionRestore(), { wrapper });

    await waitFor(() => {
      expect(result.current.isRestored).toBe(true);
    });

    expect(result.current.isRestoring).toBe(false);
    expect(result.current.status).toBe('authenticated');
  });
});
