import { notFound } from "next/navigation";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { PackageDetailView } from "@/components/expenses/package-detail-view";
import {
  getPackageDetailAction,
  listMyOpenPackagesAction,
} from "@/lib/budget-package-actions";
import { requireAuth } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function PackageDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const t = await getTranslations("budgetPackage");
  const detail = await getPackageDetailAction(id);

  if (detail.error || !detail.package) {
    notFound();
  }

  const pkg = detail.package;

  let carryTargets: { id: string; name: string }[] = [];
  if (pkg.ownerUserId === user.id && pkg.status === "OPEN") {
    const mine = await listMyOpenPackagesAction();
    carryTargets = (mine.packages ?? [])
      .filter((p) => p.id !== pkg.id)
      .map((p) => ({ id: p.id, name: p.name }));
  }

  return (
    <div className="space-y-4">
      <PageHeaderSlot title={t("detailTitle")} />
      <PackageDetailView
        pkg={pkg}
        transactions={detail.transactions ?? []}
        pendingTopups={detail.pendingTopups ?? []}
        pendingSettle={detail.pendingSettle ?? null}
        currentUserId={user.id}
        canManage={Boolean(detail.canManage)}
        carryTargets={carryTargets}
      />
    </div>
  );
}
