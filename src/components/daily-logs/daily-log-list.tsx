"use client";

import { useTransition } from "react";
import { deleteDailyLogAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatMinutes } from "@/lib/utils";
import { DAILY_LOG_STATUS_LABELS } from "@/lib/constants";
import type { DailyLog, User, Matter, Client, WorkType } from "@prisma/client";

type LogWithRelations = DailyLog & {
  user: User;
  matter: Matter | null;
  client: Client | null;
  workType: WorkType | null;
};

export function DailyLogList({
  logs,
  canEditAll,
  currentUserId,
  onEdit,
}: {
  logs: LogWithRelations[];
  canEditAll: boolean;
  currentUserId: string;
  onEdit?: (log: LogWithRelations) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleDelete(id: string) {
    confirm({
      title: "Xác nhận xóa",
      message: "Bạn có chắc muốn xóa bản ghi công việc này?",
      confirmLabel: "Xóa",
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          await deleteDailyLogAction(id);
        });
      },
    });
  }

  return (
    <>
      {dialog}
      <Card>
        <CardHeader>
          <CardTitle>Lịch sử công việc</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">Chưa có bản ghi nào.</p>
          ) : (
            logs.map((log) => {
              const canManage = canEditAll || log.userId === currentUserId;
              return (
                <div key={log.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{log.description}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatDate(log.date)} • {log.user.name}
                      </p>
                      <p className="text-sm text-slate-500">
                        {log.workType?.name ?? "Không phân loại"}
                        {log.matter ? ` • ${log.matter.code}` : ""}
                        {log.client ? ` • ${log.client.name}` : ""}
                      </p>
                    </div>
                    <Badge
                      variant={
                        log.status === "COMPLETED"
                          ? "success"
                          : log.status === "REJECTED"
                            ? "danger"
                            : "warning"
                      }
                    >
                      {DAILY_LOG_STATUS_LABELS[log.status]}
                    </Badge>
                  </div>
                  {log.rejectionNote && (
                    <p className="mt-2 text-sm text-red-600">
                      Lý do từ chối: {log.rejectionNote}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-sm">
                      {formatMinutes(log.minutes)}
                      <span className="ml-2 text-slate-500">
                        {log.isBillable ? "Tính phí" : "Không tính phí"}
                      </span>
                    </p>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => onEdit?.(log)}
                        >
                          Sửa
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleDelete(log.id)}
                        >
                          Xóa
                        </Button>
                      </div>
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
