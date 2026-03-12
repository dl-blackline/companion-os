import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CompanionOrb } from '@/components/CompanionOrb';
import {
  Microphone,
  MicrophoneSlash,
  ArrowLeft,
  SpeakerSimpleHigh,
  SpeakerSimpleSlash,
  Trash,
} from '@phosphor-icons/react';
import type { CompanionState, TalkSession, TalkTurn } from '@/types';
import { generateId } from '@/lib/helpers';
import { getModeConfig } from '@/lib/modes';
import { cn } from '@/lib/utils';

interface LiveTalkViewProps {
  companionState: CompanionState;
  setCompanionState: (state: CompanionState) => void;
  aiName: string;
  onBack: () => void;
}

const WAVEFORM_BARS = 28;

function WaveformBars({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex items-center gap-[3px] h-10">
      {Array.from({ length: WAVEFORM_BARS }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full origin-bottom"
          animate={
            active
              ? {
                  scaleY: [
                    0.15,
                    Math.random() * 0.7 + 0.3,
                    Math.random() * 0.5 + 0.15,
                    Math.random() * 0.9 + 0.3,
                    0.15,
                  ],
                }
              : { scaleY: 0.15 }
          }
          transition={
            active
              ? {
                  duration: 0.55 + Math.random() * 0.45,
                  repeat: Infinity,
                  repeatType: 'loop',
                  delay: (i * 0.04) % 0.5,
                  ease: 'easeInOut',
                }
              : { duration: 0.3 }
          }
          style={{ height: 40, background: color }}
        />
      ))}
    </div>
  );
}

