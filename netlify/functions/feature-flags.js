/**
 * feature-flags.js — Feature flag management
 * GET: public (non-admin flags for all users; all flags for admins)
 * POST/PATCH: admin-only
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function res(status, body) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(body) };
}

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

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
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  const supabase = getSupabase();
  if (!supabase) return res(500, { error: "Server configuration error" });

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace("Bearer ", "");
  const user = await resolveUser(supabase, token);

  const userIsAdmin = user ? await isAdmin(supabase, user.id) : false;

  try {
    if (event.httpMethod === "GET") {
      let query = supabase.from("feature_flags").select("*").order("category").order("name");
      if (!userIsAdmin) query = query.eq("admin_only", false);

      const { data, error } = await query;
      if (error) return res(500, { error: error.message });
      return res(200, { flags: data || [] });
    }

    // Write operations require admin
    if (!user) return res(401, { error: "Unauthorized" });
    if (!userIsAdmin) return res(403, { error: "Admin access required" });

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { key, name, description, enabled, rollout_percentage, admin_only, kill_switch, category } = body;
      if (!key || !name) return res(400, { error: "key and name are required" });

      const { data, error } = await supabase
        .from("feature_flags")
        .insert({ key, name, description: description || "", enabled: !!enabled, rollout_percentage: rollout_percentage ?? 100, admin_only: !!admin_only, kill_switch: !!kill_switch, category: category || "ops" })
        .select()
        .single();

      if (error) return res(422, { error: error.message });

      await supabase.from("audit_logs").insert({
        actor_id: user.id, actor_email: user.email, action: "feature_flag.created",
        target_type: "feature_flag", target_id: data.id, details: { key, enabled },
      });

      return res(201, { flag: data });
    }

    if (event.httpMethod === "PATCH") {
      const body = JSON.parse(event.body || "{}");
      const { id, ...updates } = body;
      if (!id) return res(400, { error: "id is required" });

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

      if (error) return res(422, { error: error.message });

      await supabase.from("audit_logs").insert({
        actor_id: user.id, actor_email: user.email, action: "feature_flag.updated",
        target_type: "feature_flag", target_id: id, details: safe,
      });

      return res(200, { flag: data });
    }

    return res(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("feature-flags error:", err);
    return res(500, { error: err.message });
  }
}
