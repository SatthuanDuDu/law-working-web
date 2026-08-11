"use server";

import { revalidatePath } from "next/cache";
import type {
  MoneyConfirmationKind,
  MoneyConfirmationStatus,
  NotificationType,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { createAuditLog } from "@/lib/audit";
import { getAccessibleMatterIds } from "@/lib/access";
import { actionError } from "@/i18n/server-labels";
import { ensureStaffWallet } from "@/lib/wallet";
import { formatVndDigits } from "@/lib/wallet";
import { notifyUsersPush } from "@/lib/web-push";
import {
  canAssignClientReceiptTo,
  canManageWalletUser,
  isManagerOrAbove,
} from "@/lib/permissions";
import {
  allocateBudgetSchema,
  clientReceiptSchema,
  moneyConfirmAllocatorSchema,
  moneyConfirmRecipientSchema,
} from "@/lib/wallet-validations";

const OPEN_MATTER_STATUSES = ["NEW", "IN_PROGRESS", "ON_HOLD"] as const;

export type MoneyConfirmationListItem = {
  id: string;
  kind: MoneyConfirmationKind;
  status: MoneyConfirmationStatus;
  amountVnd: string;
  note: string | null;
  disputeNote: string | null;
  fromUserId: string;
  fromUserName: string;
  fromUserRole: Role;
  toUserId: string;
  toUserName: string;
  toUserRole: Role;
  matterId: string | null;
  matterCode: string | null;
  matterTitle: string | null;
  planStepTitle: string | null;
  recipientRespondedAt: string | null;
  allocatorConfirmedAt: string | null;
  walletTransactionId: string | null;
  createdAt: string;
  /** What the current user can do. */
  myAction: "recipient" | "allocator" | "view" | null;
};

const confirmationInclude = {
  fromUser: { select: { id: true, name: true, role: true } },
  toUser: { select: { id: true, name: true, role: true } },
  matter: { select: { id: true, code: true, title: true } },
  matterPlanStep: { select: { title: true } },
} satisfies Prisma.MoneyConfirmationInclude;

function serializeConfirmation(
  row: {
    id: string;
    kind: MoneyConfirmationKind;
    status: MoneyConfirmationStatus;
    amountVnd: bigint;
    note: string | null;
    disputeNote: string | null;
    fromUserId: string;
    toUserId: string;
    recipientRespondedAt: Date | null;
    allocatorConfirmedAt: Date | null;
    walletTransactionId: string | null;
    createdAt: Date;
    fromUser: { id: string; name: string; role: Role };
    toUser: { id: string; name: string; role: Role };
    matter: { id: string; code: string; title: string } | null;
    matterPlanStep: { title: string } | null;
  },
  viewerId: string,
): MoneyConfirmationListItem {
  let myAction: MoneyConfirmationListItem["myAction"] = "view";
  if (
    row.status === "PENDING_RECIPIENT" &&
    row.toUserId === viewerId
  ) {
    myAction = "recipient";
  } else if (
    row.status === "PENDING_ALLOCATOR" &&
    row.fromUserId === viewerId
  ) {
    myAction = "allocator";
  } else if (
    row.status !== "PENDING_RECIPIENT" &&
    row.status !== "PENDING_ALLOCATOR"
  ) {
    myAction = null;
  }

  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    amountVnd: row.amountVnd.toString(),
    note: row.note,
    disputeNote: row.disputeNote,
    fromUserId: row.fromUserId,
    fromUserName: row.fromUser.name,
    fromUserRole: row.fromUser.role,
    toUserId: row.toUserId,
    toUserName: row.toUser.name,
    toUserRole: row.toUser.role,
    matterId: row.matter?.id ?? null,
    matterCode: row.matter?.code ?? null,
    matterTitle: row.matter?.title ?? null,
    planStepTitle: row.matterPlanStep?.title ?? null,
    recipientRespondedAt: row.recipientRespondedAt?.toISOString() ?? null,
    allocatorConfirmedAt: row.allocatorConfirmedAt?.toISOString() ?? null,
    walletTransactionId: row.walletTransactionId,
    createdAt: row.createdAt.toISOString(),
    myAction,
  };
}

