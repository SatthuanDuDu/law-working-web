import dynamic from "next/dynamic";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import {
  WorkloadDepartmentCards,
  WorkloadKpiStrip,
  WorkloadPersonCards,
  type WorkloadDepartmentRow,
  type WorkloadKpiItem,
  type WorkloadPersonRow,
  type WorkloadPersonTaskItem,
} from "@/components/workload/workload-cards";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import type { Prisma, TaskStatus } from "@prisma/client";

const WorkloadCharts = dynamic(
  () =>
    import("@/components/workload/workload-charts").then((m) => m.WorkloadCharts),
  {
    loading: () => (
      <div className="h-72 animate-pulse rounded-md bg-muted" />
    ),
  },
);

function shortenCode(code: string | null | undefined) {
  if (!code) return null;
  if (code.length <= 18) return code;
  return `${code.slice(0, 8)}…${code.slice(-6)}`;
}

function taskHref(matterId: string | null) {
  return matterId ? `/matters/${matterId}` : "/tasks";
}

function serializeTaskItem(
  task: {
    id: string;
    title: string;
    dueDate: Date | null;
    assignee: { id: string; name: string; avatarKey?: string | null };
    matter: { id: string; code: string } | null;
  },
  dueLabel: string,
  noMatterLabel: string,
): WorkloadKpiItem {
  return {
    id: task.id,
    title: task.title,
    matterLabel: shortenCode(task.matter?.code) ?? noMatterLabel,
    dueLabel,
    assignee: {
      id: task.assignee.id,
      name: task.assignee.name,
      avatarKey: task.assignee.avatarKey,
    },
    href: taskHref(task.matter?.id ?? null),
  };
}

