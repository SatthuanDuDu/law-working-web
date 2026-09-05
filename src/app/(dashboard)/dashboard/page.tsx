import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { isManagerOrAbove } from "@/lib/permissions";
import { formatDate, cn } from "@/lib/utils";
import { endOfVietnamDayPlus } from "@/lib/datetime";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  ListTodo,
  ListChecks,
} from "lucide-react";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { DashboardMetricCard } from "@/components/dashboard/dashboard-metric-card";
import { DashboardPriorityTasks } from "@/components/dashboard/dashboard-priority-tasks";
import { type DashboardTaskItem } from "@/components/dashboard/expandable-stat-card";
import { Badge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionPanel } from "@/components/ui/section-panel";
import {
  UpcomingDeadlineList,
  type UpcomingDeadlineItem,
} from "@/components/dashboard/upcoming-deadline-list";
import { MatterStatusBadge } from "@/components/matters/matter-status-control";
import { OpenPersonalTodoButton } from "@/components/personal-todo/open-personal-todo-button";
import { listDivideClass, listRowClass } from "@/lib/list-surface";
import { getLabelMaps } from "@/i18n/server-labels";
import { getTranslations } from "next-intl/server";
import { getAccessibleMatterIds } from "@/lib/access";
import { isMatterEditLocked } from "@/lib/matter-status";
import type { MatterStatus, TaskPriority, TaskStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const STATUS_BAR_CLASS: Record<MatterStatus, string> = {
  NEW: "bg-sky-500",
  IN_PROGRESS: "bg-amber-500",
  ON_HOLD: "bg-rose-500",
  CLOSED: "bg-emerald-500",
  TERMINATED: "bg-violet-500",
  ARCHIVED: "bg-slate-500",
};

const STATUS_ORDER: MatterStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "ON_HOLD",
  "CLOSED",
  "TERMINATED",
  "ARCHIVED",
];

function priorityVariant(
  priority: TaskPriority,
): "default" | "info" | "warning" | "danger" {
  switch (priority) {
    case "URGENT":
      return "danger";
    case "HIGH":
      return "warning";
    case "MEDIUM":
      return "info";
    default:
      return "default";
  }
}

function taskHref(matterId: string | null) {
  return matterId ? `/matters/${matterId}` : "/tasks";
}

function serializeTask(task: {
  id: string;
  title: string;
  status: DashboardTaskItem["status"];
  priority: TaskPriority;
  dueDate: Date | null;
  matterId: string | null;
  matter: {
    id: string;
    code: string;
    title: string;
    leadLawyer: { id: string; name: string; avatarKey: string | null } | null;
  } | null;
}): DashboardTaskItem {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate?.toISOString() ?? null,
    matterId: task.matterId ?? task.matter?.id ?? null,
    matterCode: task.matter?.code ?? null,
    matterTitle: task.matter?.title ?? null,
    leadLawyer: task.matter?.leadLawyer
      ? {
          id: task.matter.leadLawyer.id,
          name: task.matter.leadLawyer.name,
          avatarKey: task.matter.leadLawyer.avatarKey,
        }
      : null,
  };
}

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="interactive-link inline-flex max-w-full items-center gap-1 truncate text-sm font-medium text-primary"
    >
      <span className="truncate">{children}</span>
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" />
    </Link>
  );
}

function shortenCode(code: string | null | undefined) {
  if (!code) return null;
  if (code.length <= 18) return code;
  return `${code.slice(0, 8)}…${code.slice(-6)}`;
}

const OPEN_MATTER_STATUSES = ["NEW", "IN_PROGRESS", "ON_HOLD"] as const;

const matterSelect = {
  id: true,
  code: true,
  title: true,
  leadLawyer: { select: { id: true, name: true, avatarKey: true } },
} as const;

