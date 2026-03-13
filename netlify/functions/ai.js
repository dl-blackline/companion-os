import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "../../lib/openai-client.js";
import { orchestrate } from "../../lib/orchestrator.js";
import { runAI, streamAI } from "../../lib/ai-router.js";
import { processMemory } from "../../lib/memory-manager.js";
import { processKnowledgeGraph } from "../../lib/knowledge-graph.js";
import {
  detectEmotions,
  storeEmotionalSignals,
} from "../../lib/emotion-detector.js";
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
import { processVoiceTurn } from "../../lib/voice-engine.js";
import { analyzeImage, describeVideo } from "../../lib/vision-analyzer.js";
import { runTask } from "../../lib/multimodal-engine.js";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function response(statusCode, body) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

function getSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing Supabase environment configuration");
  }

  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

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
    return response(400, {
      error: "Missing required fields: conversation_id, user_id, message",
    });
  }

  const supabase = getSupabase();

  try {
    /* -------------------- VISION ANALYSIS (if media attached) ------------------- */

    let visionAnalysis = null;

    if (media_url) {
      try {
        if (media_type === "video") {
          visionAnalysis = await describeVideo({
            video_url: media_url,
            prompt: message,
            model,
          });
        } else {
          visionAnalysis = await analyzeImage({
            image_url: media_url,
            prompt: message,
            model,
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
        assistantEmbedding = await generateEmbedding(visionAnalysis);
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

      return response(200, {
        response: visionAnalysis,
        intent: { intent: "vision_analysis", confidence: 1 },
      });
    }

    /* ----------------------- STANDARD ORCHESTRATION FLOW ----------------------- */

    const result = await orchestrate({
      message,
      user_id,
      conversation_id,
      getRecentConversation: (convId) =>
        getRecentConversation(supabase, convId),
      model,
    });

    if (!result || !result.response) {
      throw new Error("Orchestrator returned empty response");
    }

    /* ----------------------------- SAFE EMBEDDING ---------------------------- */

    let assistantEmbedding = null;

    try {
      assistantEmbedding = await generateEmbedding(result.response);
    } catch (err) {
      console.warn("Embedding generation failed:", err.message);
    }

    await Promise.all([
      saveMessage(supabase, {
        conversation_id,
        user_id,
        role: "user",
        content: message,
        embedding: result.embedding || null,
      }),

      saveMessage(supabase, {
        conversation_id,
        user_id,
        role: "assistant",
        content: result.response,
        embedding: assistantEmbedding,
      }),
    ]);

    /* ------------------------ NON BLOCKING MEMORY TASKS ---------------------- */

    const conversationHistory = (result.context?.recentConversation || [])
      .map((m) => `[${m.role}]: ${m.content}`)
      .join("\n");

    Promise.allSettled([
      processMemory({
        user_id,
        conversation_id,
        message,
        conversationHistory,
        messageCount: result.context?.recentConversation?.length || 0,
      }),

      processKnowledgeGraph(user_id, message),

      detectEmotions(message)
        .then((signals) =>
          storeEmotionalSignals({
            user_id,
            conversation_id,
            signals,
            source_message: message,
          })
        )
        .catch(() => {}),
    ]);

    /* ---------------------- STREAMING VS STANDARD RESPONSE -------------------- */

    if (stream) {
      // True token streaming via the OpenAI streaming API
      const chunks = [];
      try {
        for await (const token of streamAI(
          [{ role: "user", content: message }],
          model
        )) {
          chunks.push(
            JSON.stringify({ token, done: false }) + "\n"
          );
        }
      } catch (streamErr) {
        // If streaming fails, fall back to word-splitting the already-fetched result
        console.warn("Streaming fallback: splitting orchestrator response:", streamErr.message);
        const tokens = result.response.split(" ");
        for (let i = 0; i < tokens.length; i++) {
          chunks.push(
            JSON.stringify({ token: i < tokens.length - 1 ? tokens[i] + " " : tokens[i], done: false }) + "\n"
          );
        }
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

    return response(200, {
      response: result.response,
      intent: result.intent || { intent: "chat", confidence: 1 },
    });
  } catch (orchestratorError) {
    console.warn(
      "Orchestrator failed, falling back to direct AI:",
      orchestratorError.message
    );

    /* --------------------------- ROUTER FALLBACK ---------------------------- */

    try {
      const aiResponse = await runAI(
        [{ role: "user", content: message }],
        model
      );

      return response(200, {
        response: aiResponse,
        intent: { intent: "chat", confidence: 1 },
      });
    } catch (routerError) {
      console.error("Router failed:", routerError);

      return response(200, {
        response:
          "I'm having trouble connecting to the AI service right now.",
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
    const supabase = getSupabase();

    const embedding = await generateEmbedding(data.content);

    const { data: results } = await supabase.rpc("match_messages", {
      query_embedding: embedding,
      match_count: 5,
    });

    return response(200, { results });
  }

  if (action === "save") {
    const supabase = getSupabase();

    const embedding = await generateEmbedding(data.content);

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

    return response(200, { data: saved });
  }

  return response(400, { error: "Invalid memory action" });
}

/* -------------------------------------------------------------------------- */
/*                                   MEDIA                                    */
/* -------------------------------------------------------------------------- */

async function handleMedia(data) {
  if (!data.prompt) {
    return response(400, { error: "Prompt required" });
  }

  try {
    const result = await runMediaTask({
      type: data.media_type || data.type || "image",
      prompt: data.prompt,
      model: data.model,
      options: data.options || {},
    });

    return response(200, result);
  } catch (err) {
    console.error("Media generation error:", err.message);
    return response(500, { error: err.message });
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

    return response(200, { project });
  }

  if (data.action === "run") {
    const result = await runWorkflow(data.project_id);
    return response(200, result);
  }

  return response(400, { error: "Invalid workflow action" });
}

/* -------------------------------------------------------------------------- */
/*                                  REALTIME                                  */
/* -------------------------------------------------------------------------- */

async function handleRealtime(data) {
  if (data.action === "start") {
    const session = await createSession(data);
    return response(200, { session });
  }

  if (data.action === "end") {
    const existing = await getSession(data.session_id);

    if (!existing) {
      return response(404, { error: "Session not found" });
    }

    const session = await endSession(data.session_id);
    return response(200, { session });
  }

  return response(400, { error: "Invalid realtime action" });
}

/* -------------------------------------------------------------------------- */
/*                              REALTIME TOKEN                                */
/* -------------------------------------------------------------------------- */

async function handleRealtimeToken(data) {
  if (!process.env.OPENAI_API_KEY) {
    return response(500, { error: "OpenAI API key not configured" });
  }

  const model = data.model || "gpt-4o-realtime-preview";
  const voice = data.voice || "alloy";

  try {
    const tokenRes = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        voice,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => "Unknown error");
      console.error("OpenAI realtime session error:", tokenRes.status, errText);
      return response(tokenRes.status, {
        error: `Failed to create realtime session: ${tokenRes.status}`,
      });
    }

    const sessionData = await tokenRes.json();
    return response(200, {
      client_secret: sessionData.client_secret?.value || sessionData.client_secret,
      session_id: sessionData.id,
    });
  } catch (err) {
    console.error("Realtime token error:", err.message);
    return response(500, { error: "Failed to create realtime session" });
  }
}

/* -------------------------------------------------------------------------- */
/*                                   VOICE                                    */
/* -------------------------------------------------------------------------- */

async function handleVoice(data) {
  if (!data.text) {
    return response(400, { error: "Missing required field: text" });
  }

  try {
    const result = await processVoiceTurn({
      text: data.text,
      systemPrompt: data.systemPrompt || "",
      model: data.model,
      voiceId: data.voiceId,
      useElevenLabs: data.useElevenLabs || false,
    });

    return response(200, result);
  } catch (err) {
    console.error("Voice processing error:", err.message);
    return response(500, { error: err.message });
  }
}

/* -------------------------------------------------------------------------- */
/*                                MULTIMODAL                                  */
/* -------------------------------------------------------------------------- */

async function handleMultimodal(data) {
  if (!data.taskType) {
    return response(400, { error: "Missing required field: taskType" });
  }

  try {
    const result = await runTask({
      type: data.taskType,
      prompt: data.prompt,
      model: data.model,
      options: data.options || {},
    });

    return response(200, result);
  } catch (err) {
    console.error("Multimodal engine error:", err.message);
    return response(500, { error: err.message });
  }
}

/* -------------------------------------------------------------------------- */
/*                               LIVE TALK                                    */
/* -------------------------------------------------------------------------- */

const LIVE_TALK_INTENT_SYSTEM = `You are a voice assistant intent classifier. Return ONLY valid JSON with no markdown or code blocks.

Classify the user's voice message into one of:
- "chat": general conversation, questions, opinions, information requests
- "generate_image": user wants to see, create, draw, generate, or visualize an image or picture
- "roleplay": user wants the AI to play a character, persona, or act out a scenario
- "run_task": user wants to automate a task or generate content (document, code, plan, summary)

Return exactly this JSON structure (omit fields that don't apply):
{
  "type": "chat" | "generate_image" | "roleplay" | "run_task",
  "imagePrompt": "detailed image description",
  "character": "character or persona name",
  "scenario": "scenario or context description",
  "taskType": "document" | "plan" | "code" | "summary" | "other",
  "taskDescription": "complete description of what needs to be done"
}`;

/**
 * Detect the live talk intent using a fast, focused AI call.
 */
async function detectLiveTalkIntent(message, historyContext) {
  try {
    const raw = await runAI(
      {
        system: LIVE_TALK_INTENT_SYSTEM,
        user: `Message: "${message}"\n\nRecent context:\n${historyContext}`,
      },
      "gpt-4o-mini"
    );
    // Strip potential markdown fences
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err) {
    console.warn("Live talk intent detection failed, defaulting to chat:", err.message);
    return { type: "chat" };
  }
}

/**
 * Build a conversational system prompt for the given mode / AI name.
 */
function liveTalkSystemPrompt(aiName, mode) {
  const base = `You are ${aiName}, an enterprise-grade AI companion. Respond warmly and naturally — as if speaking aloud. Keep answers to 1-3 sentences unless the user explicitly asks for more detail. Never use bullet points or markdown; speak in flowing prose.`;

  const modeAdditions = {
    strategist: " Apply high-level strategic thinking to every response.",
    operator: " Be direct, action-oriented, and concise.",
    researcher: " Provide evidence-based, thorough answers.",
    coach: " Be encouraging, motivating, and growth-focused.",
    creative: " Be imaginative, expressive, and inventive.",
  };

  return base + (modeAdditions[mode] || "");
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
  } = data;

  if (!message) {
    return response(400, { error: "Missing required field: message" });
  }

  // Build recent history context string for intent detection
  const historyContext = conversation_history
    .slice(-6)
    .map((t) => `${t.role === "user" ? "User" : ai_name}: ${t.text}`)
    .join("\n");

  // If we are already in an active role-play, stay in character without
  // re-detecting intent — unless the user explicitly asks to stop.
  if (roleplay_context && !ROLEPLAY_EXIT_RE.test(message)) {
    const roleplayResponse = await runAI({
      system: `You are ${roleplay_context.character}. ${roleplay_context.scenario}. Stay fully in character. Respond naturally as if speaking aloud. Keep answers to 1-3 sentences unless the user asks for more.`,
      user: `${historyContext}\n\nUser: ${message}`,
    });
    return response(200, {
      response: roleplayResponse,
      action: {
        type: "roleplay_continued",
        character: roleplay_context.character,
        scenario: roleplay_context.scenario,
      },
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
        const voiceReply = await runAI(
          {
            system: `You are ${ai_name}, a voice AI. In exactly one warm, natural sentence acknowledge that you just created the image the user requested. Do not describe its contents in detail.`,
            user: `I generated an image described as: "${imagePrompt}". Briefly acknowledge this.`,
          },
          "gpt-4o-mini"
        );
        return response(200, {
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
        // Fall back to a conversational response
        const fallback = await runAI({
          system: liveTalkSystemPrompt(ai_name, mode),
          user: `${historyContext}\n\nUser: ${message}`,
        });
        return response(200, { response: fallback });
      }
    }

    case "roleplay": {
      const character = intent.character || "a mysterious character";
      const scenario =
        intent.scenario || "an intriguing conversation with the user";
      const roleplayResponse = await runAI({
        system: `You are ${character}. ${scenario}. Stay fully in character from your very first word. Speak naturally as if talking aloud. Keep your opening to 1-2 sentences.`,
        user: message,
      });
      return response(200, {
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
      const taskResponse = await runAI({
        system: `You are ${ai_name}, an expert AI assistant. Complete the following task thoroughly. Write your response as flowing natural language suitable for voice output — no bullet points, no markdown headers. Be thorough but conversational.`,
        user: `Task: ${taskDesc}`,
      });
      return response(200, {
        response: taskResponse,
        action: {
          type: "task_completed",
          taskType: intent.taskType || "other",
          description: taskDesc,
        },
      });
    }

    default: {
      // General conversational chat
      const chatResponse = await runAI({
        system: liveTalkSystemPrompt(ai_name, mode),
        user: `${historyContext}\n\nUser: ${message}`,
      });
      return response(200, { response: chatResponse });
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                   GATEWAY                                  */
/* -------------------------------------------------------------------------- */

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS };
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body);

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
        return response(400, { error: "Invalid request type" });
    }
  } catch (err) {
    console.error("AI gateway error:", err);

    return response(200, {
      response: "I'm having trouble connecting to the AI service right now.",
    });
  }
}
