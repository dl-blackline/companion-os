/**
 * admin-users.js — Admin-only user management endpoint
 * All routes require admin role verified server-side.
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

async function resolveActor(supabase, token) {
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user || null;
}

async function isAdmin(supabase, userId) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();
  return data?.role === "admin";
}

async function auditLog(supabase, actorId, actorEmail, action, targetType, targetId, details) {
  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    actor_email: actorEmail,
    action,
    target_type: targetType,
    target_id: targetId,
    details,
  });
}

// Ban duration for effectively permanent suspension (~100 years)
const PERMANENT_BAN_DURATION = "876600h";

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: CORS, body: "" };

  const supabase = getSupabase();
  if (!supabase) return res(500, { error: "Server configuration error" });

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace("Bearer ", "");
  const actor = await resolveActor(supabase, token);
  if (!actor) return res(401, { error: "Unauthorized" });

  const actorIsAdmin = await isAdmin(supabase, actor.id);
  if (!actorIsAdmin) return res(403, { error: "Admin access required" });

  const path = event.path.replace(/.*\/admin-users/, "");

  try {
    // GET /admin-users — list all users with role/plan
    if (event.httpMethod === "GET" && (path === "" || path === "/")) {
      const search = event.queryStringParameters?.search || "";
      const page = parseInt(event.queryStringParameters?.page || "1", 10);
      const limit = parseInt(event.queryStringParameters?.limit || "50", 10);
      const offset = (page - 1) * limit;

      // List auth users via admin API
      const { data: { users }, error: usersErr } = await supabase.auth.admin.listUsers({
        page,
        perPage: limit,
      });

      if (usersErr) return res(500, { error: usersErr.message });

      // Fetch roles and entitlements for these users
      const userIds = users.map((u) => u.id);
      const [{ data: roles }, { data: entitlements }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
        supabase.from("user_entitlements").select("user_id, plan, status").in("user_id", userIds),
      ]);

      const roleMap = Object.fromEntries((roles || []).map((r) => [r.user_id, r.role]));
      const planMap = Object.fromEntries((entitlements || []).map((e) => [e.user_id, { plan: e.plan, status: e.status }]));

      let result = users.map((u) => ({
        id: u.id,
        email: u.email,
        display_name: u.user_metadata?.display_name || u.email?.split("@")[0],
        role: roleMap[u.id] || "user",
        plan: planMap[u.id]?.plan || "free",
        plan_status: planMap[u.id]?.status || "active",
        status: u.banned_until ? "suspended" : (u.deleted_at ? "deactivated" : "active"),
        created_at: u.created_at,
        last_sign_in: u.last_sign_in_at,
      }));

      if (search) {
        const q = search.toLowerCase();
        result = result.filter(
          (u) => u.email?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q)
        );
      }

      return res(200, { users: result, total: result.length });
    }

    // POST /admin-users — create a new user
    if (event.httpMethod === "POST" && (path === "" || path === "/")) {
      const { email, password, role = "user", plan = "free" } = JSON.parse(event.body || "{}");
      if (!email || !password) return res(400, { error: "email and password required" });

      const { data: { user: newUser }, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr) return res(422, { error: createErr.message });

      // Assign role and entitlement
      await Promise.all([
        supabase.from("user_roles").upsert({ user_id: newUser.id, role, granted_by: actor.id }, { onConflict: "user_id" }),
        supabase.from("user_entitlements").upsert({ user_id: newUser.id, plan, status: "active" }, { onConflict: "user_id" }),
      ]);

      await auditLog(supabase, actor.id, actor.email, "user.created", "user", newUser.id, { email, role, plan });

      return res(201, { user: { id: newUser.id, email: newUser.email, role, plan } });
    }

    // PATCH /admin-users/:userId — update user role/plan/status
    const matchUpdate = path.match(/^\/([^/]+)$/);
    if (event.httpMethod === "PATCH" && matchUpdate) {
      const targetUserId = matchUpdate[1];
      const { role, plan, status, display_name } = JSON.parse(event.body || "{}");

      const updates = [];

      if (role) {
        updates.push(
          supabase.from("user_roles").upsert({ user_id: targetUserId, role, granted_by: actor.id }, { onConflict: "user_id" })
        );
      }

      if (plan) {
        updates.push(
          supabase.from("user_entitlements").upsert(
            { user_id: targetUserId, plan, status: "active", overridden_by: actor.id },
            { onConflict: "user_id" }
          )
        );
      }

      if (display_name) {
        updates.push(
          supabase.auth.admin.updateUserById(targetUserId, {
            user_metadata: { display_name },
          })
        );
      }

      if (status === "suspended") {
        updates.push(
          supabase.auth.admin.updateUserById(targetUserId, {
            ban_duration: PERMANENT_BAN_DURATION,
          })
        );
      } else if (status === "active") {
        updates.push(
          supabase.auth.admin.updateUserById(targetUserId, { ban_duration: "none" })
        );
      }

      await Promise.all(updates);
      await auditLog(supabase, actor.id, actor.email, "user.updated", "user", targetUserId, { role, plan, status, display_name });

      return res(200, { success: true });
    }

    return res(404, { error: "Not found" });
  } catch (err) {
    console.error("admin-users error:", err);
    return res(500, { error: err.message });
  }
}
