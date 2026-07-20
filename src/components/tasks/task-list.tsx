"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateTaskStatusAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { Badge, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui/card";
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
}: {
  tasks: TaskListItem[];
  currentUserId: string;
  canManage: boolean;
}) {
  const t = useTranslations("tasks");
  const { taskStatus, taskPriority } = useLabelMaps();
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

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

  return (
    <>
      {dialog}
      <Card>
        <CardHeader>
          <CardTitle>{t("listTitle")}</CardTitle>
        </CardHeader>
        <CardContent className={cn("space-y-3", isPending && "pointer-events-none opacity-60")}>
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            tasks.map((task) => {
              const canUpdate =
                canManage ||
                task.assigneeId === currentUserId ||
                task.createdById === currentUserId;
              const isOverdue =
                task.dueDate &&
                new Date(task.dueDate) < new Date() &&
                !["DONE", "CANCELLED"].includes(task.status);

              return (
                <div key={task.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{task.title}</p>
                      {task.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                      )}
                      <p className="mt-2 text-sm text-muted-foreground">
                        {t("assignedTo", {
                          name: `${task.assignee.name}${task.matter ? ` • ${task.matter.code}` : ""}`,
                        })}
                      </p>
                      {task.dueDate && (
                        <p className={`text-sm ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
                          {t("dueLabel", { date: formatDate(task.dueDate) })}
                          {isOverdue ? t("overdueSuffix") : ""}
                        </p>
                      )}
                    </div>
                    <Badge variant={priorityVariant[task.priority]} className="w-fit shrink-0">
                      {taskPriority[task.priority]}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center gap-3">
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
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    ) : (
                      <Badge variant="info">{taskStatus[task.status]}</Badge>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </>
  );
}
