"use server";

import { revalidatePath } from "next/cache";
import type {
  BudgetPackageStatus,
  BudgetTopupRequestStatus,
  NotificationType,
  Prisma,
  WalletTxKind,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { createAuditLog } from "@/lib/audit";
import { actionError } from "@/i18n/server-labels";
import { ensureStaffWallet, formatVndDigits } from "@/lib/wallet";
import { canManageWalletUser } from "@/lib/permissions";
import { notifyUsersPush } from "@/lib/web-push";
import {
  budgetPackageInclude,
  packageRemainingVnd,
  serializeBudgetPackage,
  type BudgetPackageDto,
} from "@/lib/budget-package";
import {
  createBudgetPackageSchema,
  decideSettlePackageSchema,
  decideTopupSchema,
  requestSettlePackageSchema,
  requestTopupSchema,
  topupBudgetPackageSchema,
  updateBudgetPackageSchema,
} from "@/lib/wallet-validations";
import {
  diffFields,
  parseJustification,
  recordRevision,
} from "@/lib/revisions";

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

function revalidateMoneyPaths(packageId?: string) {
  revalidatePath("/wallet");
  revalidatePath("/expenses");
  if (packageId) revalidatePath(`/expenses/packages/${packageId}`);
}

/** Admin/Manager: create named package + dual-confirm allocate. */
export async function createPackageAction(formData: FormData) {
  const actor = await requireRole(["ADMIN", "MANAGER"]);
  const parsed = createBudgetPackageSchema.safeParse({
    name: formData.get("name"),
    ownerUserId: formData.get("ownerUserId"),
    amountVnd: formData.get("amountVnd"),
    note: formData.get("note"),
    matterId: formData.get("matterId") || null,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")),
    };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.ownerUserId },
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
  const matterId = parsed.data.matterId?.trim() || null;

  if (matterId) {
    const matter = await prisma.matter.findUnique({
      where: { id: matterId },
      select: { id: true, deletedAt: true },
    });
    if (!matter || matter.deletedAt) {
      return { error: await actionError("matterNotFound") };
    }
  }

  try {
    const result = await prisma.$transaction(async (db) => {
      const pkg = await db.budgetPackage.create({
        data: {
          name: parsed.data.name.trim(),
          ownerUserId: target.id,
          createdById: actor.id,
          status: "PENDING_FUNDING",
          matterId,
          note,
          allocatedVnd: BigInt(0),
          spentVnd: BigInt(0),
          returnedVnd: BigInt(0),
        },
        include: budgetPackageInclude,
      });

      const confirmation = await db.moneyConfirmation.create({
        data: {
          kind: "BUDGET_ALLOCATE",
          status: "PENDING_RECIPIENT",
          amountVnd,
          note,
          fromUserId: actor.id,
          toUserId: target.id,
          matterId,
          budgetPackageId: pkg.id,
        },
      });

      return { pkg, confirmation };
    });

    await createAuditLog({
      userId: actor.id,
      action: "CREATE",
      entityType: "BudgetPackage",
      entityId: result.pkg.id,
      details: `CREATE package "${result.pkg.name}" ${amountVnd.toString()} → ${target.name}`,
    });

    const amountLabel = formatVndDigits(amountVnd.toString());
    await notifyWallet(
      target.id,
      "WALLET_BUDGET_PENDING",
      "Nhận gói chi phí — chờ xác nhận",
      `${actor.name} cấp gói "${result.pkg.name}" ${amountLabel} ₫. Vui lòng xác nhận đã nhận tiền.`,
      "/wallet#confirmations",
    );

    revalidateMoneyPaths(result.pkg.id);
    return {
      success: true,
      package: serializeBudgetPackage(result.pkg),
      confirmationId: result.confirmation.id,
    };
  } catch (error) {
    console.error("createPackageAction failed:", error);
    return { error: await actionError("cannotCreateBudgetPackage") };
  }
}

/** Owner or creator: rename / update note with FORM justification + revision. */
export async function updateBudgetPackageAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = updateBudgetPackageSchema.safeParse({
    packageId: formData.get("packageId"),
    name: formData.get("name"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")),
    };
  }

  const justificationParsed = parseJustification(formData, "FORM");
  if ("error" in justificationParsed) {
    return { error: await actionError("justificationRequired") };
  }

  const pkg = await prisma.budgetPackage.findUnique({
    where: { id: parsed.data.packageId },
    include: { owner: { select: { id: true, role: true } } },
  });
  if (!pkg) return { error: await actionError("budgetPackageNotFound") };

  const canEdit =
    pkg.ownerUserId === user.id ||
    pkg.createdById === user.id ||
    canManageWalletUser(user, pkg.owner);
  if (!canEdit) return { error: await actionError("noPermission") };
  if (pkg.status === "CLOSED" || pkg.status === "CANCELLED") {
    return { error: await actionError("budgetPackageWrongStatus") };
  }

  const nextName = parsed.data.name.trim();
  const nextNote = parsed.data.note?.trim() || null;

  const changes = diffFields(
    { name: pkg.name, note: pkg.note },
    { name: nextName, note: nextNote },
    [
      { field: "name", label: "Tên gói" },
      { field: "note", label: "Ghi chú" },
    ],
  );
  if (changes.length === 0) {
    return { success: true, unchanged: true };
  }

  try {
    const updated = await prisma.$transaction(async (db) => {
      const row = await db.budgetPackage.update({
        where: { id: pkg.id },
        data: { name: nextName, note: nextNote },
        include: budgetPackageInclude,
      });
      await recordRevision(db, {
        entityType: "BudgetPackage",
        entityId: pkg.id,
        changedById: user.id,
        justification: justificationParsed.justification,
        source: "FORM",
        changes,
      });
      return row;
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "BudgetPackage",
      entityId: pkg.id,
      details: `UPDATE package name/note (${changes.map((c) => c.field).join(",")})`,
    });

    revalidateMoneyPaths(pkg.id);
    return { success: true, package: serializeBudgetPackage(updated) };
  } catch (error) {
    console.error("updateBudgetPackageAction failed:", error);
    return { error: await actionError("cannotUpdateBudgetPackage") };
  }
}

/** Admin/Manager: top-up an OPEN package (dual confirm). */
export async function topupPackageAction(formData: FormData) {
  const actor = await requireRole(["ADMIN", "MANAGER"]);
  const parsed = topupBudgetPackageSchema.safeParse({
    packageId: formData.get("packageId"),
    amountVnd: formData.get("amountVnd"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")),
    };
  }

  const pkg = await prisma.budgetPackage.findUnique({
    where: { id: parsed.data.packageId },
    include: { owner: { select: { id: true, name: true, role: true, isActive: true } } },
  });
  if (!pkg) return { error: await actionError("budgetPackageNotFound") };
  if (pkg.status !== "OPEN") {
    return { error: await actionError("budgetPackageNotOpen") };
  }
  if (!pkg.owner.isActive || !canManageWalletUser(actor, pkg.owner)) {
    return { error: await actionError("noWalletManagePermission") };
  }

  const amountVnd = BigInt(parsed.data.amountVnd);
  const note = parsed.data.note?.trim() || null;

  try {
    const confirmation = await prisma.moneyConfirmation.create({
      data: {
        kind: "BUDGET_TOPUP",
        status: "PENDING_RECIPIENT",
        amountVnd,
        note,
        fromUserId: actor.id,
        toUserId: pkg.ownerUserId,
        matterId: pkg.matterId,
        budgetPackageId: pkg.id,
      },
    });

    await createAuditLog({
      userId: actor.id,
      action: "CREATE",
      entityType: "MoneyConfirmation",
      entityId: confirmation.id,
      details: `BUDGET_TOPUP ${amountVnd.toString()} → package ${pkg.id}`,
    });

    const amountLabel = formatVndDigits(amountVnd.toString());
    await notifyWallet(
      pkg.ownerUserId,
      "WALLET_TOPUP_UPDATE",
      "Bổ sung gói chi phí — chờ xác nhận",
      `${actor.name} bổ sung ${amountLabel} ₫ vào gói "${pkg.name}". Vui lòng xác nhận đã nhận.`,
      "/wallet#confirmations",
    );

    revalidateMoneyPaths(pkg.id);
    return { success: true, confirmationId: confirmation.id };
  } catch (error) {
    console.error("topupPackageAction failed:", error);
    return { error: await actionError("cannotTopupBudgetPackage") };
  }
}

export async function listPackagesAction(params?: {
  ownerUserId?: string | null;
  status?: BudgetPackageStatus | "ALL" | "ACTIVE";
  from?: string | null;
  to?: string | null;
  take?: number;
}) {
  const user = await requireAuth();
  const take = Math.min(params?.take ?? 100, 300);
  const where: Prisma.BudgetPackageWhereInput = {};

  if (params?.ownerUserId) {
    if (params.ownerUserId !== user.id) {
      const target = await prisma.user.findUnique({
        where: { id: params.ownerUserId },
        select: { id: true, role: true },
      });
      if (!target || !canManageWalletUser(user, target)) {
        return { error: await actionError("noWalletManagePermission"), packages: [] as BudgetPackageDto[] };
      }
    }
    where.ownerUserId = params.ownerUserId;
  } else {
    // Default: own packages; managers see manageable users' packages when listing company-wide via expenses
    where.ownerUserId = user.id;
  }

  if (params?.status === "ACTIVE") {
    where.status = { in: ["PENDING_FUNDING", "OPEN", "PENDING_SETTLE"] };
  } else if (params?.status && params.status !== "ALL") {
    where.status = params.status;
  }

  if (params?.from || params?.to) {
    where.createdAt = {};
    if (params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from)) {
      where.createdAt.gte = new Date(`${params.from}T00:00:00.000`);
    }
    if (params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to)) {
      where.createdAt.lte = new Date(`${params.to}T23:59:59.999`);
    }
  }

  const rows = await prisma.budgetPackage.findMany({
    where,
    include: budgetPackageInclude,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take,
  });

  return { packages: rows.map(serializeBudgetPackage) };
}

