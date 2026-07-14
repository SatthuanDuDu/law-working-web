import Link from "next/link";
import { startOfDay, endOfDay, startOfWeek, startOfMonth } from "date-fns";
import { AppShell } from "@/components/layout/app-shell";
import { DailyLogsPanel } from "@/components/daily-logs/daily-logs-panel";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { buildDailyLogWhere } from "@/lib/access";
import { getAccessibleMatterIds, getAccessibleClientIds } from "@/lib/access";
import { cn } from "@/lib/utils";

export default async function DailyLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const user = await requireAuth();
  const params = await searchParams;
  const period = params.period ?? "week";

  const now = new Date();
  const periodStart =
    period === "day"
      ? startOfDay(now)
      : period === "month"
        ? startOfMonth(now)
        : startOfWeek(now, { weekStartsOn: 1 });

  const logWhere = {
    ...buildDailyLogWhere(user.id, user.role),
    date: { gte: periodStart, lte: endOfDay(now) },
  };
  const matterIds = await getAccessibleMatterIds(user.id, user.role);
  const clientIds = await getAccessibleClientIds(user.id, user.role);

  const [logs, matters, clients, workTypes] = await Promise.all([
    prisma.dailyLog.findMany({
      where: logWhere,
      include: {
        user: true,
        matter: true,
        client: true,
        workType: true,
      },
      orderBy: { date: "desc" },
    }),
    prisma.matter.findMany({
      where: matterIds ? { id: { in: matterIds } } : {},
      select: { id: true, code: true, title: true },
      orderBy: { code: "asc" },
    }),
    prisma.client.findMany({
      where: clientIds ? { id: { in: clientIds } } : {},
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.workType.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const periods = [
    { key: "day", label: "Hôm nay" },
    { key: "week", label: "Tuần này" },
    { key: "month", label: "Tháng này" },
  ] as const;

  return (
    <AppShell
      user={user}
      title="Công việc hàng ngày"
      description="Ghi nhận và theo dõi công việc hàng ngày"
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {periods.map((item) => (
          <Button
            key={item.key}
            asChild
            variant={period === item.key ? "default" : "outline"}
            size="sm"
            className={cn(period === item.key && "pointer-events-none")}
          >
            <Link href={`/daily-logs?period=${item.key}`}>{item.label}</Link>
          </Button>
        ))}
      </div>

      <DailyLogsPanel
        logs={logs}
        matters={matters}
        clients={clients}
        workTypes={workTypes}
        canEditAll={user.role === "ADMIN" || user.role === "MANAGER"}
        currentUserId={user.id}
      />
    </AppShell>
  );
}
