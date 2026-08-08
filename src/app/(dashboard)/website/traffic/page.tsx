import { Eye, TrendingUp } from "lucide-react";

import { getTrafficReport } from "@/lib/cms-traffic";
import { requireRole } from "@/lib/session";

function formatDay(day: string) {
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

export default async function WebsiteTrafficPage() {
  await requireRole(["ADMIN", "MANAGER"]);
  const report = await getTrafficReport();

  const cards = [
    { label: "Hôm nay", value: report.today, icon: Eye },
    { label: "7 ngày qua", value: report.last7Days, icon: TrendingUp },
    { label: "30 ngày qua", value: report.last30Days, icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Lượt truy cập website</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Thống kê lượt xem trang công khai — tổng hợp theo ngày, không lưu thông tin cá nhân.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-md border border-border bg-surface p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">{card.label}</p>
                <Icon className="size-4 text-primary" aria-hidden />
              </div>
              <p className="mt-3 text-3xl font-bold text-primary">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-md border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-foreground">Trang xem nhiều nhất (30 ngày)</h2>
          </div>
          {report.topPaths.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">Chưa có dữ liệu.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Đường dẫn</th>
                  <th className="px-4 py-3 text-right">Lượt xem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {report.topPaths.map((row) => (
                  <tr key={row.path}>
                    <td className="max-w-xs truncate px-4 py-3 font-mono text-xs">{row.path}</td>
                    <td className="px-4 py-3 text-right font-semibold">{row.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="overflow-hidden rounded-md border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-foreground">Lượt xem theo ngày (30 ngày)</h2>
          </div>
          {report.dailyTotals.length === 0 ? (
            <p className="px-4 py-8 text-sm text-muted-foreground">Chưa có dữ liệu.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Ngày</th>
                  <th className="px-4 py-3 text-right">Lượt xem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border max-h-96 overflow-y-auto">
                {report.dailyTotals.map((row) => (
                  <tr key={row.day}>
                    <td className="px-4 py-3">{formatDay(row.day)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{row.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
