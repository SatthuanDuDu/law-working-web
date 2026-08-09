import type { Prisma, PrismaClient } from "@prisma/client";

type TxClient = Prisma.TransactionClient | PrismaClient;

/** Ensure wallet row exists; returns current balance. */
export async function ensureStaffWallet(tx: TxClient, userId: string) {
  const existing = await tx.staffWallet.findUnique({ where: { userId } });
  if (existing) return existing;
  return tx.staffWallet.create({
    data: { userId, balanceVnd: BigInt(0) },
  });
}

export function formatVndDigits(amount: bigint | string | number) {
  const digits =
    typeof amount === "bigint"
      ? amount.toString()
      : String(amount).replace(/\D/g, "");
  if (!digits) return "0";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
