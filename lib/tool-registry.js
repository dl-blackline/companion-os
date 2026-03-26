/**
 * Tool Registry
 *
 * Registers available system capabilities so the orchestrator can determine
 * which tools are available and select the appropriate ones for each intent.
 */

/**
 * Registry of available system tools.
 * Each tool has:
 *   name        {string}   – unique identifier
 *   description {string}   – human-readable purpose
 *   intents     {string[]} – intents this tool is relevant for
 * @type {Record<string, {name: string, description: string, intents: string[]}>}
 */
const TOOLS = {
  memory_search: {
    name: "memory_search",
    description: "Search hierarchical memory (episodic, relationship, summaries).",
    intents: ["chat", "knowledge_lookup", "research", "analysis"],
  },
  knowledge_graph_lookup: {
    name: "knowledge_graph_lookup",
    description: "Query the knowledge graph for entities and relationships.",
    intents: ["knowledge_lookup", "research", "analysis"],
  },
  image_generation: {
    name: "image_generation",
    description: "Generate images using Flux via PiAPI.",
    intents: ["media_generation"],
  },
  video_generation: {
    name: "video_generation",
    description: "Generate videos using Runway.",
    intents: ["media_generation"],
  },
  music_generation: {
    name: "music_generation",
    description: "Generate music using Suno via PiAPI.",
    intents: ["media_generation"],
  },
  voice_generation: {
    name: "voice_generation",
    description: "Generate voice using ElevenLabs.",
    intents: ["media_generation"],
  },
  content_workflow: {
    name: "content_workflow",
    description: "Execute multi-step content production workflows.",
    intents: ["workflow_execution"],
  },
  goal_manager: {
    name: "goal_manager",
    description: "Manage user goals — set, update, review, and track progress.",
    intents: ["goal_management"],
  },
  web_search: {
    name: "web_search",
    description:
      "Search the internet in real time for current information, news, facts, and web content.",
    intents: ["web_search", "research", "knowledge_lookup"],
  },
  maps_lookup: {
    name: "maps_lookup",
    description:
      "Look up locations, geocode addresses, search for nearby places, and get directions.",
    intents: ["location", "research"],
  },
  financial_health_lookup: {
    name: "financial_health_lookup",
    description:
      "Retrieve linked-account cash flow, balances, and financial health pulse summary.",
    intents: ["analysis", "chat", "research"],
  },
};

/**
 * Get the full registry of tools.
 */
export function getAllTools() {
  return { ...TOOLS };
}

/**
 * Get tools that match a given intent.
 */
export function getToolsForIntent(intent) {
  return Object.values(TOOLS).filter((tool) => tool.intents.includes(intent));
}

/**
 * Get a specific tool by name.
 */
export function getTool(name) {
  return TOOLS[name] || null;
}

/**
 * List all registered tool names.
 */
export function listToolNames() {
  return Object.keys(TOOLS);
}
