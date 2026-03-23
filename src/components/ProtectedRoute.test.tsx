/**
 * Tests for ProtectedRoute — auth gating, session restore loading state,
 * and navigation between auth pages.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';

// ── Mock state ──────────────────────────────────────────────────────────────
let mockUser: { id: string; email: string } | null = null;
let mockLoading = false;
let mockAuthState: { status: string; [key: string]: unknown } = { status: 'unauthenticated' };

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
    authState: mockAuthState,
  }),
}));

// Override supabaseConfigured to true for most tests
let mockConfigured = true;
vi.mock('@/lib/supabase-client', () => ({
  get supabaseConfigured() { return mockConfigured; },
  supabase: null,
}));

// ── Setup ───────────────────────────────────────────────────────────────────
beforeEach(() => {
  mockUser = null;
  mockLoading = false;
  mockAuthState = { status: 'unauthenticated' };
  mockConfigured = true;
});

// ─────────────────────────────────────────────────────────────────────────────
describe('ProtectedRoute', () => {
  it('shows loading spinner during session initialization', () => {
    mockLoading = true;
    mockAuthState = { status: 'initializing' };
    render(<ProtectedRoute><div>Protected Content</div></ProtectedRoute>);

    expect(screen.getByText(/restoring session/i)).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when user is authenticated', () => {
    mockUser = { id: 'user-1', email: 'test@example.com' };
    mockAuthState = { status: 'authenticated', userId: 'user-1', email: 'test@example.com' };
    render(<ProtectedRoute><div>Protected Content</div></ProtectedRoute>);

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows login page when user is unauthenticated', () => {
    mockUser = null;
    mockAuthState = { status: 'unauthenticated' };
    render(<ProtectedRoute><div>Protected Content</div></ProtectedRoute>);

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });

  it('bypasses auth gate when Supabase is not configured', () => {
    mockConfigured = false;
    mockUser = null;
    render(<ProtectedRoute><div>Protected Content</div></ProtectedRoute>);

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('navigates to signup page', () => {
    render(<ProtectedRoute><div>Protected Content</div></ProtectedRoute>);
    fireEvent.click(screen.getByText(/create account/i));
    expect(screen.getByText(/create your account/i)).toBeInTheDocument();
  });

  it('navigates to forgot password page', () => {
    render(<ProtectedRoute><div>Protected Content</div></ProtectedRoute>);
    fireEvent.click(screen.getByText(/forgot password/i));
    expect(screen.getByText(/send reset link/i)).toBeInTheDocument();
  });

  it('navigates back to login from signup', () => {
    render(<ProtectedRoute><div>Protected Content</div></ProtectedRoute>);
    // Go to signup
    fireEvent.click(screen.getByText(/create account/i));
    expect(screen.getByText(/create your account/i)).toBeInTheDocument();

    // Go back to login
    fireEvent.click(screen.getByText(/sign in$/i));
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });

  it('navigates back to login from forgot password', () => {
    render(<ProtectedRoute><div>Protected Content</div></ProtectedRoute>);
    // Go to forgot password
    fireEvent.click(screen.getByText(/forgot password/i));
    expect(screen.getByText(/send reset link/i)).toBeInTheDocument();

    // Go back to login
    fireEvent.click(screen.getByText(/sign in$/i));
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });

  it('does not show false unauthenticated state during hydration', () => {
    // Simulate app boot: loading is true, authState is initializing
    mockLoading = true;
    mockAuthState = { status: 'initializing' };

    render(<ProtectedRoute><div>Protected Content</div></ProtectedRoute>);

    // Should NOT show login page — should show loading spinner
    expect(screen.queryByText(/welcome back/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sign in/i)).not.toBeInTheDocument();
    expect(screen.getByText(/restoring session/i)).toBeInTheDocument();
  });
});
