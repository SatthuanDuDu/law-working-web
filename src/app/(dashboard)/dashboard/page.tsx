import { addDays, startOfDay, endOfDay } from "date-fns";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  ListTodo,
} from "lucide-react";
import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { Badge, Card } from "@/components/ui/card";
import { MatterStatusBadge } from "@/components/matters/matter-status-control";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { formatDate, cn } from "@/lib/utils";
import {
  MATTER_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/constants";
import { getAccessibleMatterIds } from "@/lib/access";
import type { MatterStatus, TaskPriority } from "@prisma/client";

const STAT_TONES = {
  primary: "bg-primary-muted text-primary",
  sky: "bg-sky-100 text-sky-700",
  amber: "bg-amber-100 text-amber-700",
  accent: "bg-accent-muted text-accent",
} as const;

const STATUS_BAR_CLASS: Record<MatterStatus, string> = {
  NEW: "bg-sky-500",
  IN_PROGRESS: "bg-amber-500",
  ON_HOLD: "bg-rose-500",
  CLOSED: "bg-emerald-500",
};

const STATUS_ORDER: MatterStatus[] = ["NEW", "IN_PROGRESS", "ON_HOLD", "CLOSED"];

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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  icon: ReactNode;
  tone: keyof typeof STAT_TONES;
}) {
  return (
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300/80 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
            STAT_TONES[tone],
          )}
        >
          {icon}
        </span>
      </div>
      <p className="mt-4 text-[1.75rem] font-bold leading-none tabular-nums text-slate-900">
        {value}
      </p>
      {sub ? <div className="mt-2 text-sm">{sub}</div> : null}
    </div>
  );
}

