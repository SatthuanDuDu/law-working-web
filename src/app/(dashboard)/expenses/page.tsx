import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { CashflowDashboard } from "@/components/expenses/cashflow-dashboard";
import {
  getCashflowStats,
  resolveCashflowRange,
} from "@/lib/wallet-stats";
import {
  listActiveUsersForBudgetAction,
  listWalletTransactionsAction,
} from "@/lib/wallet-actions";
import { listMoneyConfirmationsAction } from "@/lib/money-confirmation-actions";
import { requireRole } from "@/lib/session";
import { getTranslations } from "next-intl/server";
import type { BudgetPackageStatus } from "@prisma/client";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>;
}) {
  const actor = await requireRole(["ADMIN", "MANAGER"]);
  const tPages = await getTranslations("pages.expenses");
  const params = await searchParams;
  const range = resolveCashflowRange(params);
  const packageStatus = params.status ?? "ACTIVE";
  const statusOption =
    packageStatus === "ALL" || packageStatus === "ACTIVE"
      ? packageStatus
      : (packageStatus as BudgetPackageStatus);

  const [stats, usersRes, txRes, confirmRes] = await Promise.all([
    getCashflowStats({ from: range.from, to: range.to }, actor, {
      packageStatus: statusOption,
    }),
    listActiveUsersForBudgetAction(),
    listWalletTransactionsAction({
      scope: "company",
      from: range.fromIso,
      to: range.toIso,
      take: 80,
    }),
    listMoneyConfirmationsAction({
      scope: "manageable",
      status: "OPEN",
      take: 40,
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeaderSlot title={tPages("title")} />
      <CashflowDashboard
        stats={stats}
        users={usersRes.users}
        transactions={txRes.transactions}
        confirmations={confirmRes.confirmations}
        packageStatus={packageStatus}
      />
    </div>
  );
}
