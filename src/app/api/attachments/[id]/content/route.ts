import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAccessAttachmentTarget } from "@/lib/access";
import { PROXY_UPLOAD_MAX_BYTES, uploadObject } from "@/lib/storage";

/**
 * Same-origin body upload (browser → Vercel → R2).
 * Avoids Cloudflare R2 CORS issues for typical images/files under ~4MB.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.json({ error: "Không tìm thấy file" }, { status: 404 });
  }

  if (attachment.uploadedById !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "Không có quyền upload" }, { status: 403 });
  }

  const allowed = await canAccessAttachmentTarget(user.id, user.role, attachment);
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền upload" }, { status: 403 });
  }

  const contentType =
    request.headers.get("content-type") ||
    attachment.mimeType ||
    "application/octet-stream";

  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.byteLength <= 0) {
    return NextResponse.json({ error: "File trống" }, { status: 400 });
  }
  if (buffer.byteLength > PROXY_UPLOAD_MAX_BYTES) {
    return NextResponse.json(
      {
        error:
          "File quá lớn để upload qua máy chủ. Dùng lại hoặc giảm kích thước ảnh (<4MB).",
      },
      { status: 413 },
    );
  }

  try {
    await uploadObject(attachment.storageKey, buffer, contentType);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("attachment content upload failed:", error);
    const message =
      error instanceof Error && /Missing environment variable|S3_/i.test(error.message)
        ? "Kho lưu trữ chưa cấu hình (S3/R2). Liên hệ admin."
        : "Upload lên kho lưu trữ thất bại";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
