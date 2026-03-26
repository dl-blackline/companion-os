/**
 * Agent Registry
 *
 * Defines the system agents that can run background tasks.
 * Each agent has a description, a set of capabilities, and a
 * structured prompt used when executing tasks via the AI router.
 */

export const AGENTS = {
  research_agent: {
    description: "Performs research tasks",
    capabilities: ["web_search", "summarize", "analysis"],
    prompt:
      "You are a research agent. Provide summarized analysis on the topic. " +
      "Return a well-structured JSON response with keys: summary (string), " +
      "key_findings (array of strings), and recommendations (array of strings).",
  },

  content_agent: {
    description: "Generates media and content",
    capabilities: ["image_generation", "video_generation", "music_generation"],
    prompt:
      "You are a content generation agent. Based on the request, produce a " +
      "creative brief with JSON keys: content_type (string), description (string), " +
      "media_prompts (array of objects with type and prompt), and suggested_workflow (array of strings).",
  },

  planner_agent: {
    description: "Breaks goals into actionable plans",
    capabilities: ["task_planning", "goal_analysis"],
    prompt:
      "You are a planning agent. Convert the user goal into clear actionable " +
      "steps. Return JSON with keys: goal_summary (string), steps (array of " +
      "objects with step_number, action, and estimated_effort), and success_criteria (array of strings).",
  },

  career_agent: {
    description: "Optimizes resumes and orchestrates job hunt execution",
    capabilities: ["resume_review", "job_search_strategy", "outreach_planning", "interview_prep"],
    prompt:
      "You are a career strategy agent. Create execution-ready job search guidance. " +
      "Return JSON with keys: target_role (string), resume_fixes (array of strings), " +
      "search_plan (array of strings), outreach_scripts (array of strings), and interview_focus (array of strings).",
  },

  memory_agent: {
    description: "Maintains long term memory summaries",
    capabilities: ["memory_summarization", "relationship_updates"],
    prompt:
      "You are a memory consolidation agent. Summarize the provided context " +
      "and identify important relationships. Return JSON with keys: summary (string), " +
      "key_entities (array of strings), relationships (array of objects with source, target, type), " +
      "and action_items (array of strings).",
  },
};

/**
 * Retrieve a single agent definition by type.
 * @param {string} agentType - The agent identifier (e.g. "research_agent").
 * @returns {object|undefined} The agent definition or undefined.
 */
export function getAgent(agentType) {
  return AGENTS[agentType];
}

/**
 * List all registered agent types.
 * @returns {string[]} Array of agent type keys.
 */
export function listAgentTypes() {
  return Object.keys(AGENTS);
}
