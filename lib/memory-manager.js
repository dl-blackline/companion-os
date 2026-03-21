import { supabase } from "./_supabase.js";
import { generateEmbedding } from "./openai-client.js";
import { route } from "./ai-router.js";

// Minimum messages in a conversation before auto-generating a summary
const SUMMARY_THRESHOLD = 10;

// Prefixes for instruction/preference memories — used during storage and retrieval
export const INSTRUCTION_PREFIX = "[USER INSTRUCTION] ";
export const PREFERENCE_PREFIX = "[USER PREFERENCE] ";

/**
 * Classify a conversation message into memory types using AI.
 * Enhanced to detect user instructions, preferences, and behavioral directives.
 * Returns an object with classification results.
 */
export async function classifyMemory(message, conversationHistory) {
  const classificationPrompt = {
    system: `You are an advanced memory classification system. Analyze the user message and conversation context to determine what types of memory should be stored.

Respond with valid JSON only. No markdown, no explanation.

{
  "episodic": { "store": boolean, "event": "string or null" },
  "relationship": { "store": boolean, "memory": "string or null" },
  "instruction": { "store": boolean, "content": "string or null" },
  "preference": { "store": boolean, "content": "string or null" },
  "summary": { "store": boolean },
  "importance_score": number between 0 and 1,
  "is_behavioral_directive": boolean,
  "memory_type": "fact|instruction|preference|episodic|relationship|workflow|context|correction"
}

Rules:
- episodic.store = true when the message references major life events, important projects, new long-term goals, milestones, or significant changes.
- relationship.store = true when the message reveals user preferences, values, communication style, recurring patterns, or personal insights.
- instruction.store = true when the user gives an explicit directive about how the AI should behave, respond, format output, or handle tasks. Examples: "always respond in bullet points", "call me Alex", "never use emojis", "be more direct".
- preference.store = true when the user states a preference or like/dislike. Examples: "I prefer concise responses", "I like dark mode", "I work in Python mostly".
- summary.store = true when the conversation is long or contains important planning/analysis.
- is_behavioral_directive = true if the user is telling the AI to change its behavior in future interactions.
- importance_score reflects how significant this is for long-term user understanding.
- memory_type classifies the overall category of the memory.

High importance signals: explicit instructions, personal preferences, goals, repeated topics, strategic planning, corrections of AI behavior.`,
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

    const parsed = parseClassificationResult(result);
    return parsed;
  } catch (err) {
    console.error("Memory classification error:", err.message);
    return {
      episodic: { store: false, event: null },
      relationship: { store: false, memory: null },
      instruction: { store: false, content: null },
      preference: { store: false, content: null },
      summary: { store: false },
      importance_score: 0.3,
      is_behavioral_directive: false,
      memory_type: "fact",
    };
  }
}

/**
 * Parse and normalize classification result from AI response.
 */
function parseClassificationResult(result) {
  let parsed;
  try {
    parsed = JSON.parse(result);
  } catch {
    // Try extracting JSON from text
    const match = (result || "").match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch { /* fall through */ }
    }
    if (!parsed) {
      return {
        episodic: { store: false, event: null },
        relationship: { store: false, memory: null },
        instruction: { store: false, content: null },
        preference: { store: false, content: null },
        summary: { store: false },
        importance_score: 0.3,
        is_behavioral_directive: false,
        memory_type: "fact",
      };
    }
  }

  return {
    episodic: parsed.episodic || { store: false, event: null },
    relationship: parsed.relationship || { store: false, memory: null },
    instruction: parsed.instruction || { store: false, content: null },
    preference: parsed.preference || { store: false, content: null },
    summary: parsed.summary || { store: false },
    importance_score: typeof parsed.importance_score === "number"
      ? Math.max(0, Math.min(1, parsed.importance_score))
      : 0.5,
    is_behavioral_directive: Boolean(parsed.is_behavioral_directive),
    memory_type: parsed.memory_type || "fact",
  };
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
 * Now handles instructions and preferences as high-priority memory items.
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

  // Store user instructions as high-priority relationship memories
  if (classification.instruction?.store && classification.instruction?.content) {
    tasks.push(
      storeRelationshipMemory({
        user_id,
        memory: `${INSTRUCTION_PREFIX}${classification.instruction.content}`,
        importance_score: Math.max(classification.importance_score || 0.8, 0.8),
      })
    );
  }

  // Store user preferences as relationship memories
  if (classification.preference?.store && classification.preference?.content) {
    tasks.push(
      storeRelationshipMemory({
        user_id,
        memory: `${PREFERENCE_PREFIX}${classification.preference.content}`,
        importance_score: Math.max(classification.importance_score || 0.7, 0.7),
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
