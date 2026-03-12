import { createClient } from "@supabase/supabase-js";
import { route } from "./ai-router.js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Retrieve all skills for a user.
 */
export async function getSkills(user_id) {
  const { data, error } = await supabase
    .from("skills")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Get skills error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Add a new skill for a user.
 */
export async function addSkill({ user_id, name, category, proficiency }) {
  const { data, error } = await supabase
    .from("skills")
    .upsert(
      {
        user_id,
        name,
        category: category || "general",
        proficiency: proficiency || 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,name" }
    )
    .select()
    .single();

  if (error) {
    console.error("Add skill error:", error.message);
    return null;
  }

  return data;
}

/**
 * Record a skill usage event.
 */
export async function recordSkillUsage({ user_id, skill_name, context }) {
  const { error } = await supabase.from("skill_usage").insert({
    user_id,
    skill_name,
    context: context || "",
  });

  if (error) {
    console.error("Record skill usage error:", error.message);
  }
}

/**
 * Get recent skill usage for a user.
 */
export async function getSkillUsage(user_id, limit = 20) {
  const { data, error } = await supabase
    .from("skill_usage")
    .select("skill_name, context, created_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Get skill usage error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Generate skill suggestions for a user based on their profile and usage.
 */
export async function generateSkillSuggestions(user_id) {
  const [skills, usage] = await Promise.all([
    getSkills(user_id),
    getSkillUsage(user_id, 50),
  ]);

  const suggestionPrompt = {
    system: `You are a skill advisor. Based on the user's existing skills and recent usage patterns, suggest new skills or improvements.

Respond with valid JSON only. No markdown, no explanation.

{
  "suggestions": [
    { "skill_name": "string", "reason": "string", "priority": "high" | "medium" | "low" }
  ]
}

Rules:
- Suggest 2-5 relevant skills.
- Prioritize skills that complement existing ones.
- Consider gaps in the user's skill set.
- Be specific and actionable.`,
    user: `Current skills: ${JSON.stringify(skills.map((s) => ({ name: s.name, category: s.category, proficiency: s.proficiency })))}
Recent usage: ${JSON.stringify(usage.map((u) => u.skill_name))}`,
  };

  try {
    const result = await route({ task: "chat", prompt: suggestionPrompt });
    const parsed = JSON.parse(result);
    const suggestions = parsed.suggestions || [];

    // Store suggestions
    if (suggestions.length > 0) {
      const rows = suggestions.map((s) => ({
        user_id,
        skill_name: s.skill_name,
        reason: s.reason,
        priority: s.priority || "medium",
      }));

      const { error } = await supabase.from("skill_suggestions").insert(rows);

      if (error) {
        console.error("Store skill suggestions error:", error.message);
      }
    }

    return suggestions;
  } catch (err) {
    console.error("Generate skill suggestions error:", err.message);
    return [];
  }
}

/**
 * Get pending skill suggestions for a user.
 */
export async function getSkillSuggestions(user_id, limit = 10) {
  const { data, error } = await supabase
    .from("skill_suggestions")
    .select("*")
    .eq("user_id", user_id)
    .eq("dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Get skill suggestions error:", error.message);
    return [];
  }

  return data || [];
}
