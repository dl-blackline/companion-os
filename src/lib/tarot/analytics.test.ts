import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TAROT_EVENTS, tarotTrack } from '@/lib/tarot/analytics';

// Mock the tarot-service trackEvent so we don't make real network calls
vi.mock('@/services/tarot-service', () => ({
  trackEvent: vi.fn().mockResolvedValue(undefined),
  persistReading: vi.fn().mockResolvedValue({ sessionId: 'mock-id', status: 'GENERATED' }),
  saveEmailLead: vi.fn().mockResolvedValue({ success: true }),
  getReading: vi.fn().mockResolvedValue(null),
}));

import { trackEvent } from '@/services/tarot-service';

const mockTrackEvent = trackEvent as ReturnType<typeof vi.fn>;

describe('TAROT_EVENTS', () => {
  it('defines all required event names', () => {
    expect(TAROT_EVENTS.LANDING_VIEWED).toBe('tarot_landing_viewed');
    expect(TAROT_EVENTS.INTAKE_STARTED).toBe('tarot_intake_started');
    expect(TAROT_EVENTS.INTAKE_SUBMITTED).toBe('tarot_intake_submitted');
    expect(TAROT_EVENTS.READING_GENERATED).toBe('tarot_reading_generated');
    expect(TAROT_EVENTS.FIRST_CARD_REVEALED).toBe('tarot_first_card_revealed');
    expect(TAROT_EVENTS.SECOND_CARD_REVEALED).toBe('tarot_second_card_revealed');
    expect(TAROT_EVENTS.THIRD_CARD_REVEALED).toBe('tarot_third_card_revealed');
    expect(TAROT_EVENTS.READING_COMPLETED).toBe('tarot_reading_completed');
    expect(TAROT_EVENTS.EMAIL_CAPTURE_STARTED).toBe('tarot_email_capture_started');
    expect(TAROT_EVENTS.EMAIL_CAPTURE_SUCCEEDED).toBe('tarot_email_capture_succeeded');
    expect(TAROT_EVENTS.EMAIL_CAPTURE_FAILED).toBe('tarot_email_capture_failed');
    expect(TAROT_EVENTS.OFFER_VIEWED).toBe('tarot_offer_viewed');
    expect(TAROT_EVENTS.OFFER_CLICKED).toBe('tarot_offer_clicked');
    expect(TAROT_EVENTS.RESTART_CLICKED).toBe('tarot_restart_clicked');
  });
});

describe('tarotTrack', () => {
  beforeEach(() => {
    mockTrackEvent.mockClear();
  });

  it('landingViewed calls trackEvent with the correct event name', async () => {
    await tarotTrack.landingViewed();
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventName: TAROT_EVENTS.LANDING_VIEWED,
    });
  });

  it('intakeStarted calls trackEvent with the correct event name', async () => {
    await tarotTrack.intakeStarted();
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventName: TAROT_EVENTS.INTAKE_STARTED,
    });
  });

  it('intakeSubmitted attaches sessionId when provided', async () => {
    await tarotTrack.intakeSubmitted({ sessionId: 'sess-123' });
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventName: TAROT_EVENTS.INTAKE_SUBMITTED,
      sessionId: 'sess-123',
    });
  });

  it('readingGenerated attaches zodiacSign and energyTheme as properties', async () => {
    await tarotTrack.readingGenerated({
      sessionId: 's1',
      zodiacSign: 'Scorpio',
      energyTheme: 'Transformation & Emergence',
    });
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: TAROT_EVENTS.READING_GENERATED,
        sessionId: 's1',
        properties: { zodiacSign: 'Scorpio', energyTheme: 'Transformation & Emergence' },
      })
    );
  });

  it('cardRevealed uses FIRST_CARD_REVEALED for index 0', async () => {
    await tarotTrack.cardRevealed(0, { sessionId: 's1' });
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: TAROT_EVENTS.FIRST_CARD_REVEALED })
    );
  });

  it('cardRevealed uses SECOND_CARD_REVEALED for index 1', async () => {
    await tarotTrack.cardRevealed(1, { sessionId: 's1' });
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: TAROT_EVENTS.SECOND_CARD_REVEALED })
    );
  });

  it('cardRevealed uses THIRD_CARD_REVEALED for index 2 or higher', async () => {
    await tarotTrack.cardRevealed(2, { sessionId: 's1' });
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: TAROT_EVENTS.THIRD_CARD_REVEALED })
    );
  });

  it('readingCompleted calls trackEvent with correct event name', async () => {
    await tarotTrack.readingCompleted({ sessionId: 'sess-456' });
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventName: TAROT_EVENTS.READING_COMPLETED,
      sessionId: 'sess-456',
    });
  });

  it('emailCaptureStarted passes sessionId', async () => {
    await tarotTrack.emailCaptureStarted({ sessionId: 'sess-789' });
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventName: TAROT_EVENTS.EMAIL_CAPTURE_STARTED,
      sessionId: 'sess-789',
    });
  });

  it('emailCaptureSucceeded passes sessionId', async () => {
    await tarotTrack.emailCaptureSucceeded({ sessionId: 'sess-789' });
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventName: TAROT_EVENTS.EMAIL_CAPTURE_SUCCEEDED,
      sessionId: 'sess-789',
    });
  });

  it('emailCaptureFailed includes error in properties', async () => {
    await tarotTrack.emailCaptureFailed({ sessionId: 's1', error: 'Network error' });
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: TAROT_EVENTS.EMAIL_CAPTURE_FAILED,
        sessionId: 's1',
        properties: { error: 'Network error' },
      })
    );
  });

  it('offerViewed includes offerId and sessionId', async () => {
    await tarotTrack.offerViewed({ offerId: 'premium-chart', sessionId: 's1' });
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventName: TAROT_EVENTS.OFFER_VIEWED,
      sessionId: 's1',
      offerId: 'premium-chart',
    });
  });

  it('offerClicked includes offerId, sessionId, and offerTitle', async () => {
    await tarotTrack.offerClicked({
      offerId: 'cosmic-forecast',
      sessionId: 's2',
      offerTitle: 'Monthly Cosmic Forecast',
    });
    expect(mockTrackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: TAROT_EVENTS.OFFER_CLICKED,
        sessionId: 's2',
        offerId: 'cosmic-forecast',
        properties: { offerTitle: 'Monthly Cosmic Forecast' },
      })
    );
  });

  it('restartClicked passes sessionId', async () => {
    await tarotTrack.restartClicked({ sessionId: 'old-sess' });
    expect(mockTrackEvent).toHaveBeenCalledWith({
      eventName: TAROT_EVENTS.RESTART_CLICKED,
      sessionId: 'old-sess',
    });
  });
});
