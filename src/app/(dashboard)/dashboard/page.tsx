import { addDays, startOfDay, startOfWeek, endOfDay } from "date-fns";
import { AppShell } from "@/components/layout/app-shell";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { formatMinutes, formatDate } from "@/lib/utils";
import {
  DAILY_LOG_STATUS_LABELS,
  MATTER_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
} from "@/lib/constants";
import { buildDailyLogWhere, getAccessibleMatterIds } from "@/lib/access";
import Link from "next/link";

export default async function DashboardPage() {
  const user = await requireAuth();
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const soonEnd = endOfDay(addDays(now, 3));

  const logWhere = buildDailyLogWhere(user.id, user.role);
  const matterIds = await getAccessibleMatterIds(user.id, user.role);

  const [
    todayLogs,
    weekMinutes,
    openTasks,
    overdueTasks,
    matters,
    recentLogs,
    unreadNotifications,
    upcomingDeadlines,
  ] = await Promise.all([
    prisma.dailyLog.findMany({
      where: {
        ...logWhere,
        date: { gte: todayStart, lte: todayEnd },
      },
      include: { workType: true, matter: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.dailyLog.aggregate({
      where: {
        ...logWhere,
        date: { gte: weekStart, lte: todayEnd },
      },
      _sum: { minutes: true },
    }),
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
    prisma.matter.findMany({
      where: matterIds ? { id: { in: matterIds } } : {},
      include: { client: true, leadLawyer: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.dailyLog.findMany({
      where: logWhere,
      include: { user: true, matter: true, workType: true },
      orderBy: { date: "desc" },
      take: 5,
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
  ]);

  const todayMinutes = todayLogs.reduce((sum, log) => sum + log.minutes, 0);

  return (
    <AppShell
      user={user}
      title={`Xin chào, ${user.name}`}
      description="Tổng quan công việc hôm nay"
    >
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-500">Giờ làm hôm nay</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{formatMinutes(todayMinutes)}</p>
            <p className="text-sm text-slate-500">{todayLogs.length} bản ghi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-500">Giờ làm tuần này</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {formatMinutes(weekMinutes._sum.minutes ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-500">Việc chưa hoàn thành</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{openTasks}</p>
            <p className="text-sm text-red-600">{overdueTasks} quá hạn</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-500">Thông báo chưa đọc</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{unreadNotifications}</p>
            <Link href="/notifications" className="text-sm text-primary hover:underline">
              Xem thông báo
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Công việc hôm nay</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayLogs.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có công việc nào hôm nay.</p>
            ) : (
              todayLogs.map((log) => (
                <div key={log.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{log.description}</p>
                      <p className="text-sm text-slate-500">
                        {log.workType?.name ?? "Không phân loại"}
                        {log.matter ? ` • ${log.matter.code}` : ""}
                      </p>
                    </div>
                    <Badge variant={log.status === "COMPLETED" ? "success" : "warning"}>
                      {DAILY_LOG_STATUS_LABELS[log.status]}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    {formatMinutes(log.minutes)}
                    {log.isBillable ? " • Tính phí" : " • Không tính phí"}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Sắp đến hạn (3 ngày)</CardTitle>
            <Link href="/calendar" className="text-sm text-primary hover:underline">
              Xem lịch
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-slate-500">Không có hạn nào sắp tới.</p>
            ) : (
              upcomingDeadlines.map((task) => (
                <div key={task.id} className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-slate-500">
                        Hạn {task.dueDate ? formatDate(task.dueDate) : "—"}
                        {task.matter ? ` • ${task.matter.code}` : ""}
                      </p>
                    </div>
                    <Badge variant="warning">{TASK_PRIORITY_LABELS[task.priority]}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vụ việc đang phụ trách</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {matters.length === 0 ? (
              <p className="text-sm text-slate-500">Không có vụ việc nào.</p>
            ) : (
              matters.map((matter) => (
                <Link
                  key={matter.id}
                  href={`/matters/${matter.id}`}
                  className="block rounded-lg border border-slate-200 p-4 transition hover:border-primary/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{matter.title}</p>
                      <p className="text-sm text-slate-500">
                        {matter.code} • {matter.client.name}
                      </p>
                    </div>
                    <Badge variant="info">{MATTER_STATUS_LABELS[matter.status]}</Badge>
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hoạt động gần đây</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="px-3 py-2">Ngày</th>
                    <th className="px-3 py-2">Nhân viên</th>
                    <th className="px-3 py-2">Nội dung</th>
                    <th className="px-3 py-2">Thời gian</th>
                    <th className="px-3 py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLogs.map((log) => (
                    <tr key={log.id} className="border-b">
                      <td className="px-3 py-3">{formatDate(log.date)}</td>
                      <td className="px-3 py-3">{log.user.name}</td>
                      <td className="px-3 py-3">{log.description}</td>
                      <td className="px-3 py-3">{formatMinutes(log.minutes)}</td>
                      <td className="px-3 py-3">
                        <Badge variant={log.status === "COMPLETED" ? "success" : "warning"}>
                          {DAILY_LOG_STATUS_LABELS[log.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
