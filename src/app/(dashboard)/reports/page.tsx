import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { buildDailyLogWhere } from "@/lib/access";
import { canViewReports } from "@/lib/permissions";
import { formatDate, formatMinutes } from "@/lib/utils";
import { redirect } from "next/navigation";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    userId?: string;
    matterId?: string;
  }>;
}) {
  const user = await requireAuth();
  if (!canViewReports(user.role)) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const defaultTo = now.toISOString().split("T")[0];

  const from = params.from ?? defaultFrom;
  const to = params.to ?? defaultTo;
  const fromDate = new Date(from);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  const baseWhere = buildDailyLogWhere(user.id, user.role);
  const where = {
    ...baseWhere,
    date: { gte: fromDate, lte: toDate },
    ...(params.userId ? { userId: params.userId } : {}),
    ...(params.matterId ? { matterId: params.matterId } : {}),
  };

  const [logs, users, matters] = await Promise.all([
    prisma.dailyLog.findMany({
      where,
      include: {
        user: true,
        matter: true,
        client: true,
        workType: true,
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
    prisma.user.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.matter.findMany({
      select: { id: true, code: true, title: true },
      orderBy: { code: "asc" },
    }),
  ]);

  const totalMinutes = logs.reduce((sum, log) => sum + log.minutes, 0);
  const billableMinutes = logs
    .filter((log) => log.isBillable)
    .reduce((sum, log) => sum + log.minutes, 0);

  const byUser = Object.values(
    logs.reduce<Record<string, { name: string; minutes: number; count: number }>>(
      (acc, log) => {
        if (!acc[log.userId]) {
          acc[log.userId] = { name: log.user.name, minutes: 0, count: 0 };
        }
        acc[log.userId].minutes += log.minutes;
        acc[log.userId].count += 1;
        return acc;
      },
      {},
    ),
  );

  const byMatter = Object.values(
    logs.reduce<
      Record<string, { label: string; minutes: number; count: number }>
    >((acc, log) => {
      const key = log.matterId ?? "none";
      if (!acc[key]) {
        acc[key] = {
          label: log.matter
            ? `${log.matter.code} - ${log.matter.title}`
            : "Không gắn vụ việc",
          minutes: 0,
          count: 0,
        };
      }
      acc[key].minutes += log.minutes;
      acc[key].count += 1;
      return acc;
    }, {}),
  );

  const exportQuery = new URLSearchParams({
    from,
    to,
    ...(params.userId ? { userId: params.userId } : {}),
    ...(params.matterId ? { matterId: params.matterId } : {}),
  }).toString();

  return (
    <AppShell
      user={user}
      title="Báo cáo"
      description="Tổng hợp giờ làm theo nhân viên, vụ việc và khoảng thời gian"
    >
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Bộ lọc</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Từ ngày</label>
              <input
                type="date"
                name="from"
                defaultValue={from}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Đến ngày</label>
              <input
                type="date"
                name="to"
                defaultValue={to}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
            </div>
            {(user.role === "ADMIN" || user.role === "MANAGER") && (
              <div>
                <label className="mb-1 block text-sm font-medium">Nhân viên</label>
                <select
                  name="userId"
                  defaultValue={params.userId ?? ""}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                >
                  <option value="">Tất cả</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Vụ việc</label>
              <select
                name="matterId"
                defaultValue={params.matterId ?? ""}
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              >
                <option value="">Tất cả</option>
                {matters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.code} - {m.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-3 md:col-span-4">
              <Button type="submit">Áp dụng</Button>
              <Button asChild variant="outline">
                <Link href={`/api/reports/export?${exportQuery}`}>Xuất Excel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="mb-8 grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-500">Tổng giờ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatMinutes(totalMinutes)}</p>
            <p className="text-sm text-slate-500">{logs.length} bản ghi</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-500">Giờ tính phí</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatMinutes(billableMinutes)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-500">
              Không tính phí
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatMinutes(totalMinutes - billableMinutes)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mb-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Theo nhân viên</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byUser.length === 0 ? (
              <p className="text-sm text-slate-500">Không có dữ liệu.</p>
            ) : (
              byUser
                .sort((a, b) => b.minutes - a.minutes)
                .map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-slate-500">{item.count} bản ghi</p>
                    </div>
                    <Badge variant="info">{formatMinutes(item.minutes)}</Badge>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Theo vụ việc</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {byMatter.length === 0 ? (
              <p className="text-sm text-slate-500">Không có dữ liệu.</p>
            ) : (
              byMatter
                .sort((a, b) => b.minutes - a.minutes)
                .map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-slate-500">{item.count} bản ghi</p>
                    </div>
                    <Badge variant="info">{formatMinutes(item.minutes)}</Badge>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chi tiết bản ghi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-3 py-2">Ngày</th>
                  <th className="px-3 py-2">Nhân viên</th>
                  <th className="px-3 py-2">Nội dung</th>
                  <th className="px-3 py-2">Vụ việc</th>
                  <th className="px-3 py-2">Thời gian</th>
                  <th className="px-3 py-2">Tính phí</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b">
                    <td className="px-3 py-3">{formatDate(log.date)}</td>
                    <td className="px-3 py-3">{log.user.name}</td>
                    <td className="px-3 py-3">{log.description}</td>
                    <td className="px-3 py-3">{log.matter?.code ?? "—"}</td>
                    <td className="px-3 py-3">{formatMinutes(log.minutes)}</td>
                    <td className="px-3 py-3">
                      {log.isBillable ? "Có" : "Không"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
