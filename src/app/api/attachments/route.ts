import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAccessAttachmentTarget } from "@/lib/access";
import { buildStorageKey, createUploadUrl } from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";
import { buildAttachmentOrigin } from "@/lib/attachment-origin";

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const matterId = searchParams.get("matterId") || undefined;
  const taskId = searchParams.get("taskId") || undefined;
  const clientId = searchParams.get("clientId") || undefined;
  const matterPlanStepId = searchParams.get("matterPlanStepId") || undefined;
  const stepOnly = searchParams.get("stepOnly") === "1";

  if (!matterId && !taskId && !clientId && !matterPlanStepId) {
    return NextResponse.json({ error: "Thiếu tham chiếu entity" }, { status: 400 });
  }

  let resolvedMatterId = matterId;
  if (matterPlanStepId && !resolvedMatterId) {
    const step = await prisma.matterPlanStep.findUnique({
      where: { id: matterPlanStepId },
      select: { matterId: true },
    });
    if (!step) {
      return NextResponse.json({ error: "Không tìm thấy bước kế hoạch" }, { status: 404 });
    }
    resolvedMatterId = step.matterId;
  }

  const allowed = await canAccessAttachmentTarget(user.id, user.role, {
    matterId: resolvedMatterId,
    taskId,
    clientId,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

  const attachments = await prisma.attachment.findMany({
    where: matterPlanStepId
      ? {
          matterPlanStepId,
          ...(stepOnly ? { commentId: null } : {}),
        }
      : {
          ...(matterId ? { matterId } : {}),
          ...(taskId ? { taskId } : {}),
          ...(clientId ? { clientId } : {}),
        },
    include: {
      uploadedBy: { select: { id: true, name: true } },
      matter: { select: { code: true, title: true } },
      matterPlanStep: { select: { title: true } },
      label: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    attachments: attachments.map((file) => ({
      id: file.id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      createdAt: file.createdAt,
      uploadedBy: file.uploadedBy,
      matterId: file.matterId,
      matterPlanStepId: file.matterPlanStepId,
      commentId: file.commentId,
      taskId: file.taskId,
      clientId: file.clientId,
      labelId: file.labelId,
      customLabel: file.customLabel,
      labelName: file.customLabel || file.label?.name || null,
      isImportant: file.isImportant,
      origin: buildAttachmentOrigin({
        commentId: file.commentId,
        matterPlanStepId: file.matterPlanStepId,
        matterId: file.matterId,
        taskId: file.taskId,
        clientId: file.clientId,
        matterCode: file.matter?.code,
        matterTitle: file.matter?.title,
        planStepTitle: file.matterPlanStep?.title,
      }),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Payload không hợp lệ" }, { status: 400 });
  }

  const {
    fileName,
    mimeType,
    sizeBytes,
    matterId,
    taskId,
    clientId,
    matterPlanStepId,
    labelId,
    customLabel,
  } = body as {
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    matterId?: string | null;
    taskId?: string | null;
    clientId?: string | null;
    matterPlanStepId?: string | null;
    labelId?: string | null;
    customLabel?: string | null;
  };

  if (!fileName || !mimeType || typeof sizeBytes !== "number") {
    return NextResponse.json({ error: "Thiếu thông tin file" }, { status: 400 });
  }

  const trimmedCustom =
    typeof customLabel === "string" ? customLabel.trim() : "";
  const hasLabelId = typeof labelId === "string" && labelId.length > 0;
  if (!hasLabelId && !trimmedCustom) {
    return NextResponse.json(
      { error: "Vui lòng chọn nhãn tài liệu hoặc nhập nhãn Khác" },
      { status: 400 },
    );
  }

  if (hasLabelId) {
    const label = await prisma.attachmentLabel.findFirst({
      where: { id: labelId!, isActive: true },
      select: { id: true },
    });
    if (!label) {
      return NextResponse.json({ error: "Nhãn không hợp lệ" }, { status: 400 });
    }
  }

  if (sizeBytes <= 0 || sizeBytes > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File phải nhỏ hơn 25MB" },
      { status: 400 },
    );
  }

  let resolvedMatterId = matterId || null;

  if (matterPlanStepId) {
    const step = await prisma.matterPlanStep.findUnique({
      where: { id: matterPlanStepId },
      select: { matterId: true },
    });
    if (!step) {
      return NextResponse.json({ error: "Không tìm thấy bước kế hoạch" }, { status: 404 });
    }
    if (resolvedMatterId && resolvedMatterId !== step.matterId) {
      return NextResponse.json({ error: "Bước kế hoạch không thuộc vụ việc" }, { status: 400 });
    }
    resolvedMatterId = step.matterId;
  }

  if (!resolvedMatterId && !taskId && !clientId) {
    return NextResponse.json({ error: "Thiếu tham chiếu entity" }, { status: 400 });
  }

  if (resolvedMatterId) {
    const matter = await prisma.matter.findUnique({
      where: { id: resolvedMatterId },
      select: { status: true },
    });
    if (matter?.status === "ARCHIVED") {
      return NextResponse.json(
        { error: "Vụ việc đã lưu trữ — không thể tải lên tài liệu" },
        { status: 403 },
      );
    }
  }

  const allowed = await canAccessAttachmentTarget(user.id, user.role, {
    matterId: resolvedMatterId,
    taskId,
    clientId,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền upload" }, { status: 403 });
  }

  const storageKey = buildStorageKey(fileName);
  const uploadUrl = await createUploadUrl(storageKey, mimeType);

  const attachment = await prisma.attachment.create({
    data: {
      fileName,
      mimeType,
      sizeBytes,
      storageKey,
      matterId: resolvedMatterId,
      taskId: taskId || null,
      clientId: clientId || null,
      matterPlanStepId: matterPlanStepId || null,
      labelId: hasLabelId ? labelId! : null,
      customLabel: hasLabelId ? null : trimmedCustom,
      uploadedById: user.id,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entityType: "Attachment",
    entityId: attachment.id,
    details: fileName,
  });

  return NextResponse.json({ attachment, uploadUrl });
}
