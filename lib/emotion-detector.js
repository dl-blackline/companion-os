import { createClient } from "@supabase/supabase-js";
import { route } from "./ai-router.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Analyze a user message for emotional signals using AI.
 *
 * Returns an array of detected signals, each with a label and intensity.
 */
export async function detectEmotions(message) {
  const detectionPrompt = {
    system: `You are an emotional signal detection system. Analyze the user message and identify any emotional signals present.

Respond with valid JSON only. No markdown, no explanation.

{
  "signals": [
    { "signal": "string", "intensity": number between 0 and 1 }
  ]
}

Recognized signals include: stress, frustration, excitement, motivation, curiosity, sadness, disappointment, confidence, anxiety, gratitude, humor, urgency.

Rules:
- Only include signals that are clearly present in the message.
- intensity reflects how strongly the emotion is expressed (0.1 = subtle, 1.0 = very strong).
- Return an empty signals array if no clear emotional signals are detected.
- Do not over-interpret neutral or factual messages.`,
    user: message,
  };

  try {
    const result = await route({ task: "chat", prompt: detectionPrompt });
    const parsed = JSON.parse(result);
    return parsed.signals || [];
  } catch (err) {
    console.error("Emotion detection error:", err.message);
    return [];
  }
}

/**
 * Store detected emotional signals in the database.
 */
export async function storeEmotionalSignals({
  user_id,
  conversation_id,
  signals,
  source_message,
}) {
  if (!signals || signals.length === 0) return;

  const rows = signals.map((s) => ({
    user_id,
    conversation_id,
    signal: s.signal,
    intensity: s.intensity,
    source_message,
  }));

  const { error } = await supabase.from("emotional_signals").insert(rows);

  if (error) {
    console.error("Store emotional signals error:", error.message);
  }
}

/**
 * Retrieve recent emotional signals for a user (last 10).
 */
export async function getRecentEmotionalSignals(user_id) {
  const { data, error } = await supabase
    .from("emotional_signals")
    .select("signal, intensity, created_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Get recent emotional signals error:", error.message);
    return [];
  }

  return data || [];
}
