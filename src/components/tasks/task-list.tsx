"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  endOfDay,
  endOfWeek,
  isWithinInterval,
  startOfDay,
  startOfWeek,
} from "date-fns";
import { AlertTriangle, FileSpreadsheet, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { updateTaskStatusAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useListViewMode } from "@/hooks/use-list-view-mode";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { Badge, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FilterSelect } from "@/components/ui/filter-select";
import { ListViewToggle } from "@/components/ui/list-view-toggle";
import { downloadExcel } from "@/lib/export-excel";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { TaskPriority, TaskStatus } from "@prisma/client";

type TaskListItem = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: Date | null;
  assigneeId: string;
  createdById: string;
  assignee: { id: string; name: string };
  matter: { id: string; code: string; title: string } | null;
};

type DueFilter = "all" | "overdue" | "today" | "thisWeek" | "none";

type TaskFilterState = {
  query: string;
  status: TaskStatus | "";
  priority: TaskPriority | "";
  assigneeId: string;
  due: DueFilter;
};

const DEFAULT_FILTERS: TaskFilterState = {
  query: "",
  status: "",
  priority: "",
  assigneeId: "",
  due: "all",
};

const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE", "CANCELLED"];
const TASK_PRIORITIES: TaskPriority[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];

function matchesDueFilter(task: TaskListItem, due: DueFilter, now: Date) {
  if (due === "all") return true;
  if (due === "none") return !task.dueDate;

  if (!task.dueDate) return false;
  const dueDate = new Date(task.dueDate);

  if (due === "overdue") {
    return (
      dueDate < startOfDay(now) &&
      !["DONE", "CANCELLED"].includes(task.status)
    );
  }
  if (due === "today") {
    return isWithinInterval(dueDate, {
      start: startOfDay(now),
      end: endOfDay(now),
    });
  }
  if (due === "thisWeek") {
    return isWithinInterval(dueDate, {
      start: startOfWeek(now, { weekStartsOn: 1 }),
      end: endOfWeek(now, { weekStartsOn: 1 }),
    });
  }
  return true;
}

function applyTaskFilters(tasks: TaskListItem[], filters: TaskFilterState) {
  const normalized = filters.query.trim().toLowerCase();
  const now = new Date();

  return tasks.filter((task) => {
    if (normalized) {
      const haystack = [
        task.title,
        task.description,
        task.assignee.name,
        task.matter?.code,
        task.matter?.title,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(normalized)) return false;
    }
    if (filters.status && task.status !== filters.status) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.assigneeId && task.assigneeId !== filters.assigneeId) {
      return false;
    }
    if (!matchesDueFilter(task, filters.due, now)) return false;
    return true;
  });
}

