#!/usr/bin/env node
/**
 * Pre-build security scan — checks that source files do not contain
 * patterns that look like hardcoded secret API keys.
 *
 * Run before `vite build`:
 *   node scripts/scan-source-secrets.mjs
 *
 * Patterns checked:
 *   1. OpenAI secret keys: `sk-` followed by 20+ alphanumeric chars
 *      (excludes test files and known safe patterns like regex literals)
 *   2. Hardcoded Bearer tokens with long credentials
 *   3. Supabase service_role JWTs (decoded from JWT-shaped tokens)
 *
 * Exits with code 1 if any match is found; 0 otherwise.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, relative } from "path";

/** Directories to scan. */
const SCAN_DIRS = ["src", "lib", "netlify", "services"];

/** File extensions to scan. */
const SCAN_EXTS = /\.(js|ts|tsx|jsx|mjs|cjs|json)$/i;

/** Paths to skip (test files, config, scan scripts themselves). */
const SKIP_PATTERNS = [
  /\.test\./,
  /\.spec\./,
  /\/test\//,
  /__tests__\//,
  /\/scripts\/scan-source-secrets\.mjs$/,
  /\/scripts\/check-dist-secrets\.mjs$/,
  /\.env\.example$/,
  /node_modules/,
];

/** Matches OpenAI secret keys: sk- followed by 20+ alphanumeric characters. */
const OPENAI_KEY_RE = /sk-[A-Za-z0-9]{20,}/g;

/**
 * Matches hardcoded Bearer tokens: "Bearer " followed by a long credential.
 * Skips template-literal expressions (Bearer ${...}).
 */
const BEARER_RE = /Bearer [A-Za-z0-9_\-.+/]{20,}/g;

/** Matches JWT-shaped tokens (header.payload.signature). */
const JWT_RE = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g;

/**
 * Returns true if the matched string is inside a regex literal, comment,
 * or a known safe pattern (e.g. the regex used to *detect* keys).
 */
function isSafeContext(content, matchIndex) {
  // Check if the match is inside a regex literal (/sk-.../) or string
  // that is clearly a pattern definition, not an actual key.
  const lineStart = content.lastIndexOf("\n", matchIndex) + 1;
  const lineEnd = content.indexOf("\n", matchIndex);
  const line = content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);

  // Skip lines that define regex patterns (detecting keys, not containing them)
  if (/\/.*sk-.*\/[gimsuy]*/.test(line) && /Re|regex|pattern|RE\b/i.test(line)) {
    return true;
  }

  // Skip lines that are clearly comments
  const trimmed = line.trimStart();
  if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
    return true;
  }

  return false;
}

/**
 * Decode a base64url string and check if it's a service_role JWT payload.
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
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      try {
        if (statSync(full).isDirectory()) {
          results.push(...collectFiles(full));
        } else {
          results.push(full);
        }
      } catch {
        // skip inaccessible entries
      }
    }
  } catch {
    // directory doesn't exist — that's fine
  }
  return results;
}

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some((p) => p.test(filePath));
}

let found = false;
const violations = [];

for (const dir of SCAN_DIRS) {
  const files = collectFiles(dir);

  for (const file of files) {
    if (!SCAN_EXTS.test(file) || shouldSkip(file)) continue;

    const content = readFileSync(file, "utf-8");
    const rel = relative(".", file);

    // Check 1: OpenAI secret keys (sk-...)
    OPENAI_KEY_RE.lastIndex = 0;
    let match;
    while ((match = OPENAI_KEY_RE.exec(content)) !== null) {
      if (isSafeContext(content, match.index)) continue;

      violations.push(`  ✗ OpenAI key pattern (sk-…) in ${rel} at offset ${match.index}`);
      found = true;
    }

    // Check 2: Hardcoded Bearer tokens
    BEARER_RE.lastIndex = 0;
    while ((match = BEARER_RE.exec(content)) !== null) {
      // Skip dynamic Bearer tokens (template literals like `Bearer ${var}`)
      const before = content.slice(Math.max(0, match.index - 20), match.index);
      if (/\$\{/.test(before) || /process\.env/.test(before)) continue;

      // Skip if the token part is a template expression
      const tokenPart = match[0].slice(7); // after "Bearer "
      if (tokenPart.startsWith("${") || tokenPart.includes("${")) continue;

      violations.push(`  ✗ Hardcoded Bearer token in ${rel} at offset ${match.index}`);
      found = true;
    }

    // Check 3: Supabase service_role JWTs
    JWT_RE.lastIndex = 0;
    while ((match = JWT_RE.exec(content)) !== null) {
      if (isServiceRoleJwt(match[0])) {
        violations.push(`  ✗ Supabase service_role JWT in ${rel} at offset ${match.index}`);
        found = true;
      }
    }
  }
}

if (found) {
  console.error("✗ SECURITY: Hardcoded secrets found in source files:\n");
  for (const v of violations) console.error(v);
  console.error(
    "\n  Move all secret values to environment variables " +
      "(process.env for backend, VITE_* for frontend)."
  );
  process.exit(1);
} else {
  console.log("✓ Source security scan passed — no hardcoded secrets found.");
}