/** Company-wide package list for Admin/Manager expenses dashboard. */
export async function listManageablePackagesAction(params?: {
  ownerUserId?: string | null;
  status?: BudgetPackageStatus | "ALL" | "ACTIVE";
  from?: string | null;
  to?: string | null;
  take?: number;
}) {
  const actor = await requireRole(["ADMIN", "MANAGER"]);
  const take = Math.min(params?.take ?? 100, 300);
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, role: true },
  });
  const allowedIds = users
    .filter((u) => canManageWalletUser(actor, u))
    .map((u) => u.id);

  const where: Prisma.BudgetPackageWhereInput = {
    ownerUserId: params?.ownerUserId
      ? params.ownerUserId
      : { in: allowedIds },
  };

  if (params?.ownerUserId && !allowedIds.includes(params.ownerUserId)) {
    return { error: await actionError("noWalletManagePermission"), packages: [] as BudgetPackageDto[] };
  }

  if (params?.status === "ACTIVE") {
    where.status = { in: ["PENDING_FUNDING", "OPEN", "PENDING_SETTLE"] };
  } else if (params?.status && params.status !== "ALL") {
    where.status = params.status;
  }

  if (params?.from || params?.to) {
    where.createdAt = {};
    if (params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from)) {
      where.createdAt.gte = new Date(`${params.from}T00:00:00.000`);
    }
    if (params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to)) {
      where.createdAt.lte = new Date(`${params.to}T23:59:59.999`);
    }
  }

  const rows = await prisma.budgetPackage.findMany({
    where,
    include: budgetPackageInclude,
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    take,
  });

  return { packages: rows.map(serializeBudgetPackage) };
}

