import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  RealtimeVoiceClient,
  type RealtimeVoice,
  type RealtimeVoiceEvent,
  type RealtimeVoiceState,
} from '@/lib/realtime-voice-client';
import { getModeConfig } from '@/lib/modes';

export type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'thinking' | 'error';

interface VoiceContextType {
  /** Whether voice mode is enabled (connected or connecting) */
  isActive: boolean;
  /** Whether the microphone is actively listening */
  isListening: boolean;
  /** Whether the AI is currently speaking */
  isSpeaking: boolean;
  /** Current detailed status */
  status: VoiceStatus;
  /** Last error message, if any */
  errorMessage: string | null;
  /** User speech transcript from current session */
  lastTranscript: string;
  /** Start a live talk session */
  startLiveTalk: () => Promise<void>;
  /** Stop the live talk session */
  stopLiveTalk: () => void;
  /** Toggle live talk on/off */
  toggleLiveTalk: () => void;
  /** Whether the mic is muted (track disabled but session alive) */
  isMuted: boolean;
  /** Toggle microphone mute */
  toggleMute: () => void;
  /** Current voice selection */
  voice: RealtimeVoice;
  /** Switch the AI voice */
  setVoice: (voice: RealtimeVoice) => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [voice, setVoiceState] = useState<RealtimeVoice>(() => {
    try {
      return (localStorage.getItem('realtime_voice') as RealtimeVoice) || 'alloy';
    } catch {
      return 'alloy';
    }
  });

  // Keep the client in a ref to avoid re-renders and survive across navigations
  const clientRef = useRef<RealtimeVoiceClient | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const handleEvent = useCallback((event: RealtimeVoiceEvent) => {
    switch (event.type) {
      case 'state_change': {
        const stateMap: Record<RealtimeVoiceState, VoiceStatus> = {
          disconnected: 'idle',
          connecting: 'connecting',
          listening: 'listening',
          thinking: 'thinking',
          speaking: 'speaking',
        };
        const mapped = stateMap[event.state!] ?? 'idle';
        setStatus(mapped);
        if (mapped !== 'error') setErrorMessage(null);
        break;
      }
      case 'transcript':
        if (event.text) setLastTranscript(event.text);
        break;
      case 'error':
        setErrorMessage(event.error ?? 'Unknown error');
        setStatus('error');
        break;
      case 'interrupted':
        // AI was interrupted — status will be updated via state_change
        break;
    }
  }, []);

  const startLiveTalk = useCallback(async () => {
    if (clientRef.current && status !== 'idle' && status !== 'error') return;

    // Clean up any existing client
    if (clientRef.current) {
      unsubRef.current?.();
      clientRef.current.disconnect();
      clientRef.current = null;
    }

    if (!RealtimeVoiceClient.isSupported()) {
      setErrorMessage('Your browser does not support real-time voice.');
      setStatus('error');
      return;
    }

    setStatus('connecting');
    setErrorMessage(null);
    setLastTranscript('');
    setIsMuted(false);

    const modeConfig = getModeConfig('neutral');
    const client = new RealtimeVoiceClient({
      voice,
      systemPrompt: modeConfig.systemPrompt,
    });

    clientRef.current = client;
    unsubRef.current = client.on(handleEvent);

    try {
      await client.connect();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to connect');
      setStatus('error');
    }
  }, [status, voice, handleEvent]);

  const stopLiveTalk = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setStatus('idle');
    setErrorMessage(null);
    setIsMuted(false);
  }, []);

  const toggleLiveTalk = useCallback(() => {
    if (status === 'idle' || status === 'error') {
      startLiveTalk();
    } else {
      stopLiveTalk();
    }
  }, [status, startLiveTalk, stopLiveTalk]);

  const toggleMute = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;

    setIsMuted((prev) => {
      const muted = !prev;
      client.setMicEnabled(!muted);
      return muted;
    });
  }, []);

  const setVoice = useCallback(
    (v: RealtimeVoice) => {
      setVoiceState(v);
      try {
        localStorage.setItem('realtime_voice', v);
      } catch {
        // Ignore storage errors
      }
      // Update the live session if active
      if (clientRef.current && status !== 'idle' && status !== 'error') {
        clientRef.current.updateSession({ voice: v });
      }
    },
    [status]
  );

  const isActive = status !== 'idle' && status !== 'error';
  const isListening = status === 'listening';
  const isSpeaking = status === 'speaking';

  const value = useMemo<VoiceContextType>(
    () => ({
      isActive,
      isListening,
      isSpeaking,
      status,
      errorMessage,
      lastTranscript,
      startLiveTalk,
      stopLiveTalk,
      toggleLiveTalk,
      isMuted,
      toggleMute,
      voice,
      setVoice,
    }),
    [
      isActive,
      isListening,
      isSpeaking,
      status,
      errorMessage,
      lastTranscript,
      startLiveTalk,
      stopLiveTalk,
      toggleLiveTalk,
      isMuted,
      toggleMute,
      voice,
      setVoice,
    ]
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoice(): VoiceContextType {
  const context = useContext(VoiceContext);
  if (context === undefined) {
    throw new Error('useVoice must be used within a VoiceProvider');
  }
  return context;
}
