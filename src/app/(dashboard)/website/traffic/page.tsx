import { Eye, TrendingUp } from "lucide-react";

import { getTrafficReport } from "@/lib/cms-traffic";
import { requireRole } from "@/lib/session";
import {
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableEmptyRow,
} from "@/components/ui/table";

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
          <Table>
            <THead className="border-b border-border bg-muted/50">
              <TR>
                <TH className="px-4 py-3">Đường dẫn</TH>
                <TH className="px-4 py-3 text-right">Lượt xem</TH>
              </TR>
            </THead>
            <TBody>
              {report.topPaths.length === 0 ? (
                <TableEmptyRow colSpan={2}>Chưa có dữ liệu.</TableEmptyRow>
              ) : (
                report.topPaths.map((row) => (
                  <TR key={row.path}>
                    <TD className="max-w-xs truncate px-4 py-3 font-mono text-xs">
                      {row.path}
                    </TD>
                    <TD className="px-4 py-3 text-right font-semibold">{row.views}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </section>

        <section className="overflow-hidden rounded-md border border-border bg-surface">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-semibold text-foreground">Lượt xem theo ngày (30 ngày)</h2>
          </div>
          <Table>
            <THead className="border-b border-border bg-muted/50">
              <TR>
                <TH className="px-4 py-3">Ngày</TH>
                <TH className="px-4 py-3 text-right">Lượt xem</TH>
              </TR>
            </THead>
            <TBody className="max-h-96 overflow-y-auto">
              {report.dailyTotals.length === 0 ? (
                <TableEmptyRow colSpan={2}>Chưa có dữ liệu.</TableEmptyRow>
              ) : (
                report.dailyTotals.map((row) => (
                  <TR key={row.day}>
                    <TD className="px-4 py-3">{formatDay(row.day)}</TD>
                    <TD className="px-4 py-3 text-right font-semibold">{row.views}</TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </section>
      </div>
    </div>
  );
}
