import { createClient } from "@supabase/supabase-js";
import { detectIntent } from "./intent-detector.js";
import { getToolsForIntent } from "./tool-registry.js";
import { generateEmbedding } from "./openai-client.js";
import { route } from "./ai-router.js";
import {
  searchEpisodicMemory,
  searchRelationshipMemory,
  searchMemorySummaries,
  getUserProfile,
} from "./memory-manager.js";
import { buildKnowledgeGraphContext } from "./knowledge-graph.js";
import { buildSystemPrompt } from "./system-prompt.js";
import { routeMediaRequest, detectMediaType } from "./media-router.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** Minimum confidence to route media_generation directly to the media pipeline. */
const MEDIA_CONFIDENCE_THRESHOLD = 0.8;

/**
 * Log an orchestration action to the database.
 */
async function logAction({ action_type, input, output }) {
  try {
    await supabase.from("orchestrator_actions").insert({
      action_type,
      input: typeof input === "string" ? input : JSON.stringify(input),
      output: typeof output === "string" ? output : JSON.stringify(output),
    });
  } catch (err) {
    console.error("Orchestrator action log error:", err.message);
  }
}

/**
 * Retrieve context from hierarchical memory and knowledge graph in parallel.
 */
async function retrieveContext({ embedding, user_id, conversation_id, getRecentConversation }) {
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

  return {
    semanticMemories,
    episodicMemories,
    relationshipMemories,
    memorySummaries,
    userProfile,
    knowledgeGraphContext,
    recentConversation,
  };
}

/**
 * Short-term memory search via Supabase RPC.
 */
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

/**
 * Planner agent — produces an execution plan based on intent, tools, and context.
 */
async function plan({ message, intent, tools, context }) {
  const toolDescriptions = tools
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");

  const planPrompt = {
    system: `You are a planning agent. Given a user message, detected intent, available tools, and context, produce a concise execution plan.

Respond with valid JSON only. No markdown, no explanation.

{
  "steps": [
    { "tool": "tool_name", "action": "brief description of what to do" }
  ]
}

Available tools:
${toolDescriptions}

Rules:
- Select only the tools necessary to fulfill the request.
- Order steps logically.
- If the intent is "chat", you may return an empty steps array (the AI router handles it directly).
- Keep plans concise — typically 1-3 steps.`,
    user: `Intent: ${intent.intent} (confidence: ${intent.confidence})
User message: ${message}
Context summary: ${context.userProfile ? `User: ${context.userProfile.name || "unknown"}` : "No profile"}${context.knowledgeGraphContext ? `, KG available` : ""}`,
  };

  try {
    const result = await route({ task: "chat", prompt: planPrompt });
    return JSON.parse(result);
  } catch (err) {
    console.error("Planning error:", err.message);
    return { steps: [] };
  }
}

/**
 * Execute a single tool step.
 */
async function executeTool(step, { message, context }) {
  switch (step.tool) {
    case "memory_search":
      return {
        tool: "memory_search",
        result: {
          episodic: context.episodicMemories,
          relationship: context.relationshipMemories,
          summaries: context.memorySummaries,
          semantic: context.semanticMemories,
        },
      };

    case "knowledge_graph_lookup":
      return {
        tool: "knowledge_graph_lookup",
        result: context.knowledgeGraphContext || "No knowledge graph data available.",
      };

    case "image_generation":
    case "video_generation":
    case "music_generation":
    case "voice_generation": {
      const typeMap = {
        image_generation: "image",
        video_generation: "video",
        music_generation: "music",
        voice_generation: "voice",
      };
      const mediaResult = await routeMediaRequest({
        type: typeMap[step.tool],
        prompt: message,
      });
      return { tool: step.tool, result: mediaResult };
    }

    case "content_workflow":
      return {
        tool: "content_workflow",
        result: "Content workflow execution is not yet available.",
      };

    case "goal_manager":
      return {
        tool: "goal_manager",
        result: {
          profile: context.userProfile,
          goals: context.userProfile?.goals || [],
        },
      };

    default:
      return { tool: step.tool, result: null };
  }
}

/**
 * Critic agent — reviews the assistant response and optionally improves it.
 */
