/** Preview link to the public NSLAW website (no edit-on-site). */
export function getSitePreviewHref() {
  return (
    process.env.SITE_URL?.trim().replace(/\/$/, "") ||
    "https://nslaw.webme.io.vn"
  );
}

/** @deprecated use getSitePreviewHref() at request time */
export const SITE_PREVIEW_HREF = getSitePreviewHref();
