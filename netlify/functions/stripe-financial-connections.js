/**
 * stripe-financial-connections.js — Stripe Financial Connections endpoint.
 *
 * Routes:
 *   GET  /stripe-financial-connections                              -> list linked accounts
 *   POST /stripe-financial-connections { action: "create_session" } -> start linking flow
 *   POST /stripe-financial-connections { action: "complete_session", accounts: [...] } -> persist linked accounts
 *   POST /stripe-financial-connections { action: "disconnect", accountId }  -> disconnect an account
 *   POST /stripe-financial-connections { action: "refresh", accountId }     -> refresh account data
 */

import { supabase } from "../../lib/_supabase.js";
import { ok, fail, preflight } from "../../lib/_responses.js";
import { log } from "../../lib/_log.js";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const stripeConfigured = Boolean(STRIPE_SECRET_KEY);

// ── Stripe API helpers ──────────────────────────────────────────────────────

/**
 * POST to the Stripe API using form-encoded parameters.
 * Follows the same pattern as billing-subscription.js.
 */
async function stripePost(path, params) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  const body = new URLSearchParams(params).toString();
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const json = await response.json();
  if (!response.ok) {
    const msg = json?.error?.message || "Stripe request failed.";
    log.error("[stripe-fc]", `POST ${path} failed:`, msg);
    throw new Error(msg);
  }
  return json;
}

/**
 * GET from the Stripe API.
 */
async function stripeGet(path) {
  if (!STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    },
  });

  const json = await response.json();
  if (!response.ok) {
    const msg = json?.error?.message || "Stripe GET request failed.";
    log.error("[stripe-fc]", `GET ${path} failed:`, msg);
    throw new Error(msg);
  }
  return json;
}

// ── Auth helpers ────────────────────────────────────────────────────────────

function getAuthToken(event) {
  const authHeader =
    event.headers?.authorization || event.headers?.Authorization;
  return authHeader?.replace("Bearer ", "") || "";
}

async function resolveActor(token) {
  if (!token) return null;
  const { data } = await supabase.auth.getUser(token);
  return data?.user || null;
}

// ── Action handlers ─────────────────────────────────────────────────────────

/**
 * List all linked Stripe Financial Connections accounts for the user.
 */
async function handleListAccounts(userId) {
  const { data: accounts, error } = await supabase
    .from("stripe_financial_accounts")
    .select(
      "id, stripe_financial_connection_account_id, institution_name, account_display_name, " +
        "account_type, account_subtype, account_status, last4, livemode, permissions, " +
        "supported_payment_method_types, balance_refresh_status, ownership_refresh_status, " +
        "transaction_refresh_status, linked_at, updated_at, disconnected_at, metadata"
    )
    .eq("user_id", userId)
    .is("disconnected_at", null)
    .order("linked_at", { ascending: false });

  if (error) {
    log.error("[stripe-fc]", "Failed to list accounts:", error.message);
    return fail("Failed to retrieve linked accounts.", "ERR_DB", 500);
  }

  return ok({
    configured: stripeConfigured,
    accounts: accounts || [],
    count: (accounts || []).length,
  });
}

/**
 * Create a Stripe Financial Connections Session for account linking.
 * Returns the client_secret so the frontend can launch the auth flow.
 */
async function handleCreateSession(user) {
  if (!stripeConfigured) {
    return ok({
      configured: false,
      message:
        "Stripe Financial Connections is not configured. Set STRIPE_SECRET_KEY to enable bank linking.",
    });
  }

  log.info("[stripe-fc]", "Creating FC session for user", user.id);

  // Create a Financial Connections Session via Stripe API.
  // Permissions: balances (extend with transactions, ownership as needed).
  const session = await stripePost("financial_connections/sessions", {
    "account_holder[type]": "customer",
    "account_holder[customer]": await ensureStripeCustomer(user),
    "permissions[]": "balances",
    "filters[countries][]": "US",
  });

  log.info("[stripe-fc]", "FC session created:", session.id);

  return ok({
    configured: true,
    clientSecret: session.client_secret,
    sessionId: session.id,
  });
}

/**
 * Ensure the user has a Stripe customer record (reuse from billing).
 */
