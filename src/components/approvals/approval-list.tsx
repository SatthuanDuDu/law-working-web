"use client";

import { useState, useTransition } from "react";
import { approveDailyLogAction, rejectDailyLogAction } from "@/lib/actions";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatMinutes } from "@/lib/utils";

type PendingLog = {
  id: string;
  date: string | Date;
  description: string;
  minutes: number;
  isBillable: boolean;
  user: { name: string };
  matter: { code: string } | null;
  workType: { name: string } | null;
};

export function ApprovalList({ logs }: { logs: PendingLog[] }) {
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function handleApprove(id: string, description: string) {
    setError("");
    confirm({
      title: "Xác nhận duyệt",
      message: `Bạn có chắc muốn duyệt timesheet "${description}"?`,
      confirmLabel: "Duyệt",
      onConfirm: () => {
        startTransition(async () => {
          const result = await approveDailyLogAction(id);
          if (result.error) setError(result.error);
        });
      },
    });
  }

  function handleReject(id: string) {
    setError("");
    const formData = new FormData();
    formData.set("rejectionNote", note);
    confirm({
      title: "Xác nhận từ chối",
      message: "Bạn có chắc muốn từ chối timesheet này?",
      confirmLabel: "Từ chối",
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const result = await rejectDailyLogAction(id, formData);
          if (result.error) {
            setError(result.error);
            return;
          }
          setRejectingId(null);
          setNote("");
        });
      },
    });
  }

  return (
    <>
      {dialog}
      <Card>
        <CardHeader>
          <CardTitle>Timesheet chờ duyệt</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
          )}
          {logs.length === 0 ? (
            <p className="text-sm text-slate-500">Không có bản ghi nào chờ duyệt.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{log.description}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(log.date)} • {log.user.name} • {formatMinutes(log.minutes)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {log.workType?.name ?? "Không phân loại"}
                      {log.matter ? ` • ${log.matter.code}` : ""}
                      {log.isBillable ? " • Tính phí" : " • Không tính phí"}
                    </p>
                  </div>
                  <Badge variant="warning">Chờ duyệt</Badge>
                </div>

                {rejectingId === log.id ? (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      rows={3}
                      placeholder="Lý do từ chối"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isPending}
                        onClick={() => handleReject(log.id)}
                      >
                        Xác nhận từ chối
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isPending}
                        onClick={() => {
                          setRejectingId(null);
                          setNote("");
                        }}
                      >
                        Hủy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleApprove(log.id, log.description)}
                    >
                      Duyệt
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() => setRejectingId(log.id)}
                    >
                      Từ chối
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </>
  );
}
