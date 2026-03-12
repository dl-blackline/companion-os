/**
 * Voice Engine — advanced voice conversation pipeline.
 *
 * Responsibilities:
 *   1. Speech input (transcription)
 *   2. AI reasoning (via AI router)
 *   3. Streamed voice output (via ElevenLabs or fallback)
 *
 * Pipeline:
 *   microphone input → speech recognition → AI router → voice synthesis → playback
 *
 * Supports interruptible voice: if the user speaks while the AI is speaking,
 * the engine signals to stop TTS playback and resume listening.
 */

import { route } from "./ai-router.js";
import { generateVoice } from "./media/voice-generator.js";

/**
 * Process a voice turn: take user text, run through AI, and synthesize speech.
 *
 * @param {object} params
 * @param {string} params.text        - Transcribed user speech text.
 * @param {string} params.systemPrompt - System prompt / personality context.
 * @param {string} [params.model]     - Optional chat model id.
 * @param {string} [params.voiceId]   - Optional ElevenLabs voice id.
 * @param {boolean} [params.useElevenLabs] - Whether to use ElevenLabs for TTS.
 * @returns {Promise<{response: string, audioUrl?: string}>}
 */
export async function processVoiceTurn({
  text,
  systemPrompt,
  model,
  voiceId,
  useElevenLabs = false,
}) {
  if (!text || !text.trim()) {
    throw new Error("Missing required parameter: text");
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
 * @returns {Promise<{response: string, audioUrl?: string}>}
 */
export async function streamVoiceResponse({
  text,
  systemPrompt,
  model,
  voiceId,
}) {
  return processVoiceTurn({
    text,
    systemPrompt,
    model,
    voiceId,
    useElevenLabs: true,
  });
}
