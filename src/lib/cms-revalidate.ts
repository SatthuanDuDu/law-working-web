/**
 * Invalidate Next.js cache on the public homepage after CMS writes.
 * No-ops when SITE_URL / SITE_REVALIDATE_SECRET are unset (local without site).
 */
export async function revalidatePublicSite(paths?: string[]) {
  const siteUrl = process.env.SITE_URL?.trim().replace(/\/$/, "");
  const secret = process.env.SITE_REVALIDATE_SECRET?.trim();
  if (!siteUrl || !secret) {
    console.warn(
      "[cms] SITE_URL or SITE_REVALIDATE_SECRET missing — skip public revalidate",
    );
    return;
  }

  try {
    const res = await fetch(`${siteUrl}/api/revalidate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paths?.length ? { paths } : {}),
      cache: "no-store",
    });
    const bodyText = await res.text();
    if (!res.ok) {
      console.warn("[cms] revalidate failed", res.status, bodyText);
    }
  } catch (err) {
    console.warn("[cms] revalidate error", err);
  }
}
