/**
 * companion-engine.js — Netlify function
 *
 * POST /.netlify/functions/companion-engine
 *
 * Actions:
 *   goals.list        — List user goals (optional filters: domain, status)
 *   goals.create      — Create a new goal
 *   goals.update      — Update an existing goal
 *   goals.delete      — Delete a goal
 *
 *   constraints.list   — List user constraints
 *   constraints.create — Create a new constraint
 *   constraints.update — Update a constraint
 *   constraints.delete — Delete a constraint
 *
 *   initiatives.list   — List initiatives
 *   initiatives.update — Update initiative status
 *   initiatives.generate — Generate proactive initiatives via AI
 *
 *   interactions.log   — Log a cross-module interaction
 *   interactions.list  — List recent interactions
 *
 *   context.get        — Retrieve the full companion context (goals + constraints + interactions + initiatives)
 */

import {
  getUserGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  getUserConstraints,
  createConstraint,
  updateConstraint,
  deleteConstraint,
  getInitiatives,
  updateInitiativeStatus,
  generateInitiatives,
  logInteraction,
  getRecentInteractions,
  buildCompanionContext,
  formatCompanionContext,
} from "../../lib/companion-engine.js";
import { ok, fail, preflight } from "../../lib/_responses.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return preflight();
  }

  if (event.httpMethod !== "POST") {
    return fail("Method not allowed", "ERR_METHOD", 405);
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return fail("Invalid JSON body", "ERR_VALIDATION", 400);
  }

  const { action, user_id } = body;

  if (!action) return fail("Missing required field: action", "ERR_VALIDATION", 400);

  // Actions that operate on a specific resource by ID don't require user_id.
  const RESOURCE_ACTIONS = new Set([
    "goals.update", "goals.delete",
    "constraints.update", "constraints.delete",
    "initiatives.update",
  ]);

  if (!user_id && !RESOURCE_ACTIONS.has(action)) {
    return fail("Missing required field: user_id", "ERR_VALIDATION", 400);
  }

  try {
    // ── Goals ───────────────────────────────────────────────────────────────
    if (action === "goals.list") {
      const goals = await getUserGoals(user_id, {
        domain: body.domain,
        status: body.status,
      });
      return ok({ goals });
    }

    if (action === "goals.create") {
      if (!body.title) return fail("Missing required field: title", "ERR_VALIDATION", 400);
      const goal = await createGoal({
        user_id,
        domain: body.domain,
        title: body.title,
        description: body.description,
        priority: body.priority,
        target_date: body.target_date,
      });
      if (!goal) return fail("Failed to create goal", "ERR_INTERNAL", 500);
      return ok({ goal });
    }

    if (action === "goals.update") {
      if (!body.goal_id) return fail("Missing required field: goal_id", "ERR_VALIDATION", 400);
      const goal = await updateGoal(body.goal_id, body);
      if (!goal) return fail("Failed to update goal", "ERR_INTERNAL", 500);
      return ok({ goal });
    }

    if (action === "goals.delete") {
      if (!body.goal_id) return fail("Missing required field: goal_id", "ERR_VALIDATION", 400);
      const deleted = await deleteGoal(body.goal_id);
      if (!deleted) return fail("Failed to delete goal", "ERR_INTERNAL", 500);
      return ok({ deleted: true });
    }

    // ── Constraints ─────────────────────────────────────────────────────────
    if (action === "constraints.list") {
      const constraints = await getUserConstraints(user_id, {
        active_only: body.active_only !== false,
      });
      return ok({ constraints });
    }

    if (action === "constraints.create") {
      if (!body.label) return fail("Missing required field: label", "ERR_VALIDATION", 400);
      if (!body.value) return fail("Missing required field: value", "ERR_VALIDATION", 400);
      const constraint = await createConstraint({
        user_id,
        domain: body.domain,
        label: body.label,
        value: body.value,
      });
      if (!constraint) return fail("Failed to create constraint", "ERR_INTERNAL", 500);
      return ok({ constraint });
    }

    if (action === "constraints.update") {
      if (!body.constraint_id) return fail("Missing required field: constraint_id", "ERR_VALIDATION", 400);
      const constraint = await updateConstraint(body.constraint_id, body);
      if (!constraint) return fail("Failed to update constraint", "ERR_INTERNAL", 500);
      return ok({ constraint });
    }

    if (action === "constraints.delete") {
      if (!body.constraint_id) return fail("Missing required field: constraint_id", "ERR_VALIDATION", 400);
      const deleted = await deleteConstraint(body.constraint_id);
      if (!deleted) return fail("Failed to delete constraint", "ERR_INTERNAL", 500);
      return ok({ deleted: true });
    }

    // ── Initiatives ─────────────────────────────────────────────────────────
    if (action === "initiatives.list") {
      const initiatives = await getInitiatives(user_id, {
        status: body.status,
        limit: body.limit,
      });
      return ok({ initiatives });
    }

    if (action === "initiatives.update") {
      if (!body.initiative_id) return fail("Missing required field: initiative_id", "ERR_VALIDATION", 400);
      if (!body.status) return fail("Missing required field: status", "ERR_VALIDATION", 400);
      const initiative = await updateInitiativeStatus(body.initiative_id, body.status);
      if (!initiative) return fail("Failed to update initiative", "ERR_INTERNAL", 500);
      return ok({ initiative });
    }

    if (action === "initiatives.generate") {
      const initiatives = await generateInitiatives(user_id);
      return ok({ initiatives });
    }

    // ── Interactions ────────────────────────────────────────────────────────
    if (action === "interactions.log") {
      if (!body.module) return fail("Missing required field: module", "ERR_VALIDATION", 400);
      if (!body.interaction_action) return fail("Missing required field: interaction_action", "ERR_VALIDATION", 400);
      const entry = await logInteraction({
        user_id,
        module: body.module,
        action: body.interaction_action,
        summary: body.summary,
        outcome: body.outcome,
        metadata: body.metadata,
      });
      if (!entry) return fail("Failed to log interaction", "ERR_INTERNAL", 500);
      return ok({ entry });
    }

    if (action === "interactions.list") {
      const interactions = await getRecentInteractions(user_id, {
        module: body.module,
        limit: body.limit,
      });
      return ok({ interactions });
    }

    // ── Context ─────────────────────────────────────────────────────────────
    if (action === "context.get") {
      const ctx = await buildCompanionContext(user_id);
      return ok({ context: ctx, formatted: formatCompanionContext(ctx) });
    }

    return fail(`Unknown action: ${action}`, "ERR_VALIDATION", 400);
  } catch (e) {
    console.error(`companion-engine [${action}] error:`, e.message);
    return fail(e.message || "Internal server error", "ERR_INTERNAL", 500);
  }
}
