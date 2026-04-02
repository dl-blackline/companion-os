import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Microphone } from '@phosphor-icons/react/Microphone';
import { MicrophoneSlash } from '@phosphor-icons/react/MicrophoneSlash';
import { SpeakerSimpleHigh } from '@phosphor-icons/react/SpeakerSimpleHigh';
import { Stop } from '@phosphor-icons/react/Stop';
import { Sparkle } from '@phosphor-icons/react/Sparkle';
import { useVoice } from '@/context/voice-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/utils/haptics';
import { REALTIME_VOICES, type RealtimeVoice } from '@/lib/realtime-voice-client';

/**
 * FloatingLiveOrb — A persistent floating button that allows the user to
 * start/stop real-time voice conversation with the AI from any page.
 */
export function FloatingLiveOrb() {
  const {
    isActive,
    isListening,
    isSpeaking,
    status,
    errorMessage,
    toggleLiveTalk,
    stopLiveTalk,
    isMuted,
    toggleMute,
    voice,
    setVoice,
  } = useVoice();

  const isMobile = useIsMobile();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    triggerHaptic('tap');
    toggleLiveTalk();
  }, [toggleLiveTalk]);

  const handlePointerDown = useCallback(() => {
    const timer = setTimeout(() => {
      if (isActive) {
        triggerHaptic('medium');
        setIsPanelOpen((prev) => !prev);
      }
    }, 500);
    setLongPressTimer(timer);
  }, [isActive]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  const handlePointerLeave = useCallback(() => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  }, [longPressTimer]);

  // Status label shown below/above launcher
  const statusLabel = (() => {
    switch (status) {
      case 'connecting':
        return 'Connecting…';
      case 'listening':
        return isMuted ? 'Muted' : 'Listening…';
      case 'thinking':
        return 'Thinking…';
      case 'speaking':
        return 'Speaking…';
      case 'error':
        return 'Error';
      default:
        return null;
    }
  })();

  const styleClass = (() => {
    if (status === 'error') return 'border-destructive/70 text-destructive bg-background/95';
    if (isSpeaking) return 'border-rose-300/70 text-rose-100 bg-rose-500/12';
    if (isListening && !isMuted) return 'border-sky-300/70 text-sky-100 bg-sky-500/12';
    if (status === 'connecting' || status === 'thinking') return 'border-amber-200/70 text-amber-100 bg-amber-500/12';
    return 'border-border/70 text-foreground bg-background/95';
  })();

  return (
    <div className="fixed right-4 md:right-6 bottom-5 md:bottom-6 z-[9999] flex flex-col items-end gap-2">
      {/* Expansion panel */}
      <AnimatePresence>
        {isPanelOpen && isActive && (
          <motion.div
            className="w-[250px] rounded-2xl border border-border/80 bg-background/95 backdrop-blur-md shadow-[0_14px_30px_rgba(0,0,0,0.25)] p-2 space-y-2"
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {/* Mute / Unmute mic */}
            <button
              className="w-full h-10 px-3 rounded-xl border border-border/70 bg-black/20 hover:bg-black/30 transition-colors inline-flex items-center gap-2"
              onClick={() => {
                triggerHaptic('light');
                toggleMute();
              }}
              aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMuted ? <MicrophoneSlash size={20} /> : <Microphone size={20} />}
              <span className="text-xs">{isMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            {/* Voice selector */}
            <div className="w-full h-10 px-3 rounded-xl border border-border/70 bg-black/20 inline-flex items-center gap-2">
              <SpeakerSimpleHigh size={16} className="text-muted-foreground" aria-hidden="true" />
              <select
                className="flex-1 bg-transparent text-sm outline-none"
                value={voice}
                onChange={(e) => setVoice(e.target.value as RealtimeVoice)}
                aria-label="Select AI voice"
              >
                {REALTIME_VOICES.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>

            {/* End session */}
            <button
              className="w-full h-10 px-3 rounded-xl border border-destructive/45 text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors inline-flex items-center gap-2"
              onClick={() => {
                triggerHaptic('medium');
                stopLiveTalk();
                setIsPanelOpen(false);
              }}
              aria-label="End voice session"
            >
              <Stop size={20} weight="fill" />
              <span className="text-xs">End</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status indicator */}
      <AnimatePresence>
        {statusLabel && (
          <motion.div
            className="rounded-md border border-border/70 bg-background/90 px-2 py-1 text-[11px] text-muted-foreground"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            title={status === 'error' ? errorMessage ?? '' : undefined}
          >
            {statusLabel}
          </motion.div>
        )}
      </AnimatePresence>

      {/* The compact launcher */}
      <motion.button
        className={cn(
          'relative inline-flex items-center justify-center rounded-xl border shadow-[0_10px_28px_rgba(0,0,0,0.3)] backdrop-blur-md transition-colors',
          styleClass
        )}
        style={{
          width: isMobile ? 50 : 44,
          height: isMobile ? 50 : 44,
        }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        aria-label={isActive ? 'Stop Live Talk' : 'Start Live Talk'}
      >
        {isActive ? (
          isMuted ? (
            <MicrophoneSlash size={isMobile ? 22 : 19} weight="fill" />
          ) : (
            <Microphone size={isMobile ? 22 : 19} weight="fill" />
          )
        ) : (
          <Sparkle size={isMobile ? 22 : 19} weight="fill" />
        )}
      </motion.button>
    </div>
  );
}
