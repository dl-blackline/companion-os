/**
 * audit-log.js — Admin-only audit log reader
 */
import { supabase } from "../../lib/_supabase.js";
import { ok, fail, preflight } from "../../lib/_responses.js";

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return preflight();
  if (event.httpMethod !== "GET") return fail("Method not allowed", "ERR_METHOD", 405);

  if (!supabase) return fail("Server configuration error", "ERR_CONFIG", 500);

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return fail("Unauthorized", "ERR_AUTH", 401);

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return fail("Unauthorized", "ERR_AUTH", 401);

  const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
  if (roleData?.role !== "admin") return fail("Admin access required", "ERR_FORBIDDEN", 403);

  try {
    const params = event.queryStringParameters || {};
    const page = parseInt(params.page || "1", 10);
    const limit = Math.min(parseInt(params.limit || "50", 10), 100);
    const offset = (page - 1) * limit;
    const action = params.action;
    const actor_id = params.actor_id;

    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (action) query = query.ilike("action", `%${action}%`);
    if (actor_id) query = query.eq("actor_id", actor_id);

    const { data, error, count } = await query;
    if (error) return fail(error.message, "ERR_INTERNAL", 500);

    return ok({ logs: data || [], total: count || 0, page, limit });
  } catch (err) {
    console.error("audit-log error:", err);
    return fail(err.message, "ERR_INTERNAL", 500);
  }
}
