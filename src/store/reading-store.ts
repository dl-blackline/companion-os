import { useState, useCallback } from 'react';
import type { ReadingSession } from '@/lib/tarot/tarot-types';
import { generateReading } from '@/lib/tarot/reading-engine';
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
}

const INITIAL_STATE: ReadingState = {
  phase: 'idle',
  session: null,
  revealedCardCount: 0,
  error: null,
};

/**
 * Central hook for managing the full tarot reading flow.
 * Sessions are generated client-side and can be extended to persist via API.
 */
export function useReadingStore() {
  const [state, setState] = useState<ReadingState>(INITIAL_STATE);

  const startIntake = useCallback(() => {
    setState((s) => ({ ...s, phase: 'intake', error: null }));
  }, []);

  const submitIntake = useCallback(async (values: IntakeFormValues) => {
    setState((s) => ({ ...s, phase: 'shuffling', error: null }));

    // Simulate shuffle animation delay
    await delay(2800);

    try {
      const { session } = generateReading({
        firstName: values.firstName,
        dateOfBirth: values.dateOfBirth,
      });

      setState((s) => ({
        ...s,
        phase: 'revealing',
        session,
        revealedCardCount: 0,
      }));
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
    setState(INITIAL_STATE);
  }, []);

  return {
    ...state,
    startIntake,
    submitIntake,
    revealNextCard,
    reset,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