export default async function WorkloadPage() {
  await requireRole(["ADMIN", "MANAGER"]);
  const tPages = await getTranslations("pages.workload");
  const tCommon = await getTranslations("common");
  const tWorkload = await getTranslations("workload");
  const now = new Date();

  const users = await prisma.user.findMany({
    where: { isActive: true },
    include: { department: true },
    orderBy: { name: "asc" },
  });

  const userIds = users.map((u) => u.id);

  const taskSelect = {
    id: true,
    title: true,
    dueDate: true,
    assigneeId: true,
    assignee: { select: { id: true, name: true, avatarKey: true } },
    matter: { select: { id: true, code: true } },
  } satisfies Prisma.TaskSelect;

  const openTaskWhere: Prisma.TaskWhereInput = {
    assigneeId: { in: userIds },
    status: { in: ["TODO", "IN_PROGRESS"] satisfies TaskStatus[] },
  };

  const [openTaskGroups, overdueTaskGroups, openTaskList, overdueTaskList] =
    await Promise.all([
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: openTaskWhere,
        _count: { _all: true },
      }),
      prisma.task.groupBy({
        by: ["assigneeId"],
        where: {
          ...openTaskWhere,
          dueDate: { lt: now },
        },
        _count: { _all: true },
      }),
      prisma.task.findMany({
        where: openTaskWhere,
        select: taskSelect,
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      }),
      prisma.task.findMany({
        where: {
          ...openTaskWhere,
          dueDate: { lt: now },
        },
        select: taskSelect,
        orderBy: [{ dueDate: "asc" }],
      }),
    ]);

  const openMap = new Map(
    openTaskGroups.map((r) => [r.assigneeId, r._count._all]),
  );
  const overdueMap = new Map(
    overdueTaskGroups.map((r) => [r.assigneeId, r._count._all]),
  );

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

  const departmentStats = Array.from(byDepartment.entries()).map(
    ([name, stats]) => ({
      name,
      openTasks: stats.openTasks,
      overdueTasks: stats.overdueTasks,
    }),
  );

  const totalOpen = rows.reduce((sum, r) => sum + r.openTasks, 0);
  const totalOverdue = rows.reduce((sum, r) => sum + r.overdueTasks, 0);
  const peopleWithOverdue = rows.filter((r) => r.overdueTasks > 0).length;

  const noMatterLabel = tWorkload("noMatter");
  const overdueIdSet = new Set(overdueTaskList.map((task) => task.id));

  const openItems = openTaskList.slice(0, 40).map((task) =>
    serializeTaskItem(
      task,
      task.dueDate
        ? tWorkload("dueAt", { date: formatDateTime(task.dueDate) })
        : "—",
      noMatterLabel,
    ),
  );
  const overdueItems = overdueTaskList.slice(0, 40).map((task) =>
    serializeTaskItem(
      task,
      task.dueDate
        ? tWorkload("dueAt", { date: formatDateTime(task.dueDate) })
        : "—",
      noMatterLabel,
    ),
  );

  const peopleItems: WorkloadKpiItem[] = rows
    .filter((row) => row.overdueTasks > 0)
    .sort(
      (a, b) =>
        b.overdueTasks - a.overdueTasks || a.name.localeCompare(b.name),
    )
    .map((row) => {
      const sample = overdueTaskList.find(
        (task) => task.assigneeId === row.userId,
      );
      const user = users.find((u) => u.id === row.userId);
      return {
        id: row.userId,
        title: row.name,
        subtitle: [
          row.department,
          tWorkload("overdueCount", { count: row.overdueTasks }),
        ].join(" · "),
        assignee: {
          id: row.userId,
          name: row.name,
          avatarKey: user?.avatarKey,
        },
        href: taskHref(sample?.matter?.id ?? null),
      };
    });

  const departmentByUserId = new Map(
    rows.map((row) => [row.userId, row.department]),
  );

  const tasksByAssignee = new Map<string, typeof openTaskList>();
  for (const task of openTaskList) {
    const list = tasksByAssignee.get(task.assigneeId) ?? [];
    list.push(task);
    tasksByAssignee.set(task.assigneeId, list);
  }

  function buildTaskItems(
    tasks: typeof openTaskList,
    idPrefix: string,
  ): WorkloadPersonTaskItem[] {
    const items: WorkloadPersonTaskItem[] = [];
    for (const task of tasks) {
      const overdue = overdueIdSet.has(task.id);
      const matterLabel = shortenCode(task.matter?.code) ?? noMatterLabel;
      const dueLabel = task.dueDate
        ? tWorkload("dueAt", { date: formatDateTime(task.dueDate) })
        : "—";
      const href = taskHref(task.matter?.id ?? null);
      const assignee = {
        id: task.assignee.id,
        name: task.assignee.name,
        avatarKey: task.assignee.avatarKey,
      };
      items.push({
        id: `${idPrefix}-open-${task.id}`,
        title: task.title,
        matterLabel,
        dueLabel,
        assignee,
        href,
        kind: "open",
      });
      if (overdue) {
        items.push({
          id: `${idPrefix}-overdue-${task.id}`,
          title: task.title,
          matterLabel,
          dueLabel,
          assignee,
          href,
          kind: "overdue",
        });
      }
    }
    items.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "open" ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
    return items;
  }

  const personRows: WorkloadPersonRow[] = rows.map((row) => {
    const tasks = tasksByAssignee.get(row.userId) ?? [];
    return {
      ...row,
      items: buildTaskItems(tasks, row.userId),
    };
  });

  const tasksByDepartment = new Map<string, typeof openTaskList>();
  for (const task of openTaskList) {
    const deptName =
      departmentByUserId.get(task.assigneeId) ?? tCommon("unassigned");
    const list = tasksByDepartment.get(deptName) ?? [];
    list.push(task);
    tasksByDepartment.set(deptName, list);
  }

  const departmentRows: WorkloadDepartmentRow[] = departmentStats.map(
    (dept) => ({
      ...dept,
      items: buildTaskItems(
        tasksByDepartment.get(dept.name) ?? [],
        `dept-${dept.name}`,
      ),
    }),
  );

  return (
    <>
      <PageHeaderSlot title={tPages("title")} />

      <WorkloadKpiStrip
        totalOpen={totalOpen}
        totalOverdue={totalOverdue}
        peopleWithOverdue={peopleWithOverdue}
        openItems={openItems}
        overdueItems={overdueItems}
        peopleItems={peopleItems}
      />

      <div className="mt-6">
        <WorkloadPersonCards rows={personRows} />
      </div>

      <div className="mt-6">
        <WorkloadDepartmentCards departments={departmentRows} />
      </div>

      <div className="mt-6">
        <WorkloadCharts rows={rows} />
      </div>
    </>
  );
}
