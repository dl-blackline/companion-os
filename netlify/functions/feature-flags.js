/**
 * feature-flags.js — Feature flag management
 * GET: public (non-admin flags for all users; all flags for admins)
 * POST/PATCH: admin-only
 */
import { supabase, supabaseConfigured } from "../../lib/_supabase.js";
import { ok, fail, preflight } from "../../lib/_responses.js";

async function resolveUser(supabase, token) {
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user || null;
}

async function isAdmin(supabase, userId) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).single();
  return data?.role === "admin";
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return preflight();

  if (!supabase) return fail("Server configuration error", "ERR_CONFIG", 500);

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace("Bearer ", "");
  const user = await resolveUser(supabase, token);

  const userIsAdmin = user ? await isAdmin(supabase, user.id) : false;

  try {
    if (event.httpMethod === "GET") {
      let query = supabase.from("feature_flags").select("*").order("category").order("name");
      if (!userIsAdmin) query = query.eq("admin_only", false);

      const { data, error } = await query;
      if (error) return fail(error.message, "ERR_INTERNAL", 500);
      return ok({ flags: data || [] });
    }

    // Write operations require admin
    if (!user) return fail("Unauthorized", "ERR_AUTH", 401);
    if (!userIsAdmin) return fail("Admin access required", "ERR_FORBIDDEN", 403);

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { key, name, description, enabled, rollout_percentage, admin_only, kill_switch, category } = body;
      if (!key || !name) return fail("key and name are required", "ERR_VALIDATION", 400);

      const { data, error } = await supabase
        .from("feature_flags")
        .insert({ key, name, description: description || "", enabled: !!enabled, rollout_percentage: rollout_percentage ?? 100, admin_only: !!admin_only, kill_switch: !!kill_switch, category: category || "ops" })
        .select()
        .single();

      if (error) return fail(error.message, "ERR_UNPROCESSABLE", 422);

      await supabase.from("audit_logs").insert({
        actor_id: user.id, actor_email: user.email, action: "feature_flag.created",
        target_type: "feature_flag", target_id: data.id, details: { key, enabled },
      });

      return ok({ flag: data }, 201);
    }

    if (event.httpMethod === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      const { id, ...updates } = body;
      if (!id) return fail("id is required", "ERR_VALIDATION", 400);

      // Strip non-updatable fields
      const safe = {};
      const allowed = ["name", "description", "enabled", "rollout_percentage", "admin_only", "kill_switch", "category"];
      for (const k of allowed) {
        if (k in updates) safe[k] = updates[k];
      }

      const { data, error } = await supabase
        .from("feature_flags")
        .update(safe)
        .eq("id", id)
        .select()
        .single();

      if (error) return fail(error.message, "ERR_UNPROCESSABLE", 422);

      await supabase.from("audit_logs").insert({
        actor_id: user.id, actor_email: user.email, action: "feature_flag.updated",
        target_type: "feature_flag", target_id: id, details: safe,
      });

      return ok({ flag: data });
    }

    return fail("Method not allowed", "ERR_METHOD", 405);
  } catch (err) {
    log.error("[feature-flags]", "handler error:", err.message);
    return fail(err.message, "ERR_INTERNAL", 500);
  }
}
