/**
 * Backfill budget packages + WalletTxKind from existing wallets/ledger.
 *
 * Rules (full migration for pre-package data):
 * 1. Backfill `kind` on transactions (ALLOCATE / SPEND / CLIENT_RECEIPT / LEGACY)
 * 2. Per wallet with allocate credits and/or spendable balance:
 *    - Ensure one OPEN conversion package "Tồn đầu kỳ"
 *    - allocatedVnd = sum(ALLOCATE credits) or spendable remaining if no credits
 *    - Link unlinked non-legacy DEBIT spends → package, kind=SPEND
 *    - spentVnd = sum of linked SPEND amounts on that package
 * 3. Reconcile: wallet.balance == open package remaining + client cash held
 *
 * Usage: npx tsx scripts/backfill-budget-packages.ts
 * Dry-run: DRY_RUN=1 npx tsx scripts/backfill-budget-packages.ts
 */
import { PrismaClient, type WalletTxKind } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const OPENING_NAME = "Tồn đầu kỳ";

async function main() {
  if (DRY_RUN) console.log("DRY_RUN=1 — no writes\n");

  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) {
    throw new Error("No active ADMIN user found — cannot set createdById");
  }
  console.log(`Using creator admin: ${admin.name} (${admin.id})`);

  // --- 1. Backfill kind ---
  const txs = await prisma.walletTransaction.findMany({
    select: {
      id: true,
      direction: true,
      legacyImported: true,
      allocatedById: true,
      spendCategoryId: true,
      kind: true,
      moneyConfirmation: { select: { kind: true } },
    },
  });

  let kindUpdated = 0;
  for (const tx of txs) {
    let next: WalletTxKind | null = null;
    if (tx.legacyImported) {
      next = "LEGACY";
    } else if (tx.moneyConfirmation?.kind === "CLIENT_RECEIPT") {
      next = "CLIENT_RECEIPT";
    } else if (
      tx.moneyConfirmation?.kind === "BUDGET_ALLOCATE" ||
      tx.moneyConfirmation?.kind === "BUDGET_TOPUP"
    ) {
      next = "ALLOCATE";
    } else if (tx.direction === "CREDIT" && tx.allocatedById) {
      next = "ALLOCATE";
    } else if (tx.direction === "DEBIT") {
      next = "SPEND";
    } else if (tx.direction === "CREDIT") {
      next = "CLIENT_RECEIPT";
    }

    if (next && tx.kind !== next) {
      if (!DRY_RUN) {
        await prisma.walletTransaction.update({
          where: { id: tx.id },
          data: { kind: next },
        });
      }
      kindUpdated += 1;
    }
  }
  console.log(`Updated kind on ${kindUpdated}/${txs.length} transactions`);

  // --- 2. Packages + link spends ---
  const wallets = await prisma.staffWallet.findMany({
    include: { user: { select: { id: true, name: true } } },
  });

  let packagesCreated = 0;
  let packagesUpdated = 0;
  let spendsLinked = 0;
  const mismatches: string[] = [];

  for (const wallet of wallets) {
    const clientHeldAgg = await prisma.walletTransaction.aggregate({
      where: {
        walletUserId: wallet.userId,
        kind: "CLIENT_RECEIPT",
        direction: "CREDIT",
        legacyImported: false,
      },
      _sum: { amountVnd: true },
    });
    const clientHeld = clientHeldAgg._sum.amountVnd ?? BigInt(0);

    const allocateAgg = await prisma.walletTransaction.aggregate({
      where: {
        walletUserId: wallet.userId,
        kind: "ALLOCATE",
        direction: "CREDIT",
        legacyImported: false,
      },
      _sum: { amountVnd: true },
    });
    const allocatedFromCredits = allocateAgg._sum.amountVnd ?? BigInt(0);

    const unlinkedSpends = await prisma.walletTransaction.findMany({
      where: {
        walletUserId: wallet.userId,
        direction: "DEBIT",
        legacyImported: false,
        budgetPackageId: null,
        kind: { in: ["SPEND", "LEGACY"] },
      },
      select: { id: true, amountVnd: true },
    });
    const unlinkedSpendSum = unlinkedSpends.reduce(
      (s, t) => s + t.amountVnd,
      BigInt(0),
    );

    let spendable = wallet.balanceVnd - clientHeld;
    if (spendable < BigInt(0)) spendable = BigInt(0);

    const needsPackage =
      allocatedFromCredits > BigInt(0) ||
      unlinkedSpendSum > BigInt(0) ||
      spendable > BigInt(0);

    if (!needsPackage) continue;

    let pkg = await prisma.budgetPackage.findFirst({
      where: { ownerUserId: wallet.userId, name: OPENING_NAME },
    });

    // Target totals after linking unlinked spends into this conversion package
    let targetAllocated = allocatedFromCredits;
    if (targetAllocated <= BigInt(0)) {
      // No allocate history: opening package = remaining spendable only
      targetAllocated = spendable + unlinkedSpendSum;
    }
    // Ensure allocated covers already-spent unlinked + remaining
    const minAllocated = unlinkedSpendSum + spendable;
    if (targetAllocated < minAllocated) {
      targetAllocated = minAllocated;
    }

    if (!pkg) {
      if (!DRY_RUN) {
        pkg = await prisma.budgetPackage.create({
          data: {
            name: OPENING_NAME,
            ownerUserId: wallet.userId,
            createdById: admin.id,
            status: "OPEN",
            allocatedVnd: targetAllocated,
            spentVnd: BigInt(0),
            returnedVnd: BigInt(0),
            note: "Gói chuyển đổi từ dữ liệu ví trước khi dùng budget package",
          },
        });
      } else {
        pkg = {
          id: "dry-run",
          allocatedVnd: targetAllocated,
          spentVnd: BigInt(0),
          returnedVnd: BigInt(0),
        } as Awaited<ReturnType<typeof prisma.budgetPackage.create>>;
      }
      packagesCreated += 1;
      console.log(
        `  + package for ${wallet.user.name}: allocated=${targetAllocated.toString()}`,
      );
    } else {
      if (!DRY_RUN) {
        await prisma.budgetPackage.update({
          where: { id: pkg.id },
          data: {
            allocatedVnd: targetAllocated,
            status: pkg.status === "CANCELLED" ? "OPEN" : pkg.status,
            note:
              pkg.note ??
              "Gói chuyển đổi từ dữ liệu ví trước khi dùng budget package",
          },
        });
      }
      packagesUpdated += 1;
      console.log(
        `  ~ package for ${wallet.user.name}: allocated→${targetAllocated.toString()}`,
      );
    }

    if (unlinkedSpends.length && pkg) {
      if (!DRY_RUN) {
        await prisma.walletTransaction.updateMany({
          where: { id: { in: unlinkedSpends.map((t) => t.id) } },
          data: { budgetPackageId: pkg.id, kind: "SPEND" },
        });
      }
      spendsLinked += unlinkedSpends.length;
      console.log(
        `    linked ${unlinkedSpends.length} spends (${unlinkedSpendSum.toString()} ₫)`,
      );
    }

    // Recompute spent on conversion package = all SPEND rows pointing at it
    if (!DRY_RUN && pkg.id !== "dry-run") {
      const spentAgg = await prisma.walletTransaction.aggregate({
        where: {
          budgetPackageId: pkg.id,
          direction: "DEBIT",
          kind: "SPEND",
          legacyImported: false,
        },
        _sum: { amountVnd: true },
      });
      const spentTotal = spentAgg._sum.amountVnd ?? BigInt(0);
      await prisma.budgetPackage.update({
        where: { id: pkg.id },
        data: { spentVnd: spentTotal },
      });
    }

    // Reconcile open packages
    const openPkgs = DRY_RUN
      ? []
      : await prisma.budgetPackage.findMany({
          where: {
            ownerUserId: wallet.userId,
            status: { in: ["OPEN", "PENDING_SETTLE", "PENDING_FUNDING"] },
          },
        });

    if (!DRY_RUN) {
      const packageRemaining = openPkgs.reduce((sum, p) => {
        const rem = p.allocatedVnd - p.spentVnd - p.returnedVnd;
        return sum + (rem > BigInt(0) ? rem : BigInt(0));
      }, BigInt(0));

      const expected = packageRemaining + clientHeld;
      if (expected !== wallet.balanceVnd) {
        mismatches.push(
          `${wallet.user.name}: wallet=${wallet.balanceVnd} vs packages+client=${expected} (pkgRem=${packageRemaining}, client=${clientHeld})`,
        );
      } else {
        console.log(`  ✓ ${wallet.user.name} reconciles`);
      }
    }
  }

  console.log(
    `\nCreated ${packagesCreated} packages, updated ${packagesUpdated}, linked ${spendsLinked} spends`,
  );
  if (mismatches.length) {
    console.error("\n⚠ RECONCILIATION MISMATCHES:");
    for (const line of mismatches) console.error(`  ${line}`);
    process.exitCode = 1;
  } else if (!DRY_RUN) {
    console.log(
      "\n✓ All wallets reconcile: balance == open package remaining + client cash held",
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
