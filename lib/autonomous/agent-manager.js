import { createClient } from "@supabase/supabase-js";
import { route } from "../ai-router.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Safely parse a JSON response from the AI, returning a fallback on failure.
 */
function safeParseJSON(text, fallback = { insights: [] }) {
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("JSON parse error:", err.message, "| Raw response:", text);
    return fallback;
  }
}

/**
 * Agent definitions keyed by task_type.
 * Each agent has a name, description, and an execute function.
 */
const AGENTS = {
  goal_analysis: {
    name: "Goal Analyst",
    description: "Evaluate user goals and suggest improvements.",
    async execute(user_id, payload) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("goals, interests, preferences")
        .eq("user_id", user_id)
        .single();

      const goals = profile?.goals || [];
      const interests = profile?.interests || [];

      const prompt = {
        system: `You are a goal analysis agent. Evaluate the user's goals and suggest improvements, new sub-goals, or identify potential conflicts.

Respond with valid JSON only. No markdown, no explanation.

{
  "insights": [
    { "insight": "string", "confidence": number between 0 and 1 }
  ]
}

Rules:
- Provide actionable, specific insights.
- If goals are empty, suggest that the user define goals based on their interests.
- confidence reflects how certain you are about the insight.`,
        user: `User goals: ${JSON.stringify(goals)}
User interests: ${JSON.stringify(interests)}`,
      };

      const result = await route({ task: "chat", prompt });
      return safeParseJSON(result);
    },
  },

  memory_consolidation: {
    name: "Memory Consolidator",
    description: "Summarize recent conversations and store summaries.",
    async execute(user_id, payload) {
      const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      const { data: messages } = await supabase
        .from("messages")
        .select("role, content, created_at")
        .eq("user_id", user_id)
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(50);

      if (!messages || messages.length < 3) {
        return { insights: [], summary: null };
      }

      const conversationText = messages
        .map((m) => `[${m.role}]: ${m.content}`)
        .join("\n");

      const prompt = {
        system: `You are a memory consolidation agent. Analyze the recent conversation and produce a concise summary and any recurring themes or patterns.

Respond with valid JSON only. No markdown, no explanation.

{
  "summary": "string",
  "insights": [
    { "insight": "string", "confidence": number between 0 and 1 }
  ]
}

Rules:
- The summary should capture key topics, decisions, and action items.
- Insights should highlight recurring themes or patterns across the conversation.
- Keep the summary under 300 words.`,
        user: conversationText,
      };

      const result = await route({ task: "chat", prompt });
      return safeParseJSON(result);
    },
  },

  knowledge_graph_update: {
    name: "Knowledge Graph Updater",
    description: "Extract new entities and relationships from recent data.",
    async execute(user_id, payload) {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      const { data: messages } = await supabase
        .from("messages")
        .select("content")
        .eq("user_id", user_id)
        .eq("role", "user")
        .gte("created_at", since)
        .order("created_at", { ascending: true })
        .limit(30);

      if (!messages || messages.length === 0) {
        return { insights: [] };
      }

      const combinedText = messages.map((m) => m.content).join("\n");

      const prompt = {
        system: `You are a knowledge graph analysis agent. Analyze the user messages and identify new entities and relationships that should be tracked. Also identify patterns worth noting.

Respond with valid JSON only. No markdown, no explanation.

{
  "entities": [
    { "entity": "string", "entity_type": "string" }
  ],
  "relationships": [
    { "source_entity": "string", "target_entity": "string", "relationship": "string" }
  ],
  "insights": [
    { "insight": "string", "confidence": number between 0 and 1 }
  ]
}

Entity types include: person, organization, project, technology, location, concept, goal, event.`,
        user: combinedText,
      };

      const result = await route({ task: "chat", prompt });
      return safeParseJSON(result);
    },
  },

  project_monitor: {
    name: "Project Monitor",
    description: "Track project progress and identify blockers.",
    async execute(user_id, payload) {
      const { data: nodes } = await supabase
        .from("knowledge_nodes")
        .select("entity, entity_type")
        .eq("user_id", user_id)
        .eq("entity_type", "project");

      const { data: edges } = await supabase
        .from("knowledge_edges")
        .select("source_entity, target_entity, relationship")
        .eq("user_id", user_id);

      const { data: recentMessages } = await supabase
        .from("messages")
        .select("content")
        .eq("user_id", user_id)
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(20);

      const prompt = {
        system: `You are a project monitoring agent. Analyze the user's projects and recent conversations to identify progress, blockers, and next steps.

Respond with valid JSON only. No markdown, no explanation.

{
  "insights": [
    { "insight": "string", "confidence": number between 0 and 1 }
  ]
}

Rules:
- Focus on actionable observations about project status.
- Identify potential blockers or stalled progress.
- Suggest next steps when appropriate.`,
        user: `Projects: ${JSON.stringify(nodes || [])}
Relationships: ${JSON.stringify(edges || [])}
Recent messages: ${(recentMessages || []).map((m) => m.content).join("\n")}`,
      };

      const result = await route({ task: "chat", prompt });
      return safeParseJSON(result);
    },
  },

  content_advisor: {
    name: "Content Advisor",
    description: "Suggest media or content ideas based on user context.",
    async execute(user_id, payload) {
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("interests, goals, preferences")
        .eq("user_id", user_id)
        .single();

      const { data: recentMessages } = await supabase
        .from("messages")
        .select("content")
        .eq("user_id", user_id)
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(15);

      const prompt = {
        system: `You are a content advisory agent. Based on the user's profile and recent conversations, suggest relevant media or content ideas they might benefit from.

Respond with valid JSON only. No markdown, no explanation.

{
  "insights": [
    { "insight": "string", "confidence": number between 0 and 1 }
  ]
}

Rules:
- Suggest specific, actionable content ideas (articles, videos, images, music).
- Relate suggestions to user interests and current projects.
- Include both creative and practical suggestions.`,
        user: `Profile: ${JSON.stringify(profile || {})}
Recent messages: ${(recentMessages || []).map((m) => m.content).join("\n")}`,
      };

      const result = await route({ task: "chat", prompt });
      return safeParseJSON(result);
    },
  },
};

