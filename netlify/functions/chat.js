import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "../../lib/openai-client.js";
import { route } from "../../lib/ai-router.js";
import {
  searchEpisodicMemory,
  searchRelationshipMemory,
  searchMemorySummaries,
  getUserProfile,
  processMemory,
} from "../../lib/memory-manager.js";
import {
  processKnowledgeGraph,
  buildKnowledgeGraphContext,
} from "../../lib/knowledge-graph.js";
import { buildSystemPrompt } from "../../lib/system-prompt.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function searchShortTermMemory(embedding) {
  const { data, error } = await supabase.rpc("match_messages", {
    query_embedding: embedding,
    match_count: 5,
  });

  if (error) {
    console.error("Short-term memory search error:", error.message);
    return [];
  }

  return data || [];
}

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

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  try {
    const { conversation_id, user_id, message } = JSON.parse(event.body);

    if (!conversation_id || !user_id || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields: conversation_id, user_id, message" }),
      };
    }

    // 1. Generate embedding for the user message
    const embedding = await generateEmbedding(message);

    // 2. Hierarchical memory retrieval (parallel)
    const [
      semanticMemories,
      episodicMemories,
      relationshipMemories,
      memorySummaries,
      userProfile,
      knowledgeGraphContext,
      recentConversation,
    ] = await Promise.all([
      searchShortTermMemory(embedding),
      searchEpisodicMemory(embedding, user_id),
      searchRelationshipMemory(embedding, user_id),
      searchMemorySummaries(embedding, user_id),
      getUserProfile(user_id),
      buildKnowledgeGraphContext(user_id),
      getRecentConversation(conversation_id),
    ]);

    // 3. Build hierarchical system prompt with all memory layers
    const systemPrompt = buildSystemPrompt({
      userProfile,
      relationshipMemories,
      episodicMemories,
      memorySummaries,
      knowledgeGraphContext,
      recentConversation,
      semanticMemories,
    });

    // 4. Send prompt to AI Router
    const assistantResponse = await route({
      task: "chat",
      prompt: { system: systemPrompt, user: message },
    });

    // 5. Save both the user message and the assistant response
    const assistantEmbedding = await generateEmbedding(assistantResponse);

    await Promise.all([
      saveMessage({
        conversation_id,
        user_id,
        role: "user",
        content: message,
        embedding,
      }),
      saveMessage({
        conversation_id,
        user_id,
        role: "assistant",
        content: assistantResponse,
        embedding: assistantEmbedding,
      }),
    ]);

    // 6. Post-response memory processing (non-blocking)
    const conversationHistory = recentConversation
      .map((m) => `[${m.role}]: ${m.content}`)
      .join("\n");

    Promise.allSettled([
      processMemory({
        user_id,
        conversation_id,
        message,
        conversationHistory,
        messageCount: recentConversation.length,
      }),
      processKnowledgeGraph(user_id, message),
    ]).catch((err) => {
      console.error("Background memory processing error:", err.message);
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ response: assistantResponse }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
