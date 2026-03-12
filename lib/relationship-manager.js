import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Retrieve recent relationship events for a user.
 *
 * Events include achievements, major projects, long-term goals, and milestones.
 */
export async function getRelationshipEvents(user_id, limit = 15) {
  const { data, error } = await supabase
    .from("relationship_events")
    .select("event_type, description, metadata, created_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Get relationship events error:", error.message);
    return [];
  }

  return data || [];
}

/**
 * Store a relationship event in the database.
 */
export async function storeRelationshipEvent({
  user_id,
  event_type,
  description,
  metadata,
}) {
  const { error } = await supabase.from("relationship_events").insert({
    user_id,
    event_type,
    description,
    metadata: metadata || {},
  });

  if (error) {
    console.error("Store relationship event error:", error.message);
  }
}

/**
 * Build a formatted relationship context string for prompt injection.
 *
 * Groups events by type for clarity:
 *   - achievements
 *   - major_project
 *   - long_term_goal
 *   - milestone
 *   - other
 */
export function buildRelationshipContext(events) {
  if (!events || events.length === 0) {
    return "";
  }

  const grouped = {};
  for (const event of events) {
    const type = event.event_type || "other";
    if (!grouped[type]) {
      grouped[type] = [];
    }
    grouped[type].push(event.description);
  }

  const typeLabels = {
    achievement: "Achievements",
    major_project: "Major Projects",
    long_term_goal: "Long-Term Goals",
    milestone: "Milestones",
    other: "Other Events",
  };

  const parts = [];
  for (const [type, descriptions] of Object.entries(grouped)) {
    const label = typeLabels[type] || type;
    const items = descriptions.map((d) => `- ${d}`).join("\n");
    parts.push(`${label}:\n${items}`);
  }

  return parts.join("\n\n");
}
