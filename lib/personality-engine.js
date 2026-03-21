import { supabase } from "./_supabase.js";

/**
 * Retrieve the personality profile for a user from the database.
 * Returns null if no profile exists.
 */
export async function getPersonalityProfile(user_id) {
  const { data, error } = await supabase
    .from("personality_profiles")
    .select("*")
    .eq("user_id", user_id)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Get personality profile error:", error.message);
    return null;
  }

  return data;
}

/**
 * Build style instructions from a personality profile.
 *
 * These instructions are injected into the system prompt so the AI adapts
 * its tone, verbosity, communication style, and response structure.
 */
export function buildStyleInstructions(personalityProfile, emotionalContext) {
  if (!personalityProfile) {
    return "";
  }

  const parts = [];

  if (personalityProfile.tone) {
    parts.push(`Tone: ${personalityProfile.tone}`);
  }

  if (personalityProfile.verbosity) {
    parts.push(`Verbosity: ${personalityProfile.verbosity}`);
  }

  if (personalityProfile.communication_style) {
    parts.push(`Communication style: ${personalityProfile.communication_style}`);
  }

  if (personalityProfile.response_structure) {
    parts.push(`Response structure: ${personalityProfile.response_structure}`);
  }

  if (
    personalityProfile.custom_traits &&
    Object.keys(personalityProfile.custom_traits).length > 0
  ) {
    const traitLines = Object.entries(personalityProfile.custom_traits)
      .map(([key, value]) => `  ${key}: ${value}`)
      .join("\n");
    parts.push(`Custom traits:\n${traitLines}`);
  }

  // Adapt style based on emotional context
  if (emotionalContext && emotionalContext.length > 0) {
    const recentSignals = emotionalContext.map((s) => s.signal);

    if (recentSignals.includes("stress") || recentSignals.includes("frustration")) {
      parts.push(
        "Adaptive override: The user appears stressed or frustrated. Use a supportive, patient tone. Be concise and solution-oriented."
      );
    } else if (recentSignals.includes("excitement") || recentSignals.includes("motivation")) {
      parts.push(
        "Adaptive override: The user appears excited or motivated. Match their energy with an encouraging, enthusiastic tone."
      );
    } else if (recentSignals.includes("curiosity")) {
      parts.push(
        "Adaptive override: The user is curious. Provide detailed explanations and suggest further exploration."
      );
    } else if (recentSignals.includes("sadness") || recentSignals.includes("disappointment")) {
      parts.push(
        "Adaptive override: The user may be feeling down. Be empathetic and gently supportive."
      );
    }
  }

  return parts.length > 0 ? parts.join("\n") : "";
}
