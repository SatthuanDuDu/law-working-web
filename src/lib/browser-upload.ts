/** Keep in sync with PROXY_UPLOAD_MAX_BYTES in storage.ts (avoid importing AWS SDK on client). */
const PROXY_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

type PutResult = { ok: true } | { ok: false; corsLikely: boolean; status?: number };

/**
 * Upload file bytes after /api/attachments prepare.
 * Prefer same-origin proxy (no R2 CORS); fall back to presigned PUT for larger files.
 */
export async function putAttachmentBytes(options: {
  attachmentId: string;
  uploadUrl: string;
  file: Blob;
  mimeType: string;
}): Promise<PutResult> {
  const { attachmentId, uploadUrl, file, mimeType } = options;
  const contentType = mimeType || "application/octet-stream";

  if (file.size <= PROXY_UPLOAD_MAX_BYTES) {
    const res = await fetch(`/api/attachments/${attachmentId}/content`, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    }).catch(() => null);

    if (res?.ok) return { ok: true };
    // If proxy fails unexpectedly, try direct as fallback when URL exists.
    if (!uploadUrl) {
      return { ok: false, corsLikely: false, status: res?.status };
    }
  }

  const direct = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  }).catch(() => null);

  if (direct?.ok) return { ok: true };
  return {
    ok: false,
    corsLikely: !direct,
    status: direct?.status,
  };
}
