/**
 * _super-admin.js — Centralized super-admin allowlist (backend / Netlify Functions).
 *
 * Every server-side admin check and entitlement resolution should call
 * `isSuperAdmin()` so that allowlisted emails always bypass role and
 * quota gates without a database lookup.
 *
 * To add more super-admins, append to SUPER_ADMIN_EMAILS.
 */

/** @type {ReadonlyArray<string>} */
export const SUPER_ADMIN_EMAILS = Object.freeze([
  'dlsvmconsulting@gmail.com',
]);

const normalised = new Set(SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase()));

/**
 * @param {string|null|undefined} email
 * @returns {boolean}
 */
export function isSuperAdmin(email) {
  if (!email) return false;
  return normalised.has(email.toLowerCase());
}

/**
 * Checks whether a Supabase user object is a super-admin.
 * Works with objects returned by `supabase.auth.getUser()`.
 * @param {{ email?: string } | null | undefined} user
 * @returns {boolean}
 */
export function isSuperAdminUser(user) {
  return isSuperAdmin(user?.email);
}
