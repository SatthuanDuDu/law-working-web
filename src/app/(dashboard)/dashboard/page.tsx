import { addDays, startOfDay, endOfDay } from "date-fns";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ListTodo,
} from "lucide-react";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import {
  ExpandableStatCard,
  type DashboardTaskItem,
} from "@/components/dashboard/expandable-stat-card";
import { Badge } from "@/components/ui/card";
import { SectionPanel } from "@/components/ui/section-panel";
import {
  UpcomingDeadlineList,
  type UpcomingDeadlineItem,
} from "@/components/dashboard/upcoming-deadline-list";
import { MatterStatusBadge } from "@/components/matters/matter-status-control";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { isManagerOrAbove } from "@/lib/permissions";
import { formatDate, cn } from "@/lib/utils";
import { getLabelMaps } from "@/i18n/server-labels";
import { getTranslations } from "next-intl/server";
import { getAccessibleMatterIds } from "@/lib/access";
import type { MatterStatus, TaskPriority, TaskStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const STATUS_BAR_CLASS: Record<MatterStatus, string> = {
  NEW: "bg-sky-500",
  IN_PROGRESS: "bg-amber-500",
  ON_HOLD: "bg-rose-500",
  CLOSED: "bg-emerald-500",
  ARCHIVED: "bg-slate-500",
};

const STATUS_ORDER: MatterStatus[] = [
  "NEW",
  "IN_PROGRESS",
  "ON_HOLD",
  "CLOSED",
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
  matter: { id: string; code: string; title: string } | null;
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
  };
}

function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="interactive-link inline-flex items-center gap-1 text-sm font-medium text-primary"
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </Link>
  );
}

function EmptyState({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border bg-muted/80 px-4 py-8 text-center text-sm text-muted-foreground">
      <p>{children}</p>
      {action}
    </div>
  );
}

function shortenCode(code: string | null | undefined) {
  if (!code) return null;
  if (code.length <= 18) return code;
  return `${code.slice(0, 8)}…${code.slice(-6)}`;
}

const matterSelect = { id: true, code: true, title: true } as const;

