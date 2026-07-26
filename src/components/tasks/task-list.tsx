"use client";

import { useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { updateTaskStatusAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useListViewMode } from "@/hooks/use-list-view-mode";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { Badge, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui/card";
import { ListViewToggle } from "@/components/ui/list-view-toggle";
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

export function TaskList({
  tasks,
  currentUserId,
  canManage,
  actions,
}: {
  tasks: TaskListItem[];
  currentUserId: string;
  canManage: boolean;
  actions?: ReactNode;
}) {
  const t = useTranslations("tasks");
  const { taskStatus, taskPriority } = useLabelMaps();
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();
  const { mode, setMode } = useListViewMode("tasks");

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
          "rounded-lg border border-border p-4",
          compact && "flex h-full flex-col",
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

  return (
    <>
      {dialog}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>{t("listTitle")}</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <ListViewToggle mode={mode} onChange={setMode} />
          </div>
        </CardHeader>
        <CardContent className={cn(isPending && "pointer-events-none opacity-60")}>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : mode === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tasks.map((task) => renderTaskCard(task, true))}
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => renderTaskCard(task, false))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