export function TaskList({
  tasks,
  totalCount,
  currentUserId,
  canManage,
  actions,
}: {
  tasks: TaskListItem[];
  /** True DB count — may exceed tasks.length when the list-limit cap truncated the fetch. */
  totalCount: number;
  currentUserId: string;
  canManage: boolean;
  actions?: ReactNode;
}) {
  const t = useTranslations("tasks");
  const tPages = useTranslations("pages.tasks");
  const tCommon = useTranslations("common");
  const tFilters = useTranslations("filters");
  const { taskStatus, taskPriority } = useLabelMaps();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();
  const { mode, setMode } = useListViewMode("tasks");
  const [filters, setFilters] = useState<TaskFilterState>(DEFAULT_FILTERS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<TaskStatus>("TODO");

  function canUpdateTask(task: TaskListItem) {
    return (
      canManage ||
      task.assigneeId === currentUserId ||
      task.createdById === currentUserId
    );
  }

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasks) {
      map.set(task.assignee.id, task.assignee.name);
    }
    return [...map.entries()]
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label, "vi"));
  }, [tasks]);

  const visibleTasks = useMemo(
    () => applyTaskFilters(tasks, filters),
    [tasks, filters],
  );

  const hasActiveFilters =
    Boolean(filters.query) ||
    Boolean(filters.status) ||
    Boolean(filters.priority) ||
    Boolean(filters.assigneeId) ||
    filters.due !== "all";

  const selectableVisibleIds = useMemo(
    () => visibleTasks.filter(canUpdateTask).map((task) => task.id),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- canUpdateTask is stable per render inputs (canManage/currentUserId)
    [visibleTasks, canManage, currentUserId],
  );

  /** Selection intersected with the currently visible rows — search/filter changes drop stale ids without a syncing effect. */
  const activeSelectedIds = useMemo(() => {
    const visibleIdSet = new Set(visibleTasks.map((task) => task.id));
    return new Set([...selectedIds].filter((id) => visibleIdSet.has(id)));
  }, [selectedIds, visibleTasks]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible() {
    setSelectedIds((prev) => {
      const allSelected = selectableVisibleIds.every((id) => prev.has(id));
      if (allSelected) return new Set();
      return new Set(selectableVisibleIds);
    });
  }

  function applyBulkStatus() {
    const ids = [...activeSelectedIds];
    if (ids.length === 0) return;
    const statusLabel = taskStatus[bulkStatus];
    confirm({
      title: t("confirmStatusTitle"),
      message: t("confirmBulkStatusMessage", { count: ids.length, status: statusLabel }),
      confirmLabel: t("updateStatus"),
      onConfirm: () => {
        startTransition(async () => {
          await Promise.all(ids.map((id) => updateTaskStatusAction(id, bulkStatus)));
          setSelectedIds(new Set());
          router.refresh();
        });
      },
    });
  }

  function handleStatusChange(id: string, status: string, title: string) {
    const statusLabel = taskStatus[status as keyof typeof taskStatus];
    confirm({
      title: t("confirmStatusTitle"),
      message: t("confirmStatusMessage", { title, status: statusLabel }),
      confirmLabel: t("updateStatus"),
      onConfirm: () => {
        startTransition(async () => {
          await updateTaskStatusAction(id, status);
        });
      },
    });
  }

  function handleExportExcel() {
    void downloadExcel(
      tPages("title"),
      visibleTasks.map((task) => ({
        [t("titleLabel")]: task.title,
        [t("descriptionLabel")]: task.description ?? "",
        [t("assigneeLabel")]: task.assignee.name,
        [t("matterLabel")]: task.matter
          ? `${task.matter.code} — ${task.matter.title}`
          : "",
        [t("priorityLabel")]: taskPriority[task.priority],
        [t("statusLabel")]: taskStatus[task.status],
        [t("dueDateLabel")]: task.dueDate ? formatDate(task.dueDate) : "",
      })),
      "cong-viec",
    );
  }

  const priorityVariant = {
    LOW: "default",
    MEDIUM: "info",
    HIGH: "warning",
    URGENT: "danger",
  } as const;

  function renderTaskCard(task: TaskListItem, compact: boolean) {
    const canUpdate =
      canManage ||
      task.assigneeId === currentUserId ||
      task.createdById === currentUserId;
    const isOverdue =
      task.dueDate &&
      new Date(task.dueDate) < new Date() &&
      !["DONE", "CANCELLED"].includes(task.status);

    return (
      <div
        key={task.id}
        className={cn(
          compact
            ? "flex h-full flex-col rounded-md border border-border/40 bg-[color-mix(in_oklab,var(--muted)_6%,var(--surface))] p-4"
            : "px-1 py-3.5 first:pt-0 last:pb-0",
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-medium">{task.title}</p>
            {task.description ? (
              <p
                className={cn(
                  "mt-1 text-sm text-muted-foreground",
                  compact && "line-clamp-2",
                )}
              >
                {task.description}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-muted-foreground">
              {t("assignedTo", {
                name: `${task.assignee.name}${task.matter ? ` • ${task.matter.code}` : ""}`,
              })}
            </p>
            {task.dueDate ? (
              <p
                className={`text-sm ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}
              >
                {t("dueLabel", { date: formatDate(task.dueDate) })}
                {isOverdue ? t("overdueSuffix") : ""}
              </p>
            ) : null}
          </div>
          <Badge variant={priorityVariant[task.priority]} className="w-fit shrink-0">
            {taskPriority[task.priority]}
          </Badge>
        </div>
        <div className={cn("mt-3 flex items-center gap-3", compact && "mt-auto pt-3")}>
          {canUpdate ? (
            <Select
              value={task.status}
              disabled={isPending}
              onChange={(e) =>
                handleStatusChange(task.id, e.target.value, task.title)
              }
              className="w-full min-w-0 sm:max-w-xs"
            >
              {Object.entries(taskStatus).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          ) : (
            <Badge variant="info">{taskStatus[task.status]}</Badge>
          )}
        </div>
      </div>
    );
  }

  function renderTableRow(task: TaskListItem) {
    const canUpdate =
      canManage ||
      task.assigneeId === currentUserId ||
      task.createdById === currentUserId;
    const isOverdue =
      task.dueDate &&
      new Date(task.dueDate) < new Date() &&
      !["DONE", "CANCELLED"].includes(task.status);

    return (
      <tr key={task.id} className="interactive-row">
        <td className="w-8 px-3 py-2.5 align-top">
          {canUpdate ? (
            <input
              type="checkbox"
              checked={activeSelectedIds.has(task.id)}
              onChange={() => toggleSelected(task.id)}
              aria-label={task.title}
              className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
            />
          ) : null}
        </td>
        <td className="min-w-[14rem] px-3 py-2.5 align-top">
          <p className="truncate font-medium text-foreground">{task.title}</p>
          {task.matter ? (
            <p className="truncate text-[11px] text-primary/80">{task.matter.code}</p>
          ) : null}
        </td>
        <td className="max-w-[9rem] truncate px-3 py-2.5 align-top text-foreground">
          {task.assignee.name}
        </td>
        <td className="px-3 py-2.5 align-top">
          <Badge variant={priorityVariant[task.priority]}>
            {taskPriority[task.priority]}
          </Badge>
        </td>
        <td
          className={cn(
            "whitespace-nowrap px-3 py-2.5 align-top tabular-nums",
            isOverdue ? "font-medium text-red-600" : "text-muted-foreground",
          )}
        >
          {task.dueDate ? formatDate(task.dueDate) : "—"}
        </td>
        <td className="min-w-[9rem] px-3 py-2.5 align-top">
          {canUpdate ? (
            <Select
              value={task.status}
              disabled={isPending}
              onChange={(e) => handleStatusChange(task.id, e.target.value, task.title)}
              className="h-8 w-full min-w-0 text-xs"
            >
              {Object.entries(taskStatus).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          ) : (
            <Badge variant="info">{taskStatus[task.status]}</Badge>
          )}
        </td>
      </tr>
    );
  }

  function renderTableView() {
    return (
      <div className="overflow-x-auto rounded-md border border-border/50">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="w-8 px-3 py-2.5 font-medium">
                {selectableVisibleIds.length > 0 ? (
                  <input
                    type="checkbox"
                    checked={selectableVisibleIds.every((id) => activeSelectedIds.has(id))}
                    onChange={toggleSelectAllVisible}
                    aria-label={tCommon("selectAll")}
                    className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
                  />
                ) : null}
              </th>
              <th className="px-3 py-2.5 font-medium">{t("titleLabel")}</th>
              <th className="px-3 py-2.5 font-medium">{t("assigneeLabel")}</th>
              <th className="px-3 py-2.5 font-medium">{t("priorityLabel")}</th>
              <th className="px-3 py-2.5 font-medium">{t("dueDateLabel")}</th>
              <th className="px-3 py-2.5 font-medium">{t("statusLabel")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {visibleTasks.map((task) => renderTableRow(task))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
      {dialog}
      <Card solid>
        <CardHeader className="space-y-0 border-b border-border/60 p-3.5 pb-3 sm:p-4 sm:pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm font-semibold sm:text-base">
              {t("listTitle")}
            </CardTitle>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        </CardHeader>
        <CardContent
          className={cn(
            "space-y-3 p-3.5 pt-3 sm:p-4 sm:pt-3",
            isPending && "pointer-events-none opacity-60",
          )}
        >
          {totalCount > tasks.length ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{t("listTruncatedWarning", { shown: tasks.length, total: totalCount })}</p>
            </div>
          ) : null}
          {tasks.length > 0 ? (
            <div className="space-y-2.5 border-b border-border/60 pb-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  value={filters.query}
                  onChange={(event) =>
                    setFilters({ ...filters, query: event.target.value })
                  }
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchPlaceholder")}
                  className="h-10 pl-9"
                />
              </div>
              <div className="flex items-end gap-2 overflow-x-auto pb-0.5">
                <div className="min-w-[8rem] flex-1">
                  <p className="mb-1 truncate text-xs text-muted-foreground">
                    {t("filterStatus")}
                  </p>
                  <FilterSelect
                    value={filters.status}
                    onChange={(status) =>
                      setFilters({
                        ...filters,
                        status: status as TaskStatus | "",
                      })
                    }
                    aria-label={t("filterStatus")}
                    options={[
                      { value: "", label: tCommon("all") },
                      ...TASK_STATUSES.map((status) => ({
                        value: status,
                        label: taskStatus[status],
                      })),
                    ]}
                  />
                </div>
                <div className="min-w-[8rem] flex-1">
                  <p className="mb-1 truncate text-xs text-muted-foreground">
                    {t("filterPriority")}
                  </p>
                  <FilterSelect
                    value={filters.priority}
                    onChange={(priority) =>
                      setFilters({
                        ...filters,
                        priority: priority as TaskPriority | "",
                      })
                    }
                    aria-label={t("filterPriority")}
                    options={[
                      { value: "", label: tCommon("all") },
                      ...TASK_PRIORITIES.map((priority) => ({
                        value: priority,
                        label: taskPriority[priority],
                      })),
                    ]}
                  />
                </div>
                <div className="min-w-[9rem] flex-1">
                  <p className="mb-1 truncate text-xs text-muted-foreground">
                    {t("filterAssignee")}
                  </p>
                  <FilterSelect
                    value={filters.assigneeId}
                    onChange={(assigneeId) =>
                      setFilters({ ...filters, assigneeId })
                    }
                    aria-label={t("filterAssignee")}
                    options={[
                      { value: "", label: tCommon("all") },
                      ...assigneeOptions,
                    ]}
                  />
                </div>
                <div className="min-w-[8.5rem] flex-1">
                  <p className="mb-1 truncate text-xs text-muted-foreground">
                    {t("filterDue")}
                  </p>
                  <FilterSelect
                    value={filters.due}
                    onChange={(due) =>
                      setFilters({ ...filters, due: due as DueFilter })
                    }
                    aria-label={t("filterDue")}
                    options={[
                      { value: "all", label: t("dueAll") },
                      { value: "overdue", label: t("dueOverdue") },
                      { value: "today", label: t("dueToday") },
                      { value: "thisWeek", label: t("dueThisWeek") },
                      { value: "none", label: t("dueNone") },
                    ]}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  tabIndex={hasActiveFilters ? 0 : -1}
                  aria-hidden={!hasActiveFilters}
                  aria-disabled={!hasActiveFilters}
                  aria-label={tFilters("clearFilters")}
                  className={cn(
                    "h-10 shrink-0 text-red-600 transition-[opacity,background-color,color] duration-500 ease-out hover:bg-red-50 hover:text-red-700",
                    hasActiveFilters ? "opacity-100" : "pointer-events-none opacity-0",
                  )}
                  onClick={() => {
                    if (!hasActiveFilters) return;
                    setFilters(DEFAULT_FILTERS);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  {tFilters("clearFilters")}
                </Button>
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={visibleTasks.length === 0}
              onClick={handleExportExcel}
              aria-label={tCommon("exportExcel")}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tCommon("exportExcel")}</span>
            </Button>
            <ListViewToggle mode={mode} onChange={setMode} size="sm" />
          </div>
          {mode === "table" && activeSelectedIds.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary-muted/50 px-3 py-2">
              <span className="text-sm font-medium text-primary">
                {t("selectedCount", { count: activeSelectedIds.size })}
              </span>
              <Select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as TaskStatus)}
                className="h-8 w-auto min-w-0 text-xs"
              >
                {Object.entries(taskStatus).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                size="sm"
                disabled={isPending}
                onClick={applyBulkStatus}
              >
                {t("applyBulkStatus")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto"
              >
                <X className="h-3.5 w-3.5" />
                {tCommon("clearSelection")}
              </Button>
            </div>
          ) : null}
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : visibleTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noFilterMatch")}</p>
          ) : mode === "table" ? (
            renderTableView()
          ) : mode === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleTasks.map((task) => renderTaskCard(task, true))}
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {visibleTasks.map((task) => renderTaskCard(task, false))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
