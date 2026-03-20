import { createClient } from "@supabase/supabase-js";
import { embed } from "./ai-client.js";
import {
  classifyMemory,
  storeEpisodicMemory,
  storeRelationshipMemory,
  storeMemorySummary,
  searchEpisodicMemory,
  searchRelationshipMemory,
  searchMemorySummaries,
  getUserProfile,
  processMemory,
  INSTRUCTION_PREFIX,
  PREFERENCE_PREFIX,
} from "./memory-manager.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Unified memory layer.
 *
 * Wraps the existing memory-manager, media-memory, and companion-engine stores
 * behind a single interface that supports:
 *
 *  - **Short-term memory** — recent turns in the current session (brain_memory, type = "short_term")
 *  - **Long-term memory** — persisted facts, instructions, preferences (brain_memory, type = "long_term")
 *  - **Episodic / Relationship / Summary** — delegated to memory-manager
 */

// ── Short-term session memory ───────────────────────────────────────────────

/**
 * Store a short-term memory entry for the current session.
 *
 * @param {{ user_id: string, session_id: string, role: string, content: string, metadata?: object }} params
 */
export async function storeShortTerm({ user_id, session_id, role, content, metadata }) {
  const embeddingVec = await embed(content);
  const { error } = await supabase.from("brain_memory").insert({
    user_id,
    session_id,
    memory_type: "short_term",
    role,
    content,
    embedding: embeddingVec,
    metadata: metadata || {},
  });
  if (error) console.error("storeShortTerm error:", error.message);
}

/**
 * Retrieve recent short-term memory for a session.
 *
 * @param {{ session_id: string, limit?: number }} params
 * @returns {Promise<Array>}
 */
export async function getShortTerm({ session_id, limit = 20 }) {
  const { data, error } = await supabase
    .from("brain_memory")
    .select("role, content, metadata, created_at")
    .eq("session_id", session_id)
    .eq("memory_type", "short_term")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("getShortTerm error:", error.message);
    return [];
  }
  return data || [];
}

// ── Long-term key-fact memory ───────────────────────────────────────────────

/**
 * Store a long-term fact.
 *
 * @param {{ user_id: string, content: string, category?: string, importance?: number, metadata?: object }} params
 */
export async function storeLongTerm({ user_id, content, category, importance, metadata }) {
  const embeddingVec = await embed(content);
  const { error } = await supabase.from("brain_memory").insert({
    user_id,
    memory_type: "long_term",
    category: category || "fact",
    content,
    embedding: embeddingVec,
    importance: importance ?? 0.5,
    metadata: metadata || {},
  });
  if (error) console.error("storeLongTerm error:", error.message);
}

/**
 * Semantic search over long-term memory for a user.
 *
 * @param {{ user_id: string, query: string, limit?: number }} params
 * @returns {Promise<Array>}
 */
export async function searchLongTerm({ user_id, query, limit = 10 }) {
  const queryEmbedding = await embed(query);
  const { data, error } = await supabase.rpc("match_brain_memory", {
    query_embedding: queryEmbedding,
    match_count: limit,
    filter_user_id: user_id,
    filter_type: "long_term",
  });

  if (error) {
    console.error("searchLongTerm error:", error.message);
    return [];
  }
  return data || [];
}

// ── Unified search (across all memory types) ────────────────────────────────

/**
 * Search all memory layers and return a merged result.
 *
 * @param {{ user_id: string, query: string }} params
 * @returns {Promise<object>}
 */
export async function searchAll({ user_id, query }) {
  const queryEmbedding = await embed(query);

  const [episodic, relationship, summaries, longTerm] = await Promise.all([
    searchEpisodicMemory(queryEmbedding, user_id).catch(() => []),
    searchRelationshipMemory(queryEmbedding, user_id).catch(() => []),
    searchMemorySummaries(queryEmbedding, user_id).catch(() => []),
    searchLongTerm({ user_id, query }).catch(() => []),
  ]);

  return { episodic, relationship, summaries, longTerm };
}

// ── Memory processing pipeline ──────────────────────────────────────────────

/**
 * Process a message through the full memory pipeline.
 *
 * Wraps memory-manager's processMemory and additionally extracts key facts
 * into the long-term brain_memory table.
 *
 * @param {{ user_id: string, conversation_id: string, session_id?: string, message: string, conversationHistory: string, messageCount?: number }} params
 * @returns {Promise<object>} classification result
 */
