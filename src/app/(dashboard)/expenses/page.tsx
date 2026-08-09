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
import { requireRole } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireRole(["ADMIN", "MANAGER"]);
  const tPages = await getTranslations("pages.expenses");
  const params = await searchParams;
  const range = resolveCashflowRange(params);
  const [stats, usersRes, txRes] = await Promise.all([
    getCashflowStats({ from: range.from, to: range.to }),
    listActiveUsersForBudgetAction(),
    listWalletTransactionsAction({
      scope: "company",
      from: range.fromIso,
      to: range.toIso,
      take: 80,
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeaderSlot title={tPages("title")} />
      <CashflowDashboard
        stats={stats}
        users={usersRes.users}
        transactions={txRes.transactions}
      />
    </div>
  );
}
