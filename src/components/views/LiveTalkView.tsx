import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CompanionOrb } from '@/components/CompanionOrb';
import { BackgroundGlow } from '@/components/ui/background-glow';
import { AudioVisualizer } from '@/components/voice/audio-visualizer';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Microphone,
  MicrophoneSlash,
  ArrowLeft,
  SpeakerSimpleHigh,
  SpeakerSimpleSlash,
  Trash,
  MagicWand,
  Image as ImageIcon,
  Lightning,
  X,
  VideoCamera,
  Books,
} from '@phosphor-icons/react';
import type { KnowledgeItem } from '@/types';
import type { CompanionState, TalkSession, TalkTurn } from '@/types';
import { generateId } from '@/lib/helpers';
import { getModeConfig } from '@/lib/modes';
import { cn } from '@/lib/utils';
import { triggerHaptic } from '@/utils/haptics';
import {
  RealtimeVoiceClient,
  type RealtimeVoice,
  type RealtimeVoiceEvent,
} from '@/lib/realtime-voice-client';
import { useVoice } from '@/context/voice-context';

/** Roleplay context tracked locally during a session */
interface RoleplayContext {
  character: string;
  scenario: string;
}

/**
 * Search the user's personal knowledge base stored in localStorage.
 * Returns up to `limit` items whose title/content/tags/summary match any query word.
 */
function searchKnowledgeItems(
  query: string,
  limit = 3,
): Array<{ title: string; type: string; content: string }> {
  try {
    const items = JSON.parse(localStorage.getItem('knowledge-items') || '[]') as KnowledgeItem[];
    const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    return items
      .filter((item) => {
        const searchTarget =
          `${item.title} ${item.content} ${(item.tags ?? []).join(' ')} ${item.summary ?? ''}`.toLowerCase();
        return queryWords.some((word) => searchTarget.includes(word));
      })
      .slice(0, limit)
      .map((item) => ({
        title: item.title,
        type: item.type,
        content: item.summary || item.content.slice(0, 300),
      }));
  } catch {
    return [];
  }
}

/** Example capability prompts shown in the empty-state hint bar */
const CAPABILITY_HINTS = [
  'Generate an image of…',
  'Generate a video of…',
  'Search my docs for…',
  'Play the role of…',
  'Write a plan for…',
  'Summarize…',
  'Write code for…',
];

interface LiveTalkViewProps {
  companionState: CompanionState;
  setCompanionState: (state: CompanionState) => void;
  aiName: string;
  onBack: () => void;
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
  const [interimAssistantText, setInterimAssistantText] = useState('');
  const [statusText, setStatusText] = useState('Tap the mic to start talking');
  const [useRealtime, setUseRealtime] = useState(false);
  const [roleplayMode, setRoleplayMode] = useState<RoleplayContext | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef(window.speechSynthesis);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isProcessingRef = useRef(false);
  const voiceEnabledRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const realtimeClientRef = useRef<RealtimeVoiceClient | null>(null);
  const roleplayRef = useRef<RoleplayContext | null>(null);
  const MAX_RECONNECT_ATTEMPTS = 3;

