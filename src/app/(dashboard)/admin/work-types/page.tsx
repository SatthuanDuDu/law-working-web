import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { WorkTypeForm } from "@/components/admin/work-type-form";
import { WorkTypesList } from "@/components/admin/work-types-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function AdminWorkTypesPage() {
  await requireRole(["ADMIN"]);
  const tPages = await getTranslations("pages.workTypes");
  const t = await getTranslations("admin.workTypes");

  const workTypes = await prisma.workType.findMany({
    include: { _count: { select: { planSteps: true } } },
    orderBy: { name: "asc" },
  });

  const listItems = workTypes.map((item) => ({
    id: item.id,
    name: item.name,
    isActive: item.isActive,
    planStepCount: item._count.planSteps,
  }));

  return (
    <>
      <PageHeaderSlot
        title={tPages("title")}
        description={tPages("description")}
      />
      <div className="grid gap-8 xl:grid-cols-[360px_1fr]">
        <Card className="rounded-[5px]">
          <CardHeader>
            <CardTitle>{t("addTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkTypeForm />
          </CardContent>
        </Card>

        <WorkTypesList items={listItems} />
      </div>
    </>
  );
}
