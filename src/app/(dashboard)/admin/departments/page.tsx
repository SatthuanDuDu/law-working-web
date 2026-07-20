import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { DepartmentForm } from "@/components/admin/department-form";
import { DepartmentsList } from "@/components/admin/departments-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function AdminDepartmentsPage() {
  await requireRole(["ADMIN"]);
  const tPages = await getTranslations("pages.departments");
  const t = await getTranslations("admin.departments");

  const departments = await prisma.department.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  const listItems = departments.map((item) => ({
    id: item.id,
    name: item.name,
    userCount: item._count.users,
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
            <DepartmentForm />
          </CardContent>
        </Card>

        <DepartmentsList items={listItems} />
      </div>
    </>
  );
}
