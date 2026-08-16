"use server";

import { revalidatePath } from "next/cache";
import type { ExpenseType, Prisma, WalletDirection } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { createAuditLog } from "@/lib/audit";
import { getAccessibleMatterIds } from "@/lib/access";
import { actionError } from "@/i18n/server-labels";
import { ensureStaffWallet } from "@/lib/wallet";
import { walletSpendSchema, walletUpdateSpendSchema } from "@/lib/wallet-validations";
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
  kind: string;
  budgetPackageId: string | null;
  budgetPackageName: string | null;
  splitGroupId: string | null;
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
    kind: string;
    budgetPackageId: string | null;
    budgetPackage: { name: string } | null;
    splitGroupId: string | null;
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
    kind: tx.kind,
    budgetPackageId: tx.budgetPackageId,
    budgetPackageName: tx.budgetPackage?.name ?? null,
    splitGroupId: tx.splitGroupId,
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
  budgetPackage: { select: { name: true } },
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
    budgetPackageId: formData.get("budgetPackageId"),
    splitFromPackageId: formData.get("splitFromPackageId") || null,
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
  const primaryPackageId = parsed.data.budgetPackageId.trim();
  const splitFromPackageId = parsed.data.splitFromPackageId?.trim() || null;

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

  const { packageRemainingVnd } = await import("@/lib/budget-package");
  const { randomUUID } = await import("crypto");

  try {
    const created = await prisma.$transaction(async (db) => {
      await ensureStaffWallet(db, user.id);
      const wallet = await db.staffWallet.findUniqueOrThrow({
        where: { userId: user.id },
      });
      if (wallet.balanceVnd < amountVnd) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const primary = await db.budgetPackage.findUnique({
        where: { id: primaryPackageId },
      });
      if (
        !primary ||
        primary.ownerUserId !== user.id ||
        primary.status !== "OPEN"
      ) {
        throw new Error("INVALID_PACKAGE");
      }

      const primaryRemaining = packageRemainingVnd(primary);
      let primaryDebit = amountVnd;
      let splitDebit = BigInt(0);
      let splitPkgId: string | null = null;
      let splitGroupId: string | null = null;

      if (amountVnd > primaryRemaining) {
        if (!splitFromPackageId) {
          throw new Error("PACKAGE_OVERSPEND");
        }
        const splitPkg = await db.budgetPackage.findUnique({
          where: { id: splitFromPackageId },
        });
        if (
          !splitPkg ||
          splitPkg.ownerUserId !== user.id ||
          splitPkg.status !== "OPEN"
        ) {
          throw new Error("INVALID_SPLIT_PACKAGE");
        }
        const splitRemaining = packageRemainingVnd(splitPkg);
        const shortfall = amountVnd - primaryRemaining;
        if (shortfall > splitRemaining) {
          throw new Error("PACKAGE_OVERSPEND");
        }
        primaryDebit = primaryRemaining;
        splitDebit = shortfall;
        splitPkgId = splitPkg.id;
        splitGroupId = randomUUID();
      }

      const updated = await db.staffWallet.update({
        where: { userId: user.id },
        data: { balanceVnd: { decrement: amountVnd } },
      });

      // After full decrement, balance is updated.balanceVnd.
      // First row (primary): balance after primary portion =
      // (updated.balanceVnd + amountVnd) - primaryDebit = updated.balanceVnd + splitDebit
      const afterPrimary = updated.balanceVnd + splitDebit;

      const primaryTx = await db.walletTransaction.create({
        data: {
          walletUserId: user.id,
          direction: "DEBIT",
          kind: "SPEND",
          amountVnd: primaryDebit,
          balanceAfterVnd: afterPrimary,
          budgetPackageId: primary.id,
          splitGroupId,
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

      await db.budgetPackage.update({
        where: { id: primary.id },
        data: { spentVnd: { increment: primaryDebit } },
      });

      if (splitDebit > BigInt(0) && splitPkgId && splitGroupId) {
        await db.walletTransaction.create({
          data: {
            walletUserId: user.id,
            direction: "DEBIT",
            kind: "SPEND",
            amountVnd: splitDebit,
            balanceAfterVnd: updated.balanceVnd,
            budgetPackageId: splitPkgId,
            splitGroupId,
            spendCategoryId: categoryRow.id,
            detail,
            note: note ? `${note} (bù gói)` : "Bù từ gói khác",
            matterId,
            matterPlanStepId,
            expenseType,
            customTypeLabel,
            createdById: user.id,
          },
        });
        await db.budgetPackage.update({
          where: { id: splitPkgId },
          data: { spentVnd: { increment: splitDebit } },
        });
      }

      return primaryTx;
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "WalletTransaction",
      entityId: created.id,
      details: `DEBIT ${categoryRow.name} ${amountVnd.toString()} VND package=${primaryPackageId}`,
    });

    revalidatePath("/wallet");
    revalidatePath("/expenses");
    revalidatePath(`/expenses/packages/${primaryPackageId}`);
    if (splitFromPackageId) {
      revalidatePath(`/expenses/packages/${splitFromPackageId}`);
    }
    if (matterId) {
      revalidatePath(`/matters/${matterId}`);
      revalidatePath("/matters");
    }
    return { success: true, transaction: serializeTx(created) };
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return { error: await actionError("insufficientBalance") };
    }
    if (error instanceof Error && error.message === "PACKAGE_OVERSPEND") {
      return { error: await actionError("budgetPackageOverspend") };
    }
    if (
      error instanceof Error &&
      (error.message === "INVALID_PACKAGE" ||
        error.message === "INVALID_SPLIT_PACKAGE")
    ) {
      return { error: await actionError("budgetPackageInvalid") };
    }
    console.error("recordWalletSpendAction failed:", error);
    return { error: await actionError("cannotRecordSpend") };
  }
}

/** Rebuild balanceAfterVnd for every non-legacy tx on a wallet (createdAt, id order). */
async function rebuildWalletBalanceAfterInTx(
  db: Prisma.TransactionClient,
  walletUserId: string,
) {
  const wallet = await db.staffWallet.findUniqueOrThrow({
    where: { userId: walletUserId },
  });
  const txs = await db.walletTransaction.findMany({
    where: { walletUserId, legacyImported: false },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      direction: true,
      amountVnd: true,
    },
  });

  let start = wallet.balanceVnd;
  for (const tx of txs) {
    if (tx.direction === "DEBIT") start += tx.amountVnd;
    else start -= tx.amountVnd;
  }

  let running = start;
  for (const tx of txs) {
    if (tx.direction === "DEBIT") running -= tx.amountVnd;
    else running += tx.amountVnd;
    await db.walletTransaction.update({
      where: { id: tx.id },
      data: { balanceAfterVnd: running },
    });
  }
}

