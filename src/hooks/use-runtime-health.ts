import { useEffect, useMemo, useState } from 'react';

type ServiceStatus = 'ok' | 'error' | 'not_configured' | 'checking';
export type RuntimeHealthState = 'checking' | 'healthy' | 'degraded' | 'down';

interface HealthPayload {
  openai?: ServiceStatus;
  supabase?: ServiceStatus;
  vector_search?: ServiceStatus;
  media?: ServiceStatus;
  leonardo?: ServiceStatus;
}

export interface RuntimeHealth {
  state: RuntimeHealthState;
  unavailableServices: string[];
}

const SERVICE_LABELS: Record<keyof HealthPayload, string> = {
  openai: 'openai',
  supabase: 'supabase',
  vector_search: 'vector',
  media: 'media',
  leonardo: 'leonardo',
};

const REQUEST_TIMEOUT_MS = 5000;
const RETRY_DELAYS_MS = [350, 900];
const MAX_CONSECUTIVE_FAILURES_BEFORE_DOWN = 3;

function isOk(status: ServiceStatus | undefined) {
  return status === 'ok';
}

function hasVoiceCapability() {
  const w = window as typeof window & {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  };
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function useRuntimeHealth(pollMs = 90000): RuntimeHealth {
  const [services, setServices] = useState<HealthPayload | null>(null);
  const [voiceOk, setVoiceOk] = useState<boolean>(hasVoiceCapability());
  const [failureCount, setFailureCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function runCheckWithRetry() {
      for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          const res = await fetchWithTimeout('/.netlify/functions/system-health', REQUEST_TIMEOUT_MS);
          if (!res.ok) {
            throw new Error(`Health request failed with ${res.status}`);
          }

          const json = await res.json();
          const data = (json.data ?? json) as HealthPayload;
          return data;
        } catch {
          if (attempt === RETRY_DELAYS_MS.length) {
            throw new Error('Health check failed after retries');
          }
          await wait(RETRY_DELAYS_MS[attempt]);
        }
      }
      throw new Error('Unreachable');
    }

    async function check() {
      try {
        const data = await runCheckWithRetry();
        if (!cancelled) {
          setServices(data);
          setVoiceOk(hasVoiceCapability());
          setFailureCount(0);
        }
      } catch {
        if (!cancelled) {
          setFailureCount((prev) => prev + 1);
        }
      }
    }

    check();
    const interval = window.setInterval(check, pollMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [pollMs]);

  return useMemo(() => {
    if (services == null) {
      if (failureCount >= MAX_CONSECUTIVE_FAILURES_BEFORE_DOWN) {
        return { state: 'down', unavailableServices: ['health-check'] };
      }
      return { state: 'checking', unavailableServices: [] };
    }

    const unavailable = Object.entries(SERVICE_LABELS)
      .filter(([key]) => !isOk(services[key as keyof HealthPayload]))
      .map(([, label]) => label);

    if (!voiceOk) unavailable.push('voice');

    if (failureCount >= MAX_CONSECUTIVE_FAILURES_BEFORE_DOWN) {
      const withHealth = Array.from(new Set([...unavailable, 'health-check']));
      return { state: 'down', unavailableServices: withHealth };
    }

    // Avoid flicker during short outages: keep the last good service view
    // until we hit the down threshold.
    if (failureCount > 0) {
      if (unavailable.length === 0) {
        return { state: 'healthy', unavailableServices: [] };
      }
      return { state: 'degraded', unavailableServices: unavailable };
    }

    if (unavailable.length === 0) {
      return { state: 'healthy', unavailableServices: [] };
    }

    if (unavailable.length >= 4) {
      return { state: 'down', unavailableServices: unavailable };
    }

    return { state: 'degraded', unavailableServices: unavailable };
  }, [services, voiceOk, failureCount]);
}
