import { createClient } from "@supabase/supabase-js";
import { generateEmbedding } from "./openai-client.js";
import { route } from "./ai-router.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Minimum messages in a conversation before auto-generating a summary
const SUMMARY_THRESHOLD = 10;

/**
 * Classify a conversation message into memory types using AI.
 * Returns an object with classification results.
 */
export async function classifyMemory(message, conversationHistory) {
  const classificationPrompt = {
    system: `You are a memory classification system. Analyze the user message and conversation context to determine what types of memory should be stored.

Respond with valid JSON only. No markdown, no explanation.

{
  "episodic": { "store": boolean, "event": "string or null" },
  "relationship": { "store": boolean, "memory": "string or null" },
  "summary": { "store": boolean },
  "importance_score": number between 0 and 1
}

Rules:
- episodic.store = true when the message references major life events, important projects, new long-term goals, milestones, or significant changes.
- relationship.store = true when the message reveals user preferences, values, communication style, recurring patterns, or personal insights.
- summary.store = true when the conversation is long (many messages) or contains important planning or analysis.
- importance_score reflects how significant this message is for long-term understanding of the user.

Factors for high importance: explicit goals, personal insights, repeated topics, strategic planning, project discussions.`,
    user: `Conversation context (last messages):
${conversationHistory || "No prior context."}

Current message:
${message}`,
  };

  try {
    const result = await route({
      task: "chat",
      prompt: classificationPrompt,
    });

    return JSON.parse(result);
  } catch (err) {
    console.error("Memory classification error:", err.message);
    return {
      episodic: { store: false, event: null },
      relationship: { store: false, memory: null },
      summary: { store: false },
      importance_score: 0.3,
    };
  }
}

/**
 * Store episodic memory for a user.
 */
export async function storeEpisodicMemory({ user_id, event, importance_score }) {
  const embedding = await generateEmbedding(event);

  const { error } = await supabase.from("episodic_memory").insert({
    user_id,
    event,
    embedding,
    importance_score,
  });

  if (error) {
    console.error("Store episodic memory error:", error.message);
  }
}

/**
 * Store relationship memory for a user.
 */
export async function storeRelationshipMemory({ user_id, memory, importance_score }) {
  const embedding = await generateEmbedding(memory);

  const { error } = await supabase.from("relationship_memory").insert({
    user_id,
    memory,
    embedding,
    importance_score,
  });

  if (error) {
    console.error("Store relationship memory error:", error.message);
  }
}

/**
 * Store a memory summary for a user.
 */
export async function storeMemorySummary({ user_id, summary, source_conversation_id }) {
  const embedding = await generateEmbedding(summary);

  const { error } = await supabase.from("memory_summaries").insert({
    user_id,
    summary,
    embedding,
    source_conversation_id,
  });

  if (error) {
    console.error("Store memory summary error:", error.message);
  }
}

/**
 * Generate a conversation summary using AI.
 */
async function generateSummary(conversationHistory) {
  const summaryPrompt = {
    system: `You are a conversation summarizer. Create a concise but comprehensive summary of the conversation that captures key topics, decisions, insights, and any action items. Keep it under 500 words.`,
    user: conversationHistory,
  };

  return await route({ task: "chat", prompt: summaryPrompt });
}

/**
 * Process a message through the memory pipeline.
 * Classifies and stores memories after a response is generated.
 */
export async function processMemory({
  user_id,
  conversation_id,
  message,
  conversationHistory,
  messageCount,
}) {
  const classification = await classifyMemory(message, conversationHistory);

  const tasks = [];

  if (classification.episodic?.store && classification.episodic?.event) {
    tasks.push(
      storeEpisodicMemory({
        user_id,
        event: classification.episodic.event,
        importance_score: classification.importance_score || 0.5,
      })
    );
  }

  if (classification.relationship?.store && classification.relationship?.memory) {
    tasks.push(
      storeRelationshipMemory({
        user_id,
        memory: classification.relationship.memory,
        importance_score: classification.importance_score || 0.5,
      })
    );
  }

  if (classification.summary?.store || messageCount >= SUMMARY_THRESHOLD) {
    tasks.push(
      generateSummary(conversationHistory).then((summary) =>
        storeMemorySummary({
          user_id,
          summary,
          source_conversation_id: conversation_id,
        })
      )
    );
  }

  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }

  return classification;
}

/**
 * Search episodic memory by embedding similarity.
 */
export async function searchEpisodicMemory(embedding, user_id) {
  const { data, error } = await supabase.rpc("match_episodic_memory", {
    query_embedding: embedding,
    match_count: 5,
    filter_user_id: user_id,
  });

  if (error) {
    console.error("Episodic memory search error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Search relationship memory by embedding similarity.
 */
export async function searchRelationshipMemory(embedding, user_id) {
  const { data, error } = await supabase.rpc("match_relationship_memory", {
    query_embedding: embedding,
    match_count: 5,
    filter_user_id: user_id,
  });

  if (error) {
    console.error("Relationship memory search error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Search memory summaries by embedding similarity.
 */
export async function searchMemorySummaries(embedding, user_id) {
  const { data, error } = await supabase.rpc("match_memory_summaries", {
    query_embedding: embedding,
    match_count: 3,
    filter_user_id: user_id,
  });

  if (error) {
    console.error("Memory summaries search error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Retrieve the user profile from the database.
 */
export async function getUserProfile(user_id) {
  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user_id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Get user profile error:", error.message);
    return null;
  }

  return data;
}
