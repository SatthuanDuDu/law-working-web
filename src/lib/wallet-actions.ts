"use server";

import { revalidatePath } from "next/cache";
import type { ExpenseType, Prisma, WalletDirection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { createAuditLog } from "@/lib/audit";
import { getAccessibleMatterIds } from "@/lib/access";
import { actionError } from "@/i18n/server-labels";
import { ensureStaffWallet } from "@/lib/wallet";
import { walletSpendSchema } from "@/lib/wallet-validations";
import { canManageWalletUser } from "@/lib/permissions";
import { allocateBudgetAction as allocateBudgetConfirmation } from "@/lib/money-confirmation-actions";

const OPEN_MATTER_STATUSES = ["NEW", "IN_PROGRESS", "ON_HOLD"] as const;

export type SpendCategoryOption = {
  id: string;
  name: string;
  code: string | null;
  requiresMatter: boolean;
  isActive: boolean;
  sortOrder: number;
};

export type WalletTxAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type WalletTxListItem = {
  id: string;
  direction: WalletDirection;
  amountVnd: string;
  balanceAfterVnd: string;
  spendCategoryId: string | null;
  spendCategoryName: string | null;
  spendCategoryCode: string | null;
  note: string | null;
  detail: string | null;
  expenseType: ExpenseType | null;
  customTypeLabel: string | null;
  legacyImported: boolean;
  createdAt: string;
  allocatedByName: string | null;
  createdByName: string;
  matterCode: string | null;
  matterTitle: string | null;
  planStepTitle: string | null;
  walletUserId: string;
  walletUserName: string;
  attachments: WalletTxAttachment[];
};

function serializeTx(
  tx: {
    id: string;
    direction: WalletDirection;
    amountVnd: bigint;
    balanceAfterVnd: bigint;
    spendCategoryId: string | null;
    spendCategory: { name: string; code: string | null } | null;
    note: string | null;
    detail: string | null;
    expenseType: ExpenseType | null;
    customTypeLabel: string | null;
    legacyImported: boolean;
    createdAt: Date;
    walletUserId: string;
    allocatedBy: { name: string } | null;
    createdBy: { name: string };
    matter: { code: string; title: string } | null;
    matterPlanStep: { title: string } | null;
    wallet: { user: { name: string } };
    attachments: {
      id: string;
      fileName: string;
      mimeType: string;
      sizeBytes: number;
    }[];
  },
): WalletTxListItem {
  return {
    id: tx.id,
    direction: tx.direction,
    amountVnd: tx.amountVnd.toString(),
    balanceAfterVnd: tx.balanceAfterVnd.toString(),
    spendCategoryId: tx.spendCategoryId,
    spendCategoryName: tx.spendCategory?.name ?? null,
    spendCategoryCode: tx.spendCategory?.code ?? null,
    note: tx.note,
    detail: tx.detail,
    expenseType: tx.expenseType,
    customTypeLabel: tx.customTypeLabel,
    legacyImported: tx.legacyImported,
    createdAt: tx.createdAt.toISOString(),
    allocatedByName: tx.allocatedBy?.name ?? null,
    createdByName: tx.createdBy.name,
    matterCode: tx.matter?.code ?? null,
    matterTitle: tx.matter?.title ?? null,
    planStepTitle: tx.matterPlanStep?.title ?? null,
    walletUserId: tx.walletUserId,
    walletUserName: tx.wallet.user.name,
    attachments: (tx.attachments ?? []).map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
    })),
  };
}

const txInclude = {
  allocatedBy: { select: { name: true } },
  createdBy: { select: { name: true } },
  matter: { select: { code: true, title: true } },
  matterPlanStep: { select: { title: true } },
  spendCategory: { select: { name: true, code: true } },
  wallet: { include: { user: { select: { name: true } } } },
  attachments: {
    where: { isLatest: true },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.WalletTransactionInclude;

export async function listActiveSpendCategoriesAction() {
  await requireAuth();
  const categories = await prisma.spendCategory.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      requiresMatter: true,
      isActive: true,
      sortOrder: true,
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
  return { categories };
}

export async function getMyWalletAction() {
  const user = await requireAuth();
  const wallet = await ensureStaffWallet(prisma, user.id);
  return {
    balanceVnd: wallet.balanceVnd.toString(),
    userId: user.id,
  };
}

export async function listActiveUsersForBudgetAction() {
  const actor = await requireRole(["ADMIN", "MANAGER"]);
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true, username: true, role: true },
    orderBy: [{ name: "asc" }],
  });
  return {
    users: users.filter((u) => canManageWalletUser(actor, u)),
  };
}

/** Thin wrapper — Next "use server" cannot re-export from another module. */
export async function allocateBudgetAction(formData: FormData) {
  return allocateBudgetConfirmation(formData);
}

