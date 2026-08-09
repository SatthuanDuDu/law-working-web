/**
 * Historical one-shot: MatterExpense → WalletTransaction (legacyImported).
 * Table MatterExpense has been dropped; script is a no-op guard.
 *
 * Usage: npx tsx scripts/migrate-matter-expenses-to-wallet.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const legacyCount = await prisma.walletTransaction.count({
    where: { legacyImported: true },
  });
  console.log(
    `MatterExpense table removed. Legacy wallet rows already imported: ${legacyCount}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
