import { AppShell } from "@/components/layout/app-shell";
import { DepartmentForm } from "@/components/admin/department-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export default async function AdminDepartmentsPage() {
  const user = await requireRole(["ADMIN"]);
  const departments = await prisma.department.findMany({
    include: { _count: { select: { users: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <AppShell
      user={user}
      title="Phòng ban"
      description="Cấu hình phòng ban nội bộ"
    >
      <div className="grid gap-8 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Thêm phòng ban</CardTitle>
          </CardHeader>
          <CardContent>
            <DepartmentForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách phòng ban</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {departments.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-slate-500">
                  {item._count.users} nhân viên
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
