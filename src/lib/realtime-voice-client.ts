/**
 * Realtime Voice Client — WebRTC-based connection to OpenAI Realtime API.
 *
 * Replaces the speech-to-text → AI → TTS pipeline with true bidirectional
 * streaming audio using WebRTC and the gpt-realtime model.
 *
 * Flow:
 *   1. Request an ephemeral key from the server
 *   2. Create a WebRTC peer connection
 *   3. Attach microphone audio track
 *   4. Establish connection via SDP offer/answer with the realtime provider
 *   5. Receive AI audio stream and play it through an <audio> element
 *   6. Listen to data channel events for state transitions & transcripts
 */

import { requestRealtimeToken } from '@/services/ai-orchestrator';

export type RealtimeVoiceState = 'disconnected' | 'connecting' | 'listening' | 'thinking' | 'speaking';

export type RealtimeVoice = 'alloy' | 'echo' | 'shimmer' | 'marin' | 'cedar';

export const REALTIME_VOICES: { id: RealtimeVoice; label: string }[] = [
  { id: 'marin', label: 'Marin' },
  { id: 'cedar', label: 'Cedar' },
  { id: 'alloy', label: 'Alloy' },
  { id: 'echo', label: 'Echo' },
  { id: 'shimmer', label: 'Shimmer' },
];

export interface RealtimeToolCall {
  callId: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface RealtimeVoiceEvent {
  type: 'state_change' | 'transcript' | 'error' | 'interrupted' | 'tool_call';
  state?: RealtimeVoiceState;
  role?: 'user' | 'assistant';
  text?: string;
  /** When true the transcript is still streaming — update the in-progress
   *  bubble rather than adding a new turn to the conversation. */
  partial?: boolean;
  error?: string;
  toolCall?: RealtimeToolCall;
}

type EventCallback = (event: RealtimeVoiceEvent) => void;

interface RealtimeVoiceClientOptions {
  voice?: RealtimeVoice;
  systemPrompt?: string;
  model?: string;
}

const REALTIME_MODEL = 'gpt-4o-realtime-preview';

/**
 * Function tools available during live talk sessions.
 * The model calls these to generate images/videos, start role-play, automate tasks, or search docs.
 */
const LIVE_TALK_TOOLS = [
  {
    type: 'function',
    name: 'generate_image',
    description:
      'Generate an image when the user asks to create, draw, visualize, or see something. Call this whenever the user requests any kind of image, picture, or visual.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed description of the image to generate',
        },
        style: {
          type: 'string',
          description: 'Optional visual style',
          enum: ['photorealistic', 'artistic', 'cinematic', 'cartoon', 'abstract'],
        },
      },
      required: ['prompt'],
    },
  },
  {
    type: 'function',
    name: 'generate_video',
    description:
      'Generate a short video when the user asks to create, animate, or produce a video or motion clip. Call this whenever the user requests any kind of video, animation, or moving visual.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Detailed description of the video to generate',
        },
        style: {
          type: 'string',
          description: 'Optional visual style',
          enum: ['cinematic', 'documentary', 'animated', 'timelapse', 'abstract'],
        },
      },
      required: ['prompt'],
    },
  },
  {
    type: 'function',
    name: 'start_roleplay',
    description:
      'Start a role-play scenario when the user asks the AI to play a character, persona, or act out a scenario.',
    parameters: {
      type: 'object',
      properties: {
        character: {
          type: 'string',
          description: 'The character or persona to play (e.g. "a pirate captain", "Sherlock Holmes")',
        },
        scenario: {
          type: 'string',
          description: 'The scenario or context for the role-play',
        },
      },
      required: ['character', 'scenario'],
    },
  },
  {
    type: 'function',
    name: 'run_task',
    description:
      'Execute an automated task when the user asks to create a document, write code, build a plan, summarize something, or automate a multi-step process.',
    parameters: {
      type: 'object',
      properties: {
        taskType: {
          type: 'string',
          description: 'The type of task to run',
          enum: ['document', 'plan', 'code', 'summary', 'other'],
        },
        description: {
          type: 'string',
          description: 'Complete description of what needs to be done',
        },
      },
      required: ['taskType', 'description'],
    },
  },
  {
    type: 'function',
    name: 'search_docs',
    description:
      'Search the user\'s personal knowledge base and documents when they ask about their saved notes, documents, links, code snippets, or any stored information.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Keywords or phrase to search for in the knowledge base',
        },
      },
      required: ['query'],
    },
  },
];

export class RealtimeVoiceClient {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private localStream: MediaStream | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private listeners: EventCallback[] = [];
  private _state: RealtimeVoiceState = 'disconnected';
  private voice: RealtimeVoice;
  private systemPrompt: string;
  private model: string;
  private isInterrupted = false;
  /** Accumulates assistant transcript deltas so we can emit partial updates. */
  private currentAssistantTranscript = '';

