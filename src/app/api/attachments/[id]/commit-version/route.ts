import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAccessAttachmentTarget } from "@/lib/access";
import { canManageMatterDocuments } from "@/lib/permissions";

/**
 * Promote a just-uploaded replace version to isLatest.
 * Safe to call after either proxy PUT or direct presigned upload.
 */
export async function POST(
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
  if (!allowed || !canManageMatterDocuments(user.role)) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  if (attachment.isLatest) {
    return NextResponse.json({ success: true, alreadyLatest: true });
  }

  const maxVersion = await prisma.attachment.aggregate({
    where: { versionGroupId: attachment.versionGroupId },
    _max: { version: true },
  });
  if (attachment.version !== maxVersion._max.version) {
    return NextResponse.json(
      { error: "Chỉ promote được phiên bản mới nhất trong nhóm" },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.attachment.updateMany({
      where: {
        versionGroupId: attachment.versionGroupId,
        isLatest: true,
      },
      data: { isLatest: false },
    }),
    prisma.attachment.update({
      where: { id: attachment.id },
      data: { isLatest: true },
    }),
  ]);

  return NextResponse.json({ success: true });
}
