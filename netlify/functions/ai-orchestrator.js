/**
 * Unified AI Orchestrator
 *
 * Single entry point for ALL AI operations.  Every request type the platform
 * supports is routed through this function so there is exactly one execution
 * path to reason about, monitor, and secure.
 *
 * Supported types:
 *   chat · memory · media · image · video · workflow · agent · realtime
 *   voice · realtime_token · multimodal · live_talk · stream · knowledge
 *   refine_media
 */

import { supabase } from "../../lib/_supabase.js";
import { orchestrate, orchestrateSimple, orchestrateEmbed } from "../../services/ai/orchestrator.js";
import {
  liveTalkSystem,
  liveTalkIntentClassification,
  liveTalkRoleplay,
  liveTalkTask,
  liveTalkMediaAck,
} from "../../lib/prompt-templates.js";
import {
  createSession,
  endSession,
  getSession,
} from "../../lib/realtime/session-manager.js";
import {
  createProject,
  addWorkflowStep,
  runWorkflow,
} from "../../lib/workflow-engine.js";
import { runMediaTask, generateMedia } from "../../lib/media-engine.js";
import { optimizePrompt } from "../../lib/media/prompt-optimizer.js";
import { processVoiceTurn, createRealtimeSession } from "../../lib/voice-engine.js";
import { analyzeImage, describeVideo } from "../../lib/vision-analyzer.js";
import { runTask } from "../../lib/multimodal-engine.js";
import { getRelevantMediaContext } from "../../lib/media-memory-service.js";
import { isNofilterModel } from "../../lib/nofilter-client.js";
import { ok, fail, preflight, raw, CORS_HEADERS } from "../../lib/_responses.js";
import { validatePayloadSize, sanitizeDeep } from "../../lib/_security.js";
import { ensureFeatureWithinQuota, recordFeatureUsage } from "../../lib/_entitlements.js";
import { log } from "../../lib/_log.js";


function decodeJwtPayload(token) {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}


async function getRecentConversation(supabase, conversation_id) {
  if (!supabase || !conversation_id) {
    return [];
  }

  const table = process.env.CHAT_HISTORY_TABLE || "messages";

  const { data } = await supabase
    .from(table)
    .select("role, content")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: false })
    .limit(10);

  return (data || []).reverse();
}

async function saveMessage(
  supabase,
  { conversation_id, user_id, role, content, embedding, media_url, media_type }
) {
  if (!supabase) {
    return;
  }

  const table = process.env.CHAT_HISTORY_TABLE || "messages";

  const row = {
    conversation_id,
    user_id,
    role,
    content,
    embedding,
    ...(media_url && { media_url }),
    ...(media_type && { media_type }),
  };

  await supabase.from(table).insert(row);
}

/* -------------------------------------------------------------------------- */
/*                                   CHAT                                     */
/* -------------------------------------------------------------------------- */

