import { createClient } from "@supabase/supabase-js";
import { route } from "./ai-router.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Extract entities and relationships from conversation text using AI.
 */
export async function extractKnowledge(message) {
  const extractionPrompt = {
    system: `You are a knowledge extraction system. Analyze the user message and extract entities and relationships.

Respond with valid JSON only. No markdown, no explanation.

{
  "nodes": [
    { "entity": "string", "entity_type": "string" }
  ],
  "edges": [
    { "source_entity": "string", "target_entity": "string", "relationship": "string" }
  ]
}

Entity types include: person, organization, project, technology, location, concept, goal, event.

Rules:
- Only extract clearly stated entities and relationships.
- The user themselves should be represented as "user" entity with type "person".
- Keep entity names concise and lowercase.
- Relationship descriptions should be short action phrases (e.g., "owns", "works at", "is building", "prefers").
- Return empty arrays if no meaningful entities or relationships are found.`,
    user: message,
  };

  try {
    const result = await route({
      task: "chat",
      prompt: extractionPrompt,
    });

    return JSON.parse(result);
  } catch (err) {
    console.error("Knowledge extraction error:", err.message);
    return { nodes: [], edges: [] };
  }
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
    const nodeList = nodes
      .map((n) => `- ${n.entity} (${n.entity_type})`)
      .join("\n");
    parts.push(`Known entities:\n${nodeList}`);
  }

  if (edges.length > 0) {
    const edgeList = edges
      .map((e) => `- ${e.source_entity} → ${e.relationship} → ${e.target_entity}`)
      .join("\n");
    parts.push(`Known relationships:\n${edgeList}`);
  }

  return parts.join("\n\n");
}
