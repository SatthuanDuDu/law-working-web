import { NextResponse } from "next/server";
import type { AttachmentAccessMode } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAccessAttachmentTarget } from "@/lib/access";
import { createAuditLog } from "@/lib/audit";
import {
  canManageAttachmentAccess,
  canViewAttachmentContent,
  isMatterOrPlanDocument,
} from "@/lib/attachment-access";

const MODES: AttachmentAccessMode[] = ["ALL_MEMBERS", "ALLOWLIST", "DENYLIST"];

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
  if (!isMatterOrPlanDocument(attachment) || !attachment.matterId) {
    return NextResponse.json(
      { error: "Chỉ áp dụng cho tài liệu vụ việc / kế hoạch" },
      { status: 400 },
    );
  }

  const allowed = await canAccessAttachmentTarget(user.id, user.role, attachment);
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const canView = await canViewAttachmentContent(
    user.id,
    user.role,
    attachment,
  );
  if (!canView) {
    return NextResponse.json({ error: "Không có quyền xem file" }, { status: 403 });
  }

  const matter = await prisma.matter.findUnique({
    where: { id: attachment.matterId },
    select: {
      leadLawyerId: true,
      status: true,
      members: {
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!matter) {
    return NextResponse.json({ error: "Không tìm thấy vụ việc" }, { status: 404 });
  }

  const access = await prisma.attachmentAccess.findUnique({
    where: { versionGroupId: attachment.versionGroupId },
    select: {
      mode: true,
      users: { select: { userId: true } },
    },
  });

  const leadUser = await prisma.user.findUnique({
    where: { id: matter.leadLawyerId },
    select: { id: true, name: true, role: true },
  });

  const candidates = Array.from(
    new Map(
      [
        ...(leadUser
          ? [
              {
                id: leadUser.id,
                name: leadUser.name,
                role: leadUser.role,
                isLead: true,
              },
            ]
          : []),
        ...matter.members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          role: m.user.role,
          isLead: m.user.id === matter.leadLawyerId,
        })),
      ].map((u) => [u.id, u]),
    ).values(),
  ).sort((a, b) => {
    if (a.isLead !== b.isLead) return a.isLead ? -1 : 1;
    return a.name.localeCompare(b.name, "vi");
  });

  return NextResponse.json({
    versionGroupId: attachment.versionGroupId,
    mode: access?.mode ?? "ALL_MEMBERS",
    userIds: access?.users.map((u) => u.userId) ?? [],
    canEdit: canManageAttachmentAccess(
      user.id,
      user.role,
      matter.leadLawyerId,
    ) && matter.status !== "ARCHIVED",
    leadLawyerId: matter.leadLawyerId,
    candidates,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    mode?: AttachmentAccessMode;
    userIds?: string[];
  } | null;

  if (!body || !body.mode || !MODES.includes(body.mode)) {
    return NextResponse.json({ error: "Chế độ truy cập không hợp lệ" }, { status: 400 });
  }

  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.json({ error: "Không tìm thấy file" }, { status: 404 });
  }
  if (!isMatterOrPlanDocument(attachment) || !attachment.matterId) {
    return NextResponse.json(
      { error: "Chỉ áp dụng cho tài liệu vụ việc / kế hoạch" },
      { status: 400 },
    );
  }

  const allowed = await canAccessAttachmentTarget(user.id, user.role, attachment);
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền" }, { status: 403 });
  }

  const matter = await prisma.matter.findUnique({
    where: { id: attachment.matterId },
    select: {
      leadLawyerId: true,
      status: true,
      code: true,
      members: { select: { userId: true } },
    },
  });
  if (!matter) {
    return NextResponse.json({ error: "Không tìm thấy vụ việc" }, { status: 404 });
  }
  if (matter.status === "ARCHIVED") {
    return NextResponse.json(
      { error: "Vụ việc đã lưu trữ — không thể chỉnh quyền xem" },
      { status: 403 },
    );
  }
  if (!canManageAttachmentAccess(user.id, user.role, matter.leadLawyerId)) {
    return NextResponse.json(
      { error: "Chỉ luật sư chính hoặc Admin/Quản lý được chỉnh quyền xem file" },
      { status: 403 },
    );
  }

  const memberIds = new Set([
    matter.leadLawyerId,
    ...matter.members.map((m) => m.userId),
  ]);
  const rawIds = Array.isArray(body.userIds) ? body.userIds : [];
  const uniqueIds = Array.from(
    new Set(
      rawIds.filter(
        (uid): uid is string =>
          typeof uid === "string" &&
          uid.length > 0 &&
          memberIds.has(uid) &&
          uid !== matter.leadLawyerId,
      ),
    ),
  );

  if (body.mode === "ALL_MEMBERS") {
    await prisma.attachmentAccess.deleteMany({
      where: { versionGroupId: attachment.versionGroupId },
    });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.attachmentAccess.upsert({
        where: { versionGroupId: attachment.versionGroupId },
        create: {
          versionGroupId: attachment.versionGroupId,
          mode: body.mode!,
          updatedById: user.id,
        },
        update: {
          mode: body.mode!,
          updatedById: user.id,
        },
      });
      await tx.attachmentAccessUser.deleteMany({
        where: { versionGroupId: attachment.versionGroupId },
      });
      if (uniqueIds.length > 0) {
        await tx.attachmentAccessUser.createMany({
          data: uniqueIds.map((userId) => ({
            versionGroupId: attachment.versionGroupId,
            userId,
          })),
        });
      }
    });
  }

  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "Attachment",
    entityId: attachment.id,
    details: `${matter.code}: quyền xem "${attachment.fileName}" → ${body.mode} (${uniqueIds.length} user)`,
  });

  return NextResponse.json({
    mode: body.mode,
    userIds: body.mode === "ALL_MEMBERS" ? [] : uniqueIds,
  });
}
