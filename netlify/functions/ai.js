import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "../../lib/openai-client.js";
import { orchestrate } from "../../lib/orchestrator.js";
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

// ---------------------------------------------------------------------------
// Chat handler – mirrors netlify/functions/chat.js logic
// ---------------------------------------------------------------------------

async function getRecentConversation(supabase, conversation_id) {
  const table = process.env.CHAT_HISTORY_TABLE || "messages";

  const { data, error } = await supabase
    .from(table)
    .select("role, content")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Recent conversation error:", error.message);
    return [];
  }

  return (data || []).reverse();
}

async function saveMessage(supabase, { conversation_id, user_id, role, content, embedding }) {
  const table = process.env.CHAT_HISTORY_TABLE || "messages";

  const { error } = await supabase.from(table).insert({
    conversation_id,
    user_id,
    role,
    content,
    embedding,
  });

  if (error) {
    console.error("Save message error:", error.message);
  }
}

async function handleChat(data) {
  const { conversation_id, user_id, message, model } = data;

  if (!conversation_id || !user_id || !message) {
    return response(400, {
      error: "Missing required fields: conversation_id, user_id, message",
    });
  }

  const supabase = getSupabase();

  const result = await orchestrate({
    message,
    user_id,
    conversation_id,
    getRecentConversation: (convId) =>
      getRecentConversation(supabase, convId),
    model,
  });

  // For media results, return the media payload directly
  if (result.isMedia) {
    return response(200, {
      response: result.response,
      intent: result.intent,
    });
  }

  // Save both the user message and the assistant response
  const assistantEmbedding = await generateEmbedding(result.response);

  await Promise.all([
    saveMessage(supabase, {
      conversation_id,
      user_id,
      role: "user",
      content: message,
      embedding: result.embedding,
    }),
    saveMessage(supabase, {
      conversation_id,
      user_id,
      role: "assistant",
      content: result.response,
      embedding: assistantEmbedding,
    }),
  ]);

  // Post-response memory processing (non-blocking)
  const conversationHistory = (result.context.recentConversation || [])
    .map((m) => `[${m.role}]: ${m.content}`)
    .join("\n");

  Promise.allSettled([
    processMemory({
      user_id,
      conversation_id,
      message,
      conversationHistory,
      messageCount: (result.context.recentConversation || []).length,
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
      .catch((err) => {
        console.error("Emotion processing error:", err.message);
      }),
  ]);

  return response(200, {
    response: result.response,
    intent: result.intent,
  });
}

// ---------------------------------------------------------------------------
// Memory handler – mirrors search-memory.js and save-message.js
// ---------------------------------------------------------------------------

async function handleMemory(data) {
  const { action } = data;

  if (action === "search") {
    const { content } = data;

    if (!content) {
      return response(400, { error: "Missing required field: content" });
    }

    const supabase = getSupabase();
    const embedding = await generateEmbedding(content);

    const { data: results, error } = await supabase.rpc("match_messages", {
      query_embedding: embedding,
      match_count: 5,
    });

    if (error) {
      return response(500, { error: error.message });
    }

    return response(200, { results });
  }

  if (action === "save") {
    const { conversation_id, user_id, role, content } = data;

    if (!conversation_id || !user_id || !role || !content) {
      return response(400, {
        error:
          "Missing required fields: conversation_id, user_id, role, content",
      });
    }

    const supabase = getSupabase();
    const embedding = await generateEmbedding(content);
    const table = process.env.CHAT_HISTORY_TABLE || "messages";

    const { data: saved, error } = await supabase
      .from(table)
      .insert({ conversation_id, user_id, role, content, embedding })
      .select();

    if (error) {
      return response(500, { error: error.message });
    }

    return response(200, { message: "Message saved", data: saved });
  }

  return response(400, {
    error: "Invalid memory action. Use 'search' or 'save'.",
  });
}

// ---------------------------------------------------------------------------
// Media handler – mirrors generate-media.js
// ---------------------------------------------------------------------------

async function handleMedia(data) {
  const { prompt, media_type } = data;

  if (!prompt) {
    return response(400, { error: "Prompt required" });
  }

  const type = media_type || "image";

  if (type === "image") {
    const piRes = await fetch("https://api.piapi.ai/api/v1/task", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": process.env.PIAPI_API_KEY,
      },
      body: JSON.stringify({
        model: "flux",
        task_type: "image_generation",
        input: { prompt },
      }),
    });

    const result = await piRes.json();
    return response(200, result);
  }

  return response(400, { error: "Unsupported media type" });
}

// ---------------------------------------------------------------------------
// Workflow handler – mirrors create-content-project.js + workflow-engine.js
// ---------------------------------------------------------------------------

async function handleWorkflow(data) {
  const { action } = data;

  if (action === "create_project") {
    const { user_id, title, description, project_type, steps } = data;

    if (!user_id || !title) {
      return response(400, {
        error: "Missing required fields: user_id, title",
      });
    }

    const project = await createProject({
      user_id,
      title,
      description,
      project_type,
    });

    if (!project) {
      return response(500, { error: "Failed to create project" });
    }

    if (steps && Array.isArray(steps)) {
      await Promise.all(
        steps.map((step, i) =>
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

  if (action === "run") {
    const { project_id } = data;

    if (!project_id) {
      return response(400, { error: "Missing required field: project_id" });
    }

    const result = await runWorkflow(project_id);
    return response(200, result);
  }

  return response(400, {
    error: "Invalid workflow action. Use 'create_project' or 'run'.",
  });
}

// ---------------------------------------------------------------------------
// Realtime handler – mirrors start-session.js and end-session.js
// ---------------------------------------------------------------------------

async function handleRealtime(data) {
  const { action } = data;

  if (action === "start") {
    const { user_id, session_type, metadata } = data;

    if (!user_id || !session_type) {
      return response(400, {
        error: "Missing required fields: user_id, session_type",
      });
    }

    const session = await createSession({ user_id, session_type, metadata });
    return response(200, { session });
  }

  if (action === "end") {
    const { session_id } = data;

    if (!session_id) {
      return response(400, { error: "Missing required field: session_id" });
    }

    const existing = await getSession(session_id);

    if (!existing) {
      return response(404, { error: "Session not found" });
    }

    if (existing.status !== "active") {
      return response(409, { error: "Session is not active" });
    }

    const session = await endSession(session_id);
    return response(200, { session });
  }

  return response(400, {
    error: "Invalid realtime action. Use 'start' or 'end'.",
  });
}

// ---------------------------------------------------------------------------
// Main gateway handler
// ---------------------------------------------------------------------------

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return response(405, { error: "Method not allowed" });
  }

  try {
    const body = JSON.parse(event.body);
    const { type, data: requestData, action } = body;

    // Support both nested { type, data } and flat payloads where data fields
    // sit alongside type/action at the top level.
    const payload = requestData || body;

    // Carry action into payload so handlers can read it uniformly.
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

      case "realtime":
        return await handleRealtime(payload);

      default:
        return response(400, { error: "Invalid request type" });
    }
  } catch (err) {
    console.error("AI Gateway error:", err);
    return response(500, { error: "AI provider temporarily unavailable" });
  }
}
