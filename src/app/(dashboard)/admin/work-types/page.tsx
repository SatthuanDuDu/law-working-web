import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { WorkTypeForm } from "@/components/admin/work-type-form";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export default async function AdminWorkTypesPage() {
  await requireRole(["ADMIN"]);
  const workTypes = await prisma.workType.findMany({
    include: { _count: { select: { planSteps: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeaderSlot
        title="Loại công việc"
        description="Cấu hình danh mục loại công việc trong kế hoạch vụ việc"
      />
      <div className="grid gap-8 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Thêm loại công việc</CardTitle>
          </CardHeader>
          <CardContent>
            <WorkTypeForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workTypes.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-sm text-slate-500">
                    {item._count.planSteps} bước kế hoạch sử dụng
                  </p>
                </div>
                <Badge variant={item.isActive ? "success" : "danger"}>
                  {item.isActive ? "Đang dùng" : "Ngưng"}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
