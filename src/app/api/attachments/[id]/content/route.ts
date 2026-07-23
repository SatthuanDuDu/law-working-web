import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAccessAttachmentTarget } from "@/lib/access";
import {
  getObjectStream,
  PROXY_UPLOAD_MAX_BYTES,
  uploadObject,
} from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";

function contentDisposition(kind: "inline" | "attachment", fileName: string) {
  const encoded = encodeURIComponent(fileName);
  return `${kind}; filename="${encoded}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
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

  const allowed = await canAccessAttachmentTarget(user.id, user.role, attachment);
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền tải file" }, { status: 403 });
  }

  const dispositionParam = new URL(request.url).searchParams.get("disposition");
  const disposition =
    dispositionParam === "attachment" ? "attachment" : "inline";

  try {
    const object = await getObjectStream(attachment.storageKey);
    const headers = new Headers({
      "Content-Type": attachment.mimeType || object.contentType,
      "Content-Disposition": contentDisposition(disposition, attachment.fileName),
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    });
    if (typeof object.contentLength === "number") {
      headers.set("Content-Length", String(object.contentLength));
    }

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "Attachment",
      entityId: attachment.id,
      details: `${disposition === "attachment" ? "Tải xuống" : "Xem"}: ${attachment.fileName}`,
    });

    return new NextResponse(object.body, { status: 200, headers });
  } catch (error) {
    console.error("attachment content proxy failed:", error);
    return NextResponse.json(
      { error: "Không mở được file" },
      { status: 502 },
    );
  }
}

/**
 * Same-origin upload of prepared attachment bytes (browser → Next → MinIO/R2).
 * Used by putAttachmentBytes for files ≤ PROXY_UPLOAD_MAX_BYTES.
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

  // Only the uploader may fill bytes for a just-prepared attachment.
  if (attachment.uploadedById !== user.id) {
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
        error: `File quá lớn cho upload proxy (tối đa ${Math.floor(PROXY_UPLOAD_MAX_BYTES / (1024 * 1024))}MB)`,
      },
      { status: 413 },
    );
  }
  // sizeBytes is declared at prepare-time; require exact match to avoid slot reuse abuse
  if (buffer.byteLength !== attachment.sizeBytes) {
    return NextResponse.json(
      { error: "Kích thước file không khớp phiên upload" },
      { status: 400 },
    );
  }

  try {
    await uploadObject(attachment.storageKey, buffer, contentType);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("attachment content upload failed:", error);
    const message =
      error instanceof Error && /Missing environment variable|S3_/i.test(error.message)
        ? "Kho lưu trữ chưa cấu hình (S3/R2). Liên hệ admin."
        : "Upload file thất bại";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