export async function recordWalletSpendAction(formData: FormData) {
  const user = await requireAuth();
  const spendCategoryId = String(formData.get("spendCategoryId") ?? "");
  const categoryRow = await prisma.spendCategory.findUnique({
    where: { id: spendCategoryId },
  });
  if (!categoryRow || !categoryRow.isActive) {
    return { error: await actionError("spendCategoryNotFound") };
  }

  const parsed = walletSpendSchema.safeParse({
    spendCategoryId,
    amountVnd: formData.get("amountVnd"),
    detail: formData.get("detail"),
    matterId: formData.get("matterId") || null,
    matterPlanStepId: formData.get("matterPlanStepId") || null,
    expenseType: formData.get("expenseType") || null,
    customTypeLabel: formData.get("customTypeLabel"),
    note: formData.get("note"),
    requiresMatter: categoryRow.requiresMatter,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const amountVnd = BigInt(parsed.data.amountVnd);
  let matterId: string | null = null;
  let matterPlanStepId: string | null = null;
  let expenseType: ExpenseType | null = null;
  let customTypeLabel: string | null = null;
  const detail = parsed.data.detail?.trim() || null;
  const note = parsed.data.note?.trim() || null;

  if (categoryRow.requiresMatter) {
    matterId = parsed.data.matterId!.trim();
    const accessibleIds = await getAccessibleMatterIds(user.id, user.role);
    if (accessibleIds && !accessibleIds.includes(matterId)) {
      return { error: await actionError("noMatterAccess") };
    }
    const matter = await prisma.matter.findUnique({
      where: { id: matterId },
      select: { id: true, status: true, deletedAt: true },
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

    expenseType = parsed.data.expenseType!;
    customTypeLabel =
      expenseType === "OTHER" ? parsed.data.customTypeLabel?.trim() || null : null;

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
  }

  try {
    const created = await prisma.$transaction(async (db) => {
      await ensureStaffWallet(db, user.id);
      const wallet = await db.staffWallet.findUniqueOrThrow({
        where: { userId: user.id },
      });
      if (wallet.balanceVnd < amountVnd) {
        throw new Error("INSUFFICIENT_BALANCE");
      }
      const updated = await db.staffWallet.update({
        where: { userId: user.id },
        data: { balanceVnd: { decrement: amountVnd } },
      });
      return db.walletTransaction.create({
        data: {
          walletUserId: user.id,
          direction: "DEBIT",
          amountVnd,
          balanceAfterVnd: updated.balanceVnd,
          spendCategoryId: categoryRow.id,
          detail,
          note,
          matterId,
          matterPlanStepId,
          expenseType,
          customTypeLabel,
          createdById: user.id,
        },
        include: txInclude,
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "WalletTransaction",
      entityId: created.id,
      details: `DEBIT ${categoryRow.name} ${amountVnd.toString()} VND`,
    });

    revalidatePath("/wallet");
    revalidatePath("/expenses");
    if (matterId) {
      revalidatePath(`/matters/${matterId}`);
      revalidatePath("/matters");
    }
    return { success: true, transaction: serializeTx(created) };
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return { error: await actionError("insufficientBalance") };
    }
    console.error("recordWalletSpendAction failed:", error);
    return { error: await actionError("cannotRecordSpend") };
  }
}

export async function listWalletTransactionsAction(params: {
  scope: "mine" | "company";
  walletUserId?: string | null;
  direction?: WalletDirection | "ALL" | null;
  spendCategoryId?: string | "ALL" | null;
  from?: string | null;
  to?: string | null;
  sort?: "newest" | "oldest" | "amount_desc" | "amount_asc";
  includeLegacy?: boolean;
  take?: number;
}) {
  const user = await requireAuth();
  if (params.scope === "company") {
    await requireRole(["ADMIN", "MANAGER"]);
  }

  const where: Prisma.WalletTransactionWhereInput = {};
  if (params.scope === "mine") {
    where.walletUserId = user.id;
  } else if (params.walletUserId) {
    const target = await prisma.user.findUnique({
      where: { id: params.walletUserId },
      select: { id: true, role: true },
    });
    if (!target || !canManageWalletUser(user, target)) {
      return { error: await actionError("noWalletManagePermission"), transactions: [] };
    }
    where.walletUserId = params.walletUserId;
  } else if (params.scope === "company") {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, role: true },
    });
    const allowed = users
      .filter((u) => canManageWalletUser(user, u))
      .map((u) => u.id);
    where.walletUserId = { in: allowed };
  }

  if (params.direction && params.direction !== "ALL") {
    where.direction = params.direction;
  }
  if (params.spendCategoryId && params.spendCategoryId !== "ALL") {
    where.spendCategoryId = params.spendCategoryId;
  }
  if (!params.includeLegacy) {
    where.legacyImported = false;
  }

  if (params.from || params.to) {
    where.createdAt = {};
    if (params.from && /^\d{4}-\d{2}-\d{2}$/.test(params.from)) {
      where.createdAt.gte = new Date(`${params.from}T00:00:00.000`);
    }
    if (params.to && /^\d{4}-\d{2}-\d{2}$/.test(params.to)) {
      where.createdAt.lte = new Date(`${params.to}T23:59:59.999`);
    }
  }

  let orderBy: Prisma.WalletTransactionOrderByWithRelationInput = {
    createdAt: "desc",
  };
  if (params.sort === "oldest") orderBy = { createdAt: "asc" };
  if (params.sort === "amount_desc") orderBy = { amountVnd: "desc" };
  if (params.sort === "amount_asc") orderBy = { amountVnd: "asc" };

  const rows = await prisma.walletTransaction.findMany({
    where,
    include: txInclude,
    orderBy,
    take: Math.min(params.take ?? 100, 300),
  });

  return { transactions: rows.map(serializeTx) };
}

export async function getPlanStepsForMatterAction(matterId: string) {
  const user = await requireAuth();
  if (!matterId) return { steps: [] as { id: string; title: string }[] };

  const accessibleIds = await getAccessibleMatterIds(user.id, user.role);
  if (accessibleIds && !accessibleIds.includes(matterId)) {
    return { error: await actionError("noMatterAccess"), steps: [] };
  }

  const steps = await prisma.matterPlanStep.findMany({
    where: { matterId },
    select: { id: true, title: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  return { steps };
}
