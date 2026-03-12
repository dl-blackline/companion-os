/**
 * Realtime Voice Client — WebRTC-based connection to OpenAI Realtime API.
 *
 * Replaces the speech-to-text → AI → TTS pipeline with true bidirectional
 * streaming audio using WebRTC and the gpt-4o-realtime-preview model.
 *
 * Flow:
 *   1. Request an ephemeral key from the server
 *   2. Create a WebRTC peer connection
 *   3. Attach microphone audio track
 *   4. Establish connection via SDP offer/answer with OpenAI
 *   5. Receive AI audio stream and play it through an <audio> element
 *   6. Listen to data channel events for state transitions & transcripts
 */

export type RealtimeVoiceState = 'disconnected' | 'connecting' | 'listening' | 'thinking' | 'speaking';

export type RealtimeVoice = 'alloy' | 'aria' | 'nova' | 'verse';

export const REALTIME_VOICES: { id: RealtimeVoice; label: string }[] = [
  { id: 'alloy', label: 'Alloy' },
  { id: 'aria', label: 'Aria' },
  { id: 'nova', label: 'Nova' },
  { id: 'verse', label: 'Verse' },
];

export interface RealtimeVoiceEvent {
  type: 'state_change' | 'transcript' | 'error' | 'interrupted';
  state?: RealtimeVoiceState;
  role?: 'user' | 'assistant';
  text?: string;
  error?: string;
}

type EventCallback = (event: RealtimeVoiceEvent) => void;

interface RealtimeVoiceClientOptions {
  voice?: RealtimeVoice;
  systemPrompt?: string;
  model?: string;
}

const REALTIME_MODEL = 'gpt-4o-realtime-preview';

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

  /** Connect to the OpenAI Realtime API via WebRTC. */
  async connect(): Promise<void> {
    if (this._state !== 'disconnected') return;
    this.setState('connecting');

    try {
      // 1. Get ephemeral key from our server
      const ephemeralKey = await this.fetchEphemeralKey();

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
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.localStream.getTracks().forEach((track) => {
        this.pc!.addTrack(track, this.localStream!);
      });

      // 5. Create data channel for events
      this.dc = this.pc.createDataChannel('oai-events');
      this.setupDataChannel();

      // 6. Create SDP offer
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // 7. Send SDP to OpenAI Realtime endpoint
      const sdpResponse = await fetch(
        `https://api.openai.com/v1/realtime?model=${encodeURIComponent(this.model)}`,
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
      this.dc.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            voice: this.voice,
            instructions: this.systemPrompt || undefined,
            input_audio_transcription: { model: 'whisper-1' },
          },
        })
      );
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

  // ── Private ──

  private async fetchEphemeralKey(): Promise<string> {
    const res = await fetch('/.netlify/functions/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'realtime_token',
        data: {
          model: this.model,
          voice: this.voice,
        },
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errData.error || `Failed to get ephemeral key: ${res.status}`);
    }

    const data = await res.json();
    return data.client_secret;
  }

  private setupDataChannel(): void {
    if (!this.dc) return;

    this.dc.onopen = () => {
      // Configure the session once the data channel is ready
      this.dc!.send(
        JSON.stringify({
          type: 'session.update',
          session: {
            voice: this.voice,
            instructions: this.systemPrompt || undefined,
            input_audio_transcription: { model: 'whisper-1' },
          },
        })
      );
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

      case 'response.audio_transcript.done': {
        // AI response transcription available
        const transcript = (msg as Record<string, unknown>).transcript as string;
        if (transcript) {
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
    }
  }

  private setState(state: RealtimeVoiceState): void {
    if (this._state === state) return;
    this._state = state;
    this.emit({ type: 'state_change', state });
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
