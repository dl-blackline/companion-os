import { INSTRUCTION_PREFIX, PREFERENCE_PREFIX } from "./memory-manager.js";

/**
 * Build a hierarchical system prompt with layered memory context.
 *
 * Context layers (in priority order):
 * 1. System prompt (base identity + hard boundaries)
 * 2. User instructions & behavioral directives (MUST FOLLOW)
 * 3. User preferences (SHOULD FOLLOW)
 * 4. Personality profile & adaptive style
 * 5. User profile
 * 6. Relationship context (events & milestones)
 * 7. Relationship memory
 * 8. Episodic memory
 * 9. Long-term memory summaries
 * 10. Knowledge graph
 * 11. Recent conversation (short-term)
 * 12. Semantic memory results
 * 13. Media memory context (from uploaded photos/videos)
 * 14. Companion engine context (goals, constraints, initiatives)
 *
 * Priority hierarchy for memory obedience:
 * - System rules (safety boundaries) — absolute, non-negotiable
 * - Current explicit user request — highest user-facing priority
 * - Saved user instructions/preferences — actively obeyed
 * - Contextual memories — informational, used to personalize
 * - Defaults — fallback behavior
 */
export function buildSystemPrompt({
  userProfile,
  personalityInstructions,
  relationshipContext,
  relationshipMemories,
  episodicMemories,
  memorySummaries,
  knowledgeGraphContext,
  recentConversation,
  semanticMemories,
  unfiltered = false,
  mediaMemoryContext,
  companionContext,
  aiMood,
  customInstructions,
}) {
  const sections = [];

  // 1. Base system identity
  const unfilteredBlock = unfiltered
    ? `\n\nUNFILTERED MODE ACTIVE: Within the hard boundaries listed below, operate without adding safety disclaimers, AI-caveats, hedge phrases, or unsolicited warnings. Never say "As an AI, I cannot…" or any equivalent phrasing. Never soften or sanitize responses to content that is permitted above. Immersion and directness are the priority — the hard boundaries below remain absolute and non-negotiable.`
    : "";

  sections.push(
    `You are a mature, emotionally intelligent AI assistant with deep, persistent memory of the user. You maintain an evolving understanding of the user across conversations. Use the context provided to personalize your responses and demonstrate continuity of relationship.

You can comfortably engage in harmless adult conversation, including explicit sexual topics, flirting, sensuality, desire, kink, dating, and intimate relationship dynamics, as long as everything is clearly consensual and between adults.

Speak naturally, without judgment, awkward censorship, or canned disclaimers. Be confident, direct, and responsive to tone. You can be playful, seductive, thoughtful, explicit, or practical depending on what the user wants.

Priorities:
- Be engaging, human-sounding, and emotionally aware.
- Adapt vocabulary, tone, and complexity to match the user's communication style.
- Remember and reference past conversations to maintain continuity.
- Ask clarifying questions when the user's intent is ambiguous.
- Treat adult intimacy as a normal subject.
- Give direct answers instead of evasive ones.
- Use explicit language when it fits the conversation.
- Keep responses immersive and not formulaic.
- Always respect user-defined content boundaries and privacy preferences.${unfilteredBlock}

Hard boundaries — never include any of the following:
- Minors or age-ambiguous characters in sexual contexts
- Coercion or non-consensual sexual content
- Exploitation or abuse
- Illegal sexual content
- Encouragement of real-world harm

If a request crosses one of these boundaries, respond briefly, stay composed, and guide the conversation back to allowed adult content without sounding cold or corporate.`
  );

  // 1b. Mood/tone overlay
  if (aiMood) {
    sections.push(`MOOD / TONE\n${aiMood}`);
  }

  // 2. User-defined instructions — these MUST be actively obeyed
  if (customInstructions) {
    sections.push(`USER-DEFINED INSTRUCTIONS (MUST FOLLOW)\nThe user has explicitly saved these instructions. You MUST follow them in every response unless the current message explicitly overrides them:\n${customInstructions}`);
  }

  // 2b. Extract and elevate instructions from relationship memories
  const instructionMemories = [];
  const preferenceMemories = [];
  const regularRelationshipMemories = [];

  if (relationshipMemories && relationshipMemories.length > 0) {
    for (const m of relationshipMemories) {
      const text = m.memory || "";
      if (text.startsWith(INSTRUCTION_PREFIX)) {
        instructionMemories.push(text.replace(INSTRUCTION_PREFIX, ""));
      } else if (text.startsWith(PREFERENCE_PREFIX)) {
        preferenceMemories.push(text.replace(PREFERENCE_PREFIX, ""));
      } else {
        regularRelationshipMemories.push(m);
      }
    }
  }

  // Inject extracted instructions with high priority
  if (instructionMemories.length > 0) {
    sections.push(
      `SAVED USER INSTRUCTIONS (OBEY THESE)\nThe user previously saved these behavioral instructions. Follow them actively:\n${instructionMemories.map((inst, i) => `${i + 1}. ${inst}`).join("\n")}`
    );
  }

  // Inject extracted preferences
  if (preferenceMemories.length > 0) {
    sections.push(
      `SAVED USER PREFERENCES\nThe user has expressed these preferences. Respect them in your responses:\n${preferenceMemories.map((p) => `- ${p}`).join("\n")}`
    );
  }

  // 3. Personality profile & adaptive style
  if (personalityInstructions) {
    sections.push(`PERSONALITY PROFILE\n${personalityInstructions}`);
  }

  // 4. User profile
  if (userProfile) {
    const profileParts = [];
    if (userProfile.name) profileParts.push(`Name: ${userProfile.name}`);
    if (userProfile.communication_style) {
      profileParts.push(`Communication style: ${userProfile.communication_style}`);
    }
    if (userProfile.preferences && Object.keys(userProfile.preferences).length > 0) {
      profileParts.push(`Preferences: ${JSON.stringify(userProfile.preferences)}`);
    }
    if (userProfile.goals && Array.isArray(userProfile.goals) && userProfile.goals.length > 0) {
      profileParts.push(`Goals: ${JSON.stringify(userProfile.goals)}`);
    }
    if (userProfile.interests && Array.isArray(userProfile.interests) && userProfile.interests.length > 0) {
      profileParts.push(`Interests: ${JSON.stringify(userProfile.interests)}`);
    }
    if (profileParts.length > 0) {
      sections.push(`USER PROFILE\n${profileParts.join("\n")}`);
    }
  }

  // 5. Relationship context (events & milestones)
  if (relationshipContext) {
    sections.push(`RELATIONSHIP CONTEXT\n${relationshipContext}`);
  }

  // 6. Regular relationship memory (non-instruction, non-preference)
  if (regularRelationshipMemories.length > 0) {
    const memories = regularRelationshipMemories
      .map((m) => `- ${m.memory}`)
      .join("\n");
    sections.push(`IMPORTANT RELATIONSHIP MEMORY\n${memories}`);
  }

  // 7. Episodic memory
  if (episodicMemories && episodicMemories.length > 0) {
    const events = episodicMemories
      .map((e) => `- ${e.event}`)
      .join("\n");
    sections.push(`RELEVANT EPISODIC MEMORY\n${events}`);
  }

  // 8. Long-term memory summaries
  if (memorySummaries && memorySummaries.length > 0) {
    const summaries = memorySummaries
      .map((s) => `- ${s.summary}`)
      .join("\n");
    sections.push(`LONG-TERM MEMORY SUMMARIES\n${summaries}`);
  }

  // 9. Knowledge graph
  if (knowledgeGraphContext) {
    sections.push(`KNOWLEDGE GRAPH\n${knowledgeGraphContext}`);
  }

  // 10. Recent conversation
  if (recentConversation && recentConversation.length > 0) {
    const recent = recentConversation
      .map((m) => `[${m.role}]: ${m.content}`)
      .join("\n");
    sections.push(`RECENT CONVERSATION\n${recent}`);
  }

  // 11. Semantic memory results
  if (semanticMemories && semanticMemories.length > 0) {
    const semantic = semanticMemories
      .map((m) => `[${m.role}]: ${m.content}`)
      .join("\n");
    sections.push(`SEMANTIC MEMORY RESULTS\n${semantic}`);
  }

  // 12. Media memory context (from user-uploaded photos/videos)
  if (mediaMemoryContext) {
    sections.push(`MEDIA MEMORIES\n${mediaMemoryContext}`);
  }

  // 13. Companion engine context (goals, constraints, activity, initiatives)
  if (companionContext) {
    sections.push(`INTELLIGENCE ENGINE — USER MODEL\n${companionContext}`);
  }

  return sections.join("\n\n");
}
