import { generateEmbedding } from "../openai-client.js";
import { route } from "../ai-router.js";
import {
  searchEpisodicMemory,
  searchRelationshipMemory,
  searchMemorySummaries,
  getUserProfile,
} from "../memory-manager.js";
import { buildKnowledgeGraphContext } from "../knowledge-graph.js";
import { buildSystemPrompt } from "../system-prompt.js";
import { generateVoice } from "../media/voice-generator.js";
import {
  emitTranscription,
  emitAssistantResponse,
  emitVoiceOutput,
} from "./event-stream.js";

/**
 * Transcribe audio input using the OpenAI realtime model.
 * Accepts base64-encoded audio and returns transcription text.
 */
export async function transcribeAudio(audioBase64) {
  if (!audioBase64) {
    throw new Error("Missing required parameter: audioBase64");
  }

  if (!process.env.OPENAI_API_KEY) {
    console.error("[voice-stream] OPENAI_API_KEY is not set");
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const OpenAI = (await import("openai")).default;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const audioBuffer = Buffer.from(audioBase64, "base64");
  const file = await OpenAI.toFile(audioBuffer, "audio.webm", {
    type: "audio/webm",
  });

  const response = await openai.audio.transcriptions.create({
    model: process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1",
    file,
  });

  return response.text;
}

/**
 * Run the full voice streaming pipeline:
 *   transcription → memory retrieval → context assembly → AI router
 *   → critique → improved response → voice output
 *
 * Emits events at each stage to the session event stream.
 */
export async function processVoiceStream({
  session_id,
  user_id,
  audioBase64,
  voiceId,
}) {
  if (!session_id || !user_id || !audioBase64) {
    throw new Error(
      "Missing required parameters: session_id, user_id, audioBase64"
    );
  }

  // 1. Transcription
  const transcription = await transcribeAudio(audioBase64);

  await emitTranscription({
    session_id,
    text: transcription,
    is_final: true,
  });

  // 2. Memory retrieval (parallel)
  const embedding = await generateEmbedding(transcription);

  const [
    episodicMemories,
    relationshipMemories,
    memorySummaries,
    userProfile,
    knowledgeGraphContext,
  ] = await Promise.all([
    searchEpisodicMemory(embedding, user_id),
    searchRelationshipMemory(embedding, user_id),
    searchMemorySummaries(embedding, user_id),
    getUserProfile(user_id),
    buildKnowledgeGraphContext(user_id),
  ]);

  // 3. Context assembly
  const systemPrompt = buildSystemPrompt({
    userProfile,
    relationshipMemories,
    episodicMemories,
    memorySummaries,
    knowledgeGraphContext,
    recentConversation: [],
    semanticMemories: [],
  });

  // 4. AI router → draft response
  const draftResponse = await route({
    task: "voice",
    prompt: { system: systemPrompt, user: transcription },
  });

  // 5. Critique agent
  const critiquePrompt = {
    system: `You are a critique agent. Review the draft response for a voice assistant.
Evaluate clarity, helpfulness, and conversational tone.
If the draft is good, return it unchanged.
If it needs improvement, return an improved version.
Respond with the final response text only. No explanation.`,
    user: `User said: "${transcription}"\n\nDraft response: "${draftResponse}"`,
  };

  const improvedResponse = await route({
    task: "chat",
    prompt: critiquePrompt,
  });

  await emitAssistantResponse({
    session_id,
    text: improvedResponse,
    is_final: true,
  });

  // 6. Voice output via ElevenLabs
  const voiceResult = await generateVoice(improvedResponse, voiceId);

  await emitVoiceOutput({
    session_id,
    audio_url: voiceResult.url,
  });

  return {
    transcription,
    response: improvedResponse,
    audio_url: voiceResult.url,
  };
}
