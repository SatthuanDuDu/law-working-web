import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { ExpenseStatsView } from "@/components/expenses/expense-stats-view";
import {
  getExpenseStats,
  resolveExpenseStatsRange,
} from "@/lib/expense-stats";
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
  const range = resolveExpenseStatsRange(params);
  const stats = await getExpenseStats({ from: range.from, to: range.to });

  return (
    <div className="space-y-4">
      <PageHeaderSlot
        title={tPages("title")}
        description={tPages("description")}
      />
      <ExpenseStatsView stats={stats} />
    </div>
  );
}
