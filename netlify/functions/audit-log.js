/**
 * audit-log.js — Admin-only audit log reader
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function res(status, body) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(body) };
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (event.httpMethod !== "GET") return res(405, { error: "Method not allowed" });

  if (!SUPABASE_URL || !SUPABASE_KEY) return res(500, { error: "Server configuration error" });
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace("Bearer ", "");
  if (!token) return res(401, { error: "Unauthorized" });

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return res(401, { error: "Unauthorized" });

  const { data: roleData } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
  if (roleData?.role !== "admin") return res(403, { error: "Admin access required" });

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
    if (error) return res(500, { error: error.message });

    return res(200, { logs: data || [], total: count || 0, page, limit });
  } catch (err) {
    console.error("audit-log error:", err);
    return res(500, { error: err.message });
  }
}
