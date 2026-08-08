type PutResult = { ok: true } | { ok: false; corsLikely: boolean; status?: number };

type UploadProgressOptions = {
  method?: string;
  headers?: Record<string, string>;
  onProgress?: (pct: number) => void;
};

type XhrPutResult =
  | { ok: true }
  | { ok: false; status?: number; networkError: boolean };

/**
 * PUT a blob with upload progress via XMLHttpRequest.
 * Prefer this over fetch when percentage feedback is needed.
 */
export function uploadWithProgress(
  url: string,
  file: Blob,
  options: UploadProgressOptions = {},
): Promise<XhrPutResult> {
  const { method = "PUT", headers = {}, onProgress } = options;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      if (!event.lengthComputable || event.total <= 0) {
        onProgress(0);
        return;
      }
      onProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(100);
        resolve({ ok: true });
        return;
      }
      resolve({ ok: false, status: xhr.status, networkError: false });
    };

    xhr.onerror = () => {
      resolve({ ok: false, networkError: true });
    };

    xhr.onabort = () => {
      resolve({ ok: false, networkError: true });
    };

    xhr.send(file);
  });
}

/**
 * Prefer same-origin proxy (no R2/MinIO CORS or public bucket endpoint).
 * Fall back to presigned PUT when proxy rejects (e.g. Vercel 4MB body limit).
 */
export async function putAttachmentBytes(options: {
  attachmentId: string;
  uploadUrl: string;
  file: Blob;
  mimeType: string;
  onProgress?: (pct: number) => void;
}): Promise<PutResult> {
  const { attachmentId, uploadUrl, file, mimeType, onProgress } = options;
  const contentType = mimeType || "application/octet-stream";
  const headers = { "Content-Type": contentType };

  const proxy = await uploadWithProgress(
    `/api/attachments/${attachmentId}/content`,
    file,
    { headers, onProgress },
  );

  if (proxy.ok) return { ok: true };

  if (!uploadUrl) {
    return { ok: false, corsLikely: false, status: proxy.status };
  }

  // Restart progress for the direct fallback attempt.
  onProgress?.(0);

  const direct = await uploadWithProgress(uploadUrl, file, {
    headers,
    onProgress,
  });

  if (direct.ok) return { ok: true };
  return {
    ok: false,
    corsLikely: direct.networkError,
    status: direct.status ?? proxy.status,
  };
}
