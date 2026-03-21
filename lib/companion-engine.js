/**
 * companion-engine.js — Core Companion Engine
 *
 * Sits above all existing modules (CRM, roleplay, email, planning) and provides:
 *
 * 1. Unified User Model  — CRUD for goals, constraints, and priorities
 * 2. Memory System        — Cross-module interaction logging
 * 3. Context Engine       — Assembles full user context for AI prompts
 * 4. Initiative Layer     — Proactive suggestion generation
 *
 * All functions accept/return plain objects and use the shared Supabase client.
 */

import { supabase } from "./_supabase.js";
import { route } from "./ai-router.js";

// ─── 1. Unified User Model — Goals ───────────────────────────────────────────

export async function getUserGoals(user_id, { domain, status } = {}) {
  let query = supabase
    .from("user_goals")
    .select("*")
    .eq("user_id", user_id)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });

  if (domain) query = query.eq("domain", domain);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("getUserGoals error:", error.message);
    return [];
  }
  return data || [];
}

export async function createGoal({ user_id, domain, title, description, priority, target_date }) {
  const { data, error } = await supabase
    .from("user_goals")
    .insert({
      user_id,
      domain: domain || "personal",
      title,
      description: description || null,
      priority: priority || "medium",
      target_date: target_date || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createGoal error:", error.message);
    return null;
  }
  return data;
}

export async function updateGoal(goal_id, updates) {
  const allowed = ["title", "description", "status", "priority", "progress", "target_date", "milestones", "metadata"];
  const patch = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (updates[key] !== undefined) patch[key] = updates[key];
  }

  const { data, error } = await supabase
    .from("user_goals")
    .update(patch)
    .eq("id", goal_id)
    .select("*")
    .single();

  if (error) {
    console.error("updateGoal error:", error.message);
    return null;
  }
  return data;
}

export async function deleteGoal(goal_id) {
  const { error } = await supabase.from("user_goals").delete().eq("id", goal_id);
  if (error) {
    console.error("deleteGoal error:", error.message);
    return false;
  }
  return true;
}

// ─── 1b. Unified User Model — Constraints ────────────────────────────────────

export async function getUserConstraints(user_id, { active_only = true } = {}) {
  let query = supabase
    .from("user_constraints")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (active_only) query = query.eq("is_active", true);

  const { data, error } = await query;
  if (error) {
    console.error("getUserConstraints error:", error.message);
    return [];
  }
  return data || [];
}

export async function createConstraint({ user_id, domain, label, value }) {
  const { data, error } = await supabase
    .from("user_constraints")
    .insert({
      user_id,
      domain: domain || "general",
      label,
      value,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createConstraint error:", error.message);
    return null;
  }
  return data;
}

export async function updateConstraint(constraint_id, updates) {
  const allowed = ["label", "value", "domain", "is_active", "metadata"];
  const patch = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (updates[key] !== undefined) patch[key] = updates[key];
  }

  const { data, error } = await supabase
    .from("user_constraints")
    .update(patch)
    .eq("id", constraint_id)
    .select("*")
    .single();

  if (error) {
    console.error("updateConstraint error:", error.message);
    return null;
  }
  return data;
}

export async function deleteConstraint(constraint_id) {
  const { error } = await supabase.from("user_constraints").delete().eq("id", constraint_id);
  if (error) {
    console.error("deleteConstraint error:", error.message);
    return false;
  }
  return true;
}

// ─── 2. Memory System — Cross-Module Interaction Log ─────────────────────────

export async function logInteraction({ user_id, module, action, summary, outcome, metadata }) {
  const { data, error } = await supabase
    .from("interaction_log")
    .insert({
      user_id,
      module,
      action,
      summary: summary || null,
      outcome: outcome || null,
      metadata: metadata || {},
    })
    .select("*")
    .single();

  if (error) {
    console.error("logInteraction error:", error.message);
    return null;
  }
  return data;
}

export async function getRecentInteractions(user_id, { module, limit = 20 } = {}) {
  let query = supabase
    .from("interaction_log")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (module) query = query.eq("module", module);

  const { data, error } = await query;
  if (error) {
    console.error("getRecentInteractions error:", error.message);
    return [];
  }
  return data || [];
}

// ─── 3. Context Engine ───────────────────────────────────────────────────────
// Assembles the companion-specific context block (goals, constraints,
// recent interactions, pending initiatives) for injection into AI prompts.

export async function buildCompanionContext(user_id) {
  const [goals, constraints, recentInteractions, pendingInitiatives] =
    await Promise.all([
      getUserGoals(user_id, { status: "active" }).catch(() => []),
      getUserConstraints(user_id).catch(() => []),
      getRecentInteractions(user_id, { limit: 10 }).catch(() => []),
      getInitiatives(user_id, { status: "pending", limit: 5 }).catch(() => []),
    ]);

  return { goals, constraints, recentInteractions, pendingInitiatives };
}

/**
 * Format companion context into a prompt-ready string.
 */
