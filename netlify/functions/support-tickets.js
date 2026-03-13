/**
 * support-tickets.js — Support ticket management
 * Users can create tickets and view their own.
 * Admins can view/update all tickets.
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

async function getUser(supabase, token) {
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user || null;
}

async function checkAdmin(supabase, userId) {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId).single();
  return data?.role === "admin";
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };
  if (!SUPABASE_URL || !SUPABASE_KEY) return res(500, { error: "Server configuration error" });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const token = (event.headers?.authorization || event.headers?.Authorization || "").replace("Bearer ", "");
  const user = await getUser(supabase, token);
  if (!user) return res(401, { error: "Unauthorized" });

  const userIsAdmin = await checkAdmin(supabase, user.id);
  const path = event.path.replace(/.*\/support-tickets/, "");

  try {
    // GET /support-tickets
    if (event.httpMethod === "GET" && (path === "" || path === "/")) {
      const params = event.queryStringParameters || {};
      const status = params.status;
      const priority = params.priority;
      const page = parseInt(params.page || "1", 10);
      const limit = Math.min(parseInt(params.limit || "25", 10), 100);
      const offset = (page - 1) * limit;

      let query = supabase
        .from("support_tickets")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      // Non-admins only see their own tickets
      if (!userIsAdmin) query = query.eq("user_id", user.id);
      if (status) query = query.eq("status", status);
      if (priority) query = query.eq("priority", priority);

      const { data, error, count } = await query;
      if (error) return res(500, { error: error.message });
      return res(200, { tickets: data || [], total: count || 0 });
    }

    // POST /support-tickets — create a ticket
    if (event.httpMethod === "POST" && (path === "" || path === "/")) {
      const { title, description, category = "other", priority = "medium" } = JSON.parse(event.body || "{}");
      if (!title) return res(400, { error: "title is required" });

      const { data, error } = await supabase
        .from("support_tickets")
        .insert({ user_id: user.id, title, description: description || "", category, priority, status: "open" })
        .select()
        .single();

      if (error) return res(422, { error: error.message });

      await supabase.from("audit_logs").insert({
        actor_id: user.id, actor_email: user.email, action: "support_ticket.created",
        target_type: "support_ticket", target_id: data.id, details: { title, category, priority },
      });

      return res(201, { ticket: data });
    }

    // PATCH /support-tickets/:id — admin updates status/notes/resolution
    const matchPatch = path.match(/^\/([^/]+)$/);
    if (event.httpMethod === "PATCH" && matchPatch) {
      if (!userIsAdmin) return res(403, { error: "Admin access required" });

      const ticketId = matchPatch[1];
      const body = JSON.parse(event.body || "{}");
      const safe = {};
      const allowed = ["status", "priority", "assignee_id", "admin_notes", "resolution", "category"];
      for (const k of allowed) {
        if (k in body) safe[k] = body[k];
      }

      const { data, error } = await supabase
        .from("support_tickets")
        .update(safe)
        .eq("id", ticketId)
        .select()
        .single();

      if (error) return res(422, { error: error.message });

      await supabase.from("audit_logs").insert({
        actor_id: user.id, actor_email: user.email, action: "support_ticket.updated",
        target_type: "support_ticket", target_id: ticketId, details: safe,
      });

      return res(200, { ticket: data });
    }

    return res(404, { error: "Not found" });
  } catch (err) {
    console.error("support-tickets error:", err);
    return res(500, { error: err.message });
  }
}