export async function getPackageDetailAction(packageId: string) {
  const user = await requireAuth();
  if (!packageId) {
    return { error: await actionError("budgetPackageNotFound") };
  }

  const pkg = await prisma.budgetPackage.findUnique({
    where: { id: packageId },
    include: {
      ...budgetPackageInclude,
      owner: { select: { id: true, name: true, role: true } },
      createdBy: { select: { id: true, name: true } },
      matter: { select: { code: true, title: true } },
      topupRequests: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          amountVnd: true,
          reason: true,
          status: true,
          createdAt: true,
          requestedBy: { select: { name: true } },
        },
      },
    },
  });
  if (!pkg) return { error: await actionError("budgetPackageNotFound") };

  const canView =
    pkg.ownerUserId === user.id ||
    pkg.createdById === user.id ||
    canManageWalletUser(user, pkg.owner);
  if (!canView) return { error: await actionError("noPermission") };

  const canManage =
    pkg.createdById === user.id || canManageWalletUser(user, pkg.owner);

  const [txs, pendingSettle] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { budgetPackageId: packageId },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        spendCategory: { select: { name: true } },
        createdBy: { select: { name: true } },
        matter: { select: { code: true, title: true } },
      },
    }),
    prisma.moneyConfirmation.findFirst({
      where: {
        budgetPackageId: packageId,
        kind: "PACKAGE_SETTLE",
        status: "PENDING_RECIPIENT",
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amountVnd: true,
        note: true,
        fromUserId: true,
        toUserId: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    package: serializeBudgetPackage(pkg),
    canManage,
    pendingTopups: pkg.topupRequests.map((r) => ({
      id: r.id,
      amountVnd: r.amountVnd.toString(),
      reason: r.reason,
      status: r.status as BudgetTopupRequestStatus,
      createdAt: r.createdAt.toISOString(),
      requestedByName: r.requestedBy.name,
    })),
    pendingSettle: pendingSettle
      ? {
          confirmationId: pendingSettle.id,
          amountVnd: pendingSettle.amountVnd.toString(),
          note: pendingSettle.note,
          fromUserId: pendingSettle.fromUserId,
          toUserId: pendingSettle.toUserId,
          createdAt: pendingSettle.createdAt.toISOString(),
        }
      : null,
    transactions: txs.map((tx) => ({
      id: tx.id,
      direction: tx.direction,
      kind: tx.kind as WalletTxKind,
      amountVnd: tx.amountVnd.toString(),
      balanceAfterVnd: tx.balanceAfterVnd.toString(),
      note: tx.note,
      detail: tx.detail,
      spendCategoryName: tx.spendCategory?.name ?? null,
      createdByName: tx.createdBy.name,
      matterCode: tx.matter?.code ?? null,
      matterTitle: tx.matter?.title ?? null,
      createdAt: tx.createdAt.toISOString(),
      splitGroupId: tx.splitGroupId,
    })),
  };
}

/** Owner: request top-up for OPEN package. */
export async function requestTopupAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = requestTopupSchema.safeParse({
    packageId: formData.get("packageId"),
    amountVnd: formData.get("amountVnd"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")),
    };
  }

  const pkg = await prisma.budgetPackage.findUnique({
    where: { id: parsed.data.packageId },
  });
  if (!pkg) return { error: await actionError("budgetPackageNotFound") };
  if (pkg.ownerUserId !== user.id) {
    return { error: await actionError("noPermission") };
  }
  if (pkg.status !== "OPEN") {
    return { error: await actionError("budgetPackageNotOpen") };
  }

  const amountVnd = BigInt(parsed.data.amountVnd);
  const reason = parsed.data.reason.trim();

  try {
    const req = await prisma.budgetTopupRequest.create({
      data: {
        packageId: pkg.id,
        requestedById: user.id,
        amountVnd,
        reason,
        status: "PENDING",
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "BudgetTopupRequest",
      entityId: req.id,
      details: `TOPUP_REQUEST ${amountVnd.toString()} package ${pkg.id}`,
    });

    const amountLabel = formatVndDigits(amountVnd.toString());
    await notifyWallet(
      pkg.createdById,
      "WALLET_TOPUP_REQUEST",
      "Yêu cầu bổ sung gói chi phí",
      `${user.name} xin thêm ${amountLabel} ₫ cho gói "${pkg.name}": ${reason}`,
      `/expenses/packages/${pkg.id}`,
    );

    revalidateMoneyPaths(pkg.id);
    return { success: true, requestId: req.id };
  } catch (error) {
    console.error("requestTopupAction failed:", error);
    return { error: await actionError("cannotRequestTopup") };
  }
}

/** Allocator: approve/reject top-up request. Approve → BUDGET_TOPUP confirmation. */
export async function decideTopupRequestAction(formData: FormData) {
  const actor = await requireAuth();
  const parsed = decideTopupSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")),
    };
  }

  const req = await prisma.budgetTopupRequest.findUnique({
    where: { id: parsed.data.requestId },
    include: {
      package: true,
      requestedBy: { select: { name: true } },
    },
  });
  if (!req) return { error: await actionError("topupRequestNotFound") };
  if (req.status !== "PENDING") {
    return { error: await actionError("topupRequestWrongStatus") };
  }
  if (req.package.createdById !== actor.id) {
    const owner = await prisma.user.findUnique({
      where: { id: req.package.ownerUserId },
      select: { id: true, role: true },
    });
    if (!owner || !canManageWalletUser(actor, owner)) {
      return { error: await actionError("noPermission") };
    }
  }
  if (req.package.status !== "OPEN") {
    return { error: await actionError("budgetPackageNotOpen") };
  }

  if (parsed.data.decision === "REJECT") {
    await prisma.budgetTopupRequest.update({
      where: { id: req.id },
      data: {
        status: "REJECTED",
        decidedById: actor.id,
        decidedAt: new Date(),
      },
    });
    await notifyWallet(
      req.requestedById,
      "WALLET_TOPUP_UPDATE",
      "Từ chối bổ sung gói",
      `${actor.name} từ chối yêu cầu bổ sung cho gói "${req.package.name}".`,
      `/expenses/packages/${req.packageId}`,
    );
    revalidateMoneyPaths(req.packageId);
    return { success: true };
  }

  // APPROVE → create BUDGET_TOPUP confirmation (still needs recipient accept)
  try {
    const confirmation = await prisma.$transaction(async (db) => {
      await db.budgetTopupRequest.update({
        where: { id: req.id },
        data: {
          status: "APPROVED",
          decidedById: actor.id,
          decidedAt: new Date(),
        },
      });
      return db.moneyConfirmation.create({
        data: {
          kind: "BUDGET_TOPUP",
          status: "PENDING_RECIPIENT",
          amountVnd: req.amountVnd,
          note: parsed.data.note?.trim() || req.reason,
          fromUserId: actor.id,
          toUserId: req.package.ownerUserId,
          matterId: req.package.matterId,
          budgetPackageId: req.packageId,
        },
      });
    });

    const amountLabel = formatVndDigits(req.amountVnd.toString());
    await notifyWallet(
      req.package.ownerUserId,
      "WALLET_TOPUP_UPDATE",
      "Đã duyệt bổ sung — chờ nhận tiền",
      `${actor.name} duyệt bổ sung ${amountLabel} ₫ cho gói "${req.package.name}". Xác nhận khi đã nhận tiền.`,
      "/wallet#confirmations",
    );

    revalidateMoneyPaths(req.packageId);
    return { success: true, confirmationId: confirmation.id };
  } catch (error) {
    console.error("decideTopupRequestAction failed:", error);
    return { error: await actionError("cannotDecideTopup") };
  }
}

