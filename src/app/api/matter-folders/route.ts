import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAccessAttachmentTarget } from "@/lib/access";
import { createAuditLog } from "@/lib/audit";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const matterId = new URL(request.url).searchParams.get("matterId");
  if (!matterId) {
    return NextResponse.json({ error: "Thiếu matterId" }, { status: 400 });
  }

  const allowed = await canAccessAttachmentTarget(user.id, user.role, { matterId });
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

  const folders = await prisma.matterFolder.findMany({
    where: { matterId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { attachments: true } } },
  });

  return NextResponse.json({
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      sortOrder: f.sortOrder,
      attachmentCount: f._count.attachments,
      createdAt: f.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    matterId?: string;
    name?: string;
  } | null;

  const matterId = body?.matterId?.trim();
  const name = body?.name?.trim();
  if (!matterId || !name) {
    return NextResponse.json({ error: "Thiếu matterId hoặc tên thư mục" }, { status: 400 });
  }
  if (name.length > 80) {
    return NextResponse.json({ error: "Tên thư mục tối đa 80 ký tự" }, { status: 400 });
  }

  const allowed = await canAccessAttachmentTarget(user.id, user.role, { matterId });
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền tạo thư mục" }, { status: 403 });
  }

  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { status: true },
  });
  if (!matter) {
    return NextResponse.json({ error: "Không tìm thấy vụ việc" }, { status: 404 });
  }
  if (matter.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Vụ việc đã lưu trữ — không thể tạo thư mục" },
      { status: 403 },
    );
  }

  try {
    const maxSort = await prisma.matterFolder.aggregate({
      where: { matterId },
      _max: { sortOrder: true },
    });
    const folder = await prisma.matterFolder.create({
      data: {
        matterId,
        name,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "MatterFolder",
      entityId: folder.id,
      details: name,
    });

    return NextResponse.json({
      folder: {
        id: folder.id,
        name: folder.name,
        sortOrder: folder.sortOrder,
        attachmentCount: 0,
        createdAt: folder.createdAt,
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
    console.error("create matter folder failed:", error);
    return NextResponse.json({ error: "Không tạo được thư mục" }, { status: 500 });
  }
}
