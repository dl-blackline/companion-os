import { createClient } from "@supabase/supabase-js";
import { route } from "./ai-router.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Extract entities, relationships, topics, and intent from conversation text using AI.
 * Returns structured knowledge with confidence scores for each extraction.
 */
export async function extractKnowledge(message) {
  const extractionPrompt = {
    system: `You are an advanced knowledge extraction and analysis engine. Analyze the user message and extract structured knowledge.

Respond with valid JSON only. No markdown, no explanation.

{
  "nodes": [
    { "entity": "string", "entity_type": "string", "confidence": 0.0-1.0 }
  ],
  "edges": [
    { "source_entity": "string", "target_entity": "string", "relationship": "string", "confidence": 0.0-1.0 }
  ],
  "topics": [
    { "name": "string", "relevance": 0.0-1.0 }
  ],
  "intent": "inform|question|request|plan|analyze|compare|brainstorm|decide|review|unknown",
  "key_insights": ["string"],
  "detected_patterns": ["string"]
}

Entity types include: person, organization, project, technology, location, concept, goal, event, date, metric.

Rules:
- Only extract clearly stated entities and relationships — no speculation.
- The user themselves should be represented as "user" entity with type "person".
- Keep entity names concise and lowercase.
- Deduplicate entities by name.
- Relationship descriptions should be short action phrases (e.g., "owns", "works at", "is building", "prefers").
- Include confidence scores (0.0–1.0) for each extraction based on how explicitly it is stated.
- Topics represent the main subjects discussed, ranked by relevance.
- Key insights are non-obvious observations or patterns you detect.
- Return empty arrays if no meaningful items are found for a given section.`,
    user: message,
  };

  try {
    const result = await route({
      task: "chat",
      prompt: extractionPrompt,
    });

    const parsed = parseJsonSafe(result);
    if (!parsed) return { nodes: [], edges: [], topics: [], intent: "unknown", key_insights: [], detected_patterns: [] };

    // Normalize and validate extracted data
    return {
      nodes: normalizeNodes(parsed.nodes),
      edges: normalizeEdges(parsed.edges),
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      intent: parsed.intent || "unknown",
      key_insights: Array.isArray(parsed.key_insights) ? parsed.key_insights : [],
      detected_patterns: Array.isArray(parsed.detected_patterns) ? parsed.detected_patterns : [],
    };
  } catch (err) {
    console.error("Knowledge extraction error:", err.message);
    return { nodes: [], edges: [], topics: [], intent: "unknown", key_insights: [], detected_patterns: [] };
  }
}

/**
 * Safely parse JSON from AI response, handling markdown code fences.
 */
function parseJsonSafe(text) {
  if (!text || typeof text !== "string") return null;
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting from markdown code block
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match && match[1]) {
      try { return JSON.parse(match[1].trim()); } catch { /* fall through */ }
    }
    // Try extracting raw JSON object
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try { return JSON.parse(text.slice(start, end + 1)); } catch { /* fall through */ }
    }
    return null;
  }
}

/**
 * Normalize extracted nodes — deduplicate, validate types, enforce lowercase.
 */
