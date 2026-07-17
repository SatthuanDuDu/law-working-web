/** Demo admin stored with a valid email; login alias "admin" is accepted at sign-in. */
export const DEMO_ADMIN_EMAIL = "admin@admin.com";
export const DEMO_ADMIN_PASSWORD = "admin";

export function resolveLoginEmail(login: string): string {
  const trimmed = login.trim().toLowerCase();
  if (trimmed === "admin") return DEMO_ADMIN_EMAIL;
  return trimmed;
}
