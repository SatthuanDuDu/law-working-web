import { getSessionUser } from "@/lib/session";
import { isManagerOrAbove } from "@/lib/permissions";
import type { SessionUser } from "@/lib/permissions";

/** API-safe gate — returns null instead of redirecting. */
export async function requireCmsApiUser(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user || !isManagerOrAbove(user.role)) return null;
  return user;
}
