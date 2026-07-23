import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAccessAttachmentTarget } from "@/lib/access";
import { deleteObject } from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";
import { isAdmin } from "@/lib/permissions";

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

  const mode = new URL(request.url).searchParams.get("mode") || "preview";
  const isDownload = mode === "download";
  const contentPath = `/api/attachments/${attachment.id}/content?disposition=${
    isDownload ? "attachment" : "inline"
  }`;

  // Same-origin content proxy — browser never needs to reach MinIO/R2 directly.
  const url = new URL(contentPath, request.url).toString();

  return NextResponse.json({
    url,
    downloadUrl: url,
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    mode: isDownload ? "download" : "preview",
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isAdmin(user.role)) {
    return NextResponse.json(
      { error: "Chỉ admin được đánh dấu Quan trọng" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    isImportant?: boolean;
  };

  if (typeof body.isImportant !== "boolean") {
    return NextResponse.json({ error: "Thiếu isImportant" }, { status: 400 });
  }

  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.json({ error: "Không tìm thấy file" }, { status: 404 });
  }

  if (!attachment.matterId) {
    return NextResponse.json(
      { error: "Chỉ đánh dấu Quan trọng cho tài liệu vụ việc" },
      { status: 400 },
    );
  }

  const allowed = await canAccessAttachmentTarget(user.id, user.role, attachment);
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const matter = await prisma.matter.findUnique({
    where: { id: attachment.matterId },
    select: { status: true },
  });
  if (matter?.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Vụ việc đã lưu trữ — không thể chỉnh sửa" },
      { status: 403 },
    );
  }

  const updated = await prisma.attachment.update({
    where: { id },
    data: { isImportant: body.isImportant },
    select: { id: true, isImportant: true },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "Attachment",
    entityId: id,
    details: body.isImportant
      ? `Đánh dấu Quan trọng: ${attachment.fileName}`
      : `Bỏ Quan trọng: ${attachment.fileName}`,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.json({ error: "Không tìm thấy file" }, { status: 404 });
  }

  const isOwner = attachment.uploadedById === user.id;
  const isElevated = user.role === "ADMIN" || user.role === "MANAGER";
  const allowed = await canAccessAttachmentTarget(user.id, user.role, attachment);

  if (!allowed || (!isOwner && !isElevated)) {
    return NextResponse.json({ error: "Không có quyền xóa file" }, { status: 403 });
  }

  if (attachment.matterId) {
    const matter = await prisma.matter.findUnique({
      where: { id: attachment.matterId },
      select: { status: true },
    });
    if (matter?.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "Vụ việc đã lưu trữ — không thể xóa tài liệu" },
        { status: 403 },
      );
    }
  }

  try {
    await deleteObject(attachment.storageKey);
  } catch {
    // File may already be missing in storage; still remove DB record.
  }

  await prisma.attachment.delete({ where: { id } });

  await createAuditLog({
    userId: user.id,
    action: "DELETE",
    entityType: "Attachment",
    entityId: id,
    details: attachment.fileName,
  });

  return NextResponse.json({ success: true });
}