async function critique({ message, response, intent }) {
  const criticPrompt = {
    system: `You are a response quality critic. Review the assistant's response for accuracy, relevance, and helpfulness.

If the response is good, return it unchanged.
If it can be meaningfully improved, return the improved version.

Return ONLY the final response text. No meta-commentary, no labels, no explanation.`,
    user: `User message: ${message}
Intent: ${intent.intent}
Assistant response:
${response}`,
  };

  try {
    return await route({ task: "chat", prompt: criticPrompt });
  } catch (err) {
    console.error("Critic error:", err.message);
    return response;
  }
}

/**
 * Main orchestration pipeline.
 *
 * Flow:
 *   User request → intent detection → context retrieval → planner →
 *   tool selection → execution → AI router → critic → final response
 */
export async function orchestrate({
  message,
  user_id,
  conversation_id,
  getRecentConversation,
}) {
  // 1. Intent detection
  const intent = await detectIntent(message);

  await logAction({
    action_type: "intent_detection",
    input: message,
    output: intent,
  });

  // 2. Generate embedding + context retrieval
  const embedding = await generateEmbedding(message);

  const context = await retrieveContext({
    embedding,
    user_id,
    conversation_id,
    getRecentConversation,
  });

  await logAction({
    action_type: "context_retrieval",
    input: { user_id, conversation_id },
    output: {
      hasProfile: !!context.userProfile,
      episodicCount: context.episodicMemories.length,
      relationshipCount: context.relationshipMemories.length,
      summaryCount: context.memorySummaries.length,
      hasKnowledgeGraph: !!context.knowledgeGraphContext,
    },
  });

  // 3. Tool selection based on intent
  const tools = getToolsForIntent(intent.intent);

  // 4. Planner agent
  const executionPlan = await plan({ message, intent, tools, context });

  await logAction({
    action_type: "planning",
    input: { intent: intent.intent, tools: tools.map((t) => t.name) },
    output: executionPlan,
  });

  // 5. Execute tool steps
  const toolResults = [];
  for (const step of executionPlan.steps || []) {
    const result = await executeTool(step, { message, context });
    toolResults.push(result);

    await logAction({
      action_type: "tool_execution",
      input: step,
      output: result,
    });
  }

  // 6. For media_generation with high confidence, return media result directly
  if (intent.intent === "media_generation" && intent.confidence >= MEDIA_CONFIDENCE_THRESHOLD) {
    const mediaResult = toolResults.find(
      (r) =>
        r.tool === "image_generation" ||
        r.tool === "video_generation" ||
        r.tool === "music_generation" ||
        r.tool === "voice_generation"
    );

    if (mediaResult && mediaResult.result && !mediaResult.result.error) {
      await logAction({
        action_type: "media_response",
        input: message,
        output: mediaResult.result,
      });

      return {
        response: mediaResult.result,
        intent,
        toolResults,
        embedding,
        context,
        isMedia: true,
      };
    }
  }

  // 7. Build system prompt and route through AI
  const systemPrompt = buildSystemPrompt({
    userProfile: context.userProfile,
    relationshipMemories: context.relationshipMemories,
    episodicMemories: context.episodicMemories,
    memorySummaries: context.memorySummaries,
    knowledgeGraphContext: context.knowledgeGraphContext,
    recentConversation: context.recentConversation,
    semanticMemories: context.semanticMemories,
  });

  // Augment prompt with tool results if any
  let augmentedMessage = message;
  if (toolResults.length > 0) {
    const toolContext = toolResults
      .filter((r) => r.result)
      .map((r) => `[${r.tool}]: ${typeof r.result === "string" ? r.result : JSON.stringify(r.result)}`)
      .join("\n");

    if (toolContext) {
      augmentedMessage = `${message}\n\n[Tool context]:\n${toolContext}`;
    }
  }

  const assistantResponse = await route({
    task: "chat",
    prompt: { system: systemPrompt, user: augmentedMessage },
  });

  // 8. Critic agent
  const finalResponse = await critique({
    message,
    response: assistantResponse,
    intent,
  });

  await logAction({
    action_type: "final_response",
    input: message,
    output: { intent: intent.intent, responseLength: finalResponse.length },
  });

  return {
    response: finalResponse,
    intent,
    toolResults,
    embedding,
    context,
    isMedia: false,
  };
}
