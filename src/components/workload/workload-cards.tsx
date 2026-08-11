"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Users,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { liquidPanelClass } from "@/lib/liquid-panel";
import { cn } from "@/lib/utils";
import { listDivideClass, listRowClass } from "@/lib/list-surface";
import type { WorkloadRow } from "@/components/workload/workload-charts";

export type WorkloadAssignee = {
  id: string;
  name: string;
  avatarKey?: string | null;
};

export type WorkloadKpiItem = {
  id: string;
  title: string;
  href: string;
  /** Matter label (or “no matter”) — shown with due on one row */
  matterLabel?: string;
  /** Due date/time label */
  dueLabel?: string;
  assignee?: WorkloadAssignee;
  /** Secondary line when not a task item (e.g. people KPI) */
  subtitle?: string;
};

export type WorkloadPersonTaskItem = {
  id: string;
  title: string;
  href: string;
  matterLabel: string;
  dueLabel: string;
  assignee: WorkloadAssignee;
  kind: "open" | "overdue";
};

export type WorkloadPersonRow = WorkloadRow & {
  items: WorkloadPersonTaskItem[];
};

export type WorkloadDepartmentRow = {
  name: string;
  openTasks: number;
  overdueTasks: number;
  items: WorkloadPersonTaskItem[];
};

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
  const widthPct =
    maxTotal > 0 ? Math.max((total / maxTotal) * 100, total > 0 ? 8 : 0) : 0;
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

