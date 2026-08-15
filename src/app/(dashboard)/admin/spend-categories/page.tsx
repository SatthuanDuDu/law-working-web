import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { SpendCategoryForm } from "@/components/admin/spend-category-form";
import { SpendCategoriesList } from "@/components/admin/spend-categories-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function AdminSpendCategoriesPage() {
  await requireRole(["ADMIN", "MANAGER"]);
  const tPages = await getTranslations("pages.spendCategories");
  const t = await getTranslations("admin.spendCategories");

  const categories = await prisma.spendCategory.findMany({
    include: { _count: { select: { transactions: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const listItems = categories.map((item) => ({
    id: item.id,
    name: item.name,
    code: item.code,
    requiresMatter: item.requiresMatter,
    isSystem: item.isSystem,
    isActive: item.isActive,
    sortOrder: item.sortOrder,
    txCount: item._count.transactions,
  }));

  return (
    <>
      <PageHeaderSlot title={tPages("title")} />
      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="rounded-md">
          <CardHeader>
            <CardTitle>{t("addTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendCategoryForm />
          </CardContent>
        </Card>
        <SpendCategoriesList items={listItems} />
      </div>
    </>
  );
}
