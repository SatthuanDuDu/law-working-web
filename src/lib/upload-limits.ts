/**
 * Max size for matter/plan document attachments (folder upload included).
 * Large files use presigned PUT to MinIO/S3; see PROXY_UPLOAD_MAX_BYTES.
 */
export const ATTACHMENT_MAX_BYTES = 500 * 1024 * 1024;

/**
 * Same-origin upload proxy max.
 * Vercel serverless body limit is ~4.5MB; self-hosted keeps a modest cap so
 * Next.js does not buffer huge bodies — bigger files fall back to presigned PUT.
 */
export const PROXY_UPLOAD_MAX_BYTES = process.env.VERCEL
  ? 4 * 1024 * 1024
  : 25 * 1024 * 1024;
