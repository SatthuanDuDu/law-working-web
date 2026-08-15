/**
 * Backfill budget packages + WalletTxKind from existing wallets/ledger.
 *
 * Rules:
 * 1. Each user with balanceVnd > 0 → one OPEN package "Tồn đầu kỳ"
 *    allocatedVnd = package-spendable balance (wallet balance minus client-receipt credits held)
 * 2. Backfill kind on existing transactions
 * 3. Old ledger rows keep budgetPackageId = null
 * 4. Print reconciliation: wallet.balance vs sum(open packages remaining) + client cash held
 *
 * Usage: npx tsx scripts/backfill-budget-packages.ts
 */
import { PrismaClient, type WalletTxKind } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN", isActive: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
  if (!admin) {
    throw new Error("No active ADMIN user found — cannot set createdById for opening packages");
  }
  console.log(`Using creator admin: ${admin.name} (${admin.id})`);

  // --- Backfill kind ---
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
    } else if (tx.moneyConfirmation?.kind === "BUDGET_ALLOCATE" || tx.moneyConfirmation?.kind === "BUDGET_TOPUP") {
      next = "ALLOCATE";
    } else if (tx.direction === "CREDIT" && tx.allocatedById) {
      next = "ALLOCATE";
    } else if (tx.direction === "DEBIT" && tx.spendCategoryId) {
      next = "SPEND";
    } else if (tx.direction === "CREDIT") {
      // Heuristic: credits without allocator often client receipt imports
      next = "CLIENT_RECEIPT";
    }

    if (next && tx.kind !== next) {
      await prisma.walletTransaction.update({
        where: { id: tx.id },
        data: { kind: next },
      });
      kindUpdated += 1;
    }
  }
  console.log(`Updated kind on ${kindUpdated}/${txs.length} transactions`);

  // --- Opening packages for positive spendable balances ---
  const wallets = await prisma.staffWallet.findMany({
    include: { user: { select: { id: true, name: true } } },
  });

  let packagesCreated = 0;
  const mismatches: string[] = [];

  for (const wallet of wallets) {
    const existingOpening = await prisma.budgetPackage.findFirst({
      where: {
        ownerUserId: wallet.userId,
        name: "Tồn đầu kỳ",
      },
    });

    const clientHeldAgg = await prisma.walletTransaction.aggregate({
      where: {
        walletUserId: wallet.userId,
        kind: "CLIENT_RECEIPT",
        direction: "CREDIT",
        legacyImported: false,
      },
      _sum: { amountVnd: true },
    });
    // Client cash held ≈ sum of CLIENT_RECEIPT credits (no package spend against them).
    // Spendable package balance ≈ wallet.balance - clientHeld (clamped).
    const clientHeld = clientHeldAgg._sum.amountVnd ?? BigInt(0);
    let spendable = wallet.balanceVnd - clientHeld;
    if (spendable < BigInt(0)) spendable = BigInt(0);

    if (!existingOpening && spendable > BigInt(0)) {
      await prisma.budgetPackage.create({
        data: {
          name: "Tồn đầu kỳ",
          ownerUserId: wallet.userId,
          createdById: admin.id,
          status: "OPEN",
          allocatedVnd: spendable,
          spentVnd: BigInt(0),
          returnedVnd: BigInt(0),
          note: "Gói mở đầu kỳ từ số dư ví trước khi dùng budget package",
        },
      });
      packagesCreated += 1;
      console.log(
        `  + package for ${wallet.user.name}: ${spendable.toString()} VND`,
      );
    }

    // Reconcile
    const openPkgs = await prisma.budgetPackage.findMany({
      where: {
        ownerUserId: wallet.userId,
        status: { in: ["OPEN", "PENDING_SETTLE", "PENDING_FUNDING"] },
      },
    });
    const packageRemaining = openPkgs.reduce((sum, p) => {
      const rem = p.allocatedVnd - p.spentVnd - p.returnedVnd;
      return sum + (rem > BigInt(0) ? rem : BigInt(0));
    }, BigInt(0));

    const expected = packageRemaining + clientHeld;
    if (expected !== wallet.balanceVnd) {
      mismatches.push(
        `${wallet.user.name}: wallet=${wallet.balanceVnd} vs packages+client=${expected} (pkg=${packageRemaining}, client=${clientHeld})`,
      );
    }
  }

  console.log(`Created ${packagesCreated} opening packages`);
  if (mismatches.length) {
    console.error("\n⚠ RECONCILIATION MISMATCHES:");
    for (const line of mismatches) console.error(`  ${line}`);
    process.exitCode = 1;
  } else {
    console.log("\n✓ All wallets reconcile: balance == open package remaining + client cash held");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
