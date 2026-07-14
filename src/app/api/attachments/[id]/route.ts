import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAccessAttachmentTarget } from "@/lib/access";
import { createDownloadUrl, deleteObject } from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";

export async function GET(
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

  const allowed = await canAccessAttachmentTarget(user.id, user.role, attachment);
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền tải file" }, { status: 403 });
  }

  const downloadUrl = await createDownloadUrl(
    attachment.storageKey,
    attachment.fileName,
  );

  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "Attachment",
    entityId: attachment.id,
    details: `Tải xuống: ${attachment.fileName}`,
  });

  return NextResponse.json({ downloadUrl, fileName: attachment.fileName });
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
