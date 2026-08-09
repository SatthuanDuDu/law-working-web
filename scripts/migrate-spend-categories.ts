/**
 * Seed SpendCategory system rows (idempotent).
 * Legacy enum backfill already applied; category column dropped.
 *
 * Usage: npx tsx scripts/migrate-spend-categories.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SEEDS = [
  {
    code: "MATTER",
    name: "Vụ việc",
    requiresMatter: true,
    isSystem: true,
    sortOrder: 10,
  },
  {
    code: "OFFICE",
    name: "Thiết bị / văn phòng phẩm",
    requiresMatter: false,
    isSystem: true,
    sortOrder: 20,
  },
  {
    code: "OTHER",
    name: "Chi khác",
    requiresMatter: false,
    isSystem: true,
    sortOrder: 90,
  },
] as const;

async function main() {
  for (const seed of SEEDS) {
    await prisma.spendCategory.upsert({
      where: { code: seed.code },
      create: {
        code: seed.code,
        name: seed.name,
        requiresMatter: seed.requiresMatter,
        isSystem: seed.isSystem,
        isActive: true,
        sortOrder: seed.sortOrder,
      },
      update: {
        name: seed.name,
        requiresMatter: seed.requiresMatter,
        isSystem: seed.isSystem,
        sortOrder: seed.sortOrder,
      },
    });
  }
  const count = await prisma.spendCategory.count();
  console.log(`Spend categories ready (${count} total)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
