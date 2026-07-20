"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, Search, X } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateRangeFilter } from "@/components/ui/date-range-filter";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { cn, formatDateTime } from "@/lib/utils";
import { createPortal } from "react-dom";
import type { AuditAction } from "@prisma/client";

export type AuditLogListItem = {
  id: string;
  action: AuditAction;
  entityType: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  href: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    avatarKey: string | null;
  } | null;
};

type AuditActorOption = {
  id: string;
  name: string;
};

const ACTION_BADGE: Record<
  AuditAction,
  "default" | "success" | "warning" | "danger" | "info"
> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "danger",
  LOGIN: "warning",
  LOGOUT: "default",
};

function startOfDay(value: string) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value: string) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function AuditDetailPanel({
  log,
  open,
  onClose,
  actionLabel,
  entityLabel,
}: {
  log: AuditLogListItem;
  open: boolean;
  onClose: () => void;
  actionLabel: string;
  entityLabel: string;
}) {
  const t = useTranslations("admin.auditLogs");
  const tAdmin = useTranslations("admin");
  const tCommon = useTranslations("common");
  const { mounted, active } = useOverlayAnimation(open);

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex h-dvh w-dvw items-stretch justify-end p-0 sm:p-6 sm:pl-0">
      <button
        type="button"
        aria-label={t("closeDetailAria")}
        className={cn(
          "overlay-backdrop absolute inset-0 bg-black/40 backdrop-blur-[1px]",
          active && "is-active",
        )}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-detail-title"
        className={cn(
          "overlay-panel relative z-10 flex h-full w-full max-w-lg flex-col overflow-hidden border-0 bg-surface shadow-[var(--shadow-overlay)] sm:rounded-lg sm:border sm:border-border",
          active && "is-active",
        )}
      >
        <div className="flex items-start justify-between border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0 pr-3">
            <h2
              id="audit-detail-title"
              className="text-lg font-semibold text-primary"
            >
              {t("detailTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatDateTime(log.createdAt)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label={tCommon("close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("colUser")}
              </dt>
              <dd className="mt-1.5 flex items-center gap-2.5">
                {log.user ? (
                  <>
                    <UserAvatar
                      userId={log.user.id}
                      name={log.user.name}
                      avatarKey={log.user.avatarKey}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{log.user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {log.user.email}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-sm font-medium">{tAdmin("systemUser")}</p>
                )}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("colAction")}
              </dt>
              <dd className="mt-1.5">
                <Badge variant={ACTION_BADGE[log.action]}>{actionLabel}</Badge>
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("colEntity")}
              </dt>
              <dd className="mt-1.5 text-sm font-medium">{entityLabel}</dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("entityId")}
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-foreground">
                {log.entityId ?? "—"}
              </dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("colDetails")}
              </dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
                {log.details ?? "—"}
              </dd>
            </div>
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("logId")}
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {log.id}
              </dd>
            </div>
          </dl>
        </div>

        {log.href ? (
          <div className="border-t border-border px-5 py-4 sm:px-6">
            <Button asChild className="w-full">
              <Link href={log.href}>
                <ExternalLink className="h-3.5 w-3.5" />
                {t("openRelated")}
              </Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}

export function AuditLogsList({
  logs,
  actors,
}: {
  logs: AuditLogListItem[];
  actors: AuditActorOption[];
}) {
  const t = useTranslations("admin.auditLogs");
  const tActions = useTranslations("admin.auditActions");
  const tEntities = useTranslations("admin.auditEntities");
  const tAdmin = useTranslations("admin");
  const tCommon = useTranslations("common");
  const locale = useLocale();

  const [query, setQuery] = useState("");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<AuditAction | "all">("all");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<AuditLogListItem | null>(null);

  const entityTypes = useMemo(() => {
    return [...new Set(logs.map((log) => log.entityType))].sort((a, b) =>
      a.localeCompare(b, locale),
    );
  }, [logs, locale]);

  const actionLabels = useMemo(
    () =>
      ({
        CREATE: tActions("CREATE"),
        UPDATE: tActions("UPDATE"),
        DELETE: tActions("DELETE"),
        LOGIN: tActions("LOGIN"),
        LOGOUT: tActions("LOGOUT"),
      }) as Record<AuditAction, string>,
    [tActions],
  );

  const entityLabels = useMemo(
    () =>
      ({
        User: tEntities("User"),
        Client: tEntities("Client"),
        Matter: tEntities("Matter"),
        MatterPlanStep: tEntities("MatterPlanStep"),
        Task: tEntities("Task"),
        Comment: tEntities("Comment"),
        Attachment: tEntities("Attachment"),
        WorkType: tEntities("WorkType"),
        Department: tEntities("Department"),
        AttachmentLabel: tEntities("AttachmentLabel"),
        System: tEntities("System"),
      }) as Record<string, string>,
    [tEntities],
  );

  function entityLabel(type: string) {
    return entityLabels[type] ?? type;
  }

  const visibleLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const from = dateFrom ? startOfDay(dateFrom) : null;
    const to = dateTo ? endOfDay(dateTo) : null;

    return logs.filter((log) => {
      if (userFilter !== "all") {
        if (userFilter === "system") {
          if (log.user) return false;
        } else if (log.user?.id !== userFilter) {
          return false;
        }
      }
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      if (entityFilter !== "all" && log.entityType !== entityFilter) return false;

      const created = new Date(log.createdAt);
      if (from && created < from) return false;
      if (to && created > to) return false;

      if (!normalized) return true;
      const haystack = [
        log.user?.name ?? "",
        log.user?.email ?? "",
        actionLabels[log.action],
        log.entityType,
        entityLabels[log.entityType] ?? log.entityType,
        log.entityId ?? "",
        log.details ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [
    logs,
    query,
    userFilter,
    actionFilter,
    entityFilter,
    dateFrom,
    dateTo,
    actionLabels,
    entityLabels,
  ]);

  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    let today = 0;
    let deletes = 0;
    const actorIds = new Set<string>();
    for (const log of visibleLogs) {
      if (new Date(log.createdAt) >= todayStart) today += 1;
      if (log.action === "DELETE") deletes += 1;
      if (log.user?.id) actorIds.add(log.user.id);
    }
    return {
      total: visibleLogs.length,
      today,
      deletes,
      actors: actorIds.size,
    };
  }, [visibleLogs]);

  return (
    <>
      <Card className="rounded-[5px]">
        <CardHeader className="gap-3 space-y-0 pb-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <div>
              <CardTitle className="text-base sm:text-lg">{t("listTitle")}</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {t("listHint")}
              </p>
            </div>
            <p className="text-xs text-muted-foreground sm:text-sm">
              {visibleLogs.length === logs.length
                ? t("itemCount", { count: logs.length })
                : t("itemCountFiltered", {
                    visible: visibleLogs.length,
                    total: logs.length,
                  })}
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-md bg-primary-muted/40 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-primary/80">
                {t("statVisible")}
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-primary">
                {stats.total}
              </p>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("statToday")}
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {stats.today}
              </p>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("statDeletes")}
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {stats.deletes}
              </p>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {t("statActors")}
              </p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {stats.actors}
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative min-w-0 sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="h-9 pl-9"
                aria-label={t("searchLabel")}
              />
            </div>
            <Select
              value={userFilter}
              onChange={(event) => setUserFilter(event.target.value)}
              className="h-9"
              aria-label={t("filterUser")}
            >
              <option value="all">{t("allUsers")}</option>
              <option value="system">{tAdmin("systemUser")}</option>
              {actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name}
                </option>
              ))}
            </Select>
            <Select
              value={actionFilter}
              onChange={(event) =>
                setActionFilter(event.target.value as AuditAction | "all")
              }
              className="h-9"
              aria-label={t("filterAction")}
            >
              <option value="all">{t("allActions")}</option>
              {(Object.keys(actionLabels) as AuditAction[]).map((action) => (
                <option key={action} value={action}>
                  {actionLabels[action]}
                </option>
              ))}
            </Select>
            <Select
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value)}
              className="h-9"
              aria-label={t("filterEntity")}
            >
              <option value="all">{t("allEntities")}</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {entityLabel(type)}
                </option>
              ))}
            </Select>
            {/* Single time-range filter (start + end inside one picker) */}
            <DateRangeFilter
              dateFrom={dateFrom}
              dateTo={dateTo}
              onChange={({ dateFrom: nextFrom, dateTo: nextTo }) => {
                setDateFrom(nextFrom);
                setDateTo(nextTo);
              }}
            />
          </div>
        </CardHeader>

        <CardContent className="divide-y divide-border/70 p-0">
          {logs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
              {t("emptyHint")}
            </p>
          ) : visibleLogs.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-6">
              {t("noFilterMatch")}
            </p>
          ) : (
            visibleLogs.map((log) => (
              <button
                key={log.id}
                type="button"
                onClick={() => setSelected(log)}
                className={cn(
                  "interactive-press flex w-full flex-col gap-2 px-4 py-3 text-left sm:flex-row sm:items-center sm:gap-4 sm:px-6",
                  "hover:bg-muted/40",
                  log.action === "DELETE" && "bg-red-50/40 dark:bg-red-950/10",
                )}
              >
                <div className="flex min-w-0 flex-1 items-start gap-2.5 sm:items-center">
                  {log.user ? (
                    <UserAvatar
                      userId={log.user.id}
                      name={log.user.name}
                      avatarKey={log.user.avatarKey}
                      size="sm"
                    />
                  ) : (
                    <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                      SYS
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-foreground">
                        {log.user?.name ?? tAdmin("systemUser")}
                      </span>
                      <Badge
                        variant={ACTION_BADGE[log.action]}
                        className="px-2 py-0 text-[10px]"
                      >
                        {actionLabels[log.action]}
                      </Badge>
                      <span className="rounded-full bg-muted px-2 py-0 text-[10px] font-medium text-muted-foreground">
                        {entityLabel(log.entityType)}
                      </span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {log.details ?? "—"}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-center">
                  <time className="text-xs tabular-nums text-muted-foreground">
                    {formatDateTime(log.createdAt)}
                  </time>
                  <span className="text-[11px] font-medium text-primary">
                    {tCommon("viewDetail")}
                  </span>
                </div>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      {selected ? (
        <AuditDetailPanel
          log={selected}
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          actionLabel={actionLabels[selected.action]}
          entityLabel={entityLabel(selected.entityType)}
        />
      ) : null}
    </>
  );
}
