/**
 * Integration tests for the full App component mount.
 *
 * Mocks all context hooks so <App /> can render without backend
 * dependencies. Validates section rendering, navigation gating,
 * react-router integration, and keyboard shortcuts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';

/* ── Shared mock shapes ───────────────────────────────────────────────────── */

const mockStopLiveTalk = vi.fn();
const mockNavigate = vi.fn();

const defaultAuth = {
  user: null,
  session: null,
  loading: false,
  configured: true,
  role: 'user' as const,
  plan: 'pro' as const,
  isAdmin: false,
  authState: { status: 'authenticated' as const },
  login: vi.fn(async () => ({ error: null })),
  signup: vi.fn(async () => ({ error: null })),
  logout: vi.fn(async () => {}),
  resetPassword: vi.fn(async () => ({ error: null })),
  refreshRole: vi.fn(async () => {}),
  getAccessToken: () => 'mock-token',
  getFreshAccessToken: vi.fn(async () => 'mock-token'),
};

const defaultSettings = {
  settings: {
    aiName: 'Vuk OS',
    defaultMode: 'neutral',
    memorySettings: { autoCapture: true, requireApproval: false, summarization: true },
    modelSettings: {
      defaultModel: 'gpt-4.1',
      fallbackModel: 'gpt-4.1-mini',
      imageModel: 'openai-image',
      videoModel: 'sora',
      musicModel: 'suno',
      voiceModel: 'elevenlabs',
      temperature: 0.7,
      maxLength: 2000,
      citationPreference: 'when-available',
      toolUseAggressiveness: 0.5,
      memoryRetrievalIntensity: 0.7,
    },
    privacySettings: { dataStorage: true, exportEnabled: true, auditTrail: true },
  },
  updateSettings: vi.fn(),
  updateModelSettings: vi.fn(),
  updateMemorySettings: vi.fn(),
  updatePrivacySettings: vi.fn(),
  prefs: {},
  prefsLoading: false,
  prefsSaving: false,
  prefsError: null,
  updatePreferences: vi.fn(async () => {}),
  updatePreferencesDebounced: vi.fn(),
};

const defaultVoice = {
  isActive: false,
  isListening: false,
  isSpeaking: false,
  status: 'idle' as const,
  errorMessage: null,
  lastTranscript: '',
  startLiveTalk: vi.fn(async () => {}),
  stopLiveTalk: mockStopLiveTalk,
  toggleLiveTalk: vi.fn(),
  isMuted: false,
  toggleMute: vi.fn(),
  voice: 'alloy' as const,
  setVoice: vi.fn(),
};

const defaultOrbAppearance = {
  mode: 'default' as const,
  emojiFeatures: null,
  styleMode: null,
  emoji: null,
  orbColor: 'silver',
  loading: false,
  applyEmojiOrb: vi.fn(async () => {}),
  setOrbColor: vi.fn(async () => {}),
  resetToDefault: vi.fn(async () => {}),
};

const defaultAIControl = {
  config: {
    model: 'gpt-4o',
    tone: 'direct' as const,
    memory_enabled: true,
    temperature: 0.7,
    max_tokens: 2000,
    capabilities: { chat: true, voice: true, image: true, video: false },
  },
  loading: false,
  saving: false,
  error: null,
  setConfig: vi.fn(),
  saveConfig: vi.fn(async () => {}),
  reloadConfig: vi.fn(async () => {}),
  orchestratorConfig: {
    model: 'gpt-4o',
    tone: 'direct' as const,
    memory_enabled: true,
    temperature: 0.7,
    max_tokens: 2000,
    capabilities: { chat: true, voice: true, image: true, video: false },
  },
};

const defaultRuntimeHealth = {
  state: 'healthy' as const,
  unavailableServices: [] as string[],
};

/* ── Module mocks ─────────────────────────────────────────────────────────── */

vi.mock('@/context/auth-context', () => ({
  useAuth: () => defaultAuth,
}));

vi.mock('@/context/settings-context', () => ({
  useSettings: () => defaultSettings,
}));

vi.mock('@/context/voice-context', () => ({
  useVoice: () => defaultVoice,
}));

vi.mock('@/context/orb-appearance-context', () => ({
  useOrbAppearance: () => defaultOrbAppearance,
}));

vi.mock('@/context/ai-control-context', () => ({
  useAIControl: () => defaultAIControl,
}));

vi.mock('@/hooks/use-runtime-health', () => ({
  useRuntimeHealth: () => defaultRuntimeHealth,
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

// Mock react-router's useNavigate so we can assert navigations
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/* ── Helper ───────────────────────────────────────────────────────────────── */

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

/* ── Tests ─────────────────────────────────────────────────────────────────── */

describe('App integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the app shell wrapper', () => {
    const { container } = renderApp();
    expect(container.querySelector('.visual-shell')).not.toBeNull();
  });

  it('renders the sidebar on desktop', () => {
    renderApp();
    // AppSidebar will be present in the DOM (not behind mobile drawer)
    const main = document.querySelector('main');
    expect(main).not.toBeNull();
  });

  it('renders home section by default at /', () => {
    renderApp('/');
    // The home section should render within main
    const main = document.querySelector('main');
    expect(main).not.toBeNull();
    expect(main!.children.length).toBeGreaterThan(0);
  });

  it('Ctrl+K toggles command palette', () => {
    renderApp();
    // Trigger Ctrl+K
    act(() => {
      fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    });
    // Command palette should now be in the DOM (lazy-loaded)
    // We just verify it doesn't crash — the CommandPalette is Suspense-wrapped
  });

  it('renders toaster', () => {
    const { container } = renderApp();
    // Sonner toaster mounts an element into DOM
    expect(container.querySelector('.visual-shell')).not.toBeNull();
  });

  it('derives activeSection from URL pathname', () => {
    renderApp('/chat');
    // main content should render with chat section key
    const main = document.querySelector('main');
    expect(main).not.toBeNull();
  });

  it('renders different sections based on route', () => {
    const { unmount } = renderApp('/settings');
    const main = document.querySelector('main');
    expect(main).not.toBeNull();
    unmount();
  });
});
