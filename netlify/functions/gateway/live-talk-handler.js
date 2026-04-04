/**
 * gateway/live-talk-handler.js — Live talk / voice conversation handler.
 *
 * Covers request type: live_talk
 *
 * Handles intent detection → image generation | role-play | task automation | chat.
 */

import { orchestrateSimple } from "../../../services/ai/orchestrator.js";
import {
  liveTalkSystem,
  liveTalkIntentClassification,
  liveTalkRoleplay,
  liveTalkTask,
  liveTalkMediaAck,
} from "../../../lib/prompt-templates.js";
import { runMediaTask } from "../../../lib/media-engine.js";
import { ok, fail } from "../../../lib/_responses.js";
import { log } from "../../../lib/_log.js";

/** Pattern that detects a user asking to stop/exit the current role-play. */
const ROLEPLAY_EXIT_RE =
  /\b(stop|end|exit|quit|cancel)\b.*\b(role.?play|character|scenario)\b/i;

/**
 * Detect the live talk intent using a fast, focused AI call.
 */
async function detectLiveTalkIntent(message, historyContext) {
  try {
    const prompt = liveTalkIntentClassification({ message, historyContext });
    const rawText = await orchestrateSimple({
      prompt,
      model: "gpt-4.1-mini",
      task: "live_talk_intent",
    });
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    log.warn(
      "[ai]",
      "live talk intent detection failed, defaulting to chat:",
      err.message,
    );
    return { type: "chat" };
  }
}

/**
 * Handle enterprise-grade live talk requests.
 */
export async function handleLiveTalk(data) {
  const {
    message,
    conversation_history = [],
    mode = "neutral",
    ai_name = "Vuk",
    roleplay_context,
    intent_override,
    task_type,
    knowledge_refs,
  } = data;

  if (!message) {
    return fail("Missing required field: message", "ERR_VALIDATION", 400);
  }

  const historyContext = conversation_history
    .slice(-6)
    .map((t) => `${t.role === "user" ? "User" : ai_name}: ${t.text}`)
    .join("\n");

  const knowledgeContext =
    knowledge_refs && knowledge_refs.length > 0
      ? `\n\nRelevant knowledge from user's personal knowledge base:\n${knowledge_refs
          .map((ref) => `[${ref.type?.toUpperCase() ?? "NOTE"}] ${ref.title}: ${ref.content}`)
          .join("\n\n")}`
      : "";

  // Fast-path: realtime tool handler already resolved intent
  if (intent_override === "run_task") {
    const resolvedTaskType = task_type || "other";
    const prompt = liveTalkTask({
      aiName: ai_name,
      taskType: resolvedTaskType,
      taskDescription: message,
    });
    const taskResponse = await orchestrateSimple({ prompt, task: "live_talk_task" });
    return ok({
      response: taskResponse,
      action: { type: "task_completed", taskType: resolvedTaskType, description: message },
    });
  }

  // Active role-play continuation (unless user asks to stop)
  if (roleplay_context && !ROLEPLAY_EXIT_RE.test(message)) {
    const prompt = liveTalkRoleplay({
      character: roleplay_context.character,
      scenario: roleplay_context.scenario,
      historyContext,
      message,
    });
    const roleplayResponse = await orchestrateSimple({ prompt, task: "live_talk_roleplay" });
    return ok({
      response: roleplayResponse,
      action: {
        type: "roleplay_continued",
        character: roleplay_context.character,
        scenario: roleplay_context.scenario,
      },
    });
  }

  // Exit active role-play
  if (roleplay_context && ROLEPLAY_EXIT_RE.test(message)) {
    const systemPrompt = liveTalkSystem({ aiName: ai_name, mode });
    const exitResponse = await orchestrateSimple({
      prompt: {
        system: systemPrompt,
        user: `The user just ended a role-play as "${roleplay_context.character}". Acknowledge it briefly and warmly in one sentence.`,
      },
      task: "live_talk_exit",
    });
    return ok({ response: exitResponse, action: { type: "roleplay_ended" } });
  }

  // Detect intent
  const intent = await detectLiveTalkIntent(message, historyContext);

  switch (intent.type) {
    case "generate_image":
      return handleLiveTalkMedia("image", intent.imagePrompt || message, ai_name, mode, historyContext, message);

    case "generate_video":
      return handleLiveTalkMedia("video", intent.videoPrompt || message, ai_name, mode, historyContext, message);

    case "roleplay": {
      const character = intent.character || "a mysterious character";
      const scenario = intent.scenario || "an intriguing conversation with the user";
      const prompt = liveTalkRoleplay({ character, scenario, historyContext: "", message });
      const roleplayResponse = await orchestrateSimple({ prompt, task: "live_talk_roleplay" });
      return ok({
        response: roleplayResponse,
        action: { type: "roleplay_started", character, scenario },
      });
    }

    case "run_task": {
      const taskDesc = intent.taskDescription || message;
      const prompt = liveTalkTask({
        aiName: ai_name,
        taskType: intent.taskType || "other",
        taskDescription: taskDesc,
      });
      const taskResponse = await orchestrateSimple({ prompt, task: "live_talk_task" });
      return ok({
        response: taskResponse,
        action: { type: "task_completed", taskType: intent.taskType || "other", description: taskDesc },
      });
    }

    default: {
      const systemPrompt =
        liveTalkSystem({ aiName: ai_name, mode }) +
        (knowledgeContext
          ? `\n\nWhen relevant, reference the user's personal knowledge base below to give more personalized answers.${knowledgeContext}`
          : "");
      const chatResponse = await orchestrateSimple({
        prompt: { system: systemPrompt, user: `${historyContext}\n\nUser: ${message}` },
        task: "live_talk_chat",
      });
      return ok({ response: chatResponse });
    }
  }
}

/* ── Shared: live talk media generation with fallback ─────────────────────── */

async function handleLiveTalkMedia(mediaType, mediaPrompt, ai_name, mode, historyContext, message) {
  try {
    const mediaResult = await runMediaTask({ type: mediaType, prompt: mediaPrompt });
    const ackPrompt = liveTalkMediaAck({ aiName: ai_name, mediaType, prompt: mediaPrompt });
    const voiceReply = await orchestrateSimple({
      prompt: ackPrompt,
      model: "gpt-4.1-mini",
      task: "live_talk_ack",
    });
    return ok({
      response: voiceReply,
      action: {
        type: `${mediaType}_generated`,
        mediaUrl: mediaResult.url || null,
        mediaType,
        prompt: mediaPrompt,
      },
    });
  } catch (err) {
    log.error("[ai]", `live talk ${mediaType} generation error:`, err.message);
    const systemPrompt = liveTalkSystem({ aiName: ai_name, mode });
    const fallback = await orchestrateSimple({
      prompt: { system: systemPrompt, user: `${historyContext}\n\nUser: ${message}` },
      task: "live_talk_fallback",
    });
    return ok({ response: fallback });
  }
}
