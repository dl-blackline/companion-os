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

export function useRuntimeHealth(pollMs = 90000): RuntimeHealth {
  const [services, setServices] = useState<HealthPayload | null>(null);
  const [voiceOk, setVoiceOk] = useState<boolean>(hasVoiceCapability());

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch('/.netlify/functions/system-health');
        if (!res.ok) {
          if (!cancelled) setServices({});
          return;
        }
        const json = await res.json();
        const data = (json.data ?? json) as HealthPayload;
        if (!cancelled) {
          setServices(data);
          setVoiceOk(hasVoiceCapability());
        }
      } catch {
        if (!cancelled) setServices({});
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
      return { state: 'checking', unavailableServices: [] };
    }

    const unavailable = Object.entries(SERVICE_LABELS)
      .filter(([key]) => !isOk(services[key as keyof HealthPayload]))
      .map(([, label]) => label);

    if (!voiceOk) unavailable.push('voice');

    if (unavailable.length === 0) {
      return { state: 'healthy', unavailableServices: [] };
    }

    if (unavailable.length >= 4) {
      return { state: 'down', unavailableServices: unavailable };
    }

    return { state: 'degraded', unavailableServices: unavailable };
  }, [services, voiceOk]);
}