async function notifyWallet(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link: string,
) {
  await prisma.notification.create({
    data: { userId, type, title, message, link },
  });
  void notifyUsersPush(userId, { title, body: message, url: link, tag: type });
}

async function creditWalletFromConfirmation(params: {
  confirmationId: string;
  toUserId: string;
  fromUserId: string;
  amountVnd: bigint;
  note: string | null;
  kind: MoneyConfirmationKind;
  matterId: string | null;
  matterPlanStepId: string | null;
}) {
  const {
    confirmationId,
    toUserId,
    fromUserId,
    amountVnd,
    note,
    kind,
    matterId,
    matterPlanStepId,
  } = params;

  return prisma.$transaction(async (db) => {
    const current = await db.moneyConfirmation.findUnique({
      where: { id: confirmationId },
      select: { status: true, walletTransactionId: true },
    });
    if (!current || current.status !== "PENDING_ALLOCATOR") {
      throw new Error("INVALID_STATUS");
    }
    if (current.walletTransactionId) {
      throw new Error("ALREADY_CREDITED");
    }

    await ensureStaffWallet(db, toUserId);
    const updated = await db.staffWallet.update({
      where: { userId: toUserId },
      data: { balanceVnd: { increment: amountVnd } },
    });
    const creditNote =
      note ||
      (kind === "BUDGET_ALLOCATE"
        ? "Budget (đã xác nhận 2 phía)"
        : "Tiền khách bàn giao (đã xác nhận 2 phía)");
    const tx = await db.walletTransaction.create({
      data: {
        walletUserId: toUserId,
        direction: "CREDIT",
        amountVnd,
        balanceAfterVnd: updated.balanceVnd,
        note: creditNote,
        allocatedById: fromUserId,
        createdById: fromUserId,
        matterId,
        matterPlanStepId,
      },
    });
    const confirmed = await db.moneyConfirmation.update({
      where: { id: confirmationId },
      data: {
        status: "CONFIRMED",
        allocatorConfirmedAt: new Date(),
        walletTransactionId: tx.id,
      },
      include: confirmationInclude,
    });
    return { tx, confirmed };
  });
}

/** Admin/Manager: create budget allocate pending confirmation (no balance yet). */
export async function allocateBudgetAction(formData: FormData) {
  const actor = await requireRole(["ADMIN", "MANAGER"]);
  const parsed = allocateBudgetSchema.safeParse({
    walletUserId: formData.get("walletUserId"),
    amountVnd: formData.get("amountVnd"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.walletUserId },
    select: { id: true, name: true, role: true, isActive: true },
  });
  if (!target || !target.isActive) {
    return { error: await actionError("userNotFound") };
  }
  if (!canManageWalletUser(actor, target)) {
    return { error: await actionError("noWalletManagePermission") };
  }

  const amountVnd = BigInt(parsed.data.amountVnd);
  const note = parsed.data.note?.trim() || null;

  try {
    const created = await prisma.moneyConfirmation.create({
      data: {
        kind: "BUDGET_ALLOCATE",
        status: "PENDING_RECIPIENT",
        amountVnd,
        note,
        fromUserId: actor.id,
        toUserId: target.id,
      },
      include: confirmationInclude,
    });

    await createAuditLog({
      userId: actor.id,
      action: "CREATE",
      entityType: "MoneyConfirmation",
      entityId: created.id,
      details: `BUDGET_ALLOCATE pending ${amountVnd.toString()} → ${target.name}`,
    });

    const amountLabel = formatVndDigits(amountVnd.toString());
    await notifyWallet(
      target.id,
      "WALLET_BUDGET_PENDING",
      "Nhận budget — chờ xác nhận",
      `${actor.name} phát ${amountLabel} ₫. Vui lòng xác nhận đã nhận tiền.`,
      "/wallet#confirmations",
    );

    revalidatePath("/wallet");
    revalidatePath("/expenses");
    return {
      success: true,
      confirmation: serializeConfirmation(created, actor.id),
    };
  } catch (error) {
    console.error("allocateBudgetAction failed:", error);
    return { error: await actionError("cannotAllocateBudget") };
  }
}

