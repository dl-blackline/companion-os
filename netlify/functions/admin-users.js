/**
 * admin-users.js — Admin-only user management endpoint
 * All routes require admin role verified server-side.
 */
import { supabase, supabaseConfigured } from "../../lib/_supabase.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { log } from "../../lib/_log.js";
import { isSuperAdminUser } from "../../lib/_super-admin.js";

function getCurrentUsageWindowStart() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function resolveActor(supabase, token) {
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user || null;
}

async function isAdmin(supabase, userId) {
  // Check user_roles table
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.role === "admin";
}

/** Checks both the super-admin allowlist (by user object) and the DB role. */
async function isAdminOrSuperAdmin(supabase, user) {
  if (isSuperAdminUser(user)) return true;
  return isAdmin(supabase, user.id);
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

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return preflight();

  if (!supabase) return fail("Server configuration error", "ERR_CONFIG", 500);

  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  const token = authHeader?.replace("Bearer ", "");
  const actor = await resolveActor(supabase, token);
  if (!actor) return fail("Unauthorized", "ERR_AUTH", 401);

  const actorIsAdmin = await isAdminOrSuperAdmin(supabase, actor);
  if (!actorIsAdmin) return fail("Admin access required", "ERR_FORBIDDEN", 403);

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

      if (usersErr) return fail(usersErr.message, "ERR_INTERNAL", 500);

      // Fetch roles and entitlements for these users
      const userIds = users.map((u) => u.id);
      const usageWindowStart = getCurrentUsageWindowStart();
      const [{ data: roles }, { data: entitlements }, { data: subscriptions }, { data: usageEvents }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
        supabase.from("user_entitlements").select("user_id, plan, status, trial_ends_at, expires_at").in("user_id", userIds),
        supabase
          .from("billing_subscriptions")
          .select("user_id, status, current_period_end, cancel_at_period_end")
          .in("user_id", userIds),
        supabase
          .from("feature_usage_events")
          .select("user_id, feature_key")
          .in("user_id", userIds)
          .gte("created_at", usageWindowStart),
      ]);

      const roleMap = Object.fromEntries((roles || []).map((r) => [r.user_id, r.role]));
      const planMap = Object.fromEntries((entitlements || []).map((e) => [e.user_id, e]));
      const subscriptionMap = Object.fromEntries((subscriptions || []).map((s) => [s.user_id, s]));
      const usageMap = {};
      for (const usageEvent of usageEvents || []) {
        if (!usageMap[usageEvent.user_id]) {
          usageMap[usageEvent.user_id] = { media_generation: 0, agent_task: 0 };
        }
        if (usageEvent.feature_key === "media_generation" || usageEvent.feature_key === "agent_task") {
          usageMap[usageEvent.user_id][usageEvent.feature_key] += 1;
        }
      }

      let result = users.map((u) => ({
        id: u.id,
        email: u.email,
        display_name: u.user_metadata?.display_name || u.email?.split("@")[0],
        role: roleMap[u.id] || "user",
        plan: planMap[u.id]?.plan || "free",
        plan_status: planMap[u.id]?.status || "active",
        trial_ends_at: planMap[u.id]?.trial_ends_at || null,
        expires_at: planMap[u.id]?.expires_at || null,
        status: u.banned_until ? "suspended" : (u.deleted_at ? "deactivated" : "active"),
        created_at: u.created_at,
        last_sign_in: u.last_sign_in_at,
        current_period_end: subscriptionMap[u.id]?.current_period_end || null,
        cancel_at_period_end: Boolean(subscriptionMap[u.id]?.cancel_at_period_end),
        billing_status: subscriptionMap[u.id]?.status || null,
        usage: usageMap[u.id] || { media_generation: 0, agent_task: 0 },
      }));

      if (search) {
        const q = search.toLowerCase();
        result = result.filter(
          (u) => u.email?.toLowerCase().includes(q) || u.display_name?.toLowerCase().includes(q)
        );
      }

      return ok({ users: result, total: result.length });
    }

    // POST /admin-users — create (or invite) a new user
    if (event.httpMethod === "POST" && (path === "" || path === "/")) {
      const { email, password, role = "user", plan = "free", invite = false } = JSON.parse(event.body || "{}");

      // Resolve the site URL for email redirects (Netlify provides URL automatically)
      const siteUrl = process.env.URL || process.env.SITE_URL;

      let newUser;
      if (invite) {
        // Send an invitation email — no password required
        if (!email) return fail("email required", "ERR_VALIDATION", 400);
        if (!siteUrl) return fail("SITE_URL not configured — cannot send invite emails", "ERR_CONFIG", 500);
        const { data, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
          redirectTo: siteUrl,
        });
        if (inviteErr) return fail(inviteErr.message, "ERR_UNPROCESSABLE", 422);
        newUser = data.user;
      } else {
        // Direct create — password required, email auto-confirmed
        if (!email || !password) return fail("email and password required", "ERR_VALIDATION", 400);
        const { data: { user }, error: createErr } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (createErr) return fail(createErr.message, "ERR_UNPROCESSABLE", 422);
        newUser = user;
      }

      // Assign role and entitlement
      await Promise.all([
        supabase.from("user_roles").upsert({ user_id: newUser.id, role, granted_by: actor.id }, { onConflict: "user_id" }),
        supabase.from("user_entitlements").upsert({ user_id: newUser.id, plan, status: "active" }, { onConflict: "user_id" }),
      ]);

      await auditLog(supabase, actor.id, actor.email, "user.created", "user", newUser.id, { email, role, plan });

      return ok({ user: { id: newUser.id, email: newUser.email, role, plan } }, 201);
    }

    // PATCH /admin-users/:userId — update user role/plan/status
    const matchUpdate = path.match(/^\/([^/]+)$/);
    if (event.httpMethod === "PATCH" && matchUpdate) {
      const targetUserId = matchUpdate[1];
      const { role, plan, entitlement_status, status, display_name, trial_ends_at, expires_at, reset_usage } = JSON.parse(event.body || "{}");

      const updates = [];

      if (role) {
        updates.push(
          supabase.from("user_roles").upsert({ user_id: targetUserId, role, granted_by: actor.id }, { onConflict: "user_id" })
        );
      }

      if (plan || entitlement_status || trial_ends_at !== undefined || expires_at !== undefined) {
        const { data: existingEntitlement } = await supabase
          .from("user_entitlements")
          .select("plan, status, trial_ends_at, expires_at")
          .eq("user_id", targetUserId)
          .maybeSingle();

        updates.push(
          supabase.from("user_entitlements").upsert(
            {
              user_id: targetUserId,
              plan: plan || existingEntitlement?.plan || "free",
              status: entitlement_status || existingEntitlement?.status || "active",
              trial_ends_at: trial_ends_at === undefined ? (existingEntitlement?.trial_ends_at || null) : (trial_ends_at || null),
              expires_at: expires_at === undefined ? (existingEntitlement?.expires_at || null) : (expires_at || null),
              overridden_by: actor.id,
            },
            { onConflict: "user_id" }
          )
        );
      }

      if (reset_usage) {
        updates.push(
          supabase
            .from("feature_usage_events")
            .delete()
            .eq("user_id", targetUserId)
            .gte("created_at", getCurrentUsageWindowStart())
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
      await auditLog(supabase, actor.id, actor.email, "user.updated", "user", targetUserId, { role, plan, entitlement_status, status, display_name, trial_ends_at, expires_at, reset_usage: Boolean(reset_usage) });

      return ok({ updated: true });
    }

    return fail("Not found", "ERR_NOT_FOUND", 404);
  } catch (err) {
    log.error("[admin-users]", "handler error:", err.message);
    return fail(err.message, "ERR_INTERNAL", 500);
  }
}
