import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "../../lib/openai-client.js";
import { runAI } from "../../lib/ai-router.js";
import { orchestrate } from "../../lib/orchestrator.js";
import { processMemory } from "../../lib/memory-manager.js";
import { processKnowledgeGraph } from "../../lib/knowledge-graph.js";
import { detectEmotions, storeEmotionalSignals } from "../../lib/emotion-detector.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getRecentConversation(conversation_id) {
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

async function saveMessage({ conversation_id, user_id, role, content, embedding }) {
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

const FALLBACK_SYSTEM_PROMPT = "You are a helpful assistant.";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  let message;

  try {
    const body = JSON.parse(event.body);
    const { conversation_id, user_id } = body;
    message = body.message;

    if (!conversation_id || !user_id || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields: conversation_id, user_id, message" }),
      };
    }

    // 1. Run the orchestrator pipeline
    //    message → intent detection → context retrieval → planning
    //    → tool execution → AI router → critic agent → final response
    const result = await orchestrate({
      message,
      user_id,
      conversation_id,
      getRecentConversation,
    });

    // 2. For media results, return the media payload directly
    if (result.isMedia) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          response: result.response,
          intent: result.intent,
        }),
      };
    }

    // 3. Save both the user message and the assistant response
    const assistantEmbedding = await generateEmbedding(result.response);

    await Promise.all([
      saveMessage({
        conversation_id,
        user_id,
        role: "user",
        content: message,
        embedding: result.embedding,
      }),
      saveMessage({
        conversation_id,
        user_id,
        role: "assistant",
        content: result.response,
        embedding: assistantEmbedding,
      }),
    ]);

    // 4. Post-response memory processing (non-blocking)
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
      detectEmotions(message).then((signals) =>
        storeEmotionalSignals({
          user_id,
          conversation_id,
          signals,
          source_message: message,
        })
      ).catch((err) => {
        console.error("Emotion processing error:", err.message);
      }),
    ]);

    return {
      statusCode: 200,
      body: JSON.stringify({
        response: result.response,
        intent: result.intent,
      }),
    };
  } catch (err) {
    // Orchestration failed — attempt a direct AI response via the resilient
    // router so the user still receives a meaningful reply.
    if (message) {
      try {
        const response = await runAI({
          system: FALLBACK_SYSTEM_PROMPT,
          user: message,
        });
        return {
          statusCode: 200,
          body: JSON.stringify({ response }),
        };
      } catch (fallbackErr) {
        console.error("Fallback AI call also failed:", fallbackErr.message);
      }
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "AI provider temporarily unavailable" }),
    };
  }
}