function WorkloadItemBody({
  title,
  matterLabel,
  dueLabel,
  assignee,
  subtitle,
}: {
  title: string;
  matterLabel?: string;
  dueLabel?: string;
  assignee?: WorkloadAssignee;
  subtitle?: string;
}) {
  const detailParts = [matterLabel, dueLabel].filter(Boolean);
  const personStyle = Boolean(assignee && detailParts.length === 0);

  if (personStyle && assignee) {
    return (
      <div className="flex min-w-0 items-start gap-2">
        <UserAvatar
          userId={assignee.id}
          name={assignee.name}
          avatarKey={assignee.avatarKey}
          size="sm"
          className="h-6 w-6 text-[10px]"
        />
        <div className="min-w-0 flex-1">
          <p className="min-w-0 truncate text-sm font-medium text-foreground">
            {title}
          </p>
          {subtitle ? (
            <p className="mt-0.5 min-w-0 truncate text-xs text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <p className="min-w-0 truncate text-sm font-medium text-foreground">
        {title}
      </p>
      {detailParts.length > 0 ? (
        <p className="mt-0.5 min-w-0 truncate text-xs text-muted-foreground">
          {detailParts.join(" · ")}
        </p>
      ) : null}
      {assignee ? (
        <div className="mt-1.5 flex min-w-0 items-center gap-2">
          <UserAvatar
            userId={assignee.id}
            name={assignee.name}
            avatarKey={assignee.avatarKey}
            size="sm"
            className="h-6 w-6 text-[10px]"
          />
          <span className="min-w-0 truncate text-xs text-muted-foreground">
            {assignee.name}
          </span>
        </div>
      ) : null}
      {!assignee && subtitle ? (
        <p className="mt-0.5 min-w-0 truncate text-xs text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function ExpandableKpiCard({
  label,
  value,
  icon: Icon,
  tone,
  items,
  emptyLabel,
}: {
  label: string;
  value: number;
  icon: typeof CheckCircle2;
  tone: string;
  items: WorkloadKpiItem[];
  emptyLabel: string;
}) {
  const t = useTranslations("workload");
  const [open, setOpen] = useState(false);

  return (
    <div className={cn(liquidPanelClass, "min-w-0 max-w-full overflow-hidden rounded-[5px] transition-colors duration-200 hover:border-primary/30")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          open ? t("collapseCard", { label }) : t("expandCard", { label })
        }
        className="interactive-press flex w-full min-w-0 items-center gap-3 p-4 text-left hover:[filter:none] active:[filter:none]"
      >
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-[5px]",
            tone,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold tabular-nums text-foreground">
            {value}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="min-w-0 border-t border-border/60 px-1.5 pb-2 pt-0">
          {items.length === 0 ? (
            <p className="px-2.5 py-3 text-sm text-muted-foreground">
              {emptyLabel}
            </p>
          ) : (
            <div className={listDivideClass}>
              {items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={cn(listRowClass, "w-full max-w-full")}
                >
                  <WorkloadItemBody
                    title={item.title}
                    matterLabel={item.matterLabel}
                    dueLabel={item.dueLabel}
                    assignee={item.assignee}
                    subtitle={item.subtitle}
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function WorkloadKpiStrip({
  totalOpen,
  totalOverdue,
  peopleWithOverdue,
  openItems,
  overdueItems,
  peopleItems,
}: {
  totalOpen: number;
  totalOverdue: number;
  peopleWithOverdue: number;
  openItems: WorkloadKpiItem[];
  overdueItems: WorkloadKpiItem[];
  peopleItems: WorkloadKpiItem[];
}) {
  const t = useTranslations("workload");
  const cards = [
    {
      key: "open",
      label: t("openWork"),
      value: totalOpen,
      icon: CheckCircle2,
      tone: "bg-primary-muted text-primary",
      items: openItems,
      emptyLabel: t("openEmpty"),
    },
    {
      key: "overdue",
      label: t("overdueWork"),
      value: totalOverdue,
      icon: AlertTriangle,
      tone: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
      items: overdueItems,
      emptyLabel: t("overdueEmpty"),
    },
    {
      key: "people",
      label: t("peopleOverdue"),
      value: peopleWithOverdue,
      icon: Users,
      tone: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
      items: peopleItems,
      emptyLabel: t("peopleEmpty"),
    },
  ] as const;

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <ExpandableKpiCard
          key={card.key}
          label={card.label}
          value={card.value}
          icon={card.icon}
          tone={card.tone}
          items={card.items}
          emptyLabel={card.emptyLabel}
        />
      ))}
    </div>
  );
}

export function WorkloadPersonCards({ rows }: { rows: WorkloadPersonRow[] }) {
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
          {sorted.map((row) => (
            <PersonWorkloadCard key={row.userId} row={row} maxTotal={maxTotal} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PersonWorkloadCard({
  row,
  maxTotal,
}: {
  row: WorkloadPersonRow;
  maxTotal: number;
}) {
  const t = useTranslations("workload");
  const [expanded, setExpanded] = useState(false);
  const hasOverdue = row.overdueTasks > 0;
  const openItems = row.items.filter((item) => item.kind === "open");
  const overdueItems = row.items.filter((item) => item.kind === "overdue");

  return (
    <div
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded-[5px] border",
        hasOverdue
          ? "border-rose-200 bg-rose-50/30 dark:border-rose-900/50 dark:bg-rose-950/30"
          : liquidPanelClass,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? t("collapseCard", { label: row.name })
            : t("expandCard", { label: row.name })
        }
        className="interactive-press w-full p-3 text-left hover:[filter:none] active:[filter:none]"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-muted text-xs font-semibold text-primary">
            {initials(row.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{row.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.department}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
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
      </button>

      {expanded ? (
        <div className="min-w-0 space-y-3 border-t border-border/60 px-2 pb-2.5 pt-2">
          <PersonTaskSection
            label={t("openSection")}
            emptyLabel={t("openSectionEmpty")}
            items={openItems}
            accent="open"
          />
          <PersonTaskSection
            label={t("overdueSection")}
            emptyLabel={t("overdueSectionEmpty")}
            items={overdueItems}
            accent="overdue"
          />
        </div>
      ) : null}
    </div>
  );
}

function PersonTaskSection({
  label,
  emptyLabel,
  items,
  accent,
}: {
  label: string;
  emptyLabel: string;
  items: WorkloadPersonTaskItem[];
  accent: "open" | "overdue";
}) {
  return (
    <div className="min-w-0">
      <p
        className={cn(
          "mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide",
          accent === "overdue" ? "text-rose-600" : "text-primary",
        )}
      >
        {label}
        <span className="ml-1 tabular-nums text-muted-foreground">
          ({items.length})
        </span>
      </p>
      {items.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="min-w-0 space-y-1.5">
          {items.map((item) => (
            <li key={item.id} className="min-w-0">
              <Link
                href={item.href}
                className={cn(
                  "interactive-press block min-w-0 rounded-sm bg-surface/80 py-1.5 pl-2.5 pr-1.5 hover:[filter:none] active:[filter:none]",
                  "border-l-4",
                  accent === "overdue"
                    ? "border-l-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50"
                    : "border-l-primary hover:bg-primary-muted-hover",
                )}
              >
                <WorkloadItemBody
                  title={item.title}
                  matterLabel={item.matterLabel}
                  dueLabel={item.dueLabel}
                  assignee={item.assignee}
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WorkloadDepartmentCards({
  departments,
}: {
  departments: WorkloadDepartmentRow[];
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
          {sorted.map((dept) => (
            <DepartmentWorkloadCard
              key={dept.name}
              dept={dept}
              maxTotal={maxTotal}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DepartmentWorkloadCard({
  dept,
  maxTotal,
}: {
  dept: WorkloadDepartmentRow;
  maxTotal: number;
}) {
  const t = useTranslations("workload");
  const [expanded, setExpanded] = useState(false);
  const hasOverdue = dept.overdueTasks > 0;
  const openItems = dept.items.filter((item) => item.kind === "open");
  const overdueItems = dept.items.filter((item) => item.kind === "overdue");

  return (
    <div
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded-[5px] border",
        hasOverdue
          ? "border-rose-200 bg-rose-50/30 dark:border-rose-900/50 dark:bg-rose-950/30"
          : liquidPanelClass,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? t("collapseCard", { label: dept.name })
            : t("expandCard", { label: dept.name })
        }
        className="interactive-press w-full p-3 text-left hover:[filter:none] active:[filter:none]"
      >
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 truncate font-medium text-foreground">
            {dept.name}
          </p>
          <ChevronDown
            className={cn(
              "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              expanded && "rotate-180",
            )}
            aria-hidden
          />
        </div>
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
      </button>

      {expanded ? (
        <div className="min-w-0 space-y-3 border-t border-border/60 px-2 pb-2.5 pt-2">
          <PersonTaskSection
            label={t("openSection")}
            emptyLabel={t("openSectionEmpty")}
            items={openItems}
            accent="open"
          />
          <PersonTaskSection
            label={t("overdueSection")}
            emptyLabel={t("overdueSectionEmpty")}
            items={overdueItems}
            accent="overdue"
          />
        </div>
      ) : null}
    </div>
  );
}
