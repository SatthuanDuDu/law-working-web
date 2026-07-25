import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAccessAttachmentTarget } from "@/lib/access";
import { buildStorageKey, createUploadUrl, deleteObject } from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";
import { canManageMatterDocuments } from "@/lib/permissions";

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

/**
 * Prepare a new version that replaces the latest matter attachment
 * (same versionGroupId, inherits folder/label/important).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Payload không hợp lệ" }, { status: 400 });
  }

  const { fileName, mimeType, sizeBytes } = body as {
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
  };

  if (!fileName || !mimeType || typeof sizeBytes !== "number") {
    return NextResponse.json({ error: "Thiếu thông tin file" }, { status: 400 });
  }
  if (sizeBytes <= 0 || sizeBytes > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File phải nhỏ hơn 25MB" },
      { status: 400 },
    );
  }

  const current = await prisma.attachment.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ error: "Không tìm thấy file" }, { status: 404 });
  }
  if (!current.matterId) {
    return NextResponse.json(
      { error: "Chỉ thay thế được tài liệu vụ việc" },
      { status: 400 },
    );
  }
  if (!current.isLatest) {
    return NextResponse.json(
      { error: "Chỉ thay thế được bản mới nhất" },
      { status: 400 },
    );
  }

  const canManageDocs = canManageMatterDocuments(user.role);
  const allowed = await canAccessAttachmentTarget(user.id, user.role, current);
  if (!allowed || !canManageDocs) {
    return NextResponse.json({ error: "Không có quyền thay thế file" }, { status: 403 });
  }

  const matter = await prisma.matter.findUnique({
    where: { id: current.matterId },
    select: { status: true },
  });
  if (matter?.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Vụ việc đã lưu trữ — không thể thay thế tài liệu" },
      { status: 403 },
    );
  }

  try {
    const storageKey = buildStorageKey(fileName);
    const uploadUrl = await createUploadUrl(storageKey, mimeType);

    // Keep current latest until bytes land (PUT/commit promotes). Create the
    // new row as non-latest so a failed/abandoned upload cannot break preview.
    const attachment = await prisma.$transaction(async (tx) => {
      const abandoned = await tx.attachment.findMany({
        where: {
          versionGroupId: current.versionGroupId,
          isLatest: false,
          version: { gt: current.version },
        },
        select: { id: true, storageKey: true },
      });
      for (const row of abandoned) {
        try {
          await deleteObject(row.storageKey);
        } catch {
          // Object may never have been uploaded.
        }
      }
      if (abandoned.length > 0) {
        await tx.attachment.deleteMany({
          where: { id: { in: abandoned.map((row) => row.id) } },
        });
      }

      const nextVersion = current.version + 1;

      return tx.attachment.create({
        data: {
          fileName,
          mimeType,
          sizeBytes,
          storageKey,
          matterId: current.matterId,
          taskId: current.taskId,
          clientId: current.clientId,
          matterPlanStepId: current.matterPlanStepId,
          folderId: current.folderId,
          labelId: current.labelId,
          customLabel: current.customLabel,
          isImportant: current.isImportant,
          uploadedById: user.id,
          versionGroupId: current.versionGroupId,
          version: nextVersion,
          isLatest: false,
        },
        include: {
          uploadedBy: { select: { id: true, name: true } },
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Attachment",
      entityId: attachment.id,
      details: `Chuẩn bị thay thế → v${attachment.version}: ${fileName}`,
    });

    return NextResponse.json({ attachment, uploadUrl });
  } catch (error) {
    console.error("attachment replace prepare failed:", error);
    const message =
      error instanceof Error && /S3_|Missing required env/i.test(error.message)
        ? "Kho lưu trữ chưa cấu hình (S3/R2). Liên hệ admin."
        : "Không thể tạo phiên thay thế file";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
