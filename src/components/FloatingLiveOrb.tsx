import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Microphone } from '@phosphor-icons/react/Microphone';
import { MicrophoneSlash } from '@phosphor-icons/react/MicrophoneSlash';
import { SpeakerSimpleHigh } from '@phosphor-icons/react/SpeakerSimpleHigh';
import { Stop } from '@phosphor-icons/react/Stop';
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

  // Status label shown below/above orb
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

  // Determine orb visual style based on state
  const orbStyle = (() => {
    if (status === 'error') return 'floating-orb--error';
    if (isSpeaking) return 'floating-orb--speaking';
    if (isListening) return isMuted ? 'floating-orb--muted' : 'floating-orb--listening';
    if (status === 'connecting' || status === 'thinking') return 'floating-orb--connecting';
    return 'floating-orb--idle';
  })();

  return (
    <div className="floating-orb-container" style={{ zIndex: 9999 }}>
      {/* Expansion panel */}
      <AnimatePresence>
        {isPanelOpen && isActive && (
          <motion.div
            className="floating-orb-panel"
            initial={{ opacity: 0, y: 12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.9 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {/* Mute / Unmute mic */}
            <button
              className="floating-orb-panel-btn"
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
            <div className="floating-orb-panel-voice">
              <SpeakerSimpleHigh size={16} className="text-muted-foreground" aria-hidden="true" />
              <select
                className="floating-orb-panel-select"
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
              className="floating-orb-panel-btn floating-orb-panel-btn--danger"
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
            className="floating-orb-status"
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

      {/* The orb button */}
      <motion.button
        className={cn('floating-orb-btn', orbStyle)}
        style={{
          width: isMobile ? 64 : 56,
          height: isMobile ? 64 : 56,
        }}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.93 }}
        aria-label={isActive ? 'Stop Live Talk' : 'Start Live Talk'}
      >
        {/* Pulse ring when listening */}
        {isListening && !isMuted && (
          <span className="floating-orb-pulse" />
        )}

        {/* Icon */}
        {isActive ? (
          isMuted ? (
            <MicrophoneSlash size={isMobile ? 28 : 24} weight="fill" />
          ) : (
            <Microphone size={isMobile ? 28 : 24} weight="fill" />
          )
        ) : (
          <Microphone size={isMobile ? 28 : 24} weight="fill" />
        )}
      </motion.button>
    </div>
  );
}
