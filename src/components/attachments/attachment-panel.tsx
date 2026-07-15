"use client";

import { useState, useTransition } from "react";
import { FileUp, Download, Trash2, Paperclip } from "lucide-react";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";

export type AttachmentItem = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { id: string; name: string };
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPanel({
  matterId,
  taskId,
  clientId,
  currentUserId,
  canDeleteAll = false,
  initialAttachments = [],
}: {
  matterId?: string;
  taskId?: string;
  clientId?: string;
  currentUserId: string;
  canDeleteAll?: boolean;
  initialAttachments?: AttachmentItem[];
}) {
  const [attachments, setAttachments] = useState<AttachmentItem[]>(initialAttachments);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  const query = new URLSearchParams({
    ...(matterId ? { matterId } : {}),
    ...(taskId ? { taskId } : {}),
    ...(clientId ? { clientId } : {}),
  }).toString();

  async function refreshAttachments() {
    const res = await fetch(`/api/attachments?${query}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Không tải được danh sách file");
      return;
    }
    const data = await res.json();
    setAttachments(data.attachments ?? []);
    setError("");
  }

  function handleUpload(file: File) {
    setError("");
    confirm({
      title: "Xác nhận tải lên",
      message: `Bạn có chắc muốn tải lên tài liệu "${file.name}"?`,
      confirmLabel: "Tải lên",
      onConfirm: () => {
        startTransition(async () => {
          const prepare = await fetch("/api/attachments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
              sizeBytes: file.size,
              matterId,
              taskId,
              clientId,
            }),
          });

          const prepared = await prepare.json();
          if (!prepare.ok) {
            setError(prepared.error || "Không thể tạo phiên upload");
            return;
          }

          const upload = await fetch(prepared.uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": file.type || "application/octet-stream" },
            body: file,
          });

          if (!upload.ok) {
            await fetch(`/api/attachments/${prepared.attachment.id}`, { method: "DELETE" });
            setError("Upload lên kho lưu trữ thất bại");
            return;
          }

          await refreshAttachments();
        });
      },
    });
  }

  function handleDownload(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/attachments/${id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Không tải được file");
        return;
      }
      window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
    });
  }

  function handleDelete(id: string, fileName: string) {
    confirm({
      title: "Xác nhận xóa tài liệu",
      message: `Bạn có chắc muốn xóa tài liệu "${fileName}"?`,
      confirmLabel: "Xóa",
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error || "Không xóa được file");
            return;
          }
          await refreshAttachments();
        });
      },
    });
  }

  return (
    <>
      {dialog}
    <Card className="rounded-[5px]">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="h-5 w-5 text-primary" />
          Tài liệu đính kèm
        </CardTitle>
        <label className="inline-flex cursor-pointer">
          <input
            type="file"
            className="hidden"
            disabled={isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
          <span className="interactive-press inline-flex h-9 items-center gap-2 rounded-[5px] bg-primary px-3 text-sm font-medium text-white hover:bg-primary-hover">
            <FileUp className="h-4 w-4" />
            Tải lên
          </span>
        </label>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <p className="rounded-[5px] bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}
        {attachments.length === 0 ? (
          <p className="text-sm text-slate-500">Chưa có tài liệu nào.</p>
        ) : (
          attachments.map((item) => {
            const canDelete = canDeleteAll || item.uploadedBy.id === currentUserId;
            return (
              <div
                key={item.id}
                className="flex items-start justify-between gap-3 rounded-[5px] border border-border p-3"
              >
                <div>
                  <p className="font-medium">{item.fileName}</p>
                  <p className="text-sm text-slate-500">
                    {formatBytes(item.sizeBytes)} • {item.uploadedBy.name} •{" "}
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleDownload(item.id)}
                    className="hover:bg-slate-100 hover:text-primary"
                    aria-label="Tải xuống"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleDelete(item.id, item.fileName)}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      aria-label="Xóa tài liệu"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