export default async function DashboardPage() {
  const user = await requireAuth();
  const labels = await getLabelMaps();
  const t = await getTranslations("dashboard");
  const tCommon = await getTranslations("common");
  const now = new Date();
  const soonEnd = endOfVietnamDayPlus(3, now);

  const matterIds = await getAccessibleMatterIds(user.id, user.role);
  const matterWhere = {
    deletedAt: null,
    ...(matterIds ? { id: { in: matterIds } } : {}),
  };
  const openTaskWhere: Prisma.TaskWhereInput = {
    assigneeId: user.id,
    status: { in: ["TODO", "IN_PROGRESS"] satisfies TaskStatus[] },
  };

  const [
    openTasks,
    overdueTasks,
    openTasksList,
    matters,
    recentTasks,
    upcomingDeadlines,
    upcomingPlanSteps,
    matterStatusGroups,
    personalTodos,
  ] = await Promise.all([
    prisma.task.count({ where: openTaskWhere }),
    prisma.task.count({
      where: {
        ...openTaskWhere,
        dueDate: { lt: now },
      },
    }),
    prisma.task.findMany({
      where: openTaskWhere,
      include: { matter: { select: matterSelect } },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    prisma.matter.findMany({
      where: matterWhere,
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        client: { select: { name: true } },
        leadLawyer: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: { assigneeId: user.id },
      include: { matter: { select: matterSelect } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.task.findMany({
      where: {
        ...openTaskWhere,
        // Include overdue + due within +3 days (same window as sidebar badge).
        dueDate: { not: null, lte: soonEnd },
      },
      include: { matter: { select: matterSelect } },
      orderBy: { dueDate: "asc" },
      take: 12,
    }),
    prisma.matterPlanStep.findMany({
      where: {
        dueAt: { not: null, lte: soonEnd },
        status: { not: "DONE" },
        matter: { deletedAt: null },
        ...(matterIds ? { matterId: { in: matterIds } } : {}),
      },
      include: {
        matter: {
          select: {
            ...matterSelect,
            leadLawyerId: true,
            status: true,
            members: { select: { userId: true } },
          },
        },
        assignees: {
          select: {
            user: { select: { id: true, name: true, avatarKey: true } },
          },
        },
        workType: { select: { name: true } },
      },
      orderBy: { dueAt: "asc" },
      take: 8,
    }),
    prisma.matter.groupBy({
      by: ["status"],
      where: matterWhere,
      _count: { _all: true },
    }),
    prisma.personalTodo.findMany({
      where: { ownerId: user.id, isDone: false },
      select: {
        id: true,
        title: true,
        dueDate: true,
        items: { select: { id: true, isDone: true } },
      },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
      take: 6,
    }),
  ]);

  const statusCounts = STATUS_ORDER.map((status) => ({
    status,
    count:
      matterStatusGroups.find((group) => group.status === status)?._count._all ??
      0,
  }));
  const totalMatters = statusCounts.reduce((sum, item) => sum + item.count, 0);
  const activeMatters = statusCounts
    .filter((item) =>
      (OPEN_MATTER_STATUSES as readonly MatterStatus[]).includes(item.status),
    )
    .reduce((sum, item) => sum + item.count, 0);

  const openItems = openTasksList.map(serializeTask);

  type UpcomingItem = Omit<UpcomingDeadlineItem, "dueAt"> & { dueAt: Date };

  const upcomingItems: UpcomingItem[] = [
    ...upcomingDeadlines.map((task) => ({
      key: `task-${task.id}`,
      title: task.title,
      href: taskHref(task.matterId),
      dueAt: task.dueDate!,
      kind: "task" as const,
      statusLabel: labels.taskPriority[task.priority],
      statusVariant: priorityVariant(task.priority),
      dueLabel: formatDate(task.dueDate!),
      matterCodeShort: shortenCode(task.matter?.code),
      person: task.matter?.leadLawyer
        ? {
            id: task.matter.leadLawyer.id,
            name: task.matter.leadLawyer.name,
            avatarKey: task.matter.leadLawyer.avatarKey,
            role: "leadLawyer" as const,
          }
        : null,
    })),
    ...upcomingPlanSteps.map((step) => {
      const canEditPlan =
        !isMatterEditLocked(step.matter.status) &&
        (isManagerOrAbove(user.role) ||
          step.matter.leadLawyerId === user.id ||
          step.matter.members.some((member) => member.userId === user.id));
      return {
        key: `plan-${step.id}`,
        title: step.title,
        href: `/matters/${step.matterId}/plan`,
        dueAt: step.dueAt!,
        kind: "plan" as const,
        planStepId: step.id,
        canEditPlan,
        planStatus: step.status,
        statusLabel: labels.planStepStatus[step.status],
        statusVariant: "info" as const,
        dueLabel: formatDate(step.dueAt!),
        matterCodeShort: shortenCode(step.matter.code),
        assignees: step.assignees.map((row) => ({
          id: row.user.id,
          name: row.user.name,
          avatarKey: row.user.avatarKey,
        })),
      };
    }),
  ]
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime())
    .slice(0, 10);

  const upcomingListItems: UpcomingDeadlineItem[] = upcomingItems.map(
    (item) => ({
      key: item.key,
      title: item.title,
      href: item.href,
      kind: item.kind,
      planStepId: item.planStepId,
      canEditPlan: item.canEditPlan,
      planStatus: item.planStatus,
      statusLabel: item.statusLabel,
      statusVariant: item.statusVariant,
      dueAt: item.dueAt.toISOString(),
      dueLabel: item.dueLabel,
      matterCodeShort: item.matterCodeShort,
      person: item.person,
      assignees: item.assignees,
    }),
  );

  const onTrackPercent =
    openTasks > 0
      ? Math.round(((openTasks - overdueTasks) / openTasks) * 100)
      : 100;
  const openTodoCount = personalTodos.length;

  return (
    <div className="relative min-w-0 max-w-full space-y-4 pb-2 sm:space-y-5">
      {/* 1. Greeting + quick actions */}
      <DashboardHero
        userName={user.name}
        openTasks={openTasks}
        upcomingCount={upcomingListItems.length}
      />

      {/* 2. Glance metrics — equal height scorecards */}
      <div className="grid min-w-0 auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard
          label={t("openTasks")}
          value={openTasks}
          icon={<ListTodo className="h-4 w-4" />}
          progress={onTrackPercent}
          progressLabel={t("onTrackPercent", { percent: onTrackPercent })}
          sub={
            overdueTasks > 0 ? (
              <span className="font-medium text-rose-600">
                {t("overdueCount", { count: overdueTasks })}
              </span>
            ) : (
              <span className="font-medium text-emerald-600">{t("onTrack")}</span>
            )
          }
          href="/tasks"
        />
        <DashboardMetricCard
          label={t("activeMatters")}
          value={activeMatters}
          suffix={`/ ${totalMatters}`}
          icon={<Briefcase className="h-4 w-4" />}
          progress={
            totalMatters > 0
              ? Math.round((activeMatters / totalMatters) * 100)
              : 0
          }
          sub={t("metricMattersRatio")}
          href="/matters"
        />
        <DashboardMetricCard
          label={t("metricUpcoming")}
          value={upcomingListItems.length}
          icon={<CalendarClock className="h-4 w-4" />}
          iconClassName="bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300"
          sub={t("metricUpcomingSub")}
          href="/calendar"
        />
        <DashboardMetricCard
          label={t("metricTodos")}
          value={openTodoCount}
          icon={<ListChecks className="h-4 w-4" />}
          iconClassName="bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"
          sub={t("metricTodosSub")}
        />
      </div>

      {/* 3. Focus today — stretch equal columns */}
      <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-2">
        <DashboardPriorityTasks
          items={openItems}
          emptyLabel={t("openTasksEmpty")}
        />
        <SectionPanel
          title={t("upcoming")}
          icon={<CalendarClock className="h-4 w-4" />}
          action={<ActionLink href="/calendar">{t("viewCalendar")}</ActionLink>}
          className="h-full"
        >
          {upcomingListItems.length === 0 ? (
            <EmptyState
              action={
                <ActionLink href="/calendar">{t("openCalendarHint")}</ActionLink>
              }
            >
              {t("noUpcoming3Days")}
            </EmptyState>
          ) : (
            <div className="max-h-[22rem] overflow-y-auto pr-0.5">
              <UpcomingDeadlineList items={upcomingListItems} />
            </div>
          )}
        </SectionPanel>
      </div>

      {/* 4. Matters + status — stretch */}
      <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-2">
        <SectionPanel
          title={t("myMatters")}
          icon={<Briefcase className="h-4 w-4" />}
          action={<ActionLink href="/matters">{tCommon("all")}</ActionLink>}
          className="h-full"
        >
          {matters.length === 0 ? (
            <EmptyState>{t("noMyMatters")}</EmptyState>
          ) : (
            <div className={cn(listDivideClass, "max-h-[22rem] overflow-y-auto")}>
              {matters.map((matter) => (
                <Link
                  key={matter.id}
                  href={`/matters/${matter.id}`}
                  className={cn(
                    listRowClass,
                    "group flex w-full max-w-full items-center justify-between gap-3",
                  )}
                >
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <p className="min-w-0 max-w-full truncate font-medium text-foreground">
                        {matter.title}
                      </p>
                      <MatterStatusBadge status={matter.status} />
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {shortenCode(matter.code)}
                      {" · "}
                      {matter.client.name}
                      {" · "}
                      {matter.leadLawyer.name}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-border transition-colors group-hover:text-primary" />
                </Link>
              ))}
            </div>
          )}
        </SectionPanel>

        <SectionPanel
          title={t("statusDistribution")}
          icon={<Briefcase className="h-4 w-4" />}
          action={
            <span className="text-sm font-medium text-muted-foreground">
              {t("activeOpen", { count: activeMatters })}
            </span>
          }
          className="h-full"
        >
          {totalMatters === 0 ? (
            <EmptyState>{t("noMattersYet")}</EmptyState>
          ) : (
            <div className="flex h-full min-w-0 flex-col justify-between gap-4">
              <div className="min-w-0">
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {totalMatters}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t("totalMattersLabel")}
                </p>
              </div>
              <div className="min-w-0 space-y-2.5">
                {statusCounts.map(({ status, count }) => {
                  const pct = totalMatters
                    ? Math.round((count / totalMatters) * 100)
                    : 0;
                  return (
                    <div key={status} className="min-w-0">
                      <div className="mb-1 flex min-w-0 items-center justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-muted-foreground">
                          {labels.matterStatus[status]}
                        </span>
                        <span className="shrink-0 font-medium tabular-nums text-foreground">
                          {count}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-surface-container-highest">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            STATUS_BAR_CLASS[status],
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </SectionPanel>
      </div>

      {/* 5. Secondary lists — stretch */}
      <div className="grid min-w-0 items-stretch gap-4 lg:grid-cols-2">
        <SectionPanel
          title={t("recentTasks")}
          icon={<ListTodo className="h-4 w-4" />}
          action={<ActionLink href="/tasks">{tCommon("all")}</ActionLink>}
          className="h-full"
        >
          {recentTasks.length === 0 ? (
            <EmptyState>{t("noRecentTasks")}</EmptyState>
          ) : (
            <div className={cn(listDivideClass, "max-h-[18rem] overflow-y-auto")}>
              {recentTasks.map((task) => (
                <Link
                  key={task.id}
                  href={taskHref(task.matterId)}
                  className={cn(listRowClass, "w-full max-w-full")}
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate font-medium text-foreground">
                      {task.title}
                    </p>
                    <Badge variant="info" className="shrink-0">
                      {labels.taskStatus[task.status]}
                    </Badge>
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {t("updatedAt", { date: formatDate(task.updatedAt) })}
                    {task.matter ? ` · ${shortenCode(task.matter.code)}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </SectionPanel>

        <SectionPanel
          title={t("personalTodos")}
          icon={<ListChecks className="h-4 w-4" />}
          action={
            <OpenPersonalTodoButton>{tCommon("all")}</OpenPersonalTodoButton>
          }
          className="h-full"
        >
          {personalTodos.length === 0 ? (
            <EmptyState
              action={
                <OpenPersonalTodoButton>{tCommon("all")}</OpenPersonalTodoButton>
              }
            >
              {t("noPersonalTodos")}
            </EmptyState>
          ) : (
            <div className={cn(listDivideClass, "max-h-[18rem] overflow-y-auto")}>
              {personalTodos.map((todo) => (
                <OpenPersonalTodoButton
                  key={todo.id}
                  showArrow={false}
                  className={cn(
                    listRowClass,
                    "w-full max-w-full text-left font-medium text-foreground",
                  )}
                >
                  {todo.title}
                </OpenPersonalTodoButton>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>
    </div>
  );
}