export function LiveTalkView({
  companionState,
  setCompanionState,
  aiName,
  onBack,
}: LiveTalkViewProps) {
  const [session, setSession] = useState<TalkSession>({
    id: generateId(),
    transcript: [],
    startedAt: Date.now(),
    mode: 'neutral',
  });
  const [isMicOn, setIsMicOn] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [interimText, setInterimText] = useState('');
  const [statusText, setStatusText] = useState('Tap the mic to start talking');

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef(window.speechSynthesis);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);
  const voiceEnabledRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read voice mode preference from localStorage
  const getVoiceMode = (): 'continuous' | 'push-to-talk' => {
    try {
      return (localStorage.getItem('voice_mode') as 'continuous' | 'push-to-talk') || 'push-to-talk';
    } catch {
      return 'push-to-talk';
    }
  };

  const isContinuousMode = () => getVoiceMode() === 'continuous';

  // Auto-scroll to bottom of transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.transcript, interimText]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsMicOn(false);
    setInterimText('');
    if (!isProcessingRef.current) {
      setCompanionState('idle');
      setStatusText(voiceEnabledRef.current ? 'Resuming…' : 'Tap the mic to start talking');
    }
  }, [setCompanionState]);

  const speak = useCallback(
    (text: string) => {
      if (!isSpeakerOn) {
        // Even if speaker is off, handle continuous mode resume
        isProcessingRef.current = false;
        if (voiceEnabledRef.current && isContinuousMode()) {
          setTimeout(() => {
            if (voiceEnabledRef.current) startListeningInternal();
          }, 300);
        } else {
          setCompanionState('idle');
          setStatusText('Tap the mic to start talking');
        }
        return;
      }
      synthRef.current.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setCompanionState('speaking');
        setStatusText('Speaking…');
      };
      utterance.onend = () => {
        isProcessingRef.current = false;
        if (voiceEnabledRef.current && isContinuousMode()) {
          setCompanionState('idle');
          setStatusText('Resuming…');
          setTimeout(() => {
            if (voiceEnabledRef.current) startListeningInternal();
          }, 300);
        } else {
          setCompanionState('idle');
          setStatusText('Tap the mic to start talking');
        }
      };
      utterance.onerror = () => {
        isProcessingRef.current = false;
        if (voiceEnabledRef.current && isContinuousMode()) {
          setCompanionState('idle');
          setStatusText('Resuming…');
          setTimeout(() => {
            if (voiceEnabledRef.current) startListeningInternal();
          }, 300);
        } else {
          setCompanionState('idle');
          setStatusText('Tap the mic to start talking');
        }
      };

      synthRef.current.speak(utterance);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSpeakerOn, setCompanionState]
  );

  const processUserMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isProcessingRef.current) return;
      isProcessingRef.current = true;

      // Add user turn
      const userTurn: TalkTurn = {
        id: generateId(),
        role: 'user',
        text: text.trim(),
        timestamp: Date.now(),
      };
      setSession((prev) => ({
        ...prev,
        transcript: [...prev.transcript, userTurn],
      }));

      setCompanionState('thinking');
      setStatusText('Thinking…');

      try {
        const modeConfig = getModeConfig('neutral');
        const contextLines = session.transcript
          .slice(-8)
          .map((t) => `${t.role === 'user' ? 'User' : aiName}: ${t.text}`)
          .join('\n');

        const prompt = `${modeConfig.systemPrompt}

You are ${aiName}, a real-time AI companion. Respond naturally, warmly, and conversationally — as if speaking aloud. Keep responses concise (1-3 sentences) unless detail is specifically needed. Avoid bullet points or markdown; speak in flowing prose.

Recent conversation:
${contextLines}

User said: "${text.trim()}"

Respond as ${aiName}:`;

        const res = await fetch('/.netlify/functions/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'chat',
            data: {
              conversation_id: session.id,
              user_id: 'default-user',
              message: prompt,
              model: localStorage.getItem('chat_model') || undefined,
            },
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Chat API error:', res.status, errData);
          throw new Error(errData.error || `Chat request failed with status ${res.status}`);
        }

        const data = await res.json();
        const response = data.response;

        const assistantTurn: TalkTurn = {
          id: generateId(),
          role: 'assistant',
          text: response,
          timestamp: Date.now(),
        };
        setSession((prev) => ({
          ...prev,
          transcript: [...prev.transcript, assistantTurn],
        }));

        speak(response);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Something went wrong. Try again.';
        console.error('Live Talk error:', err);

        const errorTurn: TalkTurn = {
          id: generateId(),
          role: 'assistant',
          text: `⚠️ ${errorMessage}. Reconnecting…`,
          timestamp: Date.now(),
        };
        setSession((prev) => ({
          ...prev,
          transcript: [...prev.transcript, errorTurn],
        }));

        isProcessingRef.current = false;

        if (voiceEnabledRef.current && isContinuousMode()) {
          setCompanionState('idle');
          setStatusText('Voice connection lost. Reconnecting…');
          // Auto-restart the voice loop after a brief delay
          reconnectTimerRef.current = setTimeout(() => {
            if (voiceEnabledRef.current) {
              setStatusText('Resuming…');
              startListeningInternal();
            }
          }, 2000);
        } else {
          setCompanionState('idle');
          setStatusText(errorMessage);
        }
      }
    },
    [session.id, session.transcript, aiName, setCompanionState, speak]
  );

  const startListeningInternal = useCallback(() => {
    const w = window as typeof window & {
      SpeechRecognition?: typeof SpeechRecognition;
      webkitSpeechRecognition?: typeof SpeechRecognition;
    };
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SR) {
      setStatusText('Voice input not supported in this browser');
      return;
    }

    synthRef.current.cancel();

    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setIsMicOn(true);
      setCompanionState('listening');
      setStatusText('Listening…');
    };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setInterimText(interim);
      if (final) {
        setInterimText('');
        processUserMessage(final);
      }
    };

    rec.onend = () => {
      setIsMicOn(false);
      setInterimText('');
      if (!isProcessingRef.current) {
        // In continuous mode, auto-restart listening if no speech was detected
        if (voiceEnabledRef.current && isContinuousMode()) {
          setTimeout(() => {
            if (voiceEnabledRef.current && !isProcessingRef.current) {
              startListeningInternal();
            }
          }, 300);
        } else {
          setCompanionState('idle');
          setStatusText('Tap the mic to start talking');
        }
      }
    };

    rec.onerror = (ev) => {
      setIsMicOn(false);
      setInterimText('');
      // In continuous mode, auto-restart on recoverable errors
      if (voiceEnabledRef.current && isContinuousMode() && ev.error !== 'not-allowed') {
        setTimeout(() => {
          if (voiceEnabledRef.current) startListeningInternal();
        }, 1000);
      } else {
        setCompanionState('idle');
        setStatusText('Tap the mic to start talking');
      }
    };

    recognitionRef.current = rec;
    rec.start();
  }, [setCompanionState, processUserMessage]);

  const startListening = useCallback(() => {
    voiceEnabledRef.current = true;
    startListeningInternal();
  }, [startListeningInternal]);

  const handleMicToggle = () => {
    // isMicOn tracks the active SpeechRecognition instance; voiceEnabledRef tracks the
    // continuous-mode voice loop (which survives between individual recognition sessions).
    // We stop both when the user explicitly clicks the toggle.
    if (isMicOn || voiceEnabledRef.current) {
      voiceEnabledRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      stopListening();
    } else {
      startListening();
    }
  };

  const handleClearSession = () => {
    synthRef.current.cancel();
    voiceEnabledRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    stopListening();
    setSession({
      id: generateId(),
      transcript: [],
      startedAt: Date.now(),
      mode: 'neutral',
    });
    setStatusText('Tap the mic to start talking');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      voiceEnabledRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      synthRef.current.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  const isListening = companionState === 'listening';
  const isSpeaking = companionState === 'speaking';
  const isThinking = companionState === 'thinking';
  const isActive = isListening || isSpeaking || isThinking;

  return (
    <div className="relative flex flex-col h-full bg-background overflow-hidden">
      {/* Ambient background */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 65% 55% at 50% 30%, oklch(0.28 0.08 285 / 0.35) 0%, transparent 70%)',
        }}
      />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={16} />
          Back
        </Button>
        <span
          className="text-sm font-semibold tracking-widest uppercase text-muted-foreground"
          style={{ fontFamily: 'var(--font-space)' }}
        >
          Live Talk
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setIsSpeakerOn((v) => !v);
              if (isSpeakerOn) synthRef.current.cancel();
            }}
            className="text-muted-foreground hover:text-foreground"
            title={isSpeakerOn ? 'Mute speaker' : 'Unmute speaker'}
          >
            {isSpeakerOn ? <SpeakerSimpleHigh size={18} /> : <SpeakerSimpleSlash size={18} />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClearSession}
            className="text-muted-foreground hover:text-foreground"
            title="Clear conversation"
          >
            <Trash size={18} />
          </Button>
        </div>
      </div>

      {/* Orb + waveform */}
      <div className="relative z-10 flex flex-col items-center pt-4 pb-6 gap-5">
        <CompanionOrb
          state={companionState}
          size="lg"
          showRipples={true}
        />

        {/* Waveform */}
        <div className="h-10 flex items-center">
          <AnimatePresence mode="wait">
            {isListening && (
              <motion.div
                key="listen-wave"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <WaveformBars active={true} color="oklch(0.65 0.20 230)" />
              </motion.div>
            )}
            {isSpeaking && (
              <motion.div
                key="speak-wave"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <WaveformBars active={true} color="oklch(0.75 0.18 65)" />
              </motion.div>
            )}
            {isThinking && (
              <motion.div
                key="think-indicator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1.5"
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: 'oklch(0.60 0.22 310)' }}
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                    transition={{ duration: 1.0, repeat: Infinity, delay: i * 0.22 }}
                  />
                ))}
              </motion.div>
            )}
            {!isActive && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <WaveformBars active={false} color="oklch(0.40 0.04 270)" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Status text */}
        <motion.p
          key={statusText}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="text-sm text-muted-foreground text-center px-4"
        >
          {statusText}
        </motion.p>
      </div>

      {/* Transcript */}
      <div className="relative z-10 flex-1 min-h-0 px-4 pb-2">
        <ScrollArea className="h-full">
          <div ref={scrollRef} className="space-y-3 pb-2 pr-1">
            <AnimatePresence initial={false}>
              {session.transcript.map((turn) => (
                <motion.div
                  key={turn.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={cn(
                    'flex',
                    turn.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[78%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
                      turn.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-card border border-border text-foreground rounded-bl-md'
                    )}
                  >
                    {turn.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Interim text */}
            {interimText && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-end"
              >
                <div className="max-w-[78%] px-4 py-2.5 rounded-2xl rounded-br-md bg-primary/40 text-primary-foreground/70 text-sm leading-relaxed italic">
                  {interimText}
                </div>
              </motion.div>
            )}

            {session.transcript.length === 0 && !interimText && (
              <p className="text-center text-muted-foreground text-sm py-6 opacity-60">
                Your conversation will appear here
              </p>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Mic button */}
      <div className="relative z-10 flex items-center justify-center pb-8 pt-4">
        <motion.button
          onClick={handleMicToggle}
          className={cn(
            'relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-300',
            isMicOn
              ? 'bg-[oklch(0.65_0.20_230)] shadow-[0_0_32px_oklch(0.65_0.20_230/0.65),0_0_64px_oklch(0.65_0.20_230/0.30)]'
              : 'bg-card border border-border hover:border-primary/50 hover:bg-card/80 hover:shadow-[0_0_20px_oklch(0.50_0.18_285/0.25)]'
          )}
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.93 }}
        >
          {isMicOn ? (
            <Microphone size={28} weight="fill" className="text-white" />
          ) : (
            <MicrophoneSlash size={28} weight="fill" className="text-muted-foreground" />
          )}

          {/* Active ring */}
          {isMicOn && (
            <>
              <span className="absolute inset-0 rounded-full border-2 border-[oklch(0.65_0.20_230/0.60)] ripple-1" />
              <span className="absolute inset-0 rounded-full border-2 border-[oklch(0.65_0.20_230/0.40)] ripple-2" />
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}
