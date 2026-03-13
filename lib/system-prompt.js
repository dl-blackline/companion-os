/**
 * Build a hierarchical system prompt with layered memory context.
 *
 * Context layers (in order):
 * 1. System prompt (base identity)
 * 2. User profile
 * 3. Personality profile & adaptive style
 * 4. Relationship context (events & milestones)
 * 5. Relationship memory
 * 6. Episodic memory
 * 7. Long-term memory summaries
 * 8. Knowledge graph
 * 9. Recent conversation (short-term)
 * 10. Semantic memory results
 * 11. Media memory context (from uploaded photos/videos)
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
}) {
  const sections = [];

  // 1. Base system identity
  const unfilteredBlock = unfiltered
    ? `\n\nUNFILTERED MODE ACTIVE: Within the hard boundaries listed below, operate without adding safety disclaimers, AI-caveats, hedge phrases, or unsolicited warnings. Never say "As an AI, I cannot…" or any equivalent phrasing. Never soften or sanitize responses to content that is permitted above. Immersion and directness are the priority — the hard boundaries below remain absolute and non-negotiable.`
    : "";

  sections.push(
    `You are a mature, emotionally intelligent companion assistant with deep, persistent memory of the user. You maintain an evolving understanding of the user across conversations. Use the context provided to personalize your responses and demonstrate continuity of relationship.

You can comfortably engage in harmless adult conversation, including explicit sexual topics, flirting, sensuality, desire, kink, dating, and intimate relationship dynamics, as long as everything is clearly consensual and between adults.

Speak naturally, without judgment, awkward censorship, or canned disclaimers. Be confident, direct, and responsive to tone. You can be playful, seductive, thoughtful, explicit, or practical depending on what the user wants.

Priorities:
- Be engaging, human-sounding, and emotionally aware.
- Treat adult intimacy as a normal subject.
- Give direct answers instead of evasive ones.
- Use explicit language when it fits the conversation.
- Keep responses immersive and not formulaic.${unfilteredBlock}

Hard boundaries — never include any of the following:
- Minors or age-ambiguous characters in sexual contexts
- Coercion or non-consensual sexual content
- Exploitation or abuse
- Illegal sexual content
- Encouragement of real-world harm

If a request crosses one of these boundaries, respond briefly, stay composed, and guide the conversation back to allowed adult content without sounding cold or corporate.`
  );

  // 2. Personality profile & adaptive style
  if (personalityInstructions) {
    sections.push(`PERSONALITY PROFILE\n${personalityInstructions}`);
  }

  // 3. User profile
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

  // 4. Relationship context (events & milestones)
  if (relationshipContext) {
    sections.push(`RELATIONSHIP CONTEXT\n${relationshipContext}`);
  }

  // 5. Relationship memory
  if (relationshipMemories && relationshipMemories.length > 0) {
    const memories = relationshipMemories
      .map((m) => `- ${m.memory}`)
      .join("\n");
    sections.push(`IMPORTANT RELATIONSHIP MEMORY\n${memories}`);
  }

  // 6. Episodic memory
  if (episodicMemories && episodicMemories.length > 0) {
    const events = episodicMemories
      .map((e) => `- ${e.event}`)
      .join("\n");
    sections.push(`RELEVANT EPISODIC MEMORY\n${events}`);
  }

  // 7. Long-term memory summaries
  if (memorySummaries && memorySummaries.length > 0) {
    const summaries = memorySummaries
      .map((s) => `- ${s.summary}`)
      .join("\n");
    sections.push(`LONG-TERM MEMORY SUMMARIES\n${summaries}`);
  }

  // 8. Knowledge graph
  if (knowledgeGraphContext) {
    sections.push(`KNOWLEDGE GRAPH\n${knowledgeGraphContext}`);
  }

  // 9. Recent conversation
  if (recentConversation && recentConversation.length > 0) {
    const recent = recentConversation
      .map((m) => `[${m.role}]: ${m.content}`)
      .join("\n");
    sections.push(`RECENT CONVERSATION\n${recent}`);
  }

  // 10. Semantic memory results
  if (semanticMemories && semanticMemories.length > 0) {
    const semantic = semanticMemories
      .map((m) => `[${m.role}]: ${m.content}`)
      .join("\n");
    sections.push(`SEMANTIC MEMORY RESULTS\n${semantic}`);
  }

  // 11. Media memory context (from user-uploaded photos/videos)
  if (mediaMemoryContext) {
    sections.push(`MEDIA MEMORIES\n${mediaMemoryContext}`);
  }

  return sections.join("\n\n");
}
