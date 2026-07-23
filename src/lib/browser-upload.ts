type PutResult = { ok: true } | { ok: false; corsLikely: boolean; status?: number };

/**
 * Prefer same-origin proxy (no R2/MinIO CORS or public bucket endpoint).
 * Fall back to presigned PUT when proxy rejects (e.g. Vercel 4MB body limit).
 */
export async function putAttachmentBytes(options: {
  attachmentId: string;
  uploadUrl: string;
  file: Blob;
  mimeType: string;
}): Promise<PutResult> {
  const { attachmentId, uploadUrl, file, mimeType } = options;
  const contentType = mimeType || "application/octet-stream";

  const res = await fetch(`/api/attachments/${attachmentId}/content`, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: file,
  }).catch(() => null);

  if (res?.ok) return { ok: true };

  if (!uploadUrl) {
    return { ok: false, corsLikely: false, status: res?.status };
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
    status: direct?.status ?? res?.status,
  };
}
