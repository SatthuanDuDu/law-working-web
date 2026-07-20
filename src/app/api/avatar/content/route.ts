import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import {
  buildAvatarStorageKey,
  PROXY_UPLOAD_MAX_BYTES,
  uploadObject,
} from "@/lib/storage";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

/**
 * Same-origin avatar upload (browser → Vercel → R2).
 * Returns storageKey for /api/avatar/confirm.
 */
export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "image/jpeg";
  if (!ALLOWED_MIME.has(contentType)) {
    return NextResponse.json(
      { error: "Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc GIF" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.byteLength <= 0) {
    return NextResponse.json({ error: "Ảnh trống" }, { status: 400 });
  }
  if (buffer.byteLength > PROXY_UPLOAD_MAX_BYTES) {
    return NextResponse.json(
      { error: "Ảnh không được vượt quá 4MB" },
      { status: 413 },
    );
  }

  const storageKey = buildAvatarStorageKey(user.id, "avatar.jpg");

  try {
    await uploadObject(storageKey, buffer, contentType);
    return NextResponse.json({ storageKey });
  } catch (error) {
    console.error("avatar content upload failed:", error);
    const message =
      error instanceof Error && /Missing environment variable|S3_/i.test(error.message)
        ? "Kho lưu trữ chưa cấu hình (S3/R2). Liên hệ admin."
        : "Upload ảnh thất bại";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