function Panel({
  title,
  icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            {icon}
          </span>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        </div>
        {action}
      </div>
      <div className="flex-1 p-5">{children}</div>
    </Card>
  );
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

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireAuth();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const soonEnd = endOfDay(addDays(now, 3));

  const matterIds = await getAccessibleMatterIds(user.id, user.role);
  const matterWhere = matterIds ? { id: { in: matterIds } } : {};

  const [
    openTasks,
    overdueTasks,
    upcomingCount,
    matters,
    recentTasks,
    unreadNotifications,
    upcomingDeadlines,
    matterStatusGroups,
  ] = await Promise.all([
    prisma.task.count({
      where: {
        assigneeId: user.id,
        status: { in: ["TODO", "IN_PROGRESS"] },
      },
    }),
    prisma.task.count({
      where: {
        assigneeId: user.id,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
    }),
    prisma.task.count({
      where: {
        assigneeId: user.id,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { gte: todayStart, lte: soonEnd },
      },
    }),
    prisma.matter.findMany({
      where: matterWhere,
      include: { client: true, leadLawyer: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.task.findMany({
      where: { assigneeId: user.id },
      include: { matter: { select: { code: true } } },
      orderBy: { updatedAt: "desc" },
      take: 6,
    }),
    prisma.notification.count({
      where: { userId: user.id, isRead: false },
    }),
    prisma.task.findMany({
      where: {
        assigneeId: user.id,
        status: { in: ["TODO", "IN_PROGRESS"] },
        dueDate: { gte: todayStart, lte: soonEnd },
      },
      include: { matter: { select: { code: true } } },
      orderBy: { dueDate: "asc" },
      take: 5,
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

  return (
    <div className="space-y-6">
      <PageHeaderSlot
        title={`Xin chào, ${user.name}`}
        description="Tổng quan công việc hôm nay"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Việc chưa hoàn thành"
          value={String(openTasks)}
          sub={
            overdueTasks > 0 ? (
              <span className="inline-flex items-center gap-1 font-medium text-rose-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                {overdueTasks} quá hạn
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Đúng tiến độ
              </span>
            )
          }
          icon={<ListTodo className="h-[18px] w-[18px]" />}
          tone="primary"
        />
        <StatCard
          label="Sắp đến hạn"
          value={String(upcomingCount)}
          sub="Trong 3 ngày tới"
          icon={<CalendarClock className="h-[18px] w-[18px]" />}
          tone="amber"
        />
        <StatCard
          label="Vụ việc đang mở"
          value={String(activeMatters)}
          sub={`${totalMatters} tổng cộng`}
          icon={<Briefcase className="h-[18px] w-[18px]" />}
          tone="sky"
        />
        <StatCard
          label="Thông báo chưa đọc"
          value={String(unreadNotifications)}
          sub={<ActionLink href="/notifications">Xem thông báo</ActionLink>}
          icon={<Bell className="h-[18px] w-[18px]" />}
          tone="accent"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel
          title="Sắp đến hạn"
          icon={<CalendarClock className="h-4 w-4" />}
          action={<ActionLink href="/calendar">Xem lịch</ActionLink>}
          className="lg:col-span-2"
        >
          {upcomingDeadlines.length === 0 ? (
            <EmptyState>Không có hạn nào trong 3 ngày tới.</EmptyState>
          ) : (
            <div className="space-y-2.5">
              {upcomingDeadlines.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-slate-200/80 px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-medium text-slate-900">
                      {task.title}
                    </p>
                    <Badge variant={priorityVariant(task.priority)}>
                      {TASK_PRIORITY_LABELS[task.priority]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Hạn {task.dueDate ? formatDate(task.dueDate) : "—"}
                    {task.matter ? ` • ${task.matter.code}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title="Phân bố trạng thái"
          icon={<Briefcase className="h-4 w-4" />}
          action={
            <span className="text-sm font-medium text-slate-500">
              {activeMatters} đang mở
            </span>
          }
        >
          {totalMatters === 0 ? (
            <EmptyState>Chưa có vụ việc.</EmptyState>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-bold tabular-nums text-slate-900">
                  {totalMatters}
                </p>
                <p className="text-sm text-slate-500">Tổng vụ việc</p>
              </div>
              <div className="space-y-3">
                {statusCounts.map(({ status, count }) => {
                  const pct = totalMatters
                    ? Math.round((count / totalMatters) * 100)
                    : 0;
                  return (
                    <div key={status}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-slate-600">
                          {MATTER_STATUS_LABELS[status]}
                        </span>
                        <span className="font-medium tabular-nums text-slate-900">
                          {count}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
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
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Vụ việc đang phụ trách"
          icon={<Briefcase className="h-4 w-4" />}
          action={<ActionLink href="/matters">Tất cả</ActionLink>}
        >
          {matters.length === 0 ? (
            <EmptyState>Không có vụ việc nào.</EmptyState>
          ) : (
            <div className="space-y-2.5">
              {matters.map((matter) => (
                <Link
                  key={matter.id}
                  href={`/matters/${matter.id}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium text-slate-900">
                        {matter.title}
                      </p>
                      <MatterStatusBadge status={matter.status} />
                    </div>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {matter.code} • {matter.client.name} • {matter.leadLawyer.name}
                    </p>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-300 transition-colors group-hover:text-primary" />
                </Link>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Nhiệm vụ gần đây" icon={<ListTodo className="h-4 w-4" />}>
          {recentTasks.length === 0 ? (
            <EmptyState>Chưa có nhiệm vụ nào.</EmptyState>
          ) : (
            <div className="space-y-2.5">
              {recentTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-slate-200/80 px-4 py-3 transition-colors hover:border-slate-300 hover:bg-slate-50/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate font-medium text-slate-900">
                      {task.title}
                    </p>
                    <Badge variant="info">{TASK_STATUS_LABELS[task.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Cập nhật {formatDate(task.updatedAt)}
                    {task.matter ? ` • ${task.matter.code}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Nhiệm vụ của tôi" icon={<ListTodo className="h-4 w-4" />}>
        {recentTasks.length === 0 ? (
          <EmptyState>Chưa có nhiệm vụ nào.</EmptyState>
        ) : (
          <>
            <div className="space-y-2.5 md:hidden">
              {recentTasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-xl border border-slate-200/80 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 font-medium text-slate-900">{task.title}</p>
                    <Badge variant="info">{TASK_STATUS_LABELS[task.status]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {task.matter?.code ?? "—"}
                    {task.dueDate ? ` • Hạn ${formatDate(task.dueDate)}` : ""}
                  </p>
                  <div className="mt-2">
                    <Badge variant={priorityVariant(task.priority)}>
                      {TASK_PRIORITY_LABELS[task.priority]}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
            <div className="-mx-5 -mb-5 hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-2.5 font-semibold">Nhiệm vụ</th>
                    <th className="px-3 py-2.5 font-semibold">Vụ việc</th>
                    <th className="px-3 py-2.5 font-semibold">Hạn</th>
                    <th className="px-3 py-2.5 font-semibold">Ưu tiên</th>
                    <th className="px-5 py-2.5 text-right font-semibold">
                      Trạng thái
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTasks.map((task) => (
                    <tr
                      key={task.id}
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-muted text-xs font-semibold text-primary">
                            {getInitials(user.name)}
                          </span>
                          <span className="font-medium text-slate-900">
                            {task.title}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-500">
                        {task.matter?.code ?? "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                        {task.dueDate ? formatDate(task.dueDate) : "—"}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant={priorityVariant(task.priority)}>
                          {TASK_PRIORITY_LABELS[task.priority]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Badge variant="info">{TASK_STATUS_LABELS[task.status]}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
