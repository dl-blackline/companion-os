#!/usr/bin/env node
/**
 * Post-build security scan — checks that the dist/ bundle does not contain
 * patterns that look like real secret API keys.
 *
 * Run after `vite build`:
 *   node scripts/check-dist-secrets.mjs
 *
 * Patterns checked:
 *   1. OpenAI secret keys: `sk-` followed by 20+ alphanumeric chars
 *   2. Supabase service_role JWTs (decoded from JWT-shaped tokens)
 *   3. Hardcoded Bearer tokens with long credentials
 *   4. Common provider key patterns (Stripe, AWS, GitHub PATs, etc.)
 *
 * Exits with code 1 if any match is found; 0 otherwise.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const DIST_DIR = "dist";

/**
 * Matches OpenAI secret keys: sk- followed by 20+ alphanumeric characters.
 * Hyphens are NOT included after the prefix so CSS class names like
 * "sk-image-linear-from-pos" (Tailwind utilities) won't match.
 */
const OPENAI_KEY_RE = /sk-[A-Za-z0-9]{20,}/g;

/** Matches JWT-shaped tokens (header.payload.signature). */
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g;

/**
 * Matches hardcoded Bearer tokens: "Bearer " followed by a long credential
 * (20+ alphanumeric/special chars).  Dynamic tokens (e.g. `Bearer ${env}`)
 * are checked separately and skipped.
 */
const BEARER_RE = /Bearer [A-Za-z0-9_\-.+/]{40,}/g;

/**
 * Additional secret-like patterns from common providers.
 * Each entry is [regex, label].
 */
const EXTRA_PATTERNS = [
  [/ghp_[A-Za-z0-9]{36,}/g, "GitHub personal access token (ghp_)"],
  [/gho_[A-Za-z0-9]{36,}/g, "GitHub OAuth token (gho_)"],
  [/ghu_[A-Za-z0-9]{36,}/g, "GitHub user-to-server token (ghu_)"],
  [/ghs_[A-Za-z0-9]{36,}/g, "GitHub server-to-server token (ghs_)"],
  [/AKIA[0-9A-Z]{16}/g, "AWS access key ID (AKIA)"],
  [/sk_live_[A-Za-z0-9]{24,}/g, "Stripe live secret key (sk_live_)"],
  [/rk_live_[A-Za-z0-9]{24,}/g, "Stripe restricted key (rk_live_)"],
  [/sk_test_[A-Za-z0-9]{24,}/g, "Stripe test secret key (sk_test_)"],
  [/xoxb-[0-9]{10,}-[A-Za-z0-9-]{20,}/g, "Slack bot token (xoxb-)"],
  [/xoxp-[0-9]{10,}-[A-Za-z0-9-]{20,}/g, "Slack user token (xoxp-)"],
  [/sk-ant-[A-Za-z0-9_-]{20,}/g, "Anthropic API key (sk-ant-)"],
];

/**
 * Decode a base64url string and check if it's a service_role JWT payload.
 * Returns true if the decoded payload has `"role":"service_role"`.
 */
function isServiceRoleJwt(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = base64.length % 4;
    if (pad) base64 += "=".repeat(4 - pad);
    const payload = JSON.parse(Buffer.from(base64, "base64").toString("utf-8"));
    return payload.role === "service_role";
  } catch {
    return false;
  }
}

/** Recursively collect all files in a directory. */
function collectFiles(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

let found = false;

try {
  statSync(DIST_DIR);
} catch {
  console.error(`✗ dist/ directory not found. Run 'npm run build' first.`);
  process.exit(1);
}

const files = collectFiles(DIST_DIR);

for (const file of files) {
  // Only scan text-like bundle files (JS, CSS, HTML, JSON, SVG)
  if (!/\.(js|css|html|json|svg|mjs)$/i.test(file)) continue;

  const content = readFileSync(file, "utf-8");

  // Check 1: OpenAI secret keys
  OPENAI_KEY_RE.lastIndex = 0;
  let match;
  while ((match = OPENAI_KEY_RE.exec(content)) !== null) {
    console.error(
      `✗ SECURITY: OpenAI API key (sk-…) found in ${file} (position ${match.index})`
    );
    found = true;
  }

  // Check 2: Supabase service_role JWTs (decode and inspect each JWT)
  JWT_RE.lastIndex = 0;
  while ((match = JWT_RE.exec(content)) !== null) {
    if (isServiceRoleJwt(match[0])) {
      console.error(
        `✗ SECURITY: Supabase service_role JWT found in ${file} (position ${match.index})`
      );
      found = true;
    }
  }

  // Check 3: Hardcoded Bearer tokens
  BEARER_RE.lastIndex = 0;
  while ((match = BEARER_RE.exec(content)) !== null) {
    console.error(
      `✗ SECURITY: Hardcoded Bearer token found in ${file} (position ${match.index})`
    );
    found = true;
  }

  // Check 4: Additional provider-specific secret patterns
  for (const [re, label] of EXTRA_PATTERNS) {
    re.lastIndex = 0;
    while ((match = re.exec(content)) !== null) {
      console.error(
        `✗ SECURITY: ${label} found in ${file} (position ${match.index})`
      );
      found = true;
    }
  }
}

if (found) {
  console.error(
    "\n✗ Build output contains secret key patterns. " +
      "Ensure all secrets are confined to server-side code (Netlify functions)."
  );
  process.exit(1);
} else {
  console.log("✓ dist/ security scan passed — no secret key patterns found.");
}
