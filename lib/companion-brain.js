import { createClient } from "@supabase/supabase-js";
import { chat, chatJSON, embed } from "./ai-client.js";
import { assembleContext, summarizeContext, formatContextBlock } from "./context-engine.js";
import { ingest, storeShortTerm } from "./memory-layer.js";
import {
  intentClassification,
  plannerAgent,
  criticAgent,
  contextAwareChat,
  roleplaySession,
  dailyPlan,
  researchTask,
  templates,
} from "./prompt-templates.js";
import { getToolsForIntent } from "./tool-registry.js";
import { routeMediaRequest, detectMediaType } from "./media-router.js";
import { isUnfilteredModel } from "./model-registry.js";
import { searchWeb, formatSearchResults } from "./web-search.js";
import {
  geocodeAddress,
  searchPlaces,
  formatGeocodingResult,
  formatPlacesResults,
} from "./maps-client.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/** Minimum confidence to route media_generation directly to the media pipeline. */
const MEDIA_CONFIDENCE_THRESHOLD = 0.8;

// ── Logging ─────────────────────────────────────────────────────────────────

async function logAction({ action_type, input, output }) {
  try {
    await supabase.from("orchestrator_actions").insert({
      action_type: `brain:${action_type}`,
      input: typeof input === "string" ? input : JSON.stringify(input),
      output: typeof output === "string" ? output : JSON.stringify(output),
    });
  } catch (err) {
    console.error("Brain log error:", err.message);
  }
}

// ── Intent detection ────────────────────────────────────────────────────────

async function detectIntent(message) {
  if (!message) return { intent: "chat", confidence: 1.0, domain: null };

  try {
    const prompt = intentClassification({ message });
    const result = await chatJSON({ prompt });
    return {
      intent: result.intent || "chat",
      confidence: typeof result.confidence === "number" ? result.confidence : 0.5,
      domain: result.domain || null,
    };
  } catch (err) {
    console.error("Brain intent detection error:", err.message);
    return { intent: "chat", confidence: 0.5, domain: null };
  }
}

// ── Planning ────────────────────────────────────────────────────────────────

async function plan({ message, intent, tools, contextSummary }) {
  const toolDescriptions = tools.map((t) => `- ${t.name}: ${t.description}`).join("\n");
  const prompt = plannerAgent({ message, intent, toolDescriptions, contextSummary });

  try {
    return await chatJSON({ prompt });
  } catch (err) {
    console.error("Brain planning error:", err.message);
    return { steps: [] };
  }
}

// ── Tool execution ──────────────────────────────────────────────────────────