/** Any auth user: record client cash handoff to same/higher-rank assignee. */
export async function createClientReceiptAction(formData: FormData) {
  const actor = await requireAuth();
  const parsed = clientReceiptSchema.safeParse({
    amountVnd: formData.get("amountVnd"),
    toUserId: formData.get("toUserId"),
    matterId: formData.get("matterId"),
    matterPlanStepId: formData.get("matterPlanStepId") || null,
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  if (parsed.data.toUserId === actor.id) {
    return { error: await actionError("cannotAssignReceiptToSelf") };
  }

  const assignee = await prisma.user.findUnique({
    where: { id: parsed.data.toUserId },
    select: { id: true, name: true, role: true, isActive: true },
  });
  if (!assignee || !assignee.isActive) {
    return { error: await actionError("userNotFound") };
  }
  if (!canAssignClientReceiptTo(actor.role, assignee.role)) {
    return { error: await actionError("assigneeRankTooLow") };
  }

  const matterId = parsed.data.matterId.trim();
  const accessibleIds = await getAccessibleMatterIds(actor.id, actor.role);
  if (accessibleIds && !accessibleIds.includes(matterId)) {
    return { error: await actionError("noMatterAccess") };
  }
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { id: true, code: true, title: true, status: true, deletedAt: true },
  });
  if (!matter || matter.deletedAt) {
    return { error: await actionError("matterNotFound") };
  }
  if (
    !OPEN_MATTER_STATUSES.includes(
      matter.status as (typeof OPEN_MATTER_STATUSES)[number],
    )
  ) {
    return { error: await actionError("matterNotOpen") };
  }

  let matterPlanStepId: string | null = null;
  const stepId = parsed.data.matterPlanStepId?.trim();
  if (stepId) {
    const step = await prisma.matterPlanStep.findFirst({
      where: { id: stepId, matterId },
      select: { id: true },
    });
    if (!step) {
      return { error: await actionError("planStepNotFound") };
    }
    matterPlanStepId = step.id;
  }

  const amountVnd = BigInt(parsed.data.amountVnd);
  const note = parsed.data.note?.trim() || null;

  try {
    const created = await prisma.moneyConfirmation.create({
      data: {
        kind: "CLIENT_RECEIPT",
        status: "PENDING_RECIPIENT",
        amountVnd,
        note,
        fromUserId: actor.id,
        toUserId: assignee.id,
        matterId,
        matterPlanStepId,
      },
      include: confirmationInclude,
    });

    await createAuditLog({
      userId: actor.id,
      action: "CREATE",
      entityType: "MoneyConfirmation",
      entityId: created.id,
      details: `CLIENT_RECEIPT pending ${amountVnd.toString()} → ${assignee.name} (${matter.code})`,
    });

    const amountLabel = formatVndDigits(amountVnd.toString());
    await notifyWallet(
      assignee.id,
      "WALLET_CLIENT_PENDING",
      "Nhận tiền khách — chờ xác nhận",
      `${actor.name} bàn giao ${amountLabel} ₫ từ vụ ${matter.code}. Vui lòng xác nhận đã nhận.`,
      "/wallet#confirmations",
    );

    revalidatePath("/wallet");
    revalidatePath("/expenses");
    revalidatePath(`/matters/${matterId}`);
    return {
      success: true,
      confirmation: serializeConfirmation(created, actor.id),
    };
  } catch (error) {
    console.error("createClientReceiptAction failed:", error);
    return { error: await actionError("cannotCreateClientReceipt") };
  }
}