async function handleChat(data) {
  const {
    conversation_id,
    user_id,
    message,
    model,
    stream,
    media_url,
    media_type,
    // conversation_history may be provided by the frontend (from localStorage)
    // so the backend can use real context even when Supabase history is sparse.
    conversation_history,
  } = data;

  if (!conversation_id || !user_id || !message) {
    return fail(
      "Missing required fields: conversation_id, user_id, message",
      "ERR_VALIDATION",
      400,
    );
  }

  // Resolver: if the frontend supplied history, prefer that (avoids cold-start
  // context gaps when the DB hasn't been seeded yet).  Fall back to Supabase.
  const resolveHistory = async (convId) => {
    if (Array.isArray(conversation_history) && conversation_history.length > 0) {
      return conversation_history.slice(-10);
    }
    return getRecentConversation(supabase, convId);
  };

  try {
    /* -------------------- VISION ANALYSIS (if media attached) ------------------- */

    let visionAnalysis = null;
    let recentHistory = [];

    if (media_url) {
      try {
        // Load recent conversation history so the vision model has context
        recentHistory = await resolveHistory(conversation_id);

        const visionSystemPrompt =
          "You are an intelligent AI assistant with the ability to analyze images and videos. " +
          "Provide detailed, insightful analysis that connects to the ongoing conversation. " +
          "Your observations help you better understand the user — treat each piece of media " +
          "as an opportunity to learn and grow from what you see.";

        if (media_type === "video") {
          visionAnalysis = await describeVideo({
            video_url: media_url,
            prompt: message,
            model,
            systemPrompt: visionSystemPrompt,
            conversationHistory: recentHistory,
          });
        } else {
          visionAnalysis = await analyzeImage({
            image_url: media_url,
            prompt: message,
            model,
            systemPrompt: visionSystemPrompt,
            conversationHistory: recentHistory,
          });
        }
      } catch (visionErr) {
        log.warn("[ai]", "vision analysis failed, falling back to text:", visionErr.message);
      }
    }

    /* If vision analysis succeeded, use it as the response directly */
    if (visionAnalysis) {
      let assistantEmbedding = null;
      try {
        assistantEmbedding = await orchestrateEmbed(visionAnalysis);
      } catch (err) {
        log.warn("[ai]", "embedding generation failed:", err.message);
      }

      await Promise.all([
        saveMessage(supabase, {
          conversation_id,
          user_id,
          role: "user",
          content: message,
          embedding: null,
          media_url,
          media_type,
        }),
        saveMessage(supabase, {
          conversation_id,
          user_id,
          role: "assistant",
          content: visionAnalysis,
          embedding: assistantEmbedding,
        }),
      ]);

      return ok({
        response: visionAnalysis,
        intent: { intent: "vision_analysis", confidence: 1 },
      });
    }

    /* ----------------------- COMPANION BRAIN ORCHESTRATION -------------------- */

    const result = await orchestrate({
      task: "chat",
      message,
      user_id,
      conversation_id,
      model,
      getRecentConversation: resolveHistory,
    });

    if (!result || !result.response) {
      throw new Error("Vuk Brain returned empty response");
    }

    /* ---- Determine if this is a media response (image / video / music) ---- */

    const isMediaResponse = result.isMedia &&
      result.response &&
      typeof result.response === "object" &&
      result.response.url;

    // Determine the media type label for the DB content field
    const mediaTypeLabel = isMediaResponse
      ? (result.response.type || "media")
      : null;

    // Normalise media_type to the values the DB/frontend understands: "image" | "video"
    const dbMediaType = isMediaResponse
      ? (result.response.type === "video" ? "video" : "image")
      : null;

    const assistantTextContent = isMediaResponse
      ? `[${mediaTypeLabel} generated]`
      : result.response;

    /* ----------------------------- SAFE EMBEDDING ---------------------------- */

    let assistantEmbedding = null;

    try {
      assistantEmbedding = await orchestrateEmbed(assistantTextContent);
    } catch (err) {
      log.warn("[ai]", "embedding generation failed:", err.message);
    }

    await Promise.all([
      saveMessage(supabase, {
        conversation_id,
        user_id,
        role: "user",
        content: message,
        embedding: result.context?.embedding || null,
      }),

      saveMessage(supabase, {
        conversation_id,
        user_id,
        role: "assistant",
        content: assistantTextContent,
        embedding: assistantEmbedding,
        ...(isMediaResponse && { media_url: result.response.url }),
        ...(isMediaResponse && { media_type: dbMediaType }),
      }),
    ]);

    /* ---------------------- STREAMING VS STANDARD RESPONSE -------------------- */

    if (stream && !isMediaResponse) {
      const chunks = [];
      const tokens = result.response.split(" ");
      for (let i = 0; i < tokens.length; i++) {
        chunks.push(
          JSON.stringify({ token: i < tokens.length - 1 ? tokens[i] + " " : tokens[i], done: false }) + "\n"
        );
      }
      chunks.push(JSON.stringify({ token: "", done: true }) + "\n");

      return {
        statusCode: 200,
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/x-ndjson",
          "Transfer-Encoding": "chunked",
        },
        body: chunks.join(""),
      };
    }

    if (isMediaResponse) {
      return ok({
        response: assistantTextContent,
        media_url: result.response.url,
        media_type: dbMediaType,
        intent: result.intent || { intent: "media_generation", confidence: 1 },
      });
    }

    return ok({
      response: result.response,
      intent: result.intent || { intent: "chat", confidence: 1 },
    });
  } catch (brainError) {
    log.warn("[ai]", "vuk brain failed, falling back to direct AI:", brainError.message);

    /* --------------------------- ROUTER FALLBACK ---------------------------- */

    try {
      const aiResponse = await orchestrateSimple({
        prompt: {
          system: "You are a helpful, mature AI assistant. Respond naturally and warmly.",
          user: message,
        },
        model,
        task: "chat_fallback",
      });

      return ok({
        response: aiResponse,
        intent: { intent: "chat", confidence: 1 },
      });
    } catch (routerError) {
      log.error("[ai]", "router fallback failed:", routerError.message);

      // Backward compat: soft-fail 200 so the frontend shows a friendly message
      return raw(200, {
        response: "I'm having trouble right now. Please try again in a moment.",
      });
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                  MEMORY                                    */
/* -------------------------------------------------------------------------- */

async function handleMemory(data) {
  const { action } = data;

  if (action === "search") {
    const embedding = await orchestrateEmbed(data.content);

    const { data: results } = await supabase.rpc("match_messages", {
      query_embedding: embedding,
      match_count: 5,
    });

    return ok({ results });
  }

  if (action === "save") {
    const embedding = await orchestrateEmbed(data.content);

    const { data: saved } = await supabase
      .from(process.env.CHAT_HISTORY_TABLE || "messages")
      .insert({
        conversation_id: data.conversation_id,
        user_id: data.user_id,
        role: data.role,
        content: data.content,
        embedding,
      })
      .select();

    return ok({ data: saved });
  }

  return fail("Invalid memory action", "ERR_VALIDATION", 400);
}

/* -------------------------------------------------------------------------- */
/*                                   MEDIA                                    */
/* -------------------------------------------------------------------------- */

async function handleMedia(data) {
  if (!data.prompt) {
    return fail("Prompt required", "ERR_VALIDATION", 400);
  }

  if (!data.user_id) {
    return fail("Unauthorized", "ERR_AUTH", 401);
  }

  const quota = await ensureFeatureWithinQuota(data.user_id, "media_generation", data.user_email);
  if (!quota.allowed) {
    return fail(quota.message, "ERR_PLAN_LIMIT", 402);
  }

  try {
    const mediaType = data.media_type || data.type || "image";
    const result = await runMediaTask({
      type: mediaType,
      prompt: data.prompt,
      model: data.model,
      options: data.options || {},
    });

    await recordFeatureUsage(data.user_id, "media_generation", {
      type: mediaType,
      model: data.model || null,
    });

    return ok({ ...result, quota: quota.feature });
  } catch (err) {
    log.error("[ai]", "media generation error:", err.message);
    return fail(err.message, "ERR_MEDIA", 500);
  }
}

/* -------------------------------------------------------------------------- */
/*                                  WORKFLOW                                  */
/* -------------------------------------------------------------------------- */

async function handleWorkflow(data) {
  if (data.action === "create_project") {
    const project = await createProject(data);

    if (data.steps) {
      await Promise.all(
        data.steps.map((step, i) =>
          addWorkflowStep({
            project_id: project.id,
            step_order: i + 1,
            step_type: step.step_type,
            config: step.config || {},
          })
        )
      );
    }

    return ok({ project });
  }

  if (data.action === "run") {
    const result = await runWorkflow(data.project_id);
    return ok(result);
  }

  return fail("Invalid workflow action", "ERR_VALIDATION", 400);
}

/* -------------------------------------------------------------------------- */
/*                                  REALTIME                                  */
/* -------------------------------------------------------------------------- */

async function handleRealtime(data) {
  if (data.action === "start") {
    const session = await createSession(data);
    return ok({ session });
  }

  if (data.action === "end") {
    const existing = await getSession(data.session_id);

    if (!existing) {
      return fail("Session not found", "ERR_NOT_FOUND", 404);
    }

    const session = await endSession(data.session_id);
    return ok({ session });
  }

  return fail("Invalid realtime action", "ERR_VALIDATION", 400);
}

/* -------------------------------------------------------------------------- */
/*                              REALTIME TOKEN                                */
/* -------------------------------------------------------------------------- */

async function handleRealtimeToken(data) {
  const model = data.model;
  const voice = data.voice;

  // Validate that the required API key is present for the requested provider.
  // When a NoFilter model is requested, only NOFILTER_GPT_API_KEY is checked
  // here; OPENAI_API_KEY is still required for other functions in this file
  // (chat memory embeddings, vision analysis, etc.) but is not needed for the
  // realtime token endpoint itself.
  if (isNofilterModel(model)) {
    const nofilterApiKey = process.env.NOFILTER_GPT_API_KEY || process.env.NOFILTER_GPT_API;
    if (!nofilterApiKey) {
      log.error("[ai]", "NOFILTER_GPT_API_KEY/NOFILTER_GPT_API is not configured for realtime token request");
      return fail("NOFILTER_GPT_API_KEY (or NOFILTER_GPT_API) is not configured", "ERR_CONFIG", 500);
    }
  } else if (!process.env.OPENAI_API_KEY) {
    log.error("[ai]", "OPENAI_API_KEY is not configured for realtime token request");
    return fail("OpenAI API key not configured", "ERR_CONFIG", 500);
  }

  try {
    const { client_secret, realtime_endpoint } = await createRealtimeSession({ model, voice });
    return ok({ client_secret, realtime_endpoint });
  } catch (err) {
    log.error("[ai]", "realtime token error:", err.message);
    return fail("Failed to create realtime session", "ERR_REALTIME", 500);
  }
}

/* -------------------------------------------------------------------------- */
/*                                   VOICE                                    */
/* -------------------------------------------------------------------------- */

async function handleVoice(data) {
  if (data?.backendType === "realtime_token" || data?.options?.backendType === "realtime_token") {
    return handleRealtimeToken({
      model: data?.model || data?.options?.data?.model,
      voice: data?.voice || data?.options?.data?.voice,
    });
  }

  if (!data.text) {
    return fail("Missing required field: text", "ERR_VALIDATION", 400);
  }

  try {
    const result = await processVoiceTurn({
      text: data.text,
      systemPrompt: data.systemPrompt || "",
      model: data.model,
      voiceId: data.voiceId,
      useElevenLabs: data.useElevenLabs || false,
    });

    return ok(result);
  } catch (err) {
    log.error("[ai]", "voice processing error:", err.message);
    return fail(err.message, "ERR_VOICE", 500);
  }
}

/* -------------------------------------------------------------------------- */
/*                                MULTIMODAL                                  */
/* -------------------------------------------------------------------------- */

async function handleMultimodal(data) {
  if (!data.taskType) {
    return fail("Missing required field: taskType", "ERR_VALIDATION", 400);
  }

  try {
    const result = await runTask({
      type: data.taskType,
      prompt: data.prompt,
      model: data.model,
      options: data.options || {},
    });

    return ok(result);
  } catch (err) {
    log.error("[ai]", "multimodal engine error:", err.message);
    return fail(err.message, "ERR_MULTIMODAL", 500);
  }
}

/* -------------------------------------------------------------------------- */
/*                               LIVE TALK                                    */
/* -------------------------------------------------------------------------- */

/**
 * Detect the live talk intent using a fast, focused AI call via centralized client.
 */
async function detectLiveTalkIntent(message, historyContext) {
  try {
    const prompt = liveTalkIntentClassification({ message, historyContext });
    const rawText = await orchestrateSimple({ prompt, model: "gpt-4.1-mini", task: "live_talk_intent" });
    // Strip potential markdown fences
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    log.warn("[ai]", "live talk intent detection failed, defaulting to chat:", err.message);
    return { type: "chat" };
  }
}

/** Pattern that detects a user asking to stop/exit the current role-play. */
const ROLEPLAY_EXIT_RE =
  /\b(stop|end|exit|quit|cancel)\b.*\b(role.?play|character|scenario)\b/i;

/**
 * Handle enterprise-grade live talk requests:
 * intent detection → image generation | role-play | task automation | chat
 */
async function handleLiveTalk(data) {
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

  // Build recent history context string for intent detection
  const historyContext = conversation_history
    .slice(-6)
    .map((t) => `${t.role === "user" ? "User" : ai_name}: ${t.text}`)
    .join("\n");

  // Build knowledge context string if knowledge refs were provided
  const knowledgeContext =
    knowledge_refs && knowledge_refs.length > 0
      ? `\n\nRelevant knowledge from user's personal knowledge base:\n${knowledge_refs
          .map((ref) => `[${ref.type?.toUpperCase() ?? "NOTE"}] ${ref.title}: ${ref.content}`)
          .join("\n\n")}`
      : "";

  // Fast-path: the realtime tool handler already resolved intent, so skip classification
  if (intent_override === "run_task") {
    const taskDesc = message;
    const resolvedTaskType = task_type || "other";
    const prompt = liveTalkTask({ aiName: ai_name, taskType: resolvedTaskType, taskDescription: taskDesc });
    const taskResponse = await orchestrateSimple({ prompt, task: "live_talk_task" });
    return ok({
      response: taskResponse,
      action: {
        type: "task_completed",
        taskType: resolvedTaskType,
        description: taskDesc,
      },
    });
  }

  // If we are already in an active role-play, stay in character without
  // re-detecting intent — unless the user explicitly asks to stop.
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

  // If there was an active role-play but the user asked to stop, exit it
  if (roleplay_context && ROLEPLAY_EXIT_RE.test(message)) {
    const systemPrompt = liveTalkSystem({ aiName: ai_name, mode });
    const exitResponse = await orchestrateSimple({
      prompt: {
        system: systemPrompt,
        user: `The user just ended a role-play as "${roleplay_context.character}". Acknowledge it briefly and warmly in one sentence.`,
      },
      task: "live_talk_exit",
    });
    return ok({
      response: exitResponse,
      action: { type: "roleplay_ended" },
    });
  }

  // Detect intent
  const intent = await detectLiveTalkIntent(message, historyContext);

  switch (intent.type) {
    case "generate_image": {
      const imagePrompt = intent.imagePrompt || message;
      try {
        const imageResult = await runMediaTask({
          type: "image",
          prompt: imagePrompt,
        });
        const ackPrompt = liveTalkMediaAck({ aiName: ai_name, mediaType: "image", prompt: imagePrompt });
        const voiceReply = await orchestrateSimple({ prompt: ackPrompt, model: "gpt-4.1-mini", task: "live_talk_ack" });
        return ok({
          response: voiceReply,
          action: {
            type: "image_generated",
            mediaUrl: imageResult.url,
            mediaType: "image",
            prompt: imagePrompt,
          },
        });
      } catch (imgErr) {
        log.error("[ai]", "live talk image generation error:", imgErr.message);
        const systemPrompt = liveTalkSystem({ aiName: ai_name, mode });
        const fallback = await orchestrateSimple({
          prompt: { system: systemPrompt, user: `${historyContext}\n\nUser: ${message}` },
          task: "live_talk_fallback",
        });
        return ok({ response: fallback });
      }
    }

    case "generate_video": {
      const videoPrompt = intent.videoPrompt || message;
      try {
        const videoResult = await runMediaTask({
          type: "video",
          prompt: videoPrompt,
        });
        const ackPrompt = liveTalkMediaAck({ aiName: ai_name, mediaType: "video", prompt: videoPrompt });
        const voiceReply = await orchestrateSimple({ prompt: ackPrompt, model: "gpt-4.1-mini", task: "live_talk_ack" });
        return ok({
          response: voiceReply,
          action: {
            type: "video_generated",
            mediaUrl: videoResult.url || null,
            mediaType: "video",
            prompt: videoPrompt,
          },
        });
      } catch (vidErr) {
        log.error("[ai]", "live talk video generation error:", vidErr.message);
        const systemPrompt = liveTalkSystem({ aiName: ai_name, mode });
        const fallback = await orchestrateSimple({
          prompt: { system: systemPrompt, user: `${historyContext}\n\nUser: ${message}` },
          task: "live_talk_fallback",
        });
        return ok({ response: fallback });
      }
    }

    case "roleplay": {
      const character = intent.character || "a mysterious character";
      const scenario =
        intent.scenario || "an intriguing conversation with the user";
      const prompt = liveTalkRoleplay({ character, scenario, historyContext: "", message });
      const roleplayResponse = await orchestrateSimple({ prompt, task: "live_talk_roleplay" });
      return ok({
        response: roleplayResponse,
        action: {
          type: "roleplay_started",
          character,
          scenario,
        },
      });
    }

    case "run_task": {
      const taskDesc = intent.taskDescription || message;
      const prompt = liveTalkTask({ aiName: ai_name, taskType: intent.taskType || "other", taskDescription: taskDesc });
      const taskResponse = await orchestrateSimple({ prompt, task: "live_talk_task" });
      return ok({
        response: taskResponse,
        action: {
          type: "task_completed",
          taskType: intent.taskType || "other",
          description: taskDesc,
        },
      });
    }

    default: {
      // General conversational chat — include knowledge context if available
      const systemPrompt = liveTalkSystem({ aiName: ai_name, mode }) +
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

/* -------------------------------------------------------------------------- */
/*                              REFINE MEDIA                                  */
/* -------------------------------------------------------------------------- */

/**
 * Build a refinement prompt for the given action and optional user instructions.
 */
function buildRefinementPrompt(action, mediaType, customPrompt) {
  const base = {
    enhance: `Enhance this ${mediaType}: improve overall quality, lighting, clarity, and color balance`,
    upscale: `Upscale this ${mediaType} to higher resolution while preserving detail`,
    stylize: customPrompt || `Apply a cinematic, professional style to this ${mediaType}`,
    denoise: `Remove noise and grain from this ${mediaType} while preserving detail`,
    colorize: `Improve the color grading and vibrancy of this ${mediaType}`,
    restore: `Restore this ${mediaType}: fix artifacts, damage, and quality issues`,
    "background-remove": `Remove the background from this image, isolating the main subject`,
    "super-resolution": `Apply super-resolution enhancement for maximum quality`,
    custom: customPrompt || `Improve this ${mediaType}`,
  };

  return base[action] || customPrompt || `Enhance this ${mediaType}`;
}

async function handleRefineMedia(data) {
  const { media_url, media_type, action, prompt, model, options } = data;

  if (!media_url) {
    return fail("media_url is required", "ERR_VALIDATION", 400);
  }

  if (!media_type || !["image", "video"].includes(media_type)) {
    return fail("media_type must be 'image' or 'video'", "ERR_VALIDATION", 400);
  }

  if (!action) {
    return fail("action is required", "ERR_VALIDATION", 400);
  }

  const refinementPrompt = buildRefinementPrompt(action, media_type, prompt);
  const optimizedPrompt = await optimizePrompt(refinementPrompt, media_type);

  const generationResult = await generateMedia({
    type: media_type,
    prompt: `${optimizedPrompt}. Reference source: ${media_url}`,
    model: model || undefined,
    options: {
      ...options,
      source_url: media_url,
      refinement_action: action,
    },
  });

  return ok({
    id: generationResult.id || crypto.randomUUID(),
    url: generationResult.url,
    refined_url: generationResult.url,
    model: generationResult.model,
    provider: generationResult.provider,
    prompt: optimizedPrompt,
    action,
    taskId: generationResult.taskId,
  });
}

/* -------------------------------------------------------------------------- */
/*                                KNOWLEDGE                                   */
/* -------------------------------------------------------------------------- */

async function handleKnowledge(data) {
  const { messages, model, temperature } = data;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return fail("messages array is required", "ERR_VALIDATION", 400);
  }

  const systemMsg = messages.find((m) => m.role === "system");
  const userMsg = messages.find((m) => m.role === "user");

  const response = await aiChat({
    prompt: {
      system: systemMsg?.content || "You are a helpful AI assistant.",
      user: userMsg?.content || "",
    },
    model: model || "gpt-4.1",
    temperature: temperature ?? 0.3,
    task: "knowledge_analysis",
  });

  return ok({ response });
}

/* -------------------------------------------------------------------------- */
/*                                   GATEWAY                                  */
/* -------------------------------------------------------------------------- */

/**
 * Normalize a raw payload object — accept both snake_case (backend-native)
 * and camelCase (frontend convention) field names for the chat handler.
 * This avoids a hard dependency on which naming convention callers use.
 */
function normalizePayload(p) {
  if (!p || typeof p !== "object") return p;
  return {
    ...p,
    conversation_id: p.conversation_id ?? p.conversationId,
    user_id: p.user_id ?? p.userId,
    media_url: p.media_url ?? p.mediaUrl,
    media_type: p.media_type ?? p.mediaType,
  };
}

async function getUserFromEventAuth(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return null;

  if (!supabase) {
    const claims = decodeJwtPayload(token);
    return claims?.sub ? { id: claims.sub } : null;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser(token);

  return user || null;
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  try {
    // Input validation: payload size check
    const sizeCheck = validatePayloadSize(event.body);
    if (!sizeCheck.valid) return fail(sizeCheck.error, "ERR_PAYLOAD_SIZE", 413);

    const body = sanitizeDeep(JSON.parse(event.body));

    log.info("[ai-orchestrator]", "gateway request:", { type: body.type });

    // Accept both 'data' (backend-native) and 'input' (frontend convention).
    // Also hoist 'config.model' into the payload so callers that send the model
    // inside a config block don't need to duplicate it in the data object.
    const { type, data, input, action, config } = body;
    const rawPayload = data || input || {};
    const modelFromConfig = config?.model;
    const payload = normalizePayload({
      ...rawPayload,
      ...(modelFromConfig && !rawPayload.model ? { model: modelFromConfig } : {}),
    });

    const authUser = await getUserFromEventAuth(event).catch(() => null);

    if (action && typeof payload === "object") {
      payload.action = payload.action || action;
    }

    switch (type) {
      case "chat":
        if (payload && typeof payload === "object") {
          if (authUser?.id) {
            payload.user_id = authUser.id;
          }
          if (!payload.user_id) {
            return fail("Unauthorized", "ERR_AUTH", 401);
          }
        }
        return await handleChat(payload);

      case "memory":
        return await handleMemory(payload);

      case "media":
        if (payload && typeof payload === "object") {
          if (authUser?.id) {
            payload.user_id = authUser.id;
          }
          if (authUser?.email) {
            payload.user_email = authUser.email;
          }
          if (!payload.user_id) {
            return fail("Unauthorized", "ERR_AUTH", 401);
          }
        }
        return await handleMedia(payload);

      // Explicit image/video aliases — route through the media handler
      case "image":
        if (payload && typeof payload === "object") {
          if (authUser?.id) {
            payload.user_id = authUser.id;
          }
          if (authUser?.email) {
            payload.user_email = authUser.email;
          }
          if (!payload.user_id) {
            return fail("Unauthorized", "ERR_AUTH", 401);
          }
        }
        return await handleMedia({ ...payload, media_type: "image" });

      case "video":
        if (payload && typeof payload === "object") {
          if (authUser?.id) {
            payload.user_id = authUser.id;
          }
          if (authUser?.email) {
            payload.user_email = authUser.email;
          }
          if (!payload.user_id) {
            return fail("Unauthorized", "ERR_AUTH", 401);
          }
        }
        return await handleMedia({ ...payload, media_type: "video" });

      case "workflow":
        return await handleWorkflow(payload);

      case "agent":
        return await handleWorkflow(payload);

      case "realtime":
        return await handleRealtime(payload);

      case "voice":
        return await handleVoice(payload);

      case "realtime_token":
        return await handleRealtimeToken(payload);

      case "multimodal":
        return await handleMultimodal(payload);

      case "live_talk":
        return await handleLiveTalk(payload);

      // Streaming chat — delegates to handleChat with stream flag forced on
      case "stream":
        if (payload && typeof payload === "object") {
          if (authUser?.id) {
            payload.user_id = authUser.id;
          }
          if (!payload.user_id) {
            return fail("Unauthorized", "ERR_AUTH", 401);
          }
        }
        return await handleChat({ ...payload, stream: true });

      // Knowledge analysis (structured AI calls with messages array)
      case "knowledge":
        return await handleKnowledge(payload);

      // Media refinement (enhance, upscale, stylize, etc.)
      case "refine_media":
        return await handleRefineMedia(payload);

      default:
        return fail("Invalid request type", "ERR_VALIDATION", 400);
    }
  } catch (err) {
    log.error("[ai-orchestrator]", "gateway error:", err.message);

    // Backward compat: soft-fail 200 so the frontend shows a friendly message
    return raw(200, {
      response: "I'm having trouble connecting to the AI service right now.",
    });
  }
}