export function formatCompanionContext({ goals, constraints, recentInteractions, pendingInitiatives }) {
  const sections = [];

  if (goals && goals.length > 0) {
    const grouped = {};
    for (const g of goals) {
      const d = g.domain || "personal";
      if (!grouped[d]) grouped[d] = [];
      grouped[d].push(g);
    }
    const goalLines = Object.entries(grouped).map(([domain, items]) => {
      const list = items.map(
        (g) => `  - ${g.title} [${g.priority}]${g.progress > 0 ? ` (${Math.round(g.progress * 100)}% done)` : ""}`
      );
      return `${domain.charAt(0).toUpperCase() + domain.slice(1)}:\n${list.join("\n")}`;
    });
    sections.push(`USER GOALS\n${goalLines.join("\n")}`);
  }

  if (constraints && constraints.length > 0) {
    const contentBoundaries = constraints.filter((c) => c.domain === "content");
    const privacyPrefs = constraints.filter((c) => c.domain === "privacy");
    const otherConstraints = constraints.filter(
      (c) => c.domain !== "content" && c.domain !== "privacy"
    );

    if (contentBoundaries.length > 0) {
      const lines = contentBoundaries.map((c) => `- ${c.label}: ${c.value}`);
      sections.push(
        `USER CONTENT BOUNDARIES (MUST RESPECT)\nThe user has set these content boundaries. Always respect them:\n${lines.join("\n")}`
      );
    }

    if (privacyPrefs.length > 0) {
      const lines = privacyPrefs.map((c) => `- ${c.label}: ${c.value}`);
      sections.push(`USER PRIVACY PREFERENCES\n${lines.join("\n")}`);
    }

    if (otherConstraints.length > 0) {
      const lines = otherConstraints.map((c) => `- [${c.domain}] ${c.label}: ${c.value}`);
      sections.push(`USER CONSTRAINTS & BOUNDARIES\n${lines.join("\n")}`);
    }
  }

  if (recentInteractions && recentInteractions.length > 0) {
    const lines = recentInteractions
      .slice(0, 5)
      .map((i) => `- [${i.module}] ${i.action}${i.summary ? ": " + i.summary : ""}`);
    sections.push(`RECENT ACTIVITY\n${lines.join("\n")}`);
  }

  if (pendingInitiatives && pendingInitiatives.length > 0) {
    const lines = pendingInitiatives.map(
      (i) => `- [${i.type}] ${i.title}${i.body ? ": " + i.body : ""}`
    );
    sections.push(`PENDING PROACTIVE SUGGESTIONS\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}

// ─── 4. Initiative Layer — Proactive Suggestions ─────────────────────────────

export async function getInitiatives(user_id, { status, limit = 10 } = {}) {
  let query = supabase
    .from("companion_initiatives")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("getInitiatives error:", error.message);
    return [];
  }
  return data || [];
}

export async function createInitiative({ user_id, type, title, body, priority, related_goal_id, scheduled_for }) {
  const { data, error } = await supabase
    .from("companion_initiatives")
    .insert({
      user_id,
      type: type || "suggestion",
      title,
      body: body || null,
      priority: priority || "medium",
      related_goal_id: related_goal_id || null,
      scheduled_for: scheduled_for || null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createInitiative error:", error.message);
    return null;
  }
  return data;
}

export async function updateInitiativeStatus(initiative_id, status) {
  const { data, error } = await supabase
    .from("companion_initiatives")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", initiative_id)
    .select("*")
    .single();

  if (error) {
    console.error("updateInitiativeStatus error:", error.message);
    return null;
  }
  return data;
}

/**
 * Generate proactive initiatives based on the current user model.
 * Uses AI to analyse goals, constraints, and recent activity, then creates
 * initiatives that the user can accept or dismiss.
 *
 * Returns the array of newly created initiatives.
 */
export async function generateInitiatives(user_id) {
  const companionCtx = await buildCompanionContext(user_id);
  const contextStr = formatCompanionContext(companionCtx);

  if (!contextStr) return [];

  const prompt = {
    system: `You are a proactive personal companion. Based on the user's goals, constraints, recent activity, and pending items, suggest 1–3 actionable initiatives.

Each initiative should be one of: suggestion, reminder, daily_plan, follow_up, optimisation.

Respond with valid JSON only. No markdown.
[
  {
    "type": "suggestion | reminder | daily_plan | follow_up | optimisation",
    "title": "short title",
    "body": "brief actionable description",
    "priority": "low | medium | high | critical",
    "related_goal_title": "optional — title of the related goal or null"
  }
]

Rules:
- Be specific and actionable — no vague motivational fluff.
- Respect the user's constraints.
- Reference concrete goals by name when relevant.
- Limit to 3 suggestions max.`,
    user: contextStr,
  };

  let suggestions;
  try {
    const raw = await route({ task: "chat", prompt });
    suggestions = JSON.parse(raw);
    if (!Array.isArray(suggestions)) suggestions = [];
  } catch {
    return [];
  }

  // Map goal titles → IDs for linking
  const goalMap = {};
  for (const g of companionCtx.goals) {
    goalMap[g.title.toLowerCase()] = g.id;
  }

  const created = [];
  for (const s of suggestions.slice(0, 3)) {
    if (!s.title) continue;

    let relatedGoalId = null;
    if (s.related_goal_title) {
      relatedGoalId = goalMap[s.related_goal_title.toLowerCase()] || null;
    }

    const initiative = await createInitiative({
      user_id,
      type: s.type || "suggestion",
      title: s.title,
      body: s.body || null,
      priority: s.priority || "medium",
      related_goal_id: relatedGoalId,
    });

    if (initiative) created.push(initiative);
  }

  return created;
}
