import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAccessAttachmentTarget } from "@/lib/access";
import { buildStorageKey, createUploadUrl } from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";
import { buildAttachmentOrigin } from "@/lib/attachment-origin";
import {
  canManageMatterDocuments,
  isManagerOrAbove,
} from "@/lib/permissions";
import {
  filterVisibleAttachments,
  getAccessSummaries,
} from "@/lib/attachment-access";

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const matterId = searchParams.get("matterId") || undefined;
  const taskId = searchParams.get("taskId") || undefined;
  const clientId = searchParams.get("clientId") || undefined;
  const matterPlanStepId = searchParams.get("matterPlanStepId") || undefined;
  const walletTransactionId =
    searchParams.get("walletTransactionId") || undefined;
  const stepOnly = searchParams.get("stepOnly") === "1";
  const folderIdParam = searchParams.get("folderId");
  // folderId=all (default) | unfiled | <id>
  const folderFilter =
    folderIdParam === "unfiled"
      ? "unfiled"
      : folderIdParam && folderIdParam !== "all"
        ? folderIdParam
        : "all";

  if (
    !matterId &&
    !taskId &&
    !clientId &&
    !matterPlanStepId &&
    !walletTransactionId
  ) {
    return NextResponse.json({ error: "Thiếu tham chiếu entity" }, { status: 400 });
  }

  if (walletTransactionId) {
    const allowed = await canAccessAttachmentTarget(user.id, user.role, {
      walletTransactionId,
    });
    if (!allowed) {
      return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
    }
    const attachments = await prisma.attachment.findMany({
      where: { walletTransactionId, isLatest: true },
      include: {
        uploadedBy: { select: { id: true, name: true } },
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
        walletTransactionId: file.walletTransactionId,
      })),
    });
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

  const folderWhere =
    folderFilter === "unfiled"
      ? { folderId: null as string | null }
      : folderFilter !== "all"
        ? { folderId: folderFilter }
        : {};

  const attachments = await prisma.attachment.findMany({
    where: matterPlanStepId
      ? {
          matterPlanStepId,
          isLatest: true,
          ...(stepOnly ? { commentId: null } : {}),
          ...folderWhere,
        }
      : {
          isLatest: true,
          ...(matterId ? { matterId } : {}),
          ...(taskId ? { taskId } : {}),
          ...(clientId ? { clientId } : {}),
          ...(matterId ? folderWhere : {}),
        },
    include: {
      uploadedBy: { select: { id: true, name: true } },
      matter: { select: { code: true, title: true } },
      matterPlanStep: { select: { title: true } },
      label: { select: { id: true, name: true } },
      folder: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const groupIds = [...new Set(attachments.map((a) => a.versionGroupId))];
  const versionCounts =
    groupIds.length > 0
      ? await prisma.attachment.groupBy({
          by: ["versionGroupId"],
          where: { versionGroupId: { in: groupIds } },
          _count: { _all: true },
        })
      : [];
  const countByGroup = new Map(
    versionCounts.map((row) => [row.versionGroupId, row._count._all]),
  );

  const visible = await filterVisibleAttachments(
    user.id,
    user.role,
    attachments.map((file) => ({
      ...file,
      uploadedById: file.uploadedBy.id,
    })),
  );
  const accessByGroup = await getAccessSummaries(
    visible.map((a) => a.versionGroupId),
  );

  return NextResponse.json({
    attachments: visible.map((file) => ({
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
      folderId: file.folderId,
      folderName: file.folder?.name ?? null,
      labelId: file.labelId,
      customLabel: file.customLabel,
      labelName: file.customLabel || file.label?.name || null,
      isImportant: file.isImportant,
      version: file.version,
      versionGroupId: file.versionGroupId,
      versionCount: countByGroup.get(file.versionGroupId) ?? 1,
      accessMode: accessByGroup.get(file.versionGroupId)?.mode ?? "ALL_MEMBERS",
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
    conversationId,
    walletTransactionId,
    labelId,
    customLabel,
    folderId,
    purpose,
  } = body as {
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    matterId?: string | null;
    taskId?: string | null;
    clientId?: string | null;
    matterPlanStepId?: string | null;
    conversationId?: string | null;
    walletTransactionId?: string | null;
    labelId?: string | null;
    customLabel?: string | null;
    folderId?: string | null;
    purpose?: "comment" | "document" | "wallet";
  };

  if (!fileName || !mimeType || typeof sizeBytes !== "number") {
    return NextResponse.json({ error: "Thiếu thông tin file" }, { status: 400 });
  }

  const isChatUpload = Boolean(conversationId);
  const isWalletReceipt =
    Boolean(walletTransactionId) || purpose === "wallet";
  const trimmedCustom =
    typeof customLabel === "string" ? customLabel.trim() : "";
  const hasLabelId = typeof labelId === "string" && labelId.length > 0;
  if (!isChatUpload && !isWalletReceipt && !hasLabelId && !trimmedCustom) {
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
  let resolvedFolderId: string | null = null;

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

  if (folderId) {
    if (!resolvedMatterId) {
      return NextResponse.json(
        { error: "Thư mục chỉ dùng cho tài liệu vụ việc" },
        { status: 400 },
      );
    }
    const folder = await prisma.matterFolder.findFirst({
      where: { id: folderId, matterId: resolvedMatterId },
      select: { id: true },
    });
    if (!folder) {
      return NextResponse.json({ error: "Thư mục không hợp lệ" }, { status: 400 });
    }
    resolvedFolderId = folder.id;
  }

  if (
    !resolvedMatterId &&
    !taskId &&
    !clientId &&
    !conversationId &&
    !walletTransactionId
  ) {
    return NextResponse.json({ error: "Thiếu tham chiếu entity" }, { status: 400 });
  }

  if (walletTransactionId) {
    const tx = await prisma.walletTransaction.findUnique({
      where: { id: walletTransactionId },
      select: { id: true, direction: true, walletUserId: true, createdById: true },
    });
    if (!tx || tx.direction !== "DEBIT") {
      return NextResponse.json(
        { error: "Giao dịch chi không hợp lệ" },
        { status: 400 },
      );
    }
    const canAttach =
      isManagerOrAbove(user.role) ||
      tx.walletUserId === user.id ||
      tx.createdById === user.id;
    if (!canAttach) {
      return NextResponse.json({ error: "Không có quyền upload" }, { status: 403 });
    }
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

  let uploadUrl: string;
  try {
    if (!isWalletReceipt) {
      const allowed = await canAccessAttachmentTarget(user.id, user.role, {
        matterId: resolvedMatterId,
        taskId,
        clientId,
        conversationId,
      });
      if (!allowed) {
        return NextResponse.json({ error: "Không có quyền upload" }, { status: 403 });
      }
    }

    // Matter document uploads (hub / plan) — lawyers+ only.
    // Comment drafts, chat, and wallet receipts stay open to anyone with access.
    const isCommentDraft = purpose === "comment";
    const isMatterDocument =
      Boolean(resolvedMatterId) &&
      !conversationId &&
      !isCommentDraft &&
      !isWalletReceipt;
    if (isMatterDocument && !canManageMatterDocuments(user.role)) {
      return NextResponse.json(
        { error: "Chỉ luật sư/admin được tải tài liệu vụ việc" },
        { status: 403 },
      );
    }

    const storageKey = buildStorageKey(fileName);
    uploadUrl = await createUploadUrl(storageKey, mimeType);

    const attachment = await prisma.$transaction(async (tx) => {
      const created = await tx.attachment.create({
        data: {
          fileName,
          mimeType,
          sizeBytes,
          storageKey,
          matterId: isWalletReceipt ? null : resolvedMatterId,
          taskId: taskId || null,
          clientId: clientId || null,
          matterPlanStepId: isWalletReceipt ? null : matterPlanStepId || null,
          conversationId: conversationId || null,
          walletTransactionId: walletTransactionId || null,
          folderId: isWalletReceipt ? null : resolvedFolderId,
          labelId: hasLabelId ? labelId! : null,
          customLabel: hasLabelId
            ? null
            : isChatUpload
              ? trimmedCustom || "Chat"
              : isWalletReceipt
                ? trimmedCustom || "Chứng từ"
                : trimmedCustom,
          uploadedById: user.id,
          // Temporary; immediately rewritten to id below.
          versionGroupId: "pending",
          version: 1,
          isLatest: true,
        },
      });
      return tx.attachment.update({
        where: { id: created.id },
        data: { versionGroupId: created.id },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Attachment",
      entityId: attachment.id,
      details: fileName,
    });

    return NextResponse.json({ attachment, uploadUrl });
  } catch (error) {
    console.error("attachment prepare failed:", error);
    const message =
      error instanceof Error && /S3_|Missing required env/i.test(error.message)
        ? "Kho lưu trữ chưa cấu hình (S3/R2). Liên hệ admin."
        : "Không thể tạo phiên upload. Kiểm tra cấu hình lưu trữ hoặc CORS.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