export default async function DashboardPage() {
  const user = await requireAuth();
  const labels = await getLabelMaps();
  const t = await getTranslations("dashboard");
  const tPages = await getTranslations("pages.dashboard");
  const tCommon = await getTranslations("common");
  const now = new Date();
  const todayStart = startOfDay(now);
  const soonEnd = endOfDay(addDays(now, 3));

  const matterIds = await getAccessibleMatterIds(user.id, user.role);
  const matterWhere = matterIds ? { id: { in: matterIds } } : {};
  const openTaskWhere: Prisma.TaskWhereInput = {
    assigneeId: user.id,
    status: { in: ["TODO", "IN_PROGRESS"] satisfies TaskStatus[] },
  };

  const [
    openTasks,
    overdueTasks,
    inProgressTasks,
    openTasksList,
    inProgressTasksList,
    matters,
    recentTasks,
    upcomingDeadlines,
    upcomingPlanSteps,
    matterStatusGroups,
  ] = await Promise.all([
    prisma.task.count({ where: openTaskWhere }),
    prisma.task.count({
      where: {
        ...openTaskWhere,
        dueDate: { lt: now },
      },
    }),
    prisma.task.count({
      where: {
        assigneeId: user.id,
        status: "IN_PROGRESS",
      },
    }),
    prisma.task.findMany({
      where: openTaskWhere,
      include: { matter: { select: matterSelect } },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    prisma.task.findMany({
      where: {
        assigneeId: user.id,
        status: "IN_PROGRESS",
      },
      include: { matter: { select: matterSelect } },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 8,
    }),
    prisma.matter.findMany({
      where: matterWhere,
      include: { client: true, leadLawyer: true },
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
        dueDate: { gte: todayStart, lte: soonEnd },
      },
      include: { matter: { select: matterSelect } },
      orderBy: { dueDate: "asc" },
      take: 8,
    }),
    prisma.matterPlanStep.findMany({
      where: {
        dueAt: { gte: todayStart, lte: soonEnd },
        status: { not: "DONE" },
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
  ]);

  const statusCounts = STATUS_ORDER.map((status) => ({
    status,
    count:
      matterStatusGroups.find((group) => group.status === status)?._count._all ??
      0,
  }));
  const totalMatters = statusCounts.reduce((sum, item) => sum + item.count, 0);
  const activeMatters = statusCounts
    .filter((item) => item.status !== "CLOSED")
    .reduce((sum, item) => sum + item.count, 0);

  const openItems = openTasksList.map(serializeTask);
  const inProgressItems = inProgressTasksList.map(serializeTask);

  type UpcomingItem = UpcomingDeadlineItem & { dueAt: Date };

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
    })),
    ...upcomingPlanSteps.map((step) => {
      const canEditPlan =
        step.matter.status !== "ARCHIVED" &&
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
      dueLabel: item.dueLabel,
      matterCodeShort: item.matterCodeShort,
    }),
  );

  return (
    <div className="space-y-6">
      <PageHeaderSlot
        title={tPages("greeting", { name: user.name })}
        description={tPages("description")}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <ExpandableStatCard
          label={t("openTasks")}
          value={String(openTasks)}
          sub={
            overdueTasks > 0 ? (
              <span className="inline-flex items-center gap-1 font-medium text-rose-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t("overdueCount", { count: overdueTasks })}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("onTrack")}
              </span>
            )
          }
          icon={<ListTodo className="h-[18px] w-[18px]" />}
          tone="primary"
          items={openItems}
          emptyLabel={t("openTasksEmpty")}
        />
        <ExpandableStatCard
          label={t("activeMatters")}
          value={String(activeMatters)}
          sub={
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-muted-foreground">
                {t("totalMatters", { count: totalMatters })}
              </span>
              <span className="text-border" aria-hidden>
                ·
              </span>
              <span className="font-medium text-sky-700 dark:text-sky-300">
                {t("inProgressTasks", { count: inProgressTasks })}
              </span>
            </span>
          }
          icon={<Briefcase className="h-[18px] w-[18px]" />}
          tone="sky"
          items={inProgressItems}
          emptyLabel={t("activeMattersEmpty")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionPanel
          title={t("upcoming")}
          icon={<CalendarClock className="h-4 w-4" />}
          action={<ActionLink href="/calendar">{t("viewCalendar")}</ActionLink>}
          className="lg:col-span-2"
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
            <UpcomingDeadlineList items={upcomingListItems} />
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
        >
          {totalMatters === 0 ? (
            <EmptyState>{t("noMattersYet")}</EmptyState>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-bold tabular-nums text-foreground">
                  {totalMatters}
                </p>
                <p className="text-sm text-muted-foreground">{t("totalMattersLabel")}</p>
              </div>
              <div className="space-y-3">
                {statusCounts.map(({ status, count }) => {
                  const pct = totalMatters
                    ? Math.round((count / totalMatters) * 100)
                    : 0;
                  return (
                    <div key={status}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {labels.matterStatus[status]}
                        </span>
                        <span className="font-medium tabular-nums text-foreground">
                          {count}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
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

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionPanel
          title={t("myMatters")}
          icon={<Briefcase className="h-4 w-4" />}
          action={<ActionLink href="/matters">{tCommon("all")}</ActionLink>}
        >
          {matters.length === 0 ? (
            <EmptyState>{t("noMyMatters")}</EmptyState>
          ) : (
            <div className="space-y-2.5">
              {matters.map((matter) => (
                <Link
                  key={matter.id}
                  href={`/matters/${matter.id}`}
                  className="interactive-press group flex items-center justify-between gap-3 rounded-md border border-border/80 bg-surface/50 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary-muted/40 hover:[filter:none] active:[filter:none]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-foreground">
                        {matter.title}
                      </p>
                      <MatterStatusBadge status={matter.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {matter.code} • {matter.client.name} • {matter.leadLawyer.name}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-border transition-colors group-hover:text-primary" />
                </Link>
              ))}
            </div>
          )}
        </SectionPanel>

        <SectionPanel title={t("recentTasks")} icon={<ListTodo className="h-4 w-4" />}>
          {recentTasks.length === 0 ? (
            <EmptyState>{t("noRecentTasks")}</EmptyState>
          ) : (
            <div className="space-y-2.5">
              {recentTasks.map((task) => (
                <Link
                  key={task.id}
                  href={taskHref(task.matterId)}
                  className="interactive-press block rounded-md border border-border/80 bg-surface/50 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-primary-muted/40 hover:[filter:none] active:[filter:none]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-medium text-foreground">
                      {task.title}
                    </p>
                    <Badge variant="info">{labels.taskStatus[task.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t("updatedAt", { date: formatDate(task.updatedAt) })}
                    {task.matter ? ` • ${task.matter.code}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>
    </div>
  );
}
