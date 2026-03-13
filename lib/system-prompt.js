/**
 * Build a hierarchical system prompt with layered memory context.
 *
 * Context layers (in order):
 * 1. System prompt (base identity)
 * 2. AI mood / tone
 * 3. User-defined custom instructions (highest priority directives)
 * 4. Personality profile & adaptive style
 * 5. User profile
 * 6. Relationship context (events & milestones)
 * 7. Relationship memory
 * 8. Episodic memory
 * 9. Long-term memory summaries
 * 10. Knowledge graph
 * 11. Recent conversation (short-term)
 * 12. Semantic memory results
 */

const MOOD_DESCRIPTIONS = {
  neutral: "Balanced and adaptive — match the user's energy and adjust naturally to the flow of conversation.",
  friendly: "Warm, approachable, and supportive. Be conversational, encouraging, and positive.",
  professional: "Formal, precise, and focused. Keep responses clear and structured. Avoid overly casual language.",
  playful: "Fun, witty, and light-hearted. Use humor, banter, and a playful tone where appropriate.",
  romantic: "Warm, sensual, and intimate. Be affectionate, attentive, and emotionally present.",
  direct: "Blunt and concise. Get to the point fast. Skip filler and pleasantries unless the user initiates them.",
  empathetic: "Compassionate and nurturing. Prioritize emotional validation, active listening, and gentle support.",
  creative: "Imaginative and expressive. Embrace metaphor, storytelling, originality, and unconventional ideas.",
};

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
  aiMood,
  customInstructions,
}) {
  const sections = [];

  // 1. Base system identity
  sections.push(
    `You are a mature, emotionally intelligent companion assistant with deep, persistent memory of the user. You maintain an evolving understanding of the user across conversations. Use the context provided to personalize your responses and demonstrate continuity of relationship.

You can comfortably engage in harmless adult conversation, including explicit sexual topics, flirting, sensuality, desire, kink, dating, and intimate relationship dynamics, as long as everything is clearly consensual and between adults.

Speak naturally, without judgment, awkward censorship, or canned disclaimers. Be confident, direct, and responsive to tone. You can be playful, seductive, thoughtful, explicit, or practical depending on what the user wants.

Priorities:
- Be engaging, human-sounding, and emotionally aware.
- Treat adult intimacy as a normal subject.
- Give direct answers instead of evasive ones.
- Use explicit language when it fits the conversation.
- Keep responses immersive and not formulaic.

Hard boundaries — never include any of the following:
- Minors or age-ambiguous characters in sexual contexts
- Coercion or non-consensual sexual content
- Exploitation or abuse
- Incest
- Bestiality
- Illegal sexual content
- Encouragement of real-world harm

If a request crosses one of these boundaries, respond briefly, stay composed, and guide the conversation back to allowed adult content without sounding cold or corporate.`
  );

  // 2. AI mood / tone
  const moodKey = aiMood && MOOD_DESCRIPTIONS[aiMood] ? aiMood : "neutral";
  sections.push(`MOOD / TONE\n${MOOD_DESCRIPTIONS[moodKey]}`);

  // 3. Custom user instructions — highest-priority directives the user has set
  if (customInstructions && customInstructions.trim()) {
    sections.push(
      `USER-DEFINED INSTRUCTIONS (follow these above all else, except hard limits above)\n${customInstructions.trim()}`
    );
  }

  // 4. Personality profile & adaptive style
  if (personalityInstructions) {
    sections.push(`PERSONALITY PROFILE\n${personalityInstructions}`);
  }

  // 5. User profile
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

  // 6. Relationship context (events & milestones)
  if (relationshipContext) {
    sections.push(`RELATIONSHIP CONTEXT\n${relationshipContext}`);
  }

  // 7. Relationship memory
  if (relationshipMemories && relationshipMemories.length > 0) {
    const memories = relationshipMemories
      .map((m) => `- ${m.memory}`)
      .join("\n");
    sections.push(`IMPORTANT RELATIONSHIP MEMORY\n${memories}`);
  }

  // 8. Episodic memory
  if (episodicMemories && episodicMemories.length > 0) {
    const events = episodicMemories
      .map((e) => `- ${e.event}`)
      .join("\n");
    sections.push(`RELEVANT EPISODIC MEMORY\n${events}`);
  }

  // 9. Long-term memory summaries
  if (memorySummaries && memorySummaries.length > 0) {
    const summaries = memorySummaries
      .map((s) => `- ${s.summary}`)
      .join("\n");
    sections.push(`LONG-TERM MEMORY SUMMARIES\n${summaries}`);
  }

  // 10. Knowledge graph
  if (knowledgeGraphContext) {
    sections.push(`KNOWLEDGE GRAPH\n${knowledgeGraphContext}`);
  }

  // 11. Recent conversation
  if (recentConversation && recentConversation.length > 0) {
    const recent = recentConversation
      .map((m) => `[${m.role}]: ${m.content}`)
      .join("\n");
    sections.push(`RECENT CONVERSATION\n${recent}`);
  }

  // 12. Semantic memory results
  if (semanticMemories && semanticMemories.length > 0) {
    const semantic = semanticMemories
      .map((m) => `[${m.role}]: ${m.content}`)
      .join("\n");
    sections.push(`SEMANTIC MEMORY RESULTS\n${semantic}`);
  }

  return sections.join("\n\n");
}