async function executeTool(step, { message, context }) {
  switch (step.tool) {
    case "memory_search":
      return {
        tool: "memory_search",
        result: {
          episodic: context.episodicMemories,
          relationship: context.relationshipMemories,
          summaries: context.memorySummaries,
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

    case "web_search": {
      try {
        const results = await searchWeb(message);
        return { tool: "web_search", result: formatSearchResults(message, results) };
      } catch (err) {
        console.error("Web search error:", err.message);
        return { tool: "web_search", result: "Web search failed: " + err.message };
      }
    }

    case "maps_lookup": {
      try {
        const geocoded = await geocodeAddress(message);
        if (geocoded) {
          return { tool: "maps_lookup", result: formatGeocodingResult(message, geocoded) };
        }
        const places = await searchPlaces(message);
        return { tool: "maps_lookup", result: formatPlacesResults(message, places) };
      } catch (err) {
        console.error("Maps lookup error:", err.message);
        return { tool: "maps_lookup", result: "Maps lookup failed: " + err.message };
      }
    }

    default:
      return { tool: step.tool, result: null };
  }
}

// ── Critic ───────────────────────────────────────────────────────────────────

async function critique({ message, response, intent }) {
  try {
    const prompt = criticAgent({ message, response, intent });
    return await chat({ prompt });
  } catch (err) {
    console.error("Brain critic error:", err.message);
    return response;
  }
}

// ── Domain handlers (sub-capabilities) ──────────────────────────────────────

/**
 * Domain handler registry. Each key maps an intent to a handler function.
 * Handlers receive ({ message, context, model }) and return a response string.
 */
const domainHandlers = {
  async roleplay({ message, context, model }) {
    const prompt = roleplaySession({
      character: context.roleplayCharacter || "a creative companion",
      scenario: context.roleplayScenario || "open conversation",
      contextBlock: formatContextBlock(context),
      message,
    });
    return chat({ prompt, model });
  },

  async planning({ message, context, model }) {
    const prompt = dailyPlan({
      contextBlock: formatContextBlock(context),
      message,
    });
    return chat({ prompt, model });
  },

  async research({ message, context, toolResults, model }) {
    const toolContext = (toolResults || [])
      .filter((r) => r.result)
      .map((r) => `[${r.tool}]: ${typeof r.result === "string" ? r.result : JSON.stringify(r.result)}`)
      .join("\n");
    const prompt = researchTask({
      contextBlock: formatContextBlock(context),
      message,
      toolContext,
    });
    return chat({ prompt, model });
  },
};

// ── Main orchestration pipeline ─────────────────────────────────────────────

/**
 * Companion Brain — unified entry point for all AI interactions.
 *
 * Flow:
 *   1. Intent detection
 *   2. Context assembly (context engine)
 *   3. Planning (tool selection)
 *   4. Tool execution
 *   5. Domain routing / AI generation
 *   6. Critic review
 *   7. Memory ingestion (async)
 *   8. Return response
 *
 * @param {object} params
 * @param {string}  params.message           - User message.
 * @param {string}  params.user_id           - User identifier.
 * @param {string}  params.conversation_id   - Conversation id.
 * @param {string}  [params.session_id]      - Session id.
 * @param {string}  [params.model]           - AI model id.
 * @param {string}  [params.capability]      - Explicit capability override (e.g. "roleplay", "planning").
 * @param {Function} [params.getRecentConversation] - Retrieves recent conversation turns.
 * @param {boolean} [params.unfiltered]      - Unfiltered mode.
 * @param {string}  [params.aiMood]          - Mood/tone override.
 * @param {string}  [params.customInstructions] - User custom instructions.
 * @param {object}  [params.extra]           - Extra params for domain handlers (e.g. roleplayCharacter).
 * @returns {Promise<object>} { response, intent, context, toolResults, isMedia }
 */
export async function think({
  message,
  user_id,
  conversation_id,
  session_id,
  model,
  capability,
  getRecentConversation,
  unfiltered,
  aiMood,
  customInstructions,
  extra,
}) {
  // 1. Intent detection
  const intent = capability
    ? { intent: capability, confidence: 1.0, domain: null }
    : await detectIntent(message);

  await logAction({ action_type: "intent", input: message, output: intent });

  // 2. Context assembly via context engine
  let context = await assembleContext({
    user_id,
    conversation_id,
    message,
    session_id,
    getRecentConversation,
    unfiltered: unfiltered || isUnfilteredModel(model),
    aiMood,
    customInstructions,
    domain: intent.domain,
  });

  // Merge any extra params (e.g. roleplay character/scenario) into context
  if (extra) {
    context = { ...context, ...extra };
  }

  const contextSummaryStr = summarizeContext(context);

  await logAction({
    action_type: "context",
    input: { user_id, conversation_id },
    output: contextSummaryStr,
  });

  // 3. Tool selection + planning
  const tools = getToolsForIntent(intent.intent);
  const executionPlan = await plan({ message, intent, tools, contextSummary: contextSummaryStr });

  await logAction({ action_type: "plan", input: intent, output: executionPlan });

  // 4. Execute tool steps
  const toolResults = [];
  for (const step of executionPlan.steps || []) {
    const result = await executeTool(step, { message, context });
    toolResults.push(result);
    await logAction({ action_type: "tool", input: step, output: result });
  }

  // 5. Media short-circuit
  if (intent.intent === "media_generation" && intent.confidence >= MEDIA_CONFIDENCE_THRESHOLD) {
    const mediaResult = toolResults.find(
      (r) =>
        ["image_generation", "video_generation", "music_generation", "voice_generation"].includes(r.tool)
    );
    if (mediaResult?.result && !mediaResult.result.error) {
      await logAction({ action_type: "media_response", input: message, output: mediaResult.result });
      return { response: mediaResult.result, intent, context, toolResults, isMedia: true };
    }
  }

  // 6. Domain-specific handler or generic chat
  let assistantResponse;
  const handler = domainHandlers[intent.intent];

  if (handler) {
    assistantResponse = await handler({ message, context, model, toolResults });
  } else {
    // Generic context-aware chat
    const toolContext = toolResults
      .filter((r) => r.result)
      .map((r) => `[${r.tool}]: ${typeof r.result === "string" ? r.result : JSON.stringify(r.result)}`)
      .join("\n");

    const prompt = contextAwareChat({
      systemPrompt: context.systemPrompt,
      message,
      toolContext: toolContext || undefined,
    });

    assistantResponse = await chat({ prompt, model });
  }

  // 7. Critic review (skipped for unfiltered models)
  const isUnfiltered = unfiltered || isUnfilteredModel(model);
  const finalResponse = isUnfiltered
    ? assistantResponse
    : await critique({ message, response: assistantResponse, intent });

  await logAction({
    action_type: "response",
    input: message,
    output: { intent: intent.intent, responseLength: finalResponse.length },
  });

  // 8. Memory ingestion (fire-and-forget to avoid blocking the response)
  ingest({
    user_id,
    conversation_id,
    session_id,
    message,
    conversationHistory: context.recentConversation
      ? context.recentConversation.map((m) => `[${m.role}]: ${m.content}`).join("\n")
      : "",
  }).catch((err) => console.error("Brain memory ingest error:", err.message));

  // Store assistant response in short-term memory
  if (session_id) {
    storeShortTerm({
      user_id,
      session_id,
      role: "assistant",
      content: finalResponse,
    }).catch((err) => console.error("Brain short-term store error:", err.message));
  }

  return { response: finalResponse, intent, context, toolResults, isMedia: false };
}

/**
 * List all capabilities supported by the Companion Brain.
 *
 * @returns {string[]}
 */
export function listCapabilities() {
  return [
    "chat",
    "roleplay",
    "planning",
    "research",
    "analysis",
    "knowledge_lookup",
    "media_generation",
    "workflow_execution",
    "goal_management",
    "web_search",
    "location",
  ];
}
