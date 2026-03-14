import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the service module directly; fetch is mocked at the global level.

describe('tarot-service', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Provide a fresh fetch mock before each test
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ── persistReading ─────────────────────────────────────────────────────────

  describe('persistReading', () => {
    it('returns the session ID on a successful response', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ sessionId: 'abc-123', status: 'GENERATED' }),
        text: async () => '',
      });

      const { persistReading } = await import('@/services/tarot-service');
      const result = await persistReading(
        {
          id: 'abc-123',
          firstName: 'Luna',
          dateOfBirth: '1990-06-15',
          zodiacSign: 'Gemini',
          zodiacSymbol: '♊',
          zodiacElement: 'Air',
          spreadType: 'three-card',
          cards: [],
          summary: 'Test summary',
          energyTheme: 'Clarity',
          zodiacNote: 'Note',
          createdAt: new Date().toISOString(),
        },
        []
      );

      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe('abc-123');
      expect(result?.status).toBe('GENERATED');
    });

    it('returns null when the server returns a non-ok response', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Internal error',
      });

      const { persistReading } = await import('@/services/tarot-service');
      const result = await persistReading(
        {
          id: 'xyz',
          firstName: 'Test',
          dateOfBirth: '2000-01-01',
          zodiacSign: 'Capricorn',
          zodiacSymbol: '♑',
          zodiacElement: 'Earth',
          spreadType: 'three-card',
          cards: [],
          summary: '',
          energyTheme: '',
          zodiacNote: '',
          createdAt: new Date().toISOString(),
        },
        []
      );

      expect(result).toBeNull();
    });

    it('returns null on network failure', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Network error')
      );

      const { persistReading } = await import('@/services/tarot-service');
      const result = await persistReading(
        {
          id: 'xyz',
          firstName: 'Test',
          dateOfBirth: '2000-01-01',
          zodiacSign: 'Capricorn',
          zodiacSymbol: '♑',
          zodiacElement: 'Earth',
          spreadType: 'three-card',
          cards: [],
          summary: '',
          energyTheme: '',
          zodiacNote: '',
          createdAt: new Date().toISOString(),
        },
        []
      );

      expect(result).toBeNull();
    });
  });

  // ── saveEmailLead ──────────────────────────────────────────────────────────

  describe('saveEmailLead', () => {
    it('returns success: true on a 200 response', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const { saveEmailLead } = await import('@/services/tarot-service');
      const result = await saveEmailLead({ email: 'user@example.com' });

      expect(result.success).toBe(true);
    });

    it('returns success: false with error message on a non-ok response', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'A valid email address is required' }),
      });

      const { saveEmailLead } = await import('@/services/tarot-service');
      const result = await saveEmailLead({ email: 'bad' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('email');
    });

    it('returns success: false with network error message on fetch failure', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('fetch failed')
      );

      const { saveEmailLead } = await import('@/services/tarot-service');
      const result = await saveEmailLead({ email: 'user@example.com' });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  // ── trackEvent ─────────────────────────────────────────────────────────────

  describe('trackEvent', () => {
    it('does not throw even when fetch fails', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('network down')
      );

      const { trackEvent } = await import('@/services/tarot-service');
      // Should resolve without throwing
      await expect(
        trackEvent({ eventName: 'tarot_landing_viewed' })
      ).resolves.toBeUndefined();
    });

    it('calls fetch with the correct endpoint', async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
        ok: true,
        json: async () => ({ ok: true }),
      });

      const { trackEvent } = await import('@/services/tarot-service');
      await trackEvent({ eventName: 'tarot_offer_clicked', offerId: 'candle-kit' });

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('tarot-track-event'),
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
