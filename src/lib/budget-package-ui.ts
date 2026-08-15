import type { BudgetPackageStatus } from "@prisma/client";
import type { StatusTonePreset } from "@/lib/status-tokens";

export function budgetPackageStatusTone(
  status: BudgetPackageStatus,
): StatusTonePreset {
  switch (status) {
    case "PENDING_FUNDING":
      return "sky";
    case "OPEN":
      return "amber";
    case "PENDING_SETTLE":
      return "rose";
    case "CLOSED":
      return "emerald";
    case "CANCELLED":
    default:
      return "slate";
  }
}

export function packageSpendPct(allocatedVnd: string, spentVnd: string): number {
  const allocated = BigInt(allocatedVnd || "0");
  const spent = BigInt(spentVnd || "0");
  if (allocated <= BigInt(0)) return 0;
  return Math.min(100, Number((spent * BigInt(10000)) / allocated) / 100);
}
