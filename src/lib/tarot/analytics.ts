/**
 * Tarot AI — centralized analytics event tracking.
 *
 * All funnel events are defined here as typed constants so typos
 * can't silently create phantom event names in the database.
 *
 * Usage:
 *   import { tarotTrack } from '@/lib/tarot/analytics';
 *   tarotTrack.landingViewed();
 *   tarotTrack.offerClicked({ sessionId, offerId });
 */

import { trackEvent } from '@/services/tarot-service';

// ─── Event Name Constants ─────────────────────────────────────────────────────

export const TAROT_EVENTS = {
  LANDING_VIEWED:           'tarot_landing_viewed',
  INTAKE_STARTED:           'tarot_intake_started',
  INTAKE_SUBMITTED:         'tarot_intake_submitted',
  READING_GENERATED:        'tarot_reading_generated',
  FIRST_CARD_REVEALED:      'tarot_first_card_revealed',
  SECOND_CARD_REVEALED:     'tarot_second_card_revealed',
  THIRD_CARD_REVEALED:      'tarot_third_card_revealed',
  READING_COMPLETED:        'tarot_reading_completed',
  EMAIL_CAPTURE_STARTED:    'tarot_email_capture_started',
  EMAIL_CAPTURE_SUCCEEDED:  'tarot_email_capture_succeeded',
  EMAIL_CAPTURE_FAILED:     'tarot_email_capture_failed',
  OFFER_VIEWED:             'tarot_offer_viewed',
  OFFER_CLICKED:            'tarot_offer_clicked',
  RESTART_CLICKED:          'tarot_restart_clicked',
} as const;

export type TarotEventName = typeof TAROT_EVENTS[keyof typeof TAROT_EVENTS];

// ─── Shared event context ─────────────────────────────────────────────────────

interface BaseCtx {
  sessionId?: string;
}
interface OfferCtx extends BaseCtx {
  offerId: string;
}

// ─── Typed event dispatchers ──────────────────────────────────────────────────

export const tarotTrack = {
  landingViewed: () =>
    trackEvent({ eventName: TAROT_EVENTS.LANDING_VIEWED }),

  intakeStarted: () =>
    trackEvent({ eventName: TAROT_EVENTS.INTAKE_STARTED }),

  intakeSubmitted: (ctx: BaseCtx) =>
    trackEvent({ eventName: TAROT_EVENTS.INTAKE_SUBMITTED, ...ctx }),

  readingGenerated: (ctx: BaseCtx & { zodiacSign?: string; energyTheme?: string }) =>
    trackEvent({
      eventName: TAROT_EVENTS.READING_GENERATED,
      sessionId: ctx.sessionId,
      properties: { zodiacSign: ctx.zodiacSign, energyTheme: ctx.energyTheme },
    }),

  cardRevealed: (cardIndex: number, ctx: BaseCtx) => {
    const name =
      cardIndex === 0
        ? TAROT_EVENTS.FIRST_CARD_REVEALED
        : cardIndex === 1
        ? TAROT_EVENTS.SECOND_CARD_REVEALED
        : TAROT_EVENTS.THIRD_CARD_REVEALED;
    return trackEvent({ eventName: name, sessionId: ctx.sessionId });
  },

  readingCompleted: (ctx: BaseCtx) =>
    trackEvent({ eventName: TAROT_EVENTS.READING_COMPLETED, ...ctx }),

  emailCaptureStarted: (ctx: BaseCtx) =>
    trackEvent({ eventName: TAROT_EVENTS.EMAIL_CAPTURE_STARTED, ...ctx }),

  emailCaptureSucceeded: (ctx: BaseCtx) =>
    trackEvent({ eventName: TAROT_EVENTS.EMAIL_CAPTURE_SUCCEEDED, ...ctx }),

  emailCaptureFailed: (ctx: BaseCtx & { error?: string }) =>
    trackEvent({
      eventName: TAROT_EVENTS.EMAIL_CAPTURE_FAILED,
      sessionId: ctx.sessionId,
      properties: { error: ctx.error },
    }),

  offerViewed: (ctx: OfferCtx) =>
    trackEvent({
      eventName: TAROT_EVENTS.OFFER_VIEWED,
      sessionId: ctx.sessionId,
      offerId: ctx.offerId,
    }),

  offerClicked: (ctx: OfferCtx & { offerTitle?: string }) =>
    trackEvent({
      eventName: TAROT_EVENTS.OFFER_CLICKED,
      sessionId: ctx.sessionId,
      offerId: ctx.offerId,
      properties: { offerTitle: ctx.offerTitle },
    }),

  restartClicked: (ctx: BaseCtx) =>
    trackEvent({ eventName: TAROT_EVENTS.RESTART_CLICKED, ...ctx }),
};