export type WalletSpendEditContext = {
  keepTransactionId: string;
  walletUserId: string;
  amountVnd: string;
  budgetPackageId: string | null;
  splitFromPackageId: string | null;
  spendCategoryId: string | null;
  detail: string | null;
  note: string | null;
  matterId: string | null;
  matterPlanStepId: string | null;
  expenseType: ExpenseType | null;
  customTypeLabel: string | null;
  siblingCount: number;
  /** Amounts currently counted in package.spent — add back for UI remaining checks. */
  packageAmountCredits: { packageId: string; amountVnd: string }[];
};

export async function getWalletSpendEditContextAction(transactionId: string) {
  const user = await requireAuth();
  const tx = await prisma.walletTransaction.findUnique({
    where: { id: transactionId },
  });
  if (
    !tx ||
    tx.direction !== "DEBIT" ||
    tx.kind !== "SPEND" ||
    tx.legacyImported
  ) {
    return { error: await actionError("spendNotEditable") };
  }
  if (tx.walletUserId !== user.id) {
    return { error: await actionError("noPermission") };
  }

  const siblings = tx.splitGroupId
    ? await prisma.walletTransaction.findMany({
        where: {
          walletUserId: tx.walletUserId,
          splitGroupId: tx.splitGroupId,
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      })
    : [tx];

  const keep = siblings[0]!;
  let total = BigInt(0);
  let primaryPackageId: string | null = keep.budgetPackageId;
  let splitFromPackageId: string | null = null;
  for (let i = 0; i < siblings.length; i++) {
    const s = siblings[i]!;
    total += s.amountVnd;
    if (i === 0) primaryPackageId = s.budgetPackageId;
    else if (s.budgetPackageId) splitFromPackageId = s.budgetPackageId;
  }

  const ctx: WalletSpendEditContext = {
    keepTransactionId: keep.id,
    walletUserId: keep.walletUserId,
    amountVnd: total.toString(),
    budgetPackageId: primaryPackageId,
    splitFromPackageId,
    spendCategoryId: keep.spendCategoryId,
    detail: keep.detail,
    note: keep.note,
    matterId: keep.matterId,
    matterPlanStepId: keep.matterPlanStepId,
    expenseType: keep.expenseType,
    customTypeLabel: keep.customTypeLabel,
    siblingCount: siblings.length,
    packageAmountCredits: siblings
      .filter((s) => s.budgetPackageId)
      .map((s) => ({
        packageId: s.budgetPackageId!,
        amountVnd: s.amountVnd.toString(),
      })),
  };
  return { success: true as const, context: ctx };
}

export async function updateWalletSpendAction(formData: FormData) {
  const user = await requireAuth();
  const spendCategoryId = String(formData.get("spendCategoryId") ?? "");
  const categoryRow = await prisma.spendCategory.findUnique({
    where: { id: spendCategoryId },
  });
  if (!categoryRow || !categoryRow.isActive) {
    return { error: await actionError("spendCategoryNotFound") };
  }

  const parsed = walletUpdateSpendSchema.safeParse({
    transactionId: formData.get("transactionId"),
    justification: formData.get("justification"),
    spendCategoryId,
    amountVnd: formData.get("amountVnd"),
    budgetPackageId: formData.get("budgetPackageId"),
    splitFromPackageId: formData.get("splitFromPackageId") || null,
    detail: formData.get("detail"),
    matterId: formData.get("matterId") || null,
    matterPlanStepId: formData.get("matterPlanStepId") || null,
    expenseType: formData.get("expenseType") || null,
    customTypeLabel: formData.get("customTypeLabel"),
    note: formData.get("note"),
    requiresMatter: categoryRow.requiresMatter,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")),
    };
  }

  const amountVnd = BigInt(parsed.data.amountVnd);
  const justification = parsed.data.justification.trim();
  const primaryPackageId = parsed.data.budgetPackageId.trim();
  const splitFromPackageId = parsed.data.splitFromPackageId?.trim() || null;
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

  const { packageRemainingVnd } = await import("@/lib/budget-package");
  const { randomUUID } = await import("crypto");
  const { diffFields, recordRevision } = await import("@/lib/revisions");

  try {
    const updated = await prisma.$transaction(async (db) => {
      const anchor = await db.walletTransaction.findUnique({
        where: { id: parsed.data.transactionId },
      });
      if (
        !anchor ||
        anchor.direction !== "DEBIT" ||
        anchor.kind !== "SPEND" ||
        anchor.legacyImported
      ) {
        throw new Error("NOT_EDITABLE");
      }
      if (anchor.walletUserId !== user.id) {
        throw new Error("NO_PERMISSION");
      }

      const siblings = anchor.splitGroupId
        ? await db.walletTransaction.findMany({
            where: {
              walletUserId: anchor.walletUserId,
              splitGroupId: anchor.splitGroupId,
            },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          })
        : [anchor];

      const keep = siblings[0]!;
      let oldTotal = BigInt(0);
      const oldPackageIds = new Set<string>();
      for (const s of siblings) {
        oldTotal += s.amountVnd;
        if (s.budgetPackageId) oldPackageIds.add(s.budgetPackageId);
      }

      const beforeSnap = {
        amountVnd: oldTotal.toString(),
        budgetPackageId: keep.budgetPackageId ?? "",
        spendCategoryId: keep.spendCategoryId ?? "",
        detail: keep.detail ?? "",
        note: keep.note ?? "",
        matterId: keep.matterId ?? "",
      };

      for (const s of siblings) {
        if (s.budgetPackageId) {
          await db.budgetPackage.update({
            where: { id: s.budgetPackageId },
            data: { spentVnd: { decrement: s.amountVnd } },
          });
        }
      }

      const extraIds = siblings.slice(1).map((s) => s.id);
      if (extraIds.length) {
        await db.walletTransaction.deleteMany({
          where: { id: { in: extraIds } },
        });
      }

      const wallet = await db.staffWallet.findUniqueOrThrow({
        where: { userId: keep.walletUserId },
      });
      const available = wallet.balanceVnd + oldTotal;
      if (available < amountVnd) {
        throw new Error("INSUFFICIENT_BALANCE");
      }
      const delta = amountVnd - oldTotal;
      if (delta !== BigInt(0)) {
        await db.staffWallet.update({
          where: { userId: keep.walletUserId },
          data: { balanceVnd: { decrement: delta } },
        });
      }

      const primary = await db.budgetPackage.findUnique({
        where: { id: primaryPackageId },
      });
      if (
        !primary ||
        primary.ownerUserId !== keep.walletUserId ||
        primary.status !== "OPEN"
      ) {
        throw new Error("INVALID_PACKAGE");
      }

      const primaryRemaining = packageRemainingVnd(primary);
      let primaryDebit = amountVnd;
      let splitDebit = BigInt(0);
      let splitPkgId: string | null = null;
      let splitGroupId: string | null = null;

      if (amountVnd > primaryRemaining) {
        if (!splitFromPackageId) {
          throw new Error("PACKAGE_OVERSPEND");
        }
        const splitPkg = await db.budgetPackage.findUnique({
          where: { id: splitFromPackageId },
        });
        if (
          !splitPkg ||
          splitPkg.ownerUserId !== keep.walletUserId ||
          splitPkg.status !== "OPEN"
        ) {
          throw new Error("INVALID_SPLIT_PACKAGE");
        }
        const splitRemaining = packageRemainingVnd(splitPkg);
        const shortfall = amountVnd - primaryRemaining;
        if (shortfall > splitRemaining) {
          throw new Error("PACKAGE_OVERSPEND");
        }
        primaryDebit = primaryRemaining;
        splitDebit = shortfall;
        splitPkgId = splitPkg.id;
        splitGroupId = randomUUID();
      }

      await db.walletTransaction.update({
        where: { id: keep.id },
        data: {
          amountVnd: primaryDebit,
          budgetPackageId: primary.id,
          splitGroupId,
          spendCategoryId: categoryRow.id,
          detail,
          note,
          matterId,
          matterPlanStepId,
          expenseType,
          customTypeLabel,
        },
      });

      await db.budgetPackage.update({
        where: { id: primary.id },
        data: { spentVnd: { increment: primaryDebit } },
      });
      oldPackageIds.add(primary.id);

      if (splitDebit > BigInt(0) && splitPkgId && splitGroupId) {
        await db.walletTransaction.create({
          data: {
            walletUserId: keep.walletUserId,
            direction: "DEBIT",
            kind: "SPEND",
            amountVnd: splitDebit,
            balanceAfterVnd: BigInt(0),
            budgetPackageId: splitPkgId,
            splitGroupId,
            spendCategoryId: categoryRow.id,
            detail,
            note: note ? `${note} (bù gói)` : "Bù từ gói khác",
            matterId,
            matterPlanStepId,
            expenseType,
            customTypeLabel,
            createdById: user.id,
            createdAt: keep.createdAt,
          },
        });
        await db.budgetPackage.update({
          where: { id: splitPkgId },
          data: { spentVnd: { increment: splitDebit } },
        });
        oldPackageIds.add(splitPkgId);
      }

      await rebuildWalletBalanceAfterInTx(db, keep.walletUserId);

      const afterSnap = {
        amountVnd: amountVnd.toString(),
        budgetPackageId: primary.id,
        spendCategoryId: categoryRow.id,
        detail: detail ?? "",
        note: note ?? "",
        matterId: matterId ?? "",
      };
      const changes = diffFields(beforeSnap, afterSnap, [
        { field: "amountVnd", label: "Số tiền" },
        { field: "budgetPackageId", label: "Gói" },
        { field: "spendCategoryId", label: "Nhóm chi" },
        { field: "detail", label: "Chi tiết" },
        { field: "note", label: "Ghi chú" },
        { field: "matterId", label: "Vụ việc" },
      ]);
      await recordRevision(db, {
        entityType: "WalletTransaction",
        entityId: keep.id,
        changedById: user.id,
        justification,
        source: "FORM",
        changes,
      });

      const refreshed = await db.walletTransaction.findUniqueOrThrow({
        where: { id: keep.id },
        include: txInclude,
      });
      return { tx: refreshed, packageIds: [...oldPackageIds] };
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "WalletTransaction",
      entityId: updated.tx.id,
      details: `UPDATE SPEND ${amountVnd.toString()} VND`,
    });

    revalidatePath("/wallet");
    revalidatePath("/expenses");
    for (const pid of updated.packageIds) {
      revalidatePath(`/expenses/packages/${pid}`);
    }
    if (matterId) {
      revalidatePath(`/matters/${matterId}`);
      revalidatePath("/matters");
    }
    return { success: true, transaction: serializeTx(updated.tx) };
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_BALANCE") {
      return { error: await actionError("insufficientBalance") };
    }
    if (error instanceof Error && error.message === "PACKAGE_OVERSPEND") {
      return { error: await actionError("budgetPackageOverspend") };
    }
    if (
      error instanceof Error &&
      (error.message === "INVALID_PACKAGE" ||
        error.message === "INVALID_SPLIT_PACKAGE")
    ) {
      return { error: await actionError("budgetPackageInvalid") };
    }
    if (error instanceof Error && error.message === "NOT_EDITABLE") {
      return { error: await actionError("spendNotEditable") };
    }
    if (error instanceof Error && error.message === "NO_PERMISSION") {
      return { error: await actionError("noPermission") };
    }
    console.error("updateWalletSpendAction failed:", error);
    return { error: await actionError("cannotUpdateSpend") };
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
