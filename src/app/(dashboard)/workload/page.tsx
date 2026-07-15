import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { WorkloadCharts } from "@/components/workload/workload-charts";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export default async function WorkloadPage() {
  await requireRole(["ADMIN", "MANAGER"]);
  const now = new Date();

  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: { department: true },
    orderBy: { name: "asc" },
  });

  const userIds = users.map((u) => u.id);

  const [openTasks, overdueTasks] = await Promise.all([
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: userIds },
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: userIds },
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
      _count: { _all: true },
    }),
  ]);

  const openMap = new Map(openTasks.map((r) => [r.assigneeId, r._count._all]));
  const overdueMap = new Map(overdueTasks.map((r) => [r.assigneeId, r._count._all]));

  const rows = users.map((u) => ({
    userId: u.id,
    name: u.name,
    department: u.department?.name ?? "Chưa gán",
    openTasks: openMap.get(u.id) ?? 0,
    overdueTasks: overdueMap.get(u.id) ?? 0,
  }));

  const byDepartment = new Map<
    string,
    { openTasks: number; overdueTasks: number }
  >();

  for (const row of rows) {
    const current = byDepartment.get(row.department) ?? {
      openTasks: 0,
      overdueTasks: 0,
    };
    current.openTasks += row.openTasks;
    current.overdueTasks += row.overdueTasks;
    byDepartment.set(row.department, current);
  }

  return (
    <>
      <PageHeaderSlot
        title="Workload"
        description="Phân bổ công việc theo nhân viên và phòng ban"
      />
      <WorkloadCharts rows={rows} />

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Chi tiết theo nhân viên</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-3 py-2">Nhân viên</th>
                <th className="px-3 py-2">Phòng ban</th>
                <th className="px-3 py-2">Việc mở</th>
                <th className="px-3 py-2">Quá hạn</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.userId} className="border-b">
                  <td className="px-3 py-3 font-medium">{row.name}</td>
                  <td className="px-3 py-3">{row.department}</td>
                  <td className="px-3 py-3">{row.openTasks}</td>
                  <td className="px-3 py-3">
                    {row.overdueTasks > 0 ? (
                      <Badge variant="danger">{row.overdueTasks}</Badge>
                    ) : (
                      0
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Tổng hợp theo phòng ban</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-left text-slate-500">
                <th className="px-3 py-2">Phòng ban</th>
                <th className="px-3 py-2">Việc mở</th>
                <th className="px-3 py-2">Quá hạn</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(byDepartment.entries()).map(([name, stats]) => (
                <tr key={name} className="border-b">
                  <td className="px-3 py-3 font-medium">{name}</td>
                  <td className="px-3 py-3">{stats.openTasks}</td>
                  <td className="px-3 py-3">{stats.overdueTasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  );
}