async function ensureStripeCustomer(user) {
  // Check if customer already exists in billing_customers table
  const { data: existing } = await supabase
    .from("billing_customers")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single();

  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  // Create new Stripe customer
  const customer = await stripePost("customers", {
    email: user.email || "",
    "metadata[supabase_user_id]": user.id,
  });

  const { error } = await supabase.from("billing_customers").upsert(
    {
      user_id: user.id,
      stripe_customer_id: customer.id,
    },
    { onConflict: "user_id" }
  );

  if (error) {
    log.error("[stripe-fc]", "Failed to persist customer record:", error.message);
  }

  return customer.id;
}

/**
 * After the user completes the Financial Connections flow on the frontend,
 * retrieve the linked accounts from Stripe and persist them.
 */
async function handleCompleteSession(user, body) {
  if (!stripeConfigured) {
    return fail(
      "Stripe is not configured on the server.",
      "ERR_CONFIG",
      500
    );
  }

  const sessionId = body?.sessionId;
  if (!sessionId || typeof sessionId !== "string") {
    return fail(
      "Missing required field: sessionId",
      "ERR_VALIDATION",
      400
    );
  }

  log.info("[stripe-fc]", "Completing session", sessionId, "for user", user.id);

  // Retrieve the session to get linked accounts
  const session = await stripeGet(
    `financial_connections/sessions/${encodeURIComponent(sessionId)}`
  );

  const linkedAccounts = session.accounts?.data || [];

  if (linkedAccounts.length === 0) {
    log.warn("[stripe-fc]", "Session completed but no accounts linked");
    return ok({
      configured: true,
      accounts: [],
      count: 0,
      message: "No accounts were linked in this session.",
    });
  }

  // Persist each linked account
  const persisted = [];
  for (const account of linkedAccounts) {
    const row = {
      user_id: user.id,
      stripe_financial_connection_account_id: account.id,
      institution_name: account.institution_name || null,
      account_display_name: account.display_name || null,
      account_type: account.category || null,
      account_subtype: account.subcategory || null,
      account_status: account.status || "active",
      last4: account.last4 || null,
      livemode: Boolean(account.livemode),
      permissions: account.permissions || [],
      supported_payment_method_types:
        account.supported_payment_method_types || [],
      balance_refresh_status: account.balance_refresh?.status || null,
      ownership_refresh_status: account.ownership_refresh?.status || null,
      transaction_refresh_status:
        account.transaction_refresh?.status || null,
      linked_at: new Date().toISOString(),
      disconnected_at: null,
      metadata: {
        institution_id: account.institution_id || null,
        account_holder: account.account_holder || null,
      },
    };

    const { data: upserted, error } = await supabase
      .from("stripe_financial_accounts")
      .upsert(row, {
        onConflict: "stripe_financial_connection_account_id",
      })
      .select()
      .single();

    if (error) {
      log.error(
        "[stripe-fc]",
        "Failed to persist account:",
        account.id,
        error.message
      );
      continue;
    }

    persisted.push(upserted);
  }

  log.info(
    "[stripe-fc]",
    `Persisted ${persisted.length}/${linkedAccounts.length} accounts`
  );

  // Return all active accounts
  return handleListAccounts(user.id);
}

/**
 * Disconnect (soft-delete) a linked account.
 */