/** toUser: accept / reject / dispute while PENDING_RECIPIENT. */
export async function respondMoneyConfirmationAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = moneyConfirmRecipientSchema.safeParse({
    confirmationId: formData.get("confirmationId"),
    response: formData.get("response"),
    disputeNote: formData.get("disputeNote"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const row = await prisma.moneyConfirmation.findUnique({
    where: { id: parsed.data.confirmationId },
    include: confirmationInclude,
  });
  if (!row) {
    return { error: await actionError("confirmationNotFound") };
  }
  if (row.toUserId !== user.id) {
    return { error: await actionError("noPermission") };
  }
  if (row.status !== "PENDING_RECIPIENT") {
    return { error: await actionError("confirmationWrongStatus") };
  }

  const amountLabel = formatVndDigits(row.amountVnd.toString());
  const disputeNote = parsed.data.disputeNote?.trim() || null;

  if (parsed.data.response === "REJECT") {
    const updated = await prisma.moneyConfirmation.update({
      where: { id: row.id },
      data: {
        status: "REJECTED",
        recipientRespondedAt: new Date(),
        disputeNote,
      },
      include: confirmationInclude,
    });
    await notifyWallet(
      row.fromUserId,
      row.kind === "BUDGET_ALLOCATE"
        ? "WALLET_BUDGET_UPDATE"
        : "WALLET_CLIENT_UPDATE",
      "Từ chối nhận tiền",
      `${user.name} từ chối khoản ${amountLabel} ₫.`,
      "/wallet#confirmations",
    );
    revalidatePath("/wallet");
    revalidatePath("/expenses");
    return { success: true, confirmation: serializeConfirmation(updated, user.id) };
  }

  if (parsed.data.response === "DISPUTE") {
    if (!disputeNote) {
      return { error: await actionError("disputeNoteRequired") };
    }
    const updated = await prisma.moneyConfirmation.update({
      where: { id: row.id },
      data: {
        status: "DISPUTED",
        recipientRespondedAt: new Date(),
        disputeNote,
      },
      include: confirmationInclude,
    });
    await notifyWallet(
      row.fromUserId,
      row.kind === "BUDGET_ALLOCATE"
        ? "WALLET_BUDGET_UPDATE"
        : "WALLET_CLIENT_UPDATE",
      "Khiếu nại số tiền",
      `${user.name} báo sai số với khoản ${amountLabel} ₫: ${disputeNote}`,
      "/wallet#confirmations",
    );
    revalidatePath("/wallet");
    revalidatePath("/expenses");
    return { success: true, confirmation: serializeConfirmation(updated, user.id) };
  }

  // ACCEPT → wait for fromUser (allocator/creator) second confirmation
  const updated = await prisma.moneyConfirmation.update({
    where: { id: row.id },
    data: {
      status: "PENDING_ALLOCATOR",
      recipientRespondedAt: new Date(),
    },
    include: confirmationInclude,
  });

  await notifyWallet(
    row.fromUserId,
    row.kind === "BUDGET_ALLOCATE"
      ? "WALLET_BUDGET_PENDING"
      : "WALLET_CLIENT_PENDING",
    "Chờ bạn xác nhận số tiền",
    `${user.name} đã xác nhận nhận ${amountLabel} ₫. Vui lòng xác nhận lại số tiền.`,
    row.kind === "BUDGET_ALLOCATE" ? "/expenses#confirmations" : "/wallet#confirmations",
  );

  revalidatePath("/wallet");
  revalidatePath("/expenses");
  return { success: true, confirmation: serializeConfirmation(updated, user.id) };
}

/** fromUser: final confirm while PENDING_ALLOCATOR → CREDIT toUser wallet. */
export async function finalizeMoneyConfirmationAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = moneyConfirmAllocatorSchema.safeParse({
    confirmationId: formData.get("confirmationId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const row = await prisma.moneyConfirmation.findUnique({
    where: { id: parsed.data.confirmationId },
    include: confirmationInclude,
  });
  if (!row) {
    return { error: await actionError("confirmationNotFound") };
  }
  if (row.fromUserId !== user.id) {
    return { error: await actionError("noPermission") };
  }
  if (row.status !== "PENDING_ALLOCATOR") {
    return { error: await actionError("confirmationWrongStatus") };
  }

  try {
    const { confirmed } = await creditWalletFromConfirmation({
      confirmationId: row.id,
      toUserId: row.toUserId,
      fromUserId: row.fromUserId,
      amountVnd: row.amountVnd,
      note: row.note,
      kind: row.kind,
      matterId: row.matterId,
      matterPlanStepId: row.matterPlanStepId,
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "MoneyConfirmation",
      entityId: row.id,
      details: `CONFIRMED ${row.kind} ${row.amountVnd.toString()} → wallet ${row.toUserId}`,
    });

    const amountLabel = formatVndDigits(row.amountVnd.toString());
    await notifyWallet(
      row.toUserId,
      row.kind === "BUDGET_ALLOCATE"
        ? "WALLET_BUDGET_UPDATE"
        : "WALLET_CLIENT_UPDATE",
      "Đã cộng vào ví",
      `Khoản ${amountLabel} ₫ đã được xác nhận và cộng vào ví của bạn.`,
      "/wallet",
    );

    revalidatePath("/wallet");
    revalidatePath("/expenses");
    if (row.matterId) revalidatePath(`/matters/${row.matterId}`);
    return {
      success: true,
      confirmation: serializeConfirmation(confirmed, user.id),
    };
  } catch (error) {
    console.error("finalizeMoneyConfirmationAction failed:", error);
    return { error: await actionError("cannotFinalizeConfirmation") };
  }
}

export async function listMoneyConfirmationsAction(params?: {
  scope?: "mine" | "manageable";
  status?: MoneyConfirmationStatus | "OPEN" | "ALL";
  take?: number;
}) {
  const user = await requireAuth();
  const scope = params?.scope ?? "mine";
  const statusFilter = params?.status ?? "OPEN";
  const take = Math.min(params?.take ?? 50, 200);

  const openStatuses: MoneyConfirmationStatus[] = [
    "PENDING_RECIPIENT",
    "PENDING_ALLOCATOR",
  ];

  const where: Prisma.MoneyConfirmationWhereInput = {};
  if (statusFilter === "OPEN") {
    where.status = { in: openStatuses };
  } else if (statusFilter !== "ALL") {
    where.status = statusFilter;
  }

  if (scope === "mine") {
    where.OR = [{ fromUserId: user.id }, { toUserId: user.id }];
  } else {
    // Manageable: manager+ sees confirmations involving users they can manage
    if (!isManagerOrAbove(user.role)) {
      where.OR = [{ fromUserId: user.id }, { toUserId: user.id }];
    } else {
      const users = await prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, role: true },
      });
      const allowedIds = users
        .filter((u) => canManageWalletUser(user, u))
        .map((u) => u.id);
      where.OR = [
        { fromUserId: { in: allowedIds } },
        { toUserId: { in: allowedIds } },
      ];
    }
  }

  const rows = await prisma.moneyConfirmation.findMany({
    where,
    include: confirmationInclude,
    orderBy: { createdAt: "desc" },
    take,
  });

  return {
    confirmations: rows.map((r) => serializeConfirmation(r, user.id)),
  };
}

/** Users eligible as client-receipt assignees (same or higher rank, not self). */
export async function listClientReceiptAssigneesAction() {
  const actor = await requireAuth();
  const users = await prisma.user.findMany({
    where: { isActive: true, id: { not: actor.id } },
    select: { id: true, name: true, username: true, role: true },
    orderBy: [{ name: "asc" }],
  });
  return {
    users: users.filter((u) => canAssignClientReceiptTo(actor.role, u.role)),
  };
}