  constructor(options: RealtimeVoiceClientOptions = {}) {
    this.voice = options.voice || 'alloy';
    this.systemPrompt = options.systemPrompt || '';
    this.model = options.model || REALTIME_MODEL;
  }

  get state(): RealtimeVoiceState {
    return this._state;
  }

  /** Subscribe to realtime voice events. */
  on(cb: EventCallback): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  /** Connect to the Realtime API via WebRTC. */
  async connect(): Promise<void> {
    if (this._state !== 'disconnected') return;
    this.setState('connecting');

    try {
      // 1. Get ephemeral key and realtime endpoint from our server
      const { key: ephemeralKey, endpoint: realtimeEndpoint } = await this.fetchEphemeralKey();

      // 2. Create peer connection
      this.pc = new RTCPeerConnection();

      // 3. Set up remote audio playback
      this.audioElement = document.createElement('audio');
      this.audioElement.autoplay = true;

      this.pc.ontrack = (event) => {
        if (this.audioElement && event.streams[0]) {
          this.audioElement.srcObject = event.streams[0];
        }
      };

      // 4. Get microphone stream and add track
      // Use explicit audio constraints to enable hardware/browser-level noise
      // suppression, echo cancellation and auto-gain control, and capture mono
      // audio at the sample rate that the Realtime API expects.
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000,
        },
      });
      this.localStream.getTracks().forEach((track) => {
        this.pc!.addTrack(track, this.localStream!);
      });

      // 5. Create data channel for events
      this.dc = this.pc.createDataChannel('oai-events');
      this.setupDataChannel();

      // 6. Create SDP offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // 7. Send SDP to the Realtime endpoint (OpenAI or NoFilter)
      const sdpResponse = await fetch(
        `${realtimeEndpoint}?model=${encodeURIComponent(this.model)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ephemeralKey}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      );

      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text().catch(() => 'Unknown error');
        throw new Error(`Realtime SDP exchange failed: ${sdpResponse.status} ${errorText}`);
      }

      const answerSdp = await sdpResponse.text();
      await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      this.setState('listening');
    } catch (err) {
      this.emit({
        type: 'error',
        error: err instanceof Error ? err.message : 'Failed to connect to realtime voice',
      });
      this.disconnect();
      throw err;
    }
  }

  /** Disconnect and clean up all resources. */
  disconnect(): void {
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }

    if (this.audioElement) {
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    this.isInterrupted = false;
    this.setState('disconnected');
  }

  /** Interrupt the current AI response. Stops playback and resumes listening. */
  interrupt(): void {
    if (this._state !== 'speaking' || !this.dc || this.dc.readyState !== 'open') return;

    this.isInterrupted = true;
    this.currentAssistantTranscript = '';

    // Send cancel event via data channel
    this.dc.send(JSON.stringify({ type: 'response.cancel' }));

    // Clear the audio output
    if (this.audioElement) {
      this.audioElement.srcObject = null;
      // Re-attach if the PC track is still present
      if (this.pc) {
        const receivers = this.pc.getReceivers();
        const audioReceiver = receivers.find((r) => r.track?.kind === 'audio');
        if (audioReceiver?.track) {
          const stream = new MediaStream([audioReceiver.track]);
          this.audioElement.srcObject = stream;
        }
      }
    }

    this.setState('listening');
    this.emit({ type: 'interrupted' });
  }

  /** Update the session configuration (voice, system prompt, etc). */
  updateSession(options: { voice?: RealtimeVoice; systemPrompt?: string }): void {
    if (options.voice) this.voice = options.voice;
    if (options.systemPrompt !== undefined) this.systemPrompt = options.systemPrompt;

    if (this.dc && this.dc.readyState === 'open') {
      this.sendSessionUpdate();
    }
  }

  /** Check if the browser supports WebRTC and getUserMedia. */
  static isSupported(): boolean {
    return !!(
      typeof RTCPeerConnection !== 'undefined' &&
      navigator.mediaDevices?.getUserMedia
    );
  }

  /** Enable or disable the microphone track without disconnecting. */
  setMicEnabled(enabled: boolean): void {
    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) {
        track.enabled = enabled;
      }
    }
  }

  /**
   * Submit the result of a tool/function call back to the model so it can
   * continue the conversation with the tool output.
   */
  submitToolResult(callId: string, result: string): void {
    if (!this.dc || this.dc.readyState !== 'open') return;

    // Send the function call output as a conversation item
    this.dc.send(
      JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: result,
        },
      })
    );

    // Trigger the model to produce a follow-up response
    this.dc.send(JSON.stringify({ type: 'response.create' }));
  }

  // ── Private ──

  private async fetchEphemeralKey(): Promise<{ key: string; endpoint: string }> {
    return requestRealtimeToken(this.model, this.voice);
  }

  private setupDataChannel(): void {
    if (!this.dc) return;

    this.dc.onopen = () => {
      // Configure the session once the data channel is ready.
      // Server-side VAD is tuned with a higher threshold so that background
      // noise does not falsely trigger speech detection, and a longer silence
      // duration so the AI waits for the user to actually finish speaking.
      this.sendSessionUpdate();
    };

    this.dc.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleServerEvent(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    this.dc.onerror = () => {
      this.emit({ type: 'error', error: 'Data channel error' });
    };

    this.dc.onclose = () => {
      if (this._state !== 'disconnected') {
        this.disconnect();
      }
    };
  }

  private handleServerEvent(msg: Record<string, unknown>): void {
    const eventType = msg.type as string;

    switch (eventType) {
      case 'input_audio_buffer.speech_started':
        // User started speaking — interrupt AI if it's currently speaking
        if (this._state === 'speaking') {
          this.interrupt();
        }
        this.setState('listening');
        break;

      case 'input_audio_buffer.speech_stopped':
        // User finished speaking, AI will start processing
        this.setState('thinking');
        break;

      case 'response.audio.delta':
        // AI audio is being streamed
        if (this._state !== 'speaking') {
          this.isInterrupted = false;
          this.currentAssistantTranscript = '';
          this.setState('speaking');
        }
        break;

      case 'response.audio.done':
        // AI finished speaking
        if (!this.isInterrupted) {
          this.setState('listening');
        }
        break;

      case 'response.done':
        // Full response complete
        if (this._state === 'speaking' || this._state === 'thinking') {
          this.setState('listening');
        }
        break;

      case 'conversation.item.input_audio_transcription.completed': {
        // User speech transcription available
        const transcript = (msg as Record<string, unknown>).transcript as string;
        if (transcript) {
          this.emit({ type: 'transcript', role: 'user', text: transcript });
        }
        break;
      }

      case 'response.audio_transcript.delta': {
        // Partial assistant transcript — stream text as it arrives
        const delta = (msg as Record<string, unknown>).delta as string;
        if (delta) {
          this.currentAssistantTranscript += delta;
          this.emit({
            type: 'transcript',
            role: 'assistant',
            text: this.currentAssistantTranscript,
            partial: true,
          });
        }
        break;
      }

      case 'response.audio_transcript.done': {
        // AI response transcription available
        const transcript = (msg as Record<string, unknown>).transcript as string;
        if (transcript) {
          this.currentAssistantTranscript = '';
          this.emit({ type: 'transcript', role: 'assistant', text: transcript });
        }
        break;
      }

      case 'error': {
        const errorMsg = (msg as Record<string, unknown>).error as Record<string, unknown> | undefined;
        this.emit({
          type: 'error',
          error: (errorMsg?.message as string) || 'Realtime API error',
        });
        break;
      }

      case 'response.function_call_arguments.done': {
        // The model wants to call one of our tools
        const callId = msg.call_id as string;
        const name = msg.name as string;
        const argsStr = msg.arguments as string;
        try {
          const args = JSON.parse(argsStr || '{}') as Record<string, unknown>;
          this.emit({ type: 'tool_call', toolCall: { callId, name, arguments: args } });
        } catch (parseErr) {
          console.warn('Failed to parse tool call arguments', { callId, name, argsStr, parseErr });
          // Send a fallback result so the model doesn't stall waiting for output
          this.submitToolResult(callId, 'Tool call failed due to invalid arguments.');
        }
        break;
      }
    }
  }

  private setState(state: RealtimeVoiceState): void {
    if (this._state === state) return;
    this._state = state;
    this.emit({ type: 'state_change', state });
  }

  /**
   * Send a session.update event with the current voice, system prompt, and
   * VAD configuration.  Centralised here so both the initial onopen handler
   * and updateSession() stay in sync.
   */
  private sendSessionUpdate(): void {
    if (!this.dc || this.dc.readyState !== 'open') return;
    this.dc.send(
      JSON.stringify({
        type: 'session.update',
        session: {
          voice: this.voice,
          instructions: this.systemPrompt || undefined,
          input_audio_transcription: { model: 'whisper-1' },
          // Server-side VAD: a higher threshold ensures background noise and
          // ambient sounds do not falsely trigger speech detection.  The
          // shorter silence window keeps responses snappy — the higher
          // threshold already filters out noise so we don't need as much
          // padding before ending the turn.
          turn_detection: {
            type: 'server_vad',
            threshold: 0.85,
            prefix_padding_ms: 300,
            silence_duration_ms: 600,
          },
          // Function tools the model can call during the conversation
          tools: LIVE_TALK_TOOLS,
          tool_choice: 'auto',
        },
      })
    );
  }

  private emit(event: RealtimeVoiceEvent): void {
    for (const cb of this.listeners) {
      try {
        cb(event);
      } catch {
        // Don't let listener errors break the client
      }
    }
  }
}