function normalizeNodes(nodes) {
  if (!Array.isArray(nodes)) return [];
  const validTypes = new Set(["person", "organization", "project", "technology", "location", "concept", "goal", "event", "date", "metric"]);
  const seen = new Set();
  return nodes
    .filter((n) => n && typeof n.entity === "string" && n.entity.trim())
    .map((n) => ({
      entity: n.entity.trim().toLowerCase(),
      entity_type: validTypes.has(n.entity_type) ? n.entity_type : "concept",
      confidence: typeof n.confidence === "number" ? Math.max(0, Math.min(1, n.confidence)) : 0.7,
    }))
    .filter((n) => {
      const key = `${n.entity}:${n.entity_type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Normalize extracted edges — validate structure, deduplicate.
 */
function normalizeEdges(edges) {
  if (!Array.isArray(edges)) return [];
  const seen = new Set();
  return edges
    .filter((e) => e && e.source_entity && e.target_entity && e.relationship)
    .map((e) => ({
      source_entity: String(e.source_entity).trim().toLowerCase(),
      target_entity: String(e.target_entity).trim().toLowerCase(),
      relationship: String(e.relationship).trim().toLowerCase(),
      confidence: typeof e.confidence === "number" ? Math.max(0, Math.min(1, e.confidence)) : 0.7,
    }))
    .filter((e) => {
      const key = `${e.source_entity}:${e.target_entity}:${e.relationship}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/**
 * Store knowledge nodes in the database, avoiding duplicates.
 */
export async function storeNodes(user_id, nodes) {
  if (!nodes || nodes.length === 0) return;

  for (const node of nodes) {
    const { data: existing } = await supabase
      .from("knowledge_nodes")
      .select("id")
      .eq("user_id", user_id)
      .eq("entity", node.entity)
      .eq("entity_type", node.entity_type)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const { error } = await supabase.from("knowledge_nodes").insert({
      user_id,
      entity: node.entity,
      entity_type: node.entity_type,
    });

    if (error) {
      console.error("Store knowledge node error:", error.message);
    }
  }
}

/**
 * Store knowledge edges in the database, avoiding duplicates.
 */
export async function storeEdges(user_id, edges) {
  if (!edges || edges.length === 0) return;

  for (const edge of edges) {
    const { data: existing } = await supabase
      .from("knowledge_edges")
      .select("id")
      .eq("user_id", user_id)
      .eq("source_entity", edge.source_entity)
      .eq("target_entity", edge.target_entity)
      .eq("relationship", edge.relationship)
      .limit(1);

    if (existing && existing.length > 0) continue;

    const { error } = await supabase.from("knowledge_edges").insert({
      user_id,
      source_entity: edge.source_entity,
      target_entity: edge.target_entity,
      relationship: edge.relationship,
    });

    if (error) {
      console.error("Store knowledge edge error:", error.message);
    }
  }
}

/**
 * Process a message through the knowledge graph pipeline.
 * Extracts entities and relationships and stores them.
 */
export async function processKnowledgeGraph(user_id, message) {
  const knowledge = await extractKnowledge(message);

  await Promise.allSettled([
    storeNodes(user_id, knowledge.nodes),
    storeEdges(user_id, knowledge.edges),
  ]);

  return knowledge;
}

/**
 * Retrieve knowledge graph nodes for a user.
 */
export async function getKnowledgeNodes(user_id) {
  const { data, error } = await supabase
    .from("knowledge_nodes")
    .select("entity, entity_type")
    .eq("user_id", user_id);

  if (error) {
    console.error("Get knowledge nodes error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Retrieve knowledge graph edges for a user.
 */
export async function getKnowledgeEdges(user_id) {
  const { data, error } = await supabase
    .from("knowledge_edges")
    .select("source_entity, target_entity, relationship")
    .eq("user_id", user_id);

  if (error) {
    console.error("Get knowledge edges error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Build a formatted knowledge graph context string for prompt injection.
 * Produces a structured, prioritized summary of the user's knowledge graph.
 */
export async function buildKnowledgeGraphContext(user_id) {
  const [nodes, edges] = await Promise.all([
    getKnowledgeNodes(user_id),
    getKnowledgeEdges(user_id),
  ]);

  if (nodes.length === 0 && edges.length === 0) {
    return "";
  }

  const parts = [];

  if (nodes.length > 0) {
    // Group entities by type for better readability
    const grouped = {};
    for (const n of nodes) {
      const type = n.entity_type || "other";
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push(n.entity);
    }
    const lines = Object.entries(grouped)
      .map(([type, entities]) => `  ${type}: ${entities.join(", ")}`)
      .join("\n");
    parts.push(`Known entities:\n${lines}`);
  }

  if (edges.length > 0) {
    const edgeList = edges
      .map((e) => `- ${e.source_entity} → ${e.relationship} → ${e.target_entity}`)
      .join("\n");
    parts.push(`Known relationships:\n${edgeList}`);
  }

  return parts.join("\n\n");
}
