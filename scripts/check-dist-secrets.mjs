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
 *   2. Supabase service_role JWTs (base64-encoded payload containing "service_role")
 *
 * Exits with code 1 if any match is found; 0 otherwise.
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const DIST_DIR = "dist";

/** Patterns to search for in bundle files. */
const SECRET_PATTERNS = [
  {
    // Real OpenAI keys: sk- followed by 20+ alphanumeric chars.
    // Short occurrences like CSS "mask-" or "stroke-" won't match.
    pattern: /sk-[A-Za-z0-9]{20,}/g,
    name: "OpenAI API key (sk-…)",
  },
  {
    // A base64-encoded "service_role" inside a JWT-shaped token.
    // Matches the base64 encoding of "role":"service_role".
    // This won't match the string literal "service_role" used in guard code.
    pattern: /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]*c2VydmljZV9yb2xl[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/g,
    name: "Supabase service_role JWT",
  },
];

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

  for (const { pattern, name } of SECRET_PATTERNS) {
    // Reset lastIndex for global regex
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match) {
      console.error(
        `✗ SECURITY: ${name} found in ${file} (near position ${match.index})`
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
