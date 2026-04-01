/**
 * super-admin.ts — Centralized super-admin allowlist.
 *
 * Every admin / billing / entitlement check in the frontend should route
 * through `isSuperAdmin()` so that the listed emails always resolve to the
 * highest privileges without touching the database.
 *
 * To add another permanent super-admin, simply append to SUPER_ADMIN_EMAILS.
 */

/** Canonical list of emails that are permanently treated as super-admins. */
export const SUPER_ADMIN_EMAILS: ReadonlyArray<string> = [
  'dlsvmconsulting@gmail.com',
];

const normalised = new Set(SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase()));

/**
 * Returns `true` when the given email belongs to a permanent super-admin.
 * Comparison is case-insensitive.
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return normalised.has(email.toLowerCase());
}
