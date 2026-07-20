import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { WorkloadCharts } from "@/components/workload/workload-charts";
import {
  WorkloadDepartmentCards,
  WorkloadKpiStrip,
  WorkloadPersonCards,
} from "@/components/workload/workload-cards";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function WorkloadPage() {
  await requireRole(["ADMIN", "MANAGER"]);
  const tPages = await getTranslations("pages.workload");
  const tCommon = await getTranslations("common");
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
    department: u.department?.name ?? tCommon("unassigned"),
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

  const departments = Array.from(byDepartment.entries()).map(([name, stats]) => ({
    name,
    openTasks: stats.openTasks,
    overdueTasks: stats.overdueTasks,
  }));

  const totalOpen = rows.reduce((sum, r) => sum + r.openTasks, 0);
  const totalOverdue = rows.reduce((sum, r) => sum + r.overdueTasks, 0);
  const peopleWithOverdue = rows.filter((r) => r.overdueTasks > 0).length;

  return (
    <>
      <PageHeaderSlot
        title={tPages("title")}
        description={tPages("description")}
      />

      <WorkloadKpiStrip
        totalOpen={totalOpen}
        totalOverdue={totalOverdue}
        peopleWithOverdue={peopleWithOverdue}
      />

      <div className="mt-6">
        <WorkloadPersonCards rows={rows} />
      </div>

      <div className="mt-6">
        <WorkloadDepartmentCards departments={departments} />
      </div>

      <div className="mt-6">
        <WorkloadCharts rows={rows} />
      </div>
    </>
  );
}
