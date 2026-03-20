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

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function ok(body) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

function err(statusCode, message) {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: message }),
  };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return err(405, "Method not allowed");
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return err(400, "Invalid JSON body");
  }

  const { action, user_id } = body;

  if (!action) return err(400, "Missing required field: action");
  if (!user_id) return err(400, "Missing required field: user_id");

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
      if (!body.title) return err(400, "Missing required field: title");
      const goal = await createGoal({
        user_id,
        domain: body.domain,
        title: body.title,
        description: body.description,
        priority: body.priority,
        target_date: body.target_date,
      });
      if (!goal) return err(500, "Failed to create goal");
      return ok({ goal });
    }

    if (action === "goals.update") {
      if (!body.goal_id) return err(400, "Missing required field: goal_id");
      const goal = await updateGoal(body.goal_id, body);
      if (!goal) return err(500, "Failed to update goal");
      return ok({ goal });
    }

    if (action === "goals.delete") {
      if (!body.goal_id) return err(400, "Missing required field: goal_id");
      const deleted = await deleteGoal(body.goal_id);
      if (!deleted) return err(500, "Failed to delete goal");
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
      if (!body.label) return err(400, "Missing required field: label");
      if (!body.value) return err(400, "Missing required field: value");
      const constraint = await createConstraint({
        user_id,
        domain: body.domain,
        label: body.label,
        value: body.value,
      });
      if (!constraint) return err(500, "Failed to create constraint");
      return ok({ constraint });
    }

    if (action === "constraints.update") {
      if (!body.constraint_id) return err(400, "Missing required field: constraint_id");
      const constraint = await updateConstraint(body.constraint_id, body);
      if (!constraint) return err(500, "Failed to update constraint");
      return ok({ constraint });
    }

    if (action === "constraints.delete") {
      if (!body.constraint_id) return err(400, "Missing required field: constraint_id");
      const deleted = await deleteConstraint(body.constraint_id);
      if (!deleted) return err(500, "Failed to delete constraint");
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
      if (!body.initiative_id) return err(400, "Missing required field: initiative_id");
      if (!body.status) return err(400, "Missing required field: status");
      const initiative = await updateInitiativeStatus(body.initiative_id, body.status);
      if (!initiative) return err(500, "Failed to update initiative");
      return ok({ initiative });
    }

    if (action === "initiatives.generate") {
      const initiatives = await generateInitiatives(user_id);
      return ok({ initiatives });
    }

    // ── Interactions ────────────────────────────────────────────────────────
    if (action === "interactions.log") {
      if (!body.module) return err(400, "Missing required field: module");
      if (!body.interaction_action) return err(400, "Missing required field: interaction_action");
      const entry = await logInteraction({
        user_id,
        module: body.module,
        action: body.interaction_action,
        summary: body.summary,
        outcome: body.outcome,
        metadata: body.metadata,
      });
      if (!entry) return err(500, "Failed to log interaction");
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

    return err(400, `Unknown action: ${action}`);
  } catch (e) {
    console.error(`companion-engine [${action}] error:`, e.message);
    return err(500, e.message || "Internal server error");
  }
}