/** Owner: propose settle (refund or carry-forward). */
export async function requestSettlePackageAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = requestSettlePackageSchema.safeParse({
    packageId: formData.get("packageId"),
    settleMode: formData.get("settleMode"),
    carryToPackageId: formData.get("carryToPackageId") || null,
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")),
    };
  }

  const pkg = await prisma.budgetPackage.findUnique({
    where: { id: parsed.data.packageId },
  });
  if (!pkg) return { error: await actionError("budgetPackageNotFound") };
  if (pkg.ownerUserId !== user.id) {
    return { error: await actionError("noPermission") };
  }
  if (pkg.status !== "OPEN") {
    return { error: await actionError("budgetPackageNotOpen") };
  }

  const remaining = packageRemainingVnd(pkg);
  let carryToPackageId: string | null = null;

  if (parsed.data.settleMode === "CARRY_FORWARD") {
    if (remaining <= BigInt(0)) {
      return { error: await actionError("budgetPackageNoRemaining") };
    }
    const destId = parsed.data.carryToPackageId!.trim();
    if (destId === pkg.id) {
      return { error: await actionError("cannotCarryToSamePackage") };
    }
    const dest = await prisma.budgetPackage.findUnique({
      where: { id: destId },
    });
    if (!dest || dest.ownerUserId !== user.id || dest.status !== "OPEN") {
      return { error: await actionError("carryTargetInvalid") };
    }
    carryToPackageId = dest.id;
  }

  const note = parsed.data.note?.trim() || null;

  try {
    const confirmation = await prisma.$transaction(async (db) => {
      await db.budgetPackage.update({
        where: { id: pkg.id },
        data: {
          status: "PENDING_SETTLE",
          settleMode: parsed.data.settleMode,
          carryToPackageId,
          settleRequestedAt: new Date(),
          note: note ?? pkg.note,
        },
      });
      return db.moneyConfirmation.create({
        data: {
          kind: "PACKAGE_SETTLE",
          status: "PENDING_RECIPIENT",
          // settle confirmation: fromUser = owner (proposer), toUser = allocator (approver)
          // Reuse dual-confirm: recipient = allocator who must approve settle
          amountVnd: remaining,
          note,
          fromUserId: user.id,
          toUserId: pkg.createdById,
          matterId: pkg.matterId,
          budgetPackageId: pkg.id,
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "BudgetPackage",
      entityId: pkg.id,
      details: `SETTLE_REQUEST ${parsed.data.settleMode} remaining=${remaining.toString()}`,
    });

    const amountLabel = formatVndDigits(remaining.toString());
    await notifyWallet(
      pkg.createdById,
      "WALLET_PACKAGE_SETTLE",
      "Đề nghị chốt gói chi phí",
      `${user.name} đề nghị chốt gói "${pkg.name}" (còn ${amountLabel} ₫, ${parsed.data.settleMode === "REFUND" ? "hoàn lại" : "chuyển gói"}).`,
      `/expenses/packages/${pkg.id}`,
    );

    revalidateMoneyPaths(pkg.id);
    return { success: true, confirmationId: confirmation.id };
  } catch (error) {
    console.error("requestSettlePackageAction failed:", error);
    return { error: await actionError("cannotRequestSettle") };
  }
}

/**
 * Allocator approves/rejects settle.
 * For PACKAGE_SETTLE we treat toUser (allocator) as the decision maker via this action,
 * not the generic respondMoneyConfirmation flow.
 */
export async function decideSettlePackageAction(formData: FormData) {
  const actor = await requireAuth();
  const parsed = decideSettlePackageSchema.safeParse({
    confirmationId: formData.get("confirmationId"),
    decision: formData.get("decision"),
    note: formData.get("note"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")),
    };
  }

  const confirmation = await prisma.moneyConfirmation.findUnique({
    where: { id: parsed.data.confirmationId },
    include: { budgetPackage: true },
  });
  if (!confirmation || confirmation.kind !== "PACKAGE_SETTLE") {
    return { error: await actionError("confirmationNotFound") };
  }
  if (confirmation.toUserId !== actor.id) {
    return { error: await actionError("noPermission") };
  }
  if (confirmation.status !== "PENDING_RECIPIENT") {
    return { error: await actionError("confirmationWrongStatus") };
  }

  const pkg = confirmation.budgetPackage;
  if (!pkg || pkg.status !== "PENDING_SETTLE") {
    return { error: await actionError("budgetPackageWrongStatus") };
  }

  if (parsed.data.decision === "REJECT") {
    await prisma.$transaction(async (db) => {
      await db.budgetPackage.update({
        where: { id: pkg.id },
        data: {
          status: "OPEN",
          settleMode: null,
          carryToPackageId: null,
          settleRequestedAt: null,
        },
      });
      await db.moneyConfirmation.update({
        where: { id: confirmation.id },
        data: {
          status: "REJECTED",
          recipientRespondedAt: new Date(),
          disputeNote: parsed.data.note?.trim() || null,
        },
      });
    });

    await notifyWallet(
      pkg.ownerUserId,
      "WALLET_PACKAGE_SETTLE",
      "Từ chối chốt gói",
      `${actor.name} từ chối đề nghị chốt gói "${pkg.name}". Gói vẫn mở.`,
      `/expenses/packages/${pkg.id}`,
    );

    revalidateMoneyPaths(pkg.id);
    return { success: true };
  }

  // APPROVE settle
  try {
    await prisma.$transaction(async (db) => {
      const fresh = await db.budgetPackage.findUniqueOrThrow({
        where: { id: pkg.id },
      });
      const remaining = packageRemainingVnd(fresh);

      await ensureStaffWallet(db, fresh.ownerUserId);

      if (remaining > BigInt(0) && fresh.settleMode === "REFUND") {
        const updated = await db.staffWallet.update({
          where: { userId: fresh.ownerUserId },
          data: { balanceVnd: { decrement: remaining } },
        });
        await db.walletTransaction.create({
          data: {
            walletUserId: fresh.ownerUserId,
            direction: "DEBIT",
            kind: "REFUND",
            amountVnd: remaining,
            balanceAfterVnd: updated.balanceVnd,
            budgetPackageId: fresh.id,
            note: `Hoàn lại gói "${fresh.name}"`,
            allocatedById: actor.id,
            createdById: actor.id,
            matterId: fresh.matterId,
          },
        });
        await db.budgetPackage.update({
          where: { id: fresh.id },
          data: {
            returnedVnd: { increment: remaining },
            status: "CLOSED",
            closedAt: new Date(),
          },
        });
      } else if (
        remaining > BigInt(0) &&
        fresh.settleMode === "CARRY_FORWARD" &&
        fresh.carryToPackageId
      ) {
        const dest = await db.budgetPackage.findUniqueOrThrow({
          where: { id: fresh.carryToPackageId },
        });
        if (dest.status !== "OPEN" || dest.ownerUserId !== fresh.ownerUserId) {
          throw new Error("CARRY_TARGET_INVALID");
        }
        const wallet = await db.staffWallet.findUniqueOrThrow({
          where: { userId: fresh.ownerUserId },
        });
        // Balance unchanged: CARRY_OUT + CARRY_IN
        await db.walletTransaction.create({
          data: {
            walletUserId: fresh.ownerUserId,
            direction: "DEBIT",
            kind: "CARRY_OUT",
            amountVnd: remaining,
            balanceAfterVnd: wallet.balanceVnd,
            budgetPackageId: fresh.id,
            note: `Chuyển sang gói "${dest.name}"`,
            createdById: actor.id,
            allocatedById: actor.id,
            matterId: fresh.matterId,
          },
        });
        await db.walletTransaction.create({
          data: {
            walletUserId: fresh.ownerUserId,
            direction: "CREDIT",
            kind: "CARRY_IN",
            amountVnd: remaining,
            balanceAfterVnd: wallet.balanceVnd,
            budgetPackageId: dest.id,
            note: `Nhận từ gói "${fresh.name}"`,
            createdById: actor.id,
            allocatedById: actor.id,
            matterId: dest.matterId,
          },
        });
        await db.budgetPackage.update({
          where: { id: fresh.id },
          data: {
            returnedVnd: { increment: remaining },
            status: "CLOSED",
            closedAt: new Date(),
          },
        });
        await db.budgetPackage.update({
          where: { id: dest.id },
          data: { allocatedVnd: { increment: remaining } },
        });
      } else {
        // remaining == 0 or no settle mode needed
        await db.budgetPackage.update({
          where: { id: fresh.id },
          data: { status: "CLOSED", closedAt: new Date() },
        });
      }

      await db.moneyConfirmation.update({
        where: { id: confirmation.id },
        data: {
          status: "CONFIRMED",
          recipientRespondedAt: new Date(),
          allocatorConfirmedAt: new Date(),
        },
      });
    });

    await createAuditLog({
      userId: actor.id,
      action: "UPDATE",
      entityType: "BudgetPackage",
      entityId: pkg.id,
      details: `SETTLE_APPROVED ${pkg.settleMode ?? "ZERO"}`,
    });

    await notifyWallet(
      pkg.ownerUserId,
      "WALLET_PACKAGE_SETTLE",
      "Đã chốt gói chi phí",
      `${actor.name} đã duyệt chốt gói "${pkg.name}".`,
      `/expenses/packages/${pkg.id}`,
    );

    revalidateMoneyPaths(pkg.id);
    return { success: true };
  } catch (error) {
    console.error("decideSettlePackageAction failed:", error);
    return { error: await actionError("cannotApproveSettle") };
  }
}

/** Open packages for current user (spend picker). */
export async function listMyOpenPackagesAction() {
  const user = await requireAuth();
  const rows = await prisma.budgetPackage.findMany({
    where: { ownerUserId: user.id, status: "OPEN" },
    include: budgetPackageInclude,
    orderBy: { updatedAt: "desc" },
  });
  return { packages: rows.map(serializeBudgetPackage) };
}
