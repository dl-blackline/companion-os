/**
 * gateway/chat-handler.js — Chat, memory, and stream domain handler.
 *
 * Covers request types: chat, memory, stream
 */

import { supabase } from "../../../lib/_supabase.js";
import {
  orchestrate,
  orchestrateSimple,
  orchestrateEmbed,
} from "../../../services/ai/orchestrator.js";
import { analyzeImage, describeVideo } from "../../../lib/vision-analyzer.js";
import { ok, fail, raw, CORS_HEADERS } from "../../../lib/_responses.js";
import { log } from "../../../lib/_log.js";

/* ── Conversation persistence helpers ─────────────────────────────────────── */

async function getRecentConversation(sb, conversation_id) {
  if (!sb || !conversation_id) return [];
  const table = process.env.CHAT_HISTORY_TABLE || "messages";
  const { data } = await sb
    .from(table)
    .select("role, content")
    .eq("conversation_id", conversation_id)
    .order("created_at", { ascending: false })
    .limit(10);
  return (data || []).reverse();
}

async function saveMessage(
  sb,
  { conversation_id, user_id, role, content, embedding, media_url, media_type },
) {
  if (!sb) return;
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
  await sb.from(table).insert(row);
}

/* ── Chat handler ─────────────────────────────────────────────────────────── */

export async function handleChat(data) {
  const {
    conversation_id,
    user_id,
    message,
    model,
    stream,
    media_url,
    media_type,
    conversation_history,
  } = data;

  if (!conversation_id || !user_id || !message) {
    return fail(
      "Missing required fields: conversation_id, user_id, message",
      "ERR_VALIDATION",
      400,
    );
  }

  const resolveHistory = async (convId) => {
    if (Array.isArray(conversation_history) && conversation_history.length > 0) {
      return conversation_history.slice(-10);
    }
    return getRecentConversation(supabase, convId);
  };

  try {
    /* ── Vision analysis (if media attached) ────────────────────────────── */
    let visionAnalysis = null;
    let recentHistory = [];

    if (media_url) {
      try {
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

    /* If vision analysis succeeded, use it directly */
    if (visionAnalysis) {
      let assistantEmbedding = null;
      try {
        assistantEmbedding = await orchestrateEmbed(visionAnalysis);
      } catch (err) {
        log.warn("[ai]", "embedding generation failed:", err.message);
      }

      await Promise.all([
        saveMessage(supabase, {
          conversation_id, user_id, role: "user",
          content: message, embedding: null, media_url, media_type,
        }),
        saveMessage(supabase, {
          conversation_id, user_id, role: "assistant",
          content: visionAnalysis, embedding: assistantEmbedding,
        }),
      ]);

      return ok({
        response: visionAnalysis,
        intent: { intent: "vision_analysis", confidence: 1 },
      });
    }

    /* ── Companion brain orchestration ──────────────────────────────────── */
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

    const isMediaResponse =
      result.isMedia &&
      result.response &&
      typeof result.response === "object" &&
      result.response.url;

    const mediaTypeLabel = isMediaResponse ? (result.response.type || "media") : null;
    const dbMediaType = isMediaResponse
      ? result.response.type === "video" ? "video" : "image"
      : null;
    const assistantTextContent = isMediaResponse
      ? `[${mediaTypeLabel} generated]`
      : result.response;

    let assistantEmbedding = null;
    try {
      assistantEmbedding = await orchestrateEmbed(assistantTextContent);
    } catch (err) {
      log.warn("[ai]", "embedding generation failed:", err.message);
    }

    await Promise.all([
      saveMessage(supabase, {
        conversation_id, user_id, role: "user",
        content: message, embedding: result.context?.embedding || null,
      }),
      saveMessage(supabase, {
        conversation_id, user_id, role: "assistant",
        content: assistantTextContent, embedding: assistantEmbedding,
        ...(isMediaResponse && { media_url: result.response.url }),
        ...(isMediaResponse && { media_type: dbMediaType }),
      }),
    ]);

    /* ── Streaming vs standard response ─────────────────────────────────── */
    if (stream && !isMediaResponse) {
      const chunks = [];
      const tokens = result.response.split(" ");
      for (let i = 0; i < tokens.length; i++) {
        chunks.push(
          JSON.stringify({
            token: i < tokens.length - 1 ? tokens[i] + " " : tokens[i],
            done: false,
          }) + "\n",
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
      return raw(200, {
        response: "I'm having trouble right now. Please try again in a moment.",
      });
    }
  }
}

/* ── Memory handler ───────────────────────────────────────────────────────── */

export async function handleMemory(data) {
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
