import { supabase } from "../../lib/_supabase.js";
import { think } from "../../lib/companion-brain.js";
import { chat as aiChat, embed } from "../../lib/ai-client.js";
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
import { runMediaTask } from "../../lib/media-engine.js";
import { processVoiceTurn, createRealtimeSession } from "../../lib/voice-engine.js";
import { analyzeImage, describeVideo } from "../../lib/vision-analyzer.js";
import { runTask } from "../../lib/multimodal-engine.js";
import { getRelevantMediaContext } from "../../lib/media-memory-service.js";
import { isNofilterModel } from "../../lib/nofilter-client.js";
import { ok, fail, preflight, raw, CORS_HEADERS } from "../../lib/_responses.js";
import { validatePayloadSize, sanitizeDeep } from "../../lib/_security.js";


async function getRecentConversation(supabase, conversation_id) {
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
  const { conversation_id, user_id, message, model, stream, media_url, media_type } = data;

  if (!conversation_id || !user_id || !message) {
    return fail(
      "Missing required fields: conversation_id, user_id, message",
      "ERR_VALIDATION",
      400,
    );
  }

  try {
    /* -------------------- VISION ANALYSIS (if media attached) ------------------- */

    let visionAnalysis = null;
    let recentHistory = [];

    if (media_url) {
      try {
        // Load recent conversation history so the vision model has context
        recentHistory = await getRecentConversation(supabase, conversation_id);

        const visionSystemPrompt =
          "You are an intelligent AI companion with the ability to analyze images and videos. " +
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
        console.warn("Vision analysis failed, falling back to text:", visionErr.message);
      }
    }

    /* If vision analysis succeeded, use it as the response directly */
    if (visionAnalysis) {
      let assistantEmbedding = null;
      try {
        assistantEmbedding = await embed(visionAnalysis);
      } catch (err) {
        console.warn("Embedding generation failed:", err.message);
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

    const result = await think({
      message,
      user_id,
      conversation_id,
      model,
      getRecentConversation: (convId) =>
        getRecentConversation(supabase, convId),
    });

    if (!result || !result.response) {
      throw new Error("Companion Brain returned empty response");
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
      assistantEmbedding = await embed(assistantTextContent);
    } catch (err) {
      console.warn("Embedding generation failed:", err.message);
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
    console.warn(
      "Companion Brain failed, falling back to direct AI:",
      brainError.message
    );

    /* --------------------------- ROUTER FALLBACK ---------------------------- */

    try {
      const aiResponse = await aiChat({
        prompt: {
          system: "You are a helpful, mature AI companion. Respond naturally and warmly.",
          user: message,
        },
        model,
      });

      return ok({
        response: aiResponse,
        intent: { intent: "chat", confidence: 1 },
      });
    } catch (routerError) {
      console.error("Router failed:", routerError);

      // Backward compat: soft-fail 200 so the frontend shows a friendly message
      return raw(200, {
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
    const embedding = await embed(data.content);

    const { data: results } = await supabase.rpc("match_messages", {
      query_embedding: embedding,
      match_count: 5,
    });

    return ok({ results });
  }

  if (action === "save") {
    const embedding = await embed(data.content);

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

  try {
    const result = await runMediaTask({
      type: data.media_type || data.type || "image",
      prompt: data.prompt,
      model: data.model,
      options: data.options || {},
    });

    return ok(result);
  } catch (err) {
    console.error("Media generation error:", err.message);
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
    if (!process.env.NOFILTER_GPT_API_KEY) {
      return fail("NOFILTER_GPT_API_KEY is not configured", "ERR_CONFIG", 500);
    }
  } else if (!process.env.OPENAI_API_KEY) {
    return fail("OpenAI API key not configured", "ERR_CONFIG", 500);
  }

  try {
    const { client_secret, realtime_endpoint } = await createRealtimeSession({ model, voice });
    return ok({ client_secret, realtime_endpoint });
  } catch (err) {
    console.error("Realtime token error:", err.message);
    return fail("Failed to create realtime session", "ERR_REALTIME", 500);
  }
}

/* -------------------------------------------------------------------------- */
/*                                   VOICE                                    */
/* -------------------------------------------------------------------------- */

async function handleVoice(data) {
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
    console.error("Voice processing error:", err.message);
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
    console.error("Multimodal engine error:", err.message);
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
    const rawText = await aiChat({ prompt, model: "gpt-4.1-mini", task: "live_talk_intent" });
    // Strip potential markdown fences
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn("Live talk intent detection failed, defaulting to chat:", err.message);
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
    ai_name = "Companion",
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
    const taskResponse = await aiChat({ prompt, task: "live_talk_task" });
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
    const roleplayResponse = await aiChat({ prompt, task: "live_talk_roleplay" });
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
    const exitResponse = await aiChat({
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
        const voiceReply = await aiChat({ prompt: ackPrompt, model: "gpt-4.1-mini", task: "live_talk_ack" });
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
        console.error("Live talk image generation error:", imgErr);
        const systemPrompt = liveTalkSystem({ aiName: ai_name, mode });
        const fallback = await aiChat({
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
        const voiceReply = await aiChat({ prompt: ackPrompt, model: "gpt-4.1-mini", task: "live_talk_ack" });
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
        console.error("Live talk video generation error:", vidErr);
        const systemPrompt = liveTalkSystem({ aiName: ai_name, mode });
        const fallback = await aiChat({
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
      const roleplayResponse = await aiChat({ prompt, task: "live_talk_roleplay" });
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
      const taskResponse = await aiChat({ prompt, task: "live_talk_task" });
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
      const chatResponse = await aiChat({
        prompt: { system: systemPrompt, user: `${historyContext}\n\nUser: ${message}` },
        task: "live_talk_chat",
      });
      return ok({ response: chatResponse });
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                   GATEWAY                                  */
/* -------------------------------------------------------------------------- */

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

    console.log("AI Gateway Request:", body);

    const { type, data, action } = body;

    const payload = data || body;

    if (action && typeof payload === "object") {
      payload.action = payload.action || action;
    }

    switch (type) {
      case "chat":
        return await handleChat(payload);

      case "memory":
        return await handleMemory(payload);

      case "media":
        return await handleMedia(payload);

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

      default:
        return fail("Invalid request type", "ERR_VALIDATION", 400);
    }
  } catch (err) {
    console.error("AI gateway error:", err);

    // Backward compat: soft-fail 200 so the frontend shows a friendly message
    return raw(200, {
      response: "I'm having trouble connecting to the AI service right now.",
    });
  }
}
