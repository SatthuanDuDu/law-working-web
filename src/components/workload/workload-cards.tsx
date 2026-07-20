"use client";

import { AlertTriangle, CheckCircle2, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { WorkloadRow } from "@/components/workload/workload-charts";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function LoadBar({
  open,
  overdue,
  maxTotal,
}: {
  open: number;
  overdue: number;
  maxTotal: number;
}) {
  const total = open + overdue;
  const widthPct = maxTotal > 0 ? Math.max((total / maxTotal) * 100, total > 0 ? 8 : 0) : 0;
  const overduePct = total > 0 ? (overdue / total) * 100 : 0;
  const openPct = total > 0 ? (open / total) * 100 : 0;

  return (
    <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="flex h-full overflow-hidden rounded-full transition-[width] duration-300"
        style={{ width: `${widthPct}%` }}
      >
        {openPct > 0 ? (
          <div className="h-full bg-primary" style={{ width: `${openPct}%` }} />
        ) : null}
        {overduePct > 0 ? (
          <div className="h-full bg-rose-500" style={{ width: `${overduePct}%` }} />
        ) : null}
      </div>
    </div>
  );
}

export function WorkloadKpiStrip({
  totalOpen,
  totalOverdue,
  peopleWithOverdue,
}: {
  totalOpen: number;
  totalOverdue: number;
  peopleWithOverdue: number;
}) {
  const t = useTranslations("workload");
  const items = [
    {
      label: t("openWork"),
      value: totalOpen,
      icon: CheckCircle2,
      tone: "bg-primary-muted text-primary",
    },
    {
      label: t("overdueWork"),
      value: totalOverdue,
      icon: AlertTriangle,
      tone: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    },
    {
      label: t("peopleOverdue"),
      value: peopleWithOverdue,
      icon: Users,
      tone: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
    },
  ] as const;

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <Card key={item.label} className="rounded-[5px]">
          <CardContent className="flex items-center gap-3 p-4">
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-[5px]",
                item.tone,
              )}
            >
              <item.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
                {item.value}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function WorkloadPersonCards({ rows }: { rows: WorkloadRow[] }) {
  const locale = useLocale();
  const t = useTranslations("workload");
  const maxTotal = Math.max(
    1,
    ...rows.map((r) => r.openTasks + r.overdueTasks),
  );
  const sorted = [...rows].sort(
    (a, b) =>
      b.openTasks + b.overdueTasks - (a.openTasks + a.overdueTasks) ||
      a.name.localeCompare(b.name, locale),
  );

  return (
    <Card className="rounded-[5px]">
      <CardHeader>
        <CardTitle>{t("byPerson")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((row) => {
            const hasOverdue = row.overdueTasks > 0;
            return (
              <div
                key={row.userId}
                className={cn(
                  "rounded-[5px] border bg-surface p-3",
                  hasOverdue ? "border-rose-200 bg-rose-50/30 dark:border-rose-900/50 dark:bg-rose-950/30" : "border-border",
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-muted text-xs font-semibold text-primary">
                    {initials(row.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{row.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.department}</p>
                  </div>
                </div>
                <div className="mt-3 flex gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("open")}</p>
                    <p className="font-semibold tabular-nums text-primary">
                      {row.openTasks}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("overdue")}</p>
                    <p
                      className={cn(
                        "font-semibold tabular-nums",
                        hasOverdue ? "text-rose-600" : "text-foreground",
                      )}
                    >
                      {row.overdueTasks}
                    </p>
                  </div>
                </div>
                <LoadBar
                  open={row.openTasks}
                  overdue={row.overdueTasks}
                  maxTotal={maxTotal}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function WorkloadDepartmentCards({
  departments,
}: {
  departments: { name: string; openTasks: number; overdueTasks: number }[];
}) {
  const locale = useLocale();
  const t = useTranslations("workload");
  const maxTotal = Math.max(
    1,
    ...departments.map((d) => d.openTasks + d.overdueTasks),
  );
  const sorted = [...departments].sort(
    (a, b) =>
      b.openTasks + b.overdueTasks - (a.openTasks + a.overdueTasks) ||
      a.name.localeCompare(b.name, locale),
  );

  return (
    <Card className="rounded-[5px]">
      <CardHeader>
        <CardTitle>{t("byDepartment")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((dept) => {
            const hasOverdue = dept.overdueTasks > 0;
            return (
              <div
                key={dept.name}
                className={cn(
                  "rounded-[5px] border p-3",
                  hasOverdue ? "border-rose-200 bg-rose-50/30 dark:border-rose-900/50 dark:bg-rose-950/30" : "border-border bg-surface",
                )}
              >
                <p className="truncate font-medium text-foreground">{dept.name}</p>
                <div className="mt-2 flex gap-4 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">{t("open")}</p>
                    <p className="font-semibold tabular-nums text-primary">
                      {dept.openTasks}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{t("overdue")}</p>
                    <p
                      className={cn(
                        "font-semibold tabular-nums",
                        hasOverdue ? "text-rose-600" : "text-foreground",
                      )}
                    >
                      {dept.overdueTasks}
                    </p>
                  </div>
                </div>
                <LoadBar
                  open={dept.openTasks}
                  overdue={dept.overdueTasks}
                  maxTotal={maxTotal}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