  // Stop the global voice session (FloatingLiveOrb) if it is running when this
  // view mounts. Both this view and the FloatingLiveOrb create independent
  // RealtimeVoiceClient instances, so allowing both to run simultaneously
  // causes duplicate audio output on this page.
  const { isActive: isGlobalVoiceActive, stopLiveTalk: stopGlobalVoice } = useVoice();
  useEffect(() => {
    if (isGlobalVoiceActive) {
      stopGlobalVoice();
    }
    // Only run on initial mount — deps intentionally omitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read voice mode preference from localStorage
  const getVoiceMode = (): 'continuous' | 'push-to-talk' => {
    try {
      return (localStorage.getItem('voice_mode') as 'continuous' | 'push-to-talk') || 'push-to-talk';
    } catch {
      return 'push-to-talk';
    }
  };

  const isContinuousMode = () => getVoiceMode() === 'continuous';

  // Read preferred realtime voice from localStorage
  const getRealtimeVoice = (): RealtimeVoice => {
    try {
      return (localStorage.getItem('realtime_voice') as RealtimeVoice) || 'alloy';
    } catch {
      return 'alloy';
    }
  };

  // Handle events from the RealtimeVoiceClient
  const handleRealtimeEvent = useCallback(
    (event: RealtimeVoiceEvent) => {
      switch (event.type) {
        case 'state_change':
          if (event.state === 'listening') {
            setCompanionState('listening');
            setStatusText('Listening…');
            setIsMicOn(true);
          } else if (event.state === 'thinking') {
            setCompanionState('thinking');
            setStatusText('Thinking…');
          } else if (event.state === 'speaking') {
            setCompanionState('speaking');
            setStatusText(`${aiName} is speaking…`);
          } else if (event.state === 'disconnected') {
            setIsMicOn(false);
            setCompanionState('idle');
            setStatusText('Tap the mic to start talking');
          }
          break;

        case 'transcript': {
          if (event.partial) {
            // Streaming assistant text — update the in-progress bubble
            if (event.role === 'assistant') {
              setInterimAssistantText(event.text || '');
            }
            break;
          }
          // Final transcript — clear interim bubble and add completed turn
          if (event.role === 'assistant') {
            setInterimAssistantText('');
          }
          triggerHaptic('light');
          const turn: TalkTurn = {
            id: generateId(),
            role: event.role || 'assistant',
            text: event.text || '',
            timestamp: Date.now(),
          };
          setSession((prev) => ({
            ...prev,
            transcript: [...prev.transcript, turn],
          }));
          break;
        }

        case 'interrupted':
          triggerHaptic('light');
          setInterimAssistantText('');
          break;

        case 'error':
          console.warn('Realtime voice error:', event.error);
          break;

        case 'tool_call': {
          if (!event.toolCall) break;
          const { callId, name, arguments: toolArgs } = event.toolCall;

          if (name === 'generate_image') {
            // Show generating state immediately
            setCompanionState('generating-image');
            setStatusText('Generating image…');
            triggerHaptic('light');

            const imagePrompt = (toolArgs.prompt as string) || '';
            const imageStyle = (toolArgs.style as string) || '';
            const fullPrompt = imageStyle ? `${imagePrompt}, style: ${imageStyle}` : imagePrompt;

            fetch('/.netlify/functions/ai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'media',
                data: { type: 'image', prompt: fullPrompt },
              }),
            })
              .then((r) => r.json())
              .then((imgData) => {
                if (imgData.url) {
                  const imageTurn: TalkTurn = {
                    id: generateId(),
                    role: 'assistant',
                    text: '',
                    timestamp: Date.now(),
                    mediaUrl: imgData.url,
                    mediaType: 'image',
                  };
                  setSession((prev) => ({
                    ...prev,
                    transcript: [...prev.transcript, imageTurn],
                  }));
                }
                realtimeClientRef.current?.submitToolResult(
                  callId,
                  imgData.url
                    ? 'Image generated and displayed to the user.'
                    : 'Image generation failed — no URL returned.'
                );
                // Let the realtime state_change events drive the UI state
              })
              .catch(() => {
                realtimeClientRef.current?.submitToolResult(
                  callId,
                  'Image generation failed due to a server error.'
                );
                setCompanionState('listening');
              });
          } else if (name === 'generate_video') {
            // Show generating-video state immediately
            setCompanionState('generating-video');
            setStatusText('Generating video…');
            triggerHaptic('light');

            const videoPrompt = (toolArgs.prompt as string) || '';
            const videoStyle = (toolArgs.style as string) || '';
            const fullVideoPrompt = videoStyle ? `${videoPrompt}, style: ${videoStyle}` : videoPrompt;

            fetch('/.netlify/functions/ai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'media',
                data: { type: 'video', prompt: fullVideoPrompt },
              }),
            })
              .then((r) => r.json())
              .then((vidData) => {
                if (vidData.url) {
                  const videoTurn: TalkTurn = {
                    id: generateId(),
                    role: 'assistant',
                    text: '',
                    timestamp: Date.now(),
                    mediaUrl: vidData.url,
                    mediaType: 'video',
                  };
                  setSession((prev) => ({
                    ...prev,
                    transcript: [...prev.transcript, videoTurn],
                  }));
                }
                realtimeClientRef.current?.submitToolResult(
                  callId,
                  vidData.url
                    ? 'Video generated and displayed to the user.'
                    : 'Video generation failed — no URL returned.'
                );
              })
              .catch(() => {
                realtimeClientRef.current?.submitToolResult(
                  callId,
                  'Video generation failed due to a server error.'
                );
                setCompanionState('listening');
              });
          } else if (name === 'search_docs') {
            const query = (toolArgs.query as string) || '';
            triggerHaptic('light');

            const results = searchKnowledgeItems(query);
            const docsResult =
              results.length > 0
                ? results
                    .map((item) => `[${item.type.toUpperCase()}] ${item.title}: ${item.content}`)
                    .join('\n\n')
                : 'No matching documents found in the knowledge base.';

            realtimeClientRef.current?.submitToolResult(callId, docsResult);
          } else if (name === 'start_roleplay') {
            const character = (toolArgs.character as string) || 'a character';
            const scenario = (toolArgs.scenario as string) || '';
            const ctx: RoleplayContext = { character, scenario };
            roleplayRef.current = ctx;
            setRoleplayMode(ctx);
            // Update the realtime session so subsequent turns stay in character
            realtimeClientRef.current?.updateSession({
              systemPrompt: `You are ${character}. ${scenario} Stay fully in character throughout the entire conversation. Speak naturally as if talking aloud. Keep responses to 1-3 sentences unless more detail is requested.`,
            });
            realtimeClientRef.current?.submitToolResult(
              callId,
              `Role-play started. You are now ${character}.`
            );
            triggerHaptic('medium');
          } else if (name === 'run_task') {
            const taskDesc = (toolArgs.description as string) || '';
            const taskType = (toolArgs.taskType as string) || 'other';
            setStatusText('Running task…');

            fetch('/.netlify/functions/ai', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                type: 'live_talk',
                data: {
                  // Pass intent_override so the backend skips re-detection
                  message: taskDesc,
                  intent_override: 'run_task',
                  task_type: taskType,
                  ai_name: aiName,
                  mode: 'neutral',
                },
              }),
            })
              .then((r) => r.json())
              .then((taskData) => {
                const taskText = taskData.response || 'Task completed.';
                const taskTurn: TalkTurn = {
                  id: generateId(),
                  role: 'assistant',
                  text: taskText,
                  timestamp: Date.now(),
                };
                setSession((prev) => ({
                  ...prev,
                  transcript: [...prev.transcript, taskTurn],
                }));
                realtimeClientRef.current?.submitToolResult(callId, taskText);
              })
              .catch(() => {
                realtimeClientRef.current?.submitToolResult(
                  callId,
                  'Task execution encountered an error.'
                );
              });
          }
          break;
        }
      }
    },
    [aiName, setCompanionState]
  );

  // Start realtime voice session
  const getBaseSystemPrompt = useCallback(() => {
    const modeConfig = getModeConfig('neutral');
    return `${modeConfig.systemPrompt}

You are ${aiName}, an enterprise-grade real-time AI companion with powerful capabilities. Respond naturally, warmly, and conversationally — as if speaking aloud. Keep responses concise (1-3 sentences) unless detail is specifically needed.

You have the following tools available — use them proactively when the user requests:
- generate_image: Call this whenever the user wants to see, create, draw, or visualize anything.
- generate_video: Call this whenever the user wants to create, animate, or produce a video or motion clip.
- start_roleplay: Call this when the user wants you to play a character or act out a scenario.
- run_task: Call this to generate documents, code, plans, or summaries the user requests.
- search_docs: Call this when the user asks about their saved notes, documents, or knowledge base.

Prefer using tools over just talking about doing something. If the user asks for an image, call generate_image. If they want a video, call generate_video. If they want to search their knowledge, call search_docs. Always follow safety guidelines.`;
  }, [aiName]);

  const startRealtime = useCallback(async (): Promise<boolean> => {
    if (!RealtimeVoiceClient.isSupported()) return false;

    try {
      const client = new RealtimeVoiceClient({
        voice: getRealtimeVoice(),
        systemPrompt: getBaseSystemPrompt(),
      });

      const unsubscribe = client.on(handleRealtimeEvent);
      // Store unsubscribe so we can clean up
      (client as unknown as Record<string, unknown>)._unsubscribe = unsubscribe;

      await client.connect();
      realtimeClientRef.current = client;
      setUseRealtime(true);
      return true;
    } catch (err) {
      console.warn('Realtime connection failed, falling back to TTS pipeline:', err);
      return false;
    }
  }, [getBaseSystemPrompt, handleRealtimeEvent]);

  // Stop realtime voice session
  const stopRealtime = useCallback(() => {
    const client = realtimeClientRef.current;
    if (client) {
      const unsub = (client as unknown as Record<string, unknown>)._unsubscribe as (() => void) | undefined;
      if (unsub) unsub();
      client.disconnect();
      realtimeClientRef.current = null;
    }
    setUseRealtime(false);
  }, []);

  // Auto-scroll to bottom of transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.transcript, interimText, interimAssistantText]);

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

  // Interrupt AI speech — if user starts speaking while AI is still talking,
  // stop TTS playback immediately and resume listening (Part 7).
  const interruptSpeech = useCallback(() => {
    // Realtime mode: interrupt via the client
    if (realtimeClientRef.current && realtimeClientRef.current.state === 'speaking') {
      realtimeClientRef.current.interrupt();
      return;
    }
    // Fallback mode: cancel browser TTS
    if (synthRef.current.speaking) {
      synthRef.current.cancel();
      isProcessingRef.current = false;
      setCompanionState('listening');
      setStatusText('Listening…');
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
        setStatusText(`${aiName} is speaking…`);
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
    [isSpeakerOn, setCompanionState, aiName]
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

      // Build knowledge refs from localStorage for context
      const knowledgeRefsRaw = searchKnowledgeItems(text.trim());
      const knowledgeRefs = knowledgeRefsRaw.length > 0 ? knowledgeRefsRaw : undefined;

      try {
        const res = await fetch('/.netlify/functions/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'live_talk',
            data: {
              message: text.trim(),
              conversation_history: session.transcript.slice(-8),
              mode: 'neutral',
              ai_name: aiName,
              roleplay_context: roleplayRef.current || undefined,
              knowledge_refs: knowledgeRefs,
            },
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
          console.error('Live Talk API error:', res.status, errData);
          throw new Error(errData.error || `Chat request failed with status ${res.status}`);
        }

        const json = await res.json();
        // Unwrap ok() envelope: { success, data: { response, … } } or legacy raw shape
        const data = json.data ?? json;
        const responseText = data.response || '';

        // Handle action payloads (image generation, video generation, role-play, task)
        if (data.action) {
          if (
            (data.action.type === 'image_generated' || data.action.type === 'image') &&
            data.action.mediaUrl
          ) {
            triggerHaptic('light');
            const imageTurn: TalkTurn = {
              id: generateId(),
              role: 'assistant',
              text: '',
              timestamp: Date.now(),
              mediaUrl: data.action.mediaUrl,
              mediaType: 'image',
            };
            setSession((prev) => ({
              ...prev,
              transcript: [...prev.transcript, imageTurn],
            }));
          } else if (
            (data.action.type === 'video_generated' || data.action.type === 'video') &&
            data.action.mediaUrl
          ) {
            triggerHaptic('light');
            const videoTurn: TalkTurn = {
              id: generateId(),
              role: 'assistant',
              text: '',
              timestamp: Date.now(),
              mediaUrl: data.action.mediaUrl,
              mediaType: 'video',
            };
            setSession((prev) => ({
              ...prev,
              transcript: [...prev.transcript, videoTurn],
            }));
          } else if (
            data.action.type === 'roleplay_started' ||
            data.action.type === 'roleplay_continued'
          ) {
            const ctx: RoleplayContext = {
              character: data.action.character || 'a character',
              scenario: data.action.scenario || '',
            };
            roleplayRef.current = ctx;
            setRoleplayMode(ctx);
            triggerHaptic('medium');
          } else if (data.action.type === 'roleplay_ended') {
            // Backend detected the user wants to exit role-play
            roleplayRef.current = null;
            setRoleplayMode(null);
          }
        }

        // Add text response turn
        if (responseText) {
          triggerHaptic('light');
          const assistantTurn: TalkTurn = {
            id: generateId(),
            role: 'assistant',
            text: responseText,
            timestamp: Date.now(),
          };
          setSession((prev) => ({
            ...prev,
            transcript: [...prev.transcript, assistantTurn],
          }));

          speak(responseText);
        }

        isProcessingRef.current = false;
        reconnectAttemptsRef.current = 0;
        setCompanionState('idle');
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Something went wrong. Try again.';
        console.error('Live Talk error:', err);

        const errorTurn: TalkTurn = {
          id: generateId(),
          role: 'assistant',
          text: `⚠️ ${errorMessage}`,
          timestamp: Date.now(),
        };
        setSession((prev) => ({
          ...prev,
          transcript: [...prev.transcript, errorTurn],
        }));

        isProcessingRef.current = false;

        // Only reconnect on actual network / request failures, up to the limit.
        if (
          voiceEnabledRef.current &&
          isContinuousMode() &&
          reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
        ) {
          reconnectAttemptsRef.current += 1;
          setCompanionState('idle');
          setStatusText('Voice connection lost. Reconnecting…');
          reconnectTimerRef.current = setTimeout(() => {
            if (voiceEnabledRef.current) {
              setStatusText('Listening…');
              startListeningInternal();
            }
          }, 3000);
        } else {
          reconnectAttemptsRef.current = 0;
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
      triggerHaptic('light');
      setIsMicOn(true);
      setCompanionState('listening');
      setStatusText('Listening…');
    };

    rec.onresult = (e: SpeechRecognitionEvent) => {
      // Interrupt AI speech if user starts talking (Part 7 — Interruptible Voice)
      if (synthRef.current.speaking) {
        interruptSpeech();
      }

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
  }, [setCompanionState, processUserMessage, interruptSpeech]);

  const startListening = useCallback(() => {
    voiceEnabledRef.current = true;
    startListeningInternal();
  }, [startListeningInternal]);

  const handleMicToggle = async () => {
    triggerHaptic('medium');
    // isMicOn tracks the active SpeechRecognition instance; voiceEnabledRef tracks the
    // continuous-mode voice loop (which survives between individual recognition sessions).
    // We stop both when the user explicitly clicks the toggle.
    if (isMicOn || voiceEnabledRef.current || useRealtime) {
      voiceEnabledRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      // Disconnect realtime if active
      if (useRealtime) {
        stopRealtime();
      }
      stopListening();
    } else {
      // Try realtime first, fall back to standard speech recognition + TTS
      const realtimeStarted = await startRealtime();
      if (!realtimeStarted) {
        startListening();
      }
    }
  };

  const handleClearSession = () => {
    synthRef.current.cancel();
    voiceEnabledRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    stopRealtime();
    stopListening();
    roleplayRef.current = null;
    setRoleplayMode(null);
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
      // Disconnect realtime client on unmount
      if (realtimeClientRef.current) {
        realtimeClientRef.current.disconnect();
        realtimeClientRef.current = null;
      }
    };
  }, []);

  const isListening = companionState === 'listening';
  const isSpeaking = companionState === 'speaking';
  const isThinking = companionState === 'thinking';
  const isGeneratingImage = companionState === 'generating-image';
  const isGeneratingVideo = companionState === 'generating-video';
  const isActive = isListening || isSpeaking || isThinking || isGeneratingImage || isGeneratingVideo;
  const isSmallScreen = useIsMobile();

  return (
    <div className="relative flex flex-col h-full bg-background overflow-hidden safe-area-bottom">
      {/* Dynamic ambient background glow */}
      <BackgroundGlow state={companionState} />

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-4 md:px-6 pt-5 pb-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="gap-2 text-muted-foreground hover:text-foreground min-h-[44px]"
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
          size={isSmallScreen ? 'md' : 'lg'}
          showRipples={true}
        />

        {/* Waveform + state indicator labels */}
        <div className="h-12 flex items-center">
          <AnimatePresence mode="wait">
            {isListening && (
              <motion.div
                key="listen-wave"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-1"
              >
                <AudioVisualizer active={true} color="oklch(0.65 0.20 230)" colorEnd="oklch(0.55 0.18 260)" height={48} />
              </motion.div>
            )}
            {isSpeaking && (
              <motion.div
                key="speak-wave"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-1"
              >
                <AudioVisualizer active={true} color="oklch(0.65 0.22 145)" colorEnd="oklch(0.75 0.18 65)" height={48} />
              </motion.div>
            )}
            {isThinking && (
              <motion.div
                key="think-indicator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{ background: 'oklch(0.60 0.22 310)' }}
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                      transition={{ duration: 1.0, repeat: Infinity, delay: i * 0.22 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
            {isGeneratingImage && (
              <motion.div
                key="image-indicator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{ background: 'oklch(0.65 0.22 60)' }}
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.20 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
            {isGeneratingVideo && (
              <motion.div
                key="video-indicator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-2"
              >
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{ background: 'oklch(0.60 0.24 180)' }}
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.22 }}
                    />
                  ))}
                </div>
              </motion.div>
            )}
            {!isActive && (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <AudioVisualizer active={false} color="oklch(0.40 0.04 270)" height={48} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* State indicator badge */}
        <AnimatePresence mode="wait">
          {isActive && (
            <motion.div
              key={companionState}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium tracking-wide uppercase',
                isListening && 'bg-[oklch(0.65_0.20_230/0.15)] text-[oklch(0.65_0.20_230)]',
                isSpeaking && 'bg-[oklch(0.65_0.22_145/0.15)] text-[oklch(0.65_0.22_145)]',
                isThinking && 'bg-[oklch(0.60_0.22_310/0.15)] text-[oklch(0.60_0.22_310)]',
                isGeneratingImage && 'bg-[oklch(0.65_0.22_60/0.15)] text-[oklch(0.65_0.22_60)]',
                isGeneratingVideo && 'bg-[oklch(0.60_0.24_180/0.15)] text-[oklch(0.60_0.24_180)]',
              )}
            >
              {isListening && <><Microphone size={11} weight="fill" />Listening</>}
              {isSpeaking && <><SpeakerSimpleHigh size={11} weight="fill" />Speaking</>}
              {isThinking && <><Lightning size={11} weight="fill" />Thinking</>}
              {isGeneratingImage && <><ImageIcon size={11} weight="fill" />Generating image…</>}
              {isGeneratingVideo && <><VideoCamera size={11} weight="fill" />Generating video…</>}
            </motion.div>
          )}
        </AnimatePresence>

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

      {/* Role-play mode banner */}
      <AnimatePresence>
        {roleplayMode && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 mx-4 mb-2 flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20"
          >
            <div className="flex items-center gap-2 min-w-0">
              <MagicWand size={14} className="text-purple-400 shrink-0" />
              <span className="text-xs text-purple-400 font-medium truncate">
                Role-playing as <span className="font-semibold">{roleplayMode.character}</span>
              </span>
            </div>
            <button
              onClick={() => {
                roleplayRef.current = null;
                setRoleplayMode(null);
                // Restore the full base system prompt (including tool instructions) in the live session
                if (realtimeClientRef.current) {
                  realtimeClientRef.current.updateSession({
                    systemPrompt: getBaseSystemPrompt(),
                  });
                }
              }}
              className="shrink-0 text-purple-400/70 hover:text-purple-400 transition-colors"
              aria-label="Exit role-play"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

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
                  {/* Image turns */}
                  {turn.mediaUrl && turn.mediaType === 'image' ? (
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md overflow-hidden border border-border/40 bg-card shadow-sm">
                      <img
                        src={turn.mediaUrl}
                        alt="Generated image"
                        className="w-full object-contain max-h-72"
                        loading="lazy"
                      />
                    </div>
                  ) : turn.mediaUrl && turn.mediaType === 'video' ? (
                    /* Video turns */
                    <div className="max-w-[85%] rounded-2xl rounded-bl-md overflow-hidden border border-border/40 bg-card shadow-sm">
                      <video
                        src={turn.mediaUrl}
                        controls
                        className="w-full max-h-72"
                        preload="metadata"
                      />
                    </div>
                  ) : (
                    /* Text turns */
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
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Interim text (user speech in progress) */}
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

            {/* Streaming assistant text (realtime transcript delta) */}
            {interimAssistantText && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="max-w-[78%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-card border border-border text-foreground/60 text-sm leading-relaxed italic">
                  {interimAssistantText}
                </div>
              </motion.div>
            )}

            {session.transcript.length === 0 && !interimText && !interimAssistantText && (
              <div className="py-6 space-y-4">
                <p className="text-center text-muted-foreground text-sm opacity-60">
                  Your conversation will appear here
                </p>
                <div className="flex flex-wrap justify-center gap-2 px-2">
                  {CAPABILITY_HINTS.map((hint) => {
                    const icon =
                      hint.startsWith('Generate a video') ? (
                        <VideoCamera size={10} className="shrink-0" />
                      ) : hint.startsWith('Search my docs') ? (
                        <Books size={10} className="shrink-0" />
                      ) : hint.startsWith('Generate an image') ? (
                        <ImageIcon size={10} className="shrink-0" />
                      ) : (
                        <Lightning size={10} className="shrink-0" />
                      );
                    return (
                      <div
                        key={hint}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card/60 border border-border/60 text-[11px] text-muted-foreground opacity-70 select-none"
                      >
                        {icon}
                        {hint}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Mic button */}
      <div className="relative z-10 flex items-center justify-center pb-8 pt-4 safe-area-bottom">
        <motion.button
          onClick={handleMicToggle}
          className={cn(
            'relative flex items-center justify-center rounded-full transition-all duration-300',
            isSmallScreen ? 'w-[72px] h-[72px]' : 'w-20 h-20',
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