/**
 * Retrieve all active agent definitions.
 */
export function getActiveAgents() {
  return Object.entries(AGENTS).map(([type, agent]) => ({
    type,
    name: agent.name,
    description: agent.description,
  }));
}

/**
 * Fetch pending tasks from the database.
 */
export async function getPendingTasks(limit = 10) {
  const { data, error } = await supabase
    .from("autonomous_tasks")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("Fetch pending tasks error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Create a new autonomous task.
 */
export async function createTask({ user_id, task_type, task_payload = {} }) {
  if (!AGENTS[task_type]) {
    throw new Error(`Unknown task type: ${task_type}`);
  }

  const { data, error } = await supabase
    .from("autonomous_tasks")
    .insert({ user_id, task_type, task_payload })
    .select()
    .single();

  if (error) {
    console.error("Create task error:", error.message);
    return null;
  }

  return data;
}

/**
 * Process a single task by executing the corresponding agent.
 */
export async function processTask(task) {
  const agent = AGENTS[task.task_type];
  if (!agent) {
    console.error(`No agent found for task type: ${task.task_type}`);
    return;
  }

  await supabase
    .from("autonomous_tasks")
    .update({ status: "processing" })
    .eq("id", task.id);

  try {
    const result = await agent.execute(task.user_id, task.task_payload);

    await supabase
      .from("autonomous_tasks")
      .update({
        status: "completed",
        result,
        completed_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    if (result?.insights && result.insights.length > 0) {
      await storeInsights(task.user_id, task.task_type, result.insights);
    }

    return result;
  } catch (err) {
    console.error(`Agent ${agent.name} error:`, err.message);

    await supabase
      .from("autonomous_tasks")
      .update({ status: "failed", result: { error: err.message } })
      .eq("id", task.id);

    return null;
  }
}

/**
 * Process all pending tasks in the queue.
 */
export async function processPendingTasks() {
  const tasks = await getPendingTasks();

  const settled = await Promise.allSettled(
    tasks.map((task) => processTask(task).then((result) => ({
      taskId: task.id,
      taskType: task.task_type,
      result,
    })))
  );

  return settled
    .filter((s) => s.status === "fulfilled")
    .map((s) => s.value);
}

/**
 * Store generated insights in the database.
 */
export async function storeInsights(user_id, agent_type, insights) {
  const rows = insights.map((item) => ({
    user_id,
    agent_type,
    insight: item.insight,
    confidence: item.confidence ?? 0.5,
  }));

  const { error } = await supabase.from("autonomous_insights").insert(rows);

  if (error) {
    console.error("Store insights error:", error.message);
  }
}

/**
 * Retrieve recent insights for a user.
 */
export async function getInsights(user_id, { limit = 10, acknowledged } = {}) {
  let query = supabase
    .from("autonomous_insights")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (acknowledged !== undefined) {
    query = query.eq("acknowledged", acknowledged);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Get insights error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Generate proactive insights for a user by running all agents.
 */
export async function generateInsights(user_id) {
  const agentTypes = Object.keys(AGENTS);
  const results = [];

  for (const taskType of agentTypes) {
    const task = await createTask({ user_id, task_type: taskType });
    if (task) {
      const result = await processTask(task);
      results.push({ taskType, result });
    }
  }

  return results;
}
