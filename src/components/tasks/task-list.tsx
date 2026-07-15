"use client";

import { useTransition } from "react";
import { updateTaskStatusAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Badge, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/constants";
import type { Task, User, Matter } from "@prisma/client";

type TaskWithRelations = Task & {
  assignee: User;
  createdBy: User;
  matter: Matter | null;
};

export function TaskList({
  tasks,
  currentUserId,
  canManage,
}: {
  tasks: TaskWithRelations[];
  currentUserId: string;
  canManage: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleStatusChange(id: string, status: string, title: string) {
    confirm({
      title: "Xác nhận cập nhật trạng thái",
      message: `Bạn có chắc muốn đổi trạng thái công việc "${title}" thành "${TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS]}"?`,
      confirmLabel: "Cập nhật",
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
          <CardTitle>Danh sách công việc</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có công việc nào.</p>
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
                <div key={task.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium">{task.title}</p>
                      {task.description && (
                        <p className="mt-1 text-sm text-slate-500">{task.description}</p>
                      )}
                      <p className="mt-2 text-sm text-slate-500">
                        Giao cho: {task.assignee.name}
                        {task.matter ? ` • ${task.matter.code}` : ""}
                      </p>
                      {task.dueDate && (
                        <p className={`text-sm ${isOverdue ? "text-red-600" : "text-slate-500"}`}>
                          Hạn: {formatDate(task.dueDate)}
                          {isOverdue ? " (Quá hạn)" : ""}
                        </p>
                      )}
                    </div>
                    <Badge variant={priorityVariant[task.priority]} className="w-fit shrink-0">
                      {TASK_PRIORITY_LABELS[task.priority]}
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
                        {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </Select>
                    ) : (
                      <Badge variant="info">{TASK_STATUS_LABELS[task.status]}</Badge>
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
