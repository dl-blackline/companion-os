/**
 * Tests for the Login page component — rendering, form validation,
 * authentication flows, and navigation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import Login from '@/pages/Login';

// ── Mock auth context ───────────────────────────────────────────────────────
const mockLogin = vi.fn();
const mockAuthState = { status: 'unauthenticated' as const };

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    login: mockLogin,
    configured: true,
    authState: mockAuthState,
  }),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────
const defaultProps = {
  onNavigateToSignup: vi.fn(),
  onNavigateToForgotPassword: vi.fn(),
};

function renderLogin(overrides = {}) {
  return render(<Login {...defaultProps} {...overrides} />);
}

// ── Setup ───────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockLogin.mockResolvedValue({ error: null });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Login page rendering', () => {
  it('renders the login form with email and password fields', () => {
    renderLogin();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('renders branding and description', () => {
    renderLogin();
    expect(screen.getByText('Companion OS')).toBeInTheDocument();
    expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  });

  it('renders sign-up navigation link', () => {
    renderLogin();
    expect(screen.getByText(/create account/i)).toBeInTheDocument();
  });

  it('renders forgot password link', () => {
    renderLogin();
    expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Login form validation', () => {
  it('shows error for empty email on submit', async () => {
    renderLogin();
    // Submit the form directly to bypass HTML5 constraint validation
    const form = screen.getByRole('button', { name: /sign in/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/enter your email/i);
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('shows error for empty password on submit', async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    const form = screen.getByRole('button', { name: /sign in/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/enter your password/i);
    });
    expect(mockLogin).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Login submission', () => {
  it('calls login with email and password on valid submit', async () => {
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    const form = screen.getByRole('button', { name: /sign in/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('user@test.com', 'password123');
    });
  });

  it('shows success message after successful login', async () => {
    mockLogin.mockResolvedValue({ error: null });
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    const form = screen.getByRole('button', { name: /sign in/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/signed in successfully/i);
    });
  });

  it('shows error for invalid credentials', async () => {
    mockLogin.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'bad@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    const form = screen.getByRole('button', { name: /sign in/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/invalid email or password/i);
    });
  });

  it('shows generic error message for non-credential errors', async () => {
    mockLogin.mockResolvedValue({ error: { message: 'Network error' } });
    renderLogin();
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'user@test.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'pass1234' } });
    const form = screen.getByRole('button', { name: /sign in/i }).closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Login navigation', () => {
  it('calls onNavigateToSignup when Create account is clicked', () => {
    const onNavigateToSignup = vi.fn();
    renderLogin({ onNavigateToSignup });
    fireEvent.click(screen.getByText(/create account/i));
    expect(onNavigateToSignup).toHaveBeenCalledOnce();
  });

  it('calls onNavigateToForgotPassword when Forgot password is clicked', () => {
    const onNavigateToForgotPassword = vi.fn();
    renderLogin({ onNavigateToForgotPassword });
    fireEvent.click(screen.getByText(/forgot password/i));
    expect(onNavigateToForgotPassword).toHaveBeenCalledOnce();
  });
});
