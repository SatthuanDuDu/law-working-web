"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLabelMaps } from "@/i18n/use-label-maps";
import type {
  ExpenseMatterStat,
  ExpenseSeriesPoint,
  ExpenseTypeStat,
} from "@/lib/expense-stats";
import type { ExpenseType } from "@prisma/client";

const BRAND = "#14532d";
const TYPE_COLORS = [
  "#14532d",
  "#9a7b16",
  "#0e7490",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#334155",
];

function formatVnd(amount: string | number) {
  const digits = String(amount).replace(/\D/g, "");
  if (!digits) return "0 ₫";
  return `${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".")} ₫`;
}

function typeLabel(
  type: ExpenseType,
  customLabel: string | null,
  expenseType: Record<ExpenseType, string>,
) {
  if (type === "OTHER" && customLabel) return customLabel;
  return expenseType[type] ?? type;
}

function shortenLabel(label: string, max = 18) {
  if (label.length <= max) return label;
  return `${label.slice(0, max - 1)}…`;
}

export function ExpenseCharts({
  byType,
  byMatter,
  series,
  bucket,
}: {
  byType: ExpenseTypeStat[];
  byMatter: ExpenseMatterStat[];
  series: ExpenseSeriesPoint[];
  bucket: "day" | "week";
}) {
  const t = useTranslations("expenses");
  const { expenseType } = useLabelMaps();
  const router = useRouter();

  const typePie = byType.map((row) => ({
    key: row.key,
    name: typeLabel(row.type, row.customTypeLabel, expenseType),
    value: Number(row.amountVnd),
  }));

  const typeBars = [...byType]
    .sort((a, b) => Number(b.amountVnd) - Number(a.amountVnd))
    .map((row) => ({
      key: row.key,
      name: shortenLabel(typeLabel(row.type, row.customTypeLabel, expenseType)),
      fullName: typeLabel(row.type, row.customTypeLabel, expenseType),
      amount: Number(row.amountVnd),
    }));

  const matterBars = byMatter.slice(0, 10).map((row) => ({
    matterId: row.matterId,
    name: shortenLabel(`${row.code} · ${row.title}`, 22),
    fullName: `${row.code} · ${row.title}`,
    amount: Number(row.amountVnd),
  }));

  const trend = series.map((point) => ({
    date: point.date,
    amount: Number(point.amountVnd),
  }));

  const typeBarHeight = Math.max(180, typeBars.length * 32);
  const matterBarHeight = Math.max(180, matterBars.length * 32);

  if (byType.length === 0) {
    return (
      <Card className="rounded-md">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t("empty")}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("chartByType")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="mx-auto h-52 w-full max-w-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={typePie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={48}
                      outerRadius={72}
                      paddingAngle={2}
                    >
                      {typePie.map((entry, index) => (
                        <Cell
                          key={entry.key}
                          fill={TYPE_COLORS[index % TYPE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatVnd(Number(value ?? 0))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="-mx-1 overflow-x-auto px-1">
                <div style={{ minWidth: 200, height: typeBarHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={typeBars}
                      layout="vertical"
                      margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) =>
                          Number(v) >= 1_000_000
                            ? `${Math.round(Number(v) / 1_000_000)}M`
                            : Number(v) >= 1000
                              ? `${Math.round(Number(v) / 1000)}K`
                              : String(v)
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={90}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value) => formatVnd(Number(value ?? 0))}
                        labelFormatter={(_, payload) =>
                          String(payload?.[0]?.payload?.fullName ?? "")
                        }
                      />
                      <Bar
                        dataKey="amount"
                        fill={BRAND}
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("chartByMatter")}</CardTitle>
          </CardHeader>
          <CardContent>
            {matterBars.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("empty")}
              </p>
            ) : (
              <div className="-mx-1 overflow-x-auto px-1">
                <div style={{ minWidth: 260, height: matterBarHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={matterBars}
                      layout="vertical"
                      margin={{ top: 4, right: 12, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) =>
                          Number(v) >= 1_000_000
                            ? `${Math.round(Number(v) / 1_000_000)}M`
                            : Number(v) >= 1000
                              ? `${Math.round(Number(v) / 1000)}K`
                              : String(v)
                        }
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        formatter={(value) => formatVnd(Number(value ?? 0))}
                        labelFormatter={(_, payload) =>
                          String(payload?.[0]?.payload?.fullName ?? "")
                        }
                      />
                      <Bar
                        dataKey="amount"
                        fill={BRAND}
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        onClick={(data) => {
                          const id = (
                            data as { matterId?: string } | undefined
                          )?.matterId;
                          if (id) router.push(`/matters/${id}`);
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {bucket === "week" ? t("chartTrendWeek") : t("chartTrendDay")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="-mx-1 overflow-x-auto px-1">
            <div className="h-56 min-w-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={trend}
                  margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BRAND} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={BRAND} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => String(v).slice(5)}
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    width={48}
                    tickFormatter={(v) =>
                      Number(v) >= 1_000_000
                        ? `${Math.round(Number(v) / 1_000_000)}M`
                        : Number(v) >= 1000
                          ? `${Math.round(Number(v) / 1000)}K`
                          : String(v)
                    }
                  />
                  <Tooltip
                    formatter={(value) => formatVnd(Number(value ?? 0))}
                    labelFormatter={(label) => String(label)}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke={BRAND}
                    fill="url(#expenseFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