async function handleDisconnect(user, body) {
  const accountId = body?.accountId;
  if (!accountId || typeof accountId !== "string") {
    return fail("Missing required field: accountId", "ERR_VALIDATION", 400);
  }

  // Verify the account belongs to the user before disconnecting
  const { data: existing } = await supabase
    .from("stripe_financial_accounts")
    .select("id, stripe_financial_connection_account_id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .single();

  if (!existing) {
    return fail("Account not found or access denied.", "ERR_NOT_FOUND", 404);
  }

  log.info(
    "[stripe-fc]",
    "Disconnecting account",
    existing.stripe_financial_connection_account_id,
    "for user",
    user.id
  );

  // Disconnect on Stripe side
  if (stripeConfigured) {
    try {
      await stripePost(
        `financial_connections/accounts/${encodeURIComponent(existing.stripe_financial_connection_account_id)}/disconnect`,
        {}
      );
    } catch (err) {
      // Log but don't fail — the account may already be disconnected on Stripe's side
      log.warn(
        "[stripe-fc]",
        "Stripe disconnect API error (continuing):",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  // Soft-delete in our DB
  const { error } = await supabase
    .from("stripe_financial_accounts")
    .update({
      account_status: "disconnected",
      disconnected_at: new Date().toISOString(),
    })
    .eq("id", accountId)
    .eq("user_id", user.id);

  if (error) {
    log.error("[stripe-fc]", "Failed to disconnect account:", error.message);
    return fail("Failed to disconnect account.", "ERR_DB", 500);
  }

  return handleListAccounts(user.id);
}

/**
 * Refresh account data from Stripe.
 */
async function handleRefresh(user, body) {
  const accountId = body?.accountId;

  if (accountId) {
    // Refresh a specific account
    const { data: existing } = await supabase
      .from("stripe_financial_accounts")
      .select("id, stripe_financial_connection_account_id")
      .eq("id", accountId)
      .eq("user_id", user.id)
      .is("disconnected_at", null)
      .single();

    if (!existing) {
      return fail(
        "Account not found or access denied.",
        "ERR_NOT_FOUND",
        404
      );
    }

    await refreshSingleAccount(user.id, existing);
  } else {
    // Refresh all active accounts
    const { data: accounts } = await supabase
      .from("stripe_financial_accounts")
      .select("id, stripe_financial_connection_account_id")
      .eq("user_id", user.id)
      .is("disconnected_at", null);

    if (accounts && accounts.length > 0) {
      for (const account of accounts) {
        await refreshSingleAccount(user.id, account);
      }
    }
  }

  return handleListAccounts(user.id);
}

/**
 * Refresh a single account's metadata from Stripe.
 */
async function refreshSingleAccount(userId, dbAccount) {
  if (!stripeConfigured) return;

  try {
    const stripeAccount = await stripeGet(
      `financial_connections/accounts/${encodeURIComponent(dbAccount.stripe_financial_connection_account_id)}`
    );

    await supabase
      .from("stripe_financial_accounts")
      .update({
        institution_name: stripeAccount.institution_name || null,
        account_display_name: stripeAccount.display_name || null,
        account_type: stripeAccount.category || null,
        account_subtype: stripeAccount.subcategory || null,
        account_status: stripeAccount.status || "active",
        last4: stripeAccount.last4 || null,
        permissions: stripeAccount.permissions || [],
        supported_payment_method_types:
          stripeAccount.supported_payment_method_types || [],
        balance_refresh_status:
          stripeAccount.balance_refresh?.status || null,
        ownership_refresh_status:
          stripeAccount.ownership_refresh?.status || null,
        transaction_refresh_status:
          stripeAccount.transaction_refresh?.status || null,
        metadata: {
          institution_id: stripeAccount.institution_id || null,
          account_holder: stripeAccount.account_holder || null,
        },
      })
      .eq("id", dbAccount.id)
      .eq("user_id", userId);

    log.info(
      "[stripe-fc]",
      "Refreshed account",
      dbAccount.stripe_financial_connection_account_id
    );
  } catch (err) {
    log.error(
      "[stripe-fc]",
      "Failed to refresh account:",
      dbAccount.stripe_financial_connection_account_id,
      err instanceof Error ? err.message : String(err)
    );

    // Mark as error status if Stripe says it's disconnected
    await supabase
      .from("stripe_financial_accounts")
      .update({ account_status: "error" })
      .eq("id", dbAccount.id)
      .eq("user_id", userId);
  }
}

// ── Main handler ────────────────────────────────────────────────────────────

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return preflight();

  if (!supabase) {
    return fail("Server configuration error", "ERR_CONFIG", 500);
  }

  const token = getAuthToken(event);
  const user = await resolveActor(token);
  if (!user) return fail("Unauthorized", "ERR_AUTH", 401);

  try {
    if (event.httpMethod === "GET") {
      return handleListAccounts(user.id);
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

    const action = body.action;

    switch (action) {
      case "create_session":
        return await handleCreateSession(user);
      case "complete_session":
        return await handleCompleteSession(user, body);
      case "disconnect":
        return await handleDisconnect(user, body);
      case "refresh":
        return await handleRefresh(user, body);
      default:
        return fail(`Unknown action: ${action}`, "ERR_VALIDATION", 400);
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Financial connections request failed.";
    log.error("[stripe-fc]", "Handler error:", message);
    return fail(message, "ERR_STRIPE_FC", 500);
  }
}
