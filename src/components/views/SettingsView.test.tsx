/**
 * Tests for the SettingsView auth/account section — ensures the Account tab
 * always renders auth status (loading / signed-in / signed-out / error) and
 * that Sign Out / Sign In controls are visible.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// ── Mutable mock state ──────────────────────────────────────────────────────
let mockUser: { id: string; email: string } | null = null;
let mockAuthState: { status: string; [key: string]: unknown } = { status: 'unauthenticated' };
let mockAuthLoading = false;
let mockConfigured = true;
const mockLogout = vi.fn();

vi.mock('@/context/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
    session: mockUser ? { access_token: 'tok' } : null,
    loading: mockAuthLoading,
    configured: mockConfigured,
    role: 'user',
    plan: 'free',
    isAdmin: false,
    authState: mockAuthState,
    login: vi.fn(),
    signup: vi.fn(),
    logout: mockLogout,
    refreshRole: vi.fn(),
    getAccessToken: vi.fn(() => (mockUser ? 'tok' : null)),
  }),
}));

vi.mock('@/context/settings-context', () => ({
  useSettings: () => ({
    settings: {
      aiName: 'Companion OS',
      defaultMode: 'neutral',
      memorySettings: { autoCapture: true, requireApproval: false, summarization: true },
      modelSettings: {
        defaultModel: 'gpt-4.1', fallbackModel: 'gpt-4.1-mini', imageModel: 'openai-image',
        videoModel: 'sora', musicModel: 'suno', voiceModel: 'elevenlabs',
        temperature: 0.7, maxLength: 2000, citationPreference: 'when-available',
        toolUseAggressiveness: 0.5, memoryRetrievalIntensity: 0.7,
      },
      privacySettings: { dataStorage: true, exportEnabled: true, auditTrail: true },
    },
    updateSettings: vi.fn(),
    updateModelSettings: vi.fn(),
    updateMemorySettings: vi.fn(),
    updatePrivacySettings: vi.fn(),
    prefs: {
      display_name: '', bio: '', avatar_url: '',
      ai_personality: 'professional', ai_tone: 'formal', response_length: 'balanced',
      creativity_level: 0.5, empathy_level: 0.5, directness_level: 0.5,
      memory_enabled: true, memory_depth: 'long_term',
      preferred_voice: 'default', voice_speed: 1, voice_mode: 'push-to-talk',
      theme: 'dark', reduce_motion: false, high_contrast: false, font_size: 'md',
      data_storage: true, export_enabled: true, audit_trail: true,
      notifications_enabled: true, notification_email: false, notification_in_app: true,
      preferred_language: 'en', default_image_style: 'natural', default_video_quality: 'high',
      default_mode: 'neutral', auto_title_conversations: true, show_citations: true,
    },
    prefsLoading: false,
    prefsSaving: false,
    prefsError: null,
    updatePreferences: vi.fn(),
    updatePreferencesDebounced: vi.fn(),
  }),
}));

vi.mock('@/context/voice-context', () => ({
  useVoice: () => ({ voice: 'alloy', setVoice: vi.fn() }),
}));

vi.mock('@/utils/model-cache', () => ({
  getCachedModels: () => null,
  preloadModels: () => Promise.resolve(null),
}));

vi.mock('@/components/EmojiOrbCustomizer', () => ({
  EmojiOrbCustomizer: () => <div data-testid="emoji-customizer" />,
}));

// ── Reset mocks ─────────────────────────────────────────────────────────────
beforeEach(() => {
  mockUser = null;
  mockAuthState = { status: 'unauthenticated' };
  mockAuthLoading = false;
  mockConfigured = true;
  mockLogout.mockReset();
});

// Lazy import so mocks are active at import time
async function renderSettings() {
  const { SettingsView } = await import('@/components/views/SettingsView');
  return render(<SettingsView />);
}

// ─────────────────────────────────────────────────────────────────────────────
describe('SettingsView — Auth section in Account tab', () => {
  it('shows "Restoring session" while auth is initializing', async () => {
    mockAuthLoading = true;
    mockAuthState = { status: 'initializing' };
    await renderSettings();
    expect(screen.getByText(/restoring session/i)).toBeInTheDocument();
  }, 30000);

  it('shows "not signed in" when unauthenticated', async () => {
    mockAuthState = { status: 'unauthenticated' };
    await renderSettings();
    // The auth card specifically says "You are not signed in."
    expect(screen.getAllByText('You are not signed in.').length).toBeGreaterThan(0);
  });

  it('shows signed-in status and Sign Out button when authenticated', async () => {
    mockUser = { id: 'u1', email: 'alice@example.com' };
    mockAuthState = { status: 'authenticated', userId: 'u1', email: 'alice@example.com' };
    await renderSettings();
    // The auth card shows the email in the "Signed in as" row
    expect(screen.getByText('Signed in as')).toBeInTheDocument();
    // There should be at least one Sign Out button visible (in the Account tab auth section)
    const signOutBtns = screen.getAllByRole('button', { name: /sign out/i });
    expect(signOutBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('calls logout when Sign Out is clicked', async () => {
    mockUser = { id: 'u1', email: 'alice@example.com' };
    mockAuthState = { status: 'authenticated', userId: 'u1', email: 'alice@example.com' };
    await renderSettings();
    const signOutBtns = screen.getAllByRole('button', { name: /sign out/i });
    fireEvent.click(signOutBtns[0]);
    expect(mockLogout).toHaveBeenCalled();
  });

  it('shows error state with retry action on auth error', async () => {
    mockAuthState = { status: 'error', error: 'Session expired' };
    await renderSettings();
    expect(screen.getByText(/session expired/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('always renders Authentication card heading', async () => {
    mockConfigured = false;
    mockAuthState = { status: 'unauthenticated' };
    await renderSettings();
    expect(screen.getByText('Authentication')).toBeInTheDocument();
  });

  it('shows Supabase not configured message when unconfigured and signed out', async () => {
    mockConfigured = false;
    mockAuthState = { status: 'unauthenticated' };
    await renderSettings();
    expect(screen.getByText(/supabase is not configured/i)).toBeInTheDocument();
  });

  it('lists Leonardo AI in the Diagnostics tab service labels', async () => {
    mockAuthState = { status: 'unauthenticated' };
    await renderSettings();
    // Radix UI Tabs v1 activates via mouseDown; fire that to switch to diagnostics tab
    const diagTab = screen.getByRole('tab', { name: /diagnostics/i });
    fireEvent.mouseDown(diagTab);
    await waitFor(() => {
      expect(screen.getByText('Leonardo AI')).toBeInTheDocument();
    });
  });
});
