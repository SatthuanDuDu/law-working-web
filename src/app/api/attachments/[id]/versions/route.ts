import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAccessAttachmentTarget } from "@/lib/access";
import { canViewAttachmentContent } from "@/lib/attachment-access";

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
    return NextResponse.json({ error: "Không có quyền xem phiên bản" }, { status: 403 });
  }

  const canView = await canViewAttachmentContent(user.id, user.role, attachment);
  if (!canView) {
    return NextResponse.json({ error: "Không có quyền xem file này" }, { status: 403 });
  }

  const versions = await prisma.attachment.findMany({
    where: { versionGroupId: attachment.versionGroupId },
    include: {
      uploadedBy: { select: { id: true, name: true } },
    },
    orderBy: { version: "desc" },
  });

  return NextResponse.json({
    versionGroupId: attachment.versionGroupId,
    versions: versions.map((v) => ({
      id: v.id,
      fileName: v.fileName,
      mimeType: v.mimeType,
      sizeBytes: v.sizeBytes,
      version: v.version,
      isLatest: v.isLatest,
      createdAt: v.createdAt,
      uploadedBy: v.uploadedBy,
    })),
  });
}
