import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAccessAttachmentTarget } from "@/lib/access";
import { createAuditLog } from "@/lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as { name?: string } | null;
  const name = body?.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Thiếu tên thư mục" }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json({ error: "Tên thư mục tối đa 80 ký tự" }, { status: 400 });
  }

  const folder = await prisma.matterFolder.findUnique({ where: { id } });
  if (!folder) {
    return NextResponse.json({ error: "Không tìm thấy thư mục" }, { status: 404 });
  }

  const allowed = await canAccessAttachmentTarget(user.id, user.role, {
    matterId: folder.matterId,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền sửa thư mục" }, { status: 403 });
  }

  try {
    const updated = await prisma.matterFolder.update({
      where: { id },
      data: { name },
      include: { _count: { select: { attachments: true } } },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "MatterFolder",
      entityId: id,
      details: `${folder.name} → ${name}`,
    });

    return NextResponse.json({
      folder: {
        id: updated.id,
        name: updated.name,
        sortOrder: updated.sortOrder,
        attachmentCount: updated._count.attachments,
        createdAt: updated.createdAt,
      },
    });
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "P2002") {
      return NextResponse.json({ error: "Thư mục cùng tên đã tồn tại" }, { status: 409 });
    }
    console.error("rename matter folder failed:", error);
    return NextResponse.json({ error: "Không đổi tên được thư mục" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const folder = await prisma.matterFolder.findUnique({ where: { id } });
  if (!folder) {
    return NextResponse.json({ error: "Không tìm thấy thư mục" }, { status: 404 });
  }

  const allowed = await canAccessAttachmentTarget(user.id, user.role, {
    matterId: folder.matterId,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền xóa thư mục" }, { status: 403 });
  }

  await prisma.$transaction([
    prisma.attachment.updateMany({
      where: { folderId: id },
      data: { folderId: null },
    }),
    prisma.matterFolder.delete({ where: { id } }),
  ]);

  await createAuditLog({
    userId: user.id,
    action: "DELETE",
    entityType: "MatterFolder",
    entityId: id,
    details: folder.name,
  });

  return NextResponse.json({ ok: true });
}
