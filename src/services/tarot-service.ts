/**
 * Tarot AI API service — thin wrapper over the Netlify function endpoints.
 * All calls are fire-and-forget safe: failures are logged but never propagated
 * to the caller unless explicitly needed (e.g. email capture success/failure).
 */

import type { ReadingSession } from '@/lib/tarot/tarot-types';

const BASE = '/.netlify/functions';

// ─── Session Persistence ──────────────────────────────────────────────────────

export interface RecommendedOffer {
  offerId: string;
  reason: string;
  score: number;
}

export interface CreateReadingResult {
  sessionId: string;
  status: string;
}

/**
 * Persists a client-generated reading session to the server.
 * Returns the confirmed session ID on success, null on failure.
 */
export async function persistReading(
  session: ReadingSession,
  recommendations: RecommendedOffer[] = []
): Promise<CreateReadingResult | null> {
  try {
    const res = await fetch(`${BASE}/tarot-create-reading`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session, recommendations }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn('[tarot-service] persistReading failed:', res.status, text);
      return null;
    }

    return (await res.json()) as CreateReadingResult;
  } catch (err) {
    console.warn('[tarot-service] persistReading network error:', err);
    return null;
  }
}

export interface PersistedCard {
  session_id: string;
  card_id: string;
  card_name: string;
  card_arcana: string;
  card_suit: string | null;
  position: number;
  position_label: string;
  is_reversed: boolean;
  interpretation: string;
}

export interface GetReadingResult {
  session: {
    id: string;
    first_name: string;
    date_of_birth: string;
    zodiac_sign: string;
    zodiac_symbol: string | null;
    zodiac_element: string | null;
    spread_type: string;
    status: string;
    summary: string | null;
    energy_theme: string | null;
    zodiac_note: string | null;
    created_at: string;
  };
  cards: PersistedCard[];
  recommendations: Array<{ offer_id: string; reason: string | null; score: number }>;
}

/**
 * Fetches a persisted reading session by ID.
 * Returns null if not found or on network failure.
 */
export async function getReading(sessionId: string): Promise<GetReadingResult | null> {
  try {
    const res = await fetch(
      `${BASE}/tarot-get-reading?sessionId=${encodeURIComponent(sessionId)}`
    );

    if (!res.ok) return null;
    return (await res.json()) as GetReadingResult;
  } catch (err) {
    console.warn('[tarot-service] getReading network error:', err);
    return null;
  }
}

// ─── Email Lead ───────────────────────────────────────────────────────────────

export interface EmailLeadPayload {
  email: string;
  firstName?: string;
  sessionId?: string;
  zodiacSign?: string;
}

export interface EmailLeadResult {
  success: boolean;
  error?: string;
}

/**
 * Saves an email lead. Returns success/failure so the UI can show real states.
 */
export async function saveEmailLead(payload: EmailLeadPayload): Promise<EmailLeadResult> {
  try {
    const res = await fetch(`${BASE}/tarot-email-lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { success: false, error: data.error ?? 'Failed to save email' };
    }

    return { success: true };
  } catch (err) {
    console.warn('[tarot-service] saveEmailLead network error:', err);
    return { success: false, error: 'Network error. Please try again.' };
  }
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface TrackEventPayload {
  eventName: string;
  sessionId?: string;
  offerId?: string;
  properties?: Record<string, unknown>;
}

/**
 * Tracks a funnel event. Always resolves — analytics must never block the UI.
 */
export async function trackEvent(payload: TrackEventPayload): Promise<void> {
  try {
    await fetch(`${BASE}/tarot-track-event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // intentionally silent — analytics must never disrupt UX
  }
}
