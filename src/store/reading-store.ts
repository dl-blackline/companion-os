import { useState, useCallback, useEffect, useRef } from 'react';
import type { ReadingSession } from '@/lib/tarot/tarot-types';
import { generateReading } from '@/lib/tarot/reading-engine';
import { persistReading, type RecommendedOffer } from '@/services/tarot-service';
import { buildRecommendations } from '@/lib/tarot/recommendations';
import type { IntakeFormValues } from '@/lib/validation/reading';

export type ReadingPhase =
  | 'idle'
  | 'intake'
  | 'shuffling'
  | 'revealing'
  | 'complete';

export interface ReadingState {
  phase: ReadingPhase;
  session: ReadingSession | null;
  revealedCardCount: number;
  error: string | null;
  /** True once the session has been confirmed persisted to the server */
  isPersisted: boolean;
}

const INITIAL_STATE: ReadingState = {
  phase: 'idle',
  session: null,
  revealedCardCount: 0,
  error: null,
  isPersisted: false,
};

const SESSION_STORAGE_KEY = 'tarot_session';

/**
 * Central hook for managing the full tarot reading flow.
 *
 * Local state drives UI animations and reveal progression.
 * The server is the authoritative persistence layer (fire-and-forget on save).
 * Session is mirrored to sessionStorage so a page refresh restores the reading.
 */
export function useReadingStore() {
  const [state, setState] = useState<ReadingState>(INITIAL_STATE);
  const landingTrackedRef = useRef(false);

  // ── Session resume on mount ────────────────────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw) as {
        session: ReadingSession;
        revealedCardCount: number;
        phase: ReadingPhase;
      };
      if (saved.session?.id) {
        setState({
          phase: saved.phase === 'shuffling' ? 'revealing' : saved.phase,
          session: saved.session,
          revealedCardCount: saved.revealedCardCount ?? 0,
          error: null,
          isPersisted: true,
        });
      }
    } catch {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, []);

  // ── Persist snapshot to sessionStorage on changes ──────────────────────────
  useEffect(() => {
    if (state.session) {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          session: state.session,
          revealedCardCount: state.revealedCardCount,
          phase: state.phase,
        })
      );
    }
  }, [state.session, state.phase, state.revealedCardCount]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const startIntake = useCallback(() => {
    setState((s) => ({ ...s, phase: 'intake', error: null }));
  }, []);

  const submitIntake = useCallback(async (values: IntakeFormValues) => {
    setState((s) => ({ ...s, phase: 'shuffling', error: null }));

    // Shuffle animation — intentional ceremonial delay
    await delay(2800);

    try {
      const { session } = generateReading({
        firstName: values.firstName,
        dateOfBirth: values.dateOfBirth,
      });

      const recommendations: RecommendedOffer[] = buildRecommendations({
        zodiacSign: session.zodiacSign,
        energyTheme: session.energyTheme,
        cards: session.cards,
      });

      setState((s) => ({
        ...s,
        phase: 'revealing',
        session,
        revealedCardCount: 0,
        isPersisted: false,
      }));

      // Persist in the background — does not block the reveal flow
      persistReading(session, recommendations)
        .then((result) => {
          if (result) setState((s) => ({ ...s, isPersisted: true }));
        })
        .catch(() => {
          // Non-fatal — reading continues without server confirmation
        });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setState((s) => ({ ...s, phase: 'intake', error: message }));
    }
  }, []);

  const revealNextCard = useCallback(() => {
    setState((s) => {
      const next = s.revealedCardCount + 1;
      const total = s.session?.cards.length ?? 0;
      return {
        ...s,
        revealedCardCount: next,
        phase: next >= total ? 'complete' : 'revealing',
      };
    });
  }, []);

  const reset = useCallback(() => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    setState(INITIAL_STATE);
  }, []);

  return {
    ...state,
    startIntake,
    submitIntake,
    revealNextCard,
    reset,
    landingTrackedRef,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
