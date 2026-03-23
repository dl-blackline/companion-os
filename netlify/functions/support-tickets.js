/**
 * support-tickets.js — Support ticket management
 * Users can create tickets and view their own.
 * Admins can view/update all tickets.
 */
import { supabase } from "../../lib/_supabase.js";
import { ok, fail, preflight } from "../../lib/_responses.js";

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
  if (event.httpMethod === "OPTIONS") return preflight();
  if (!supabase) return fail("Server configuration error", "ERR_CONFIG", 500);

  const token = (event.headers?.authorization || event.headers?.Authorization || "").replace("Bearer ", "");
  const user = await getUser(supabase, token);
  if (!user) return fail("Unauthorized", "ERR_AUTH", 401);

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
      if (error) return fail(error.message, "ERR_INTERNAL", 500);
      return ok({ tickets: data || [], total: count || 0 });
    }

    // POST /support-tickets — create a ticket
    if (event.httpMethod === "POST" && (path === "" || path === "/")) {
      const { title, description, category = "other", priority = "medium" } = JSON.parse(event.body || "{}");
      if (!title) return fail("title is required", "ERR_VALIDATION", 400);

      const { data, error } = await supabase
        .from("support_tickets")
        .insert({ user_id: user.id, title, description: description || "", category, priority, status: "open" })
        .select()
        .single();

      if (error) return fail(error.message, "ERR_UNPROCESSABLE", 422);

      await supabase.from("audit_logs").insert({
        actor_id: user.id, actor_email: user.email, action: "support_ticket.created",
        target_type: "support_ticket", target_id: data.id, details: { title, category, priority },
      });

      return ok({ ticket: data }, 201);
    }

    // PATCH /support-tickets/:id — admin updates status/notes/resolution
    const matchPatch = path.match(/^\/([^/]+)$/);
    if (event.httpMethod === "PATCH" && matchPatch) {
      if (!userIsAdmin) return fail("Admin access required", "ERR_FORBIDDEN", 403);

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

      if (error) return fail(error.message, "ERR_UNPROCESSABLE", 422);

      await supabase.from("audit_logs").insert({
        actor_id: user.id, actor_email: user.email, action: "support_ticket.updated",
        target_type: "support_ticket", target_id: ticketId, details: safe,
      });

      return ok({ ticket: data });
    }

    return fail("Not found", "ERR_NOT_FOUND", 404);
  } catch (err) {
    log.error("[support-tickets]", "handler error:", err.message);
    return fail(err.message, "ERR_INTERNAL", 500);
  }
}
