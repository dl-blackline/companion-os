/**
 * Voice Engine — advanced voice conversation pipeline.
 *
 * Responsibilities:
 *   1. Speech input (transcription)
 *   2. AI reasoning (via AI router)
 *   3. Streamed voice output (via ElevenLabs or OpenAI realtime)
 *
 * Pipeline:
 *   microphone input → speech recognition → AI reasoning → voice synthesis → playback
 *
 * Supports:
 *   - Interruptible voice: if the user speaks while the AI is speaking,
 *     the engine signals to stop TTS playback and resume listening.
 *   - OpenAI realtime voice mode (gpt-realtime) for low-latency
 *     speech-to-speech with interruption support.
 */

import { route } from "./ai-router.js";
import { generateVoice } from "./media/voice-generator.js";
import { MODEL_CONFIG } from "./model-config.js";
import {
  createRealtimeSession as nofilterCreateRealtimeSession,
  isNofilterModel,
} from "./nofilter-client.js";

/**
 * Process a voice turn: take user text, run through AI, and synthesize speech.
 *
 * @param {object} params
 * @param {string} params.text        - Transcribed user speech text.
 * @param {string} params.systemPrompt - System prompt / personality context.
 * @param {string} [params.model]     - Optional chat model id.
 * @param {string} [params.voiceId]   - Optional ElevenLabs voice id.
 * @param {boolean} [params.useElevenLabs] - Whether to use ElevenLabs for TTS.
 * @param {boolean} [params.useRealtime]   - Whether to use OpenAI realtime voice mode.
 * @returns {Promise<{response: string, audioUrl?: string}>}
 */
export async function processVoiceTurn({
  text,
  systemPrompt,
  model,
  voiceId,
  useElevenLabs = false,
  useRealtime = false,
}) {
  if (!text || !text.trim()) {
    throw new Error("Missing required parameter: text");
  }

  // OpenAI realtime voice mode — speech-to-speech with low latency
  if (useRealtime && process.env.OPENAI_API_KEY) {
    try {
      return await processRealtimeVoice({ text, systemPrompt });
    } catch (err) {
      console.warn("OpenAI realtime voice failed, falling back to standard pipeline:", err.message);
    }
  }

  // 1. AI reasoning — route through the AI router
  const response = await route({
    task: "voice",
    prompt: {
      system: systemPrompt || "",
      user: text.trim(),
    },
    model,
  });

  // 2. Voice synthesis (optional — only when ElevenLabs is requested)
  let audioUrl;

  if (useElevenLabs && process.env.ELEVENLABS_API_KEY) {
    try {
      const voiceResult = await generateVoice(response, voiceId);
      audioUrl = voiceResult.url;
    } catch (err) {
      console.warn("ElevenLabs TTS failed, falling back to browser TTS:", err.message);
    }
  }

  return {
    response,
    audioUrl,
  };
}

/**
 * Process voice input using the AI chat model with audio output.
 *
 * This provides a low-latency speech-to-speech pipeline that supports
 * interruptions during AI speech.
 *
 * @param {object} params
 * @param {string} params.text         - User speech text.
 * @param {string} [params.systemPrompt] - System context.
 * @returns {Promise<{response: string, audioUrl?: string, model: string}>}
 */
async function processRealtimeVoice({ text, systemPrompt, voice }) {
  const OpenAI = (await import("openai")).default;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Use the chat model for server-side voice processing (gpt-realtime is for
  // WebRTC-based client connections only and cannot be used via chat completions)
  const audioModel = MODEL_CONFIG.chat;
  const audioVoice = voice || "alloy";

  try {
    const response = await client.chat.completions.create({
      model: audioModel,
      messages: [
        ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
        { role: "user", content: text.trim() },
      ],
      modalities: ["text", "audio"],
      audio: { voice: audioVoice, format: "wav" },
    });

    const message = response.choices?.[0]?.message;
    const textResponse = message?.audio?.transcript || message?.content || "";
    const audioData = message?.audio?.data;

    // Convert base64 audio to a data URL for playback
    const audioUrl = audioData
      ? `data:audio/wav;base64,${audioData}`
      : undefined;

    return {
      response: textResponse,
      audioUrl,
      model: audioModel,
    };
  } catch (audioErr) {
    // If the model doesn't support audio modalities, fall back to text-only
    console.warn("Audio modalities not supported, falling back to text-only:", audioErr.message);
    const textResponse = await route({
      task: "voice",
      prompt: {
        system: systemPrompt || "",
        user: text.trim(),
      },
    });
    return {
      response: textResponse,
      model: audioModel,
    };
  }
}

/**
 * Create an ephemeral API key for the OpenAI Realtime API.
 *
 * The frontend uses this key to establish a direct WebRTC connection
 * to OpenAI for low-latency streaming audio.
 *
 * @param {object} params
 * @param {string} [params.model]  - Realtime model (default: MODEL_CONFIG.voice).
 * @param {string} [params.voice]  - Realtime voice (e.g. marin, cedar, alloy, echo, shimmer).
 * @returns {Promise<{client_secret: string, realtime_endpoint: string}>}
 */
export async function createRealtimeSession({ model, voice } = {}) {
  // Route to the NoFilter GPT realtime endpoint when that provider is requested
  // and its API key is configured.
  const nofilterApiKey = process.env.NOFILTER_GPT_API_KEY || process.env.NOFILTER_GPT_API;
  if (isNofilterModel(model) && nofilterApiKey) {
    const result = await nofilterCreateRealtimeSession({ model, voice });
    const nofilterBaseURL =
      process.env.NOFILTER_GPT_BASE_URL || "https://api.nofilter.ai/v1";
    return {
      client_secret: result.client_secret,
      realtime_endpoint: `${nofilterBaseURL}/realtime`,
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("[voice-engine] OPENAI_API_KEY is not set — cannot create realtime session");
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || MODEL_CONFIG.voice,
      voice: voice || "alloy",
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    console.error(`[voice-engine] OpenAI realtime session failed (${res.status}):`, errText);
    throw new Error(`Realtime session creation failed: ${res.status} ${errText}`);
  }

  const data = await res.json();
  return {
    client_secret: data.client_secret?.value,
    realtime_endpoint: "https://api.openai.com/v1/realtime",
  };
}

/**
 * Generate speech audio from text using ElevenLabs.
 *
 * @param {string} text     - Text to synthesize.
 * @param {string} [voiceId] - ElevenLabs voice id (e.g. "Rachel").
 * @returns {Promise<{url: string}>}
 */
export async function synthesizeSpeech(text, voiceId) {
  if (!text) {
    throw new Error("Missing required parameter: text");
  }

  return generateVoice(text, voiceId);
}

/**
 * Stream a voice response — processes text through AI and returns
 * both the text response and audio data for streaming playback.
 *
 * @param {object} params
 * @param {string} params.text         - User speech text.
 * @param {string} params.systemPrompt - System context.
 * @param {string} [params.model]      - Chat model id.
 * @param {string} [params.voiceId]    - ElevenLabs voice id.
 * @param {boolean} [params.useRealtime] - Use OpenAI realtime voice mode.
 * @returns {Promise<{response: string, audioUrl?: string}>}
 */
export async function streamVoiceResponse({
  text,
  systemPrompt,
  model,
  voiceId,
  useRealtime = false,
}) {
  return processVoiceTurn({
    text,
    systemPrompt,
    model,
    voiceId,
    useElevenLabs: !useRealtime,
    useRealtime,
  });
}