export async function ingest({ user_id, conversation_id, session_id, message, conversationHistory, messageCount }) {
  // Delegate core classification + storage to existing memory-manager
  const classification = await processMemory({
    user_id,
    conversation_id,
    message,
    conversationHistory,
    messageCount: messageCount || 0,
  });

  // Additionally persist key facts to brain_memory long-term store
  if (classification.key_facts && Array.isArray(classification.key_facts)) {
    const factTasks = classification.key_facts.map((fact) =>
      storeLongTerm({
        user_id,
        content: fact,
        category: classification.memory_type || "fact",
        importance: classification.importance_score || 0.5,
      }).catch((err) => console.error(`Long-term fact store error for '${fact.slice(0, 50)}':`, err.message))
    );
    await Promise.allSettled(factTasks);
  }

  // Store the user message in short-term memory if a session_id is provided
  if (session_id) {
    await storeShortTerm({ user_id, session_id, role: "user", content: message }).catch(
      (err) => console.error("Short-term store error:", err.message)
    );
  }

  return classification;
}

// ── Convenience wrappers (required by Companion Brain contract) ─────────────

/**
 * Save a user ↔ assistant interaction.
 *
 * Persists the message to short-term memory (if a session_id is provided) and
 * runs the full memory-manager classification / storage pipeline so that key
 * facts are extracted into long-term memory.
 *
 * @param {{ user_id: string, conversation_id: string, session_id?: string, role: string, content: string, metadata?: object }} params
 * @returns {Promise<object>} classification result (or empty object when skipped).
 */
export async function saveInteraction({ user_id, conversation_id, session_id, role, content, metadata }) {
  // Store to session memory when applicable
  if (session_id) {
    await storeShortTerm({ user_id, session_id, role, content, metadata }).catch((err) =>
      console.error("saveInteraction short-term error:", err.message)
    );
  }

  // Only run full classification pipeline for user messages (assistant
  // responses rarely contain facts worth persisting and would pollute memory).
  if (role === "user") {
    return ingest({
      user_id,
      conversation_id,
      session_id,
      message: content,
      conversationHistory: "",
    });
  }

  return {};
}

/**
 * Retrieve recent context for a user — combines short-term session memory with
 * a semantic search across all long-term memory layers.
 *
 * @param {{ user_id: string, session_id?: string, query?: string, limit?: number }} params
 * @returns {Promise<object>} { shortTerm, episodic, relationship, summaries, longTerm }
 */
export async function getRecentContext({ user_id, session_id, query, limit = 10 }) {
  const [shortTerm, longTermResults] = await Promise.all([
    session_id
      ? getShortTerm({ session_id, limit }).catch(() => [])
      : Promise.resolve([]),
    query
      ? searchAll({ user_id, query }).catch(() => ({ episodic: [], relationship: [], summaries: [], longTerm: [] }))
      : Promise.resolve({ episodic: [], relationship: [], summaries: [], longTerm: [] }),
  ]);

  return { shortTerm, ...longTermResults };
}

/**
 * Summarize a block of memory / conversation into a concise text summary using
 * the AI client and persist the result as a memory summary.
 *
 * @param {{ user_id: string, conversation_id: string, conversationHistory: string }} params
 * @returns {Promise<string>} The generated summary text.
 */
export async function summarizeMemory({ user_id, conversation_id, conversationHistory }) {
  const { chat } = await import("./ai-client.js");
  const { conversationSummary } = await import("./prompt-templates.js");

  const prompt = conversationSummary({ conversationHistory });
  const summary = await chat({ prompt, task: "summarization" });

  // Persist the summary into hierarchical memory
  await storeMemorySummary({
    user_id,
    conversation_id,
    summary,
  }).catch((err) => console.error("summarizeMemory store error:", err.message));

  // Also persist to long-term brain_memory for semantic retrieval
  await storeLongTerm({
    user_id,
    content: summary,
    category: "summary",
    importance: 0.7,
    metadata: { conversation_id },
  }).catch((err) => console.error("summarizeMemory long-term error:", err.message));

  return summary;
}

// ── Re-exports for backward compatibility ───────────────────────────────────

export {
  classifyMemory,
  storeEpisodicMemory,
  storeRelationshipMemory,
  storeMemorySummary,
  searchEpisodicMemory,
  searchRelationshipMemory,
  searchMemorySummaries,
  getUserProfile,
  processMemory,
  INSTRUCTION_PREFIX,
  PREFERENCE_PREFIX,
};
