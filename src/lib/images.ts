import { cmsMediaPublicUrl } from "@/lib/cms-storage";

const PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9"><rect width="16" height="9" fill="#eef2f0"/></svg>`,
  );

/** Resolve CMS media keys to the public site media proxy. */
export function imageUrl(key: string | null | undefined): string {
  if (!key) return PLACEHOLDER;
  if (key.startsWith("http://") || key.startsWith("https://")) return key;
  if (key.startsWith("/")) return key;
  return cmsMediaPublicUrl(key);
}

export function hasImage(key: string | null | undefined): boolean {
  return Boolean(key && key.trim().length > 0);
}
