"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Eye, FileUp, Download, Trash2, Paperclip, Star } from "lucide-react";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { AttachmentViewer } from "@/components/attachments/attachment-viewer";
import { AttachmentUploadDialog } from "@/components/attachments/attachment-upload-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, cn } from "@/lib/utils";
import type { AttachmentOrigin } from "@/lib/attachment-origin";

export type { AttachmentLabelOption } from "@/components/attachments/attachment-label-fields";
export {
  AttachmentLabelFields,
  resolveLabelPayload,
} from "@/components/attachments/attachment-label-fields";

export type AttachmentItem = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: { id: string; name: string };
  origin?: AttachmentOrigin;
  labelName?: string | null;
  isImportant?: boolean;
};

type LabelOption = { id: string; name: string };

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPanel({
  matterId,
  taskId,
  clientId,
  matterPlanStepId,
  currentUserId,
  canDeleteAll = false,
  canUpload = true,
  canMarkImportant = false,
  initialAttachments = [],
  compact = false,
}: {
  matterId?: string;
  taskId?: string;
  clientId?: string;
  matterPlanStepId?: string;
  currentUserId: string;
  canDeleteAll?: boolean;
  canUpload?: boolean;
  canMarkImportant?: boolean;
  initialAttachments?: AttachmentItem[];
  compact?: boolean;
}) {
  const t = useTranslations("attachments");
  const tCommon = useTranslations("common");
  const [attachments, setAttachments] = useState<AttachmentItem[]>(initialAttachments);
  const [labels, setLabels] = useState<LabelOption[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [viewerItem, setViewerItem] = useState<AttachmentItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  const query = new URLSearchParams({
    ...(matterId ? { matterId } : {}),
    ...(taskId ? { taskId } : {}),
    ...(clientId ? { clientId } : {}),
    ...(matterPlanStepId ? { matterPlanStepId, stepOnly: "1" } : {}),
  }).toString();

  useEffect(() => {
    let cancelled = false;
    async function loadLabels() {
      const res = await fetch("/api/attachment-labels");
      const data = await res.json().catch(() => ({}));
      if (cancelled || !res.ok) return;
      setLabels(data.labels ?? []);
    }
    void loadLabels();
    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshAttachments() {
    const res = await fetch(`/api/attachments?${query}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || t("loadListFailed"));
      return;
    }
    const data = await res.json();
    setAttachments(
      (data.attachments ?? []).map(
        (item: AttachmentItem & { createdAt: string | Date }) => ({
          ...item,
          createdAt:
            typeof item.createdAt === "string"
              ? item.createdAt
              : new Date(item.createdAt).toISOString(),
        }),
      ),
    );
    setError("");
  }

  function runUpload(
    file: File,
    labelId: string | null,
    customLabel: string | null,
  ) {
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
          matterPlanStepId,
          labelId,
          customLabel,
        }),
      });

      const prepared = await prepare.json();
      if (!prepare.ok) {
        setError(prepared.error || t("uploadSessionFailed"));
        return;
      }

      const { putAttachmentBytes } = await import("@/lib/browser-upload");
      const uploaded = await putAttachmentBytes({
        attachmentId: prepared.attachment.id,
        uploadUrl: prepared.uploadUrl,
        file,
        mimeType: file.type || "application/octet-stream",
      });

      if (!uploaded.ok) {
        await fetch(`/api/attachments/${prepared.attachment.id}`, {
          method: "DELETE",
        });
        setError(
          uploaded.corsLikely ? t("uploadCorsFailed") : t("uploadFailed"),
        );
        return;
      }

      await refreshAttachments();
    });
  }

  function handleDownload(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/attachments/${id}?mode=download`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t("loadFileFailed"));
        return;
      }
      window.open(data.url || data.downloadUrl, "_blank", "noopener,noreferrer");
    });
  }

  function handleDelete(id: string, fileName: string) {
    confirm({
      title: t("deleteConfirmTitle"),
      message: t("deleteConfirmMessage", { name: fileName }),
      confirmLabel: tCommon("delete"),
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const res = await fetch(`/api/attachments/${id}`, { method: "DELETE" });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error || t("deleteFailed"));
            return;
          }
          await refreshAttachments();
        });
      },
    });
  }

  function handleToggleImportant(item: AttachmentItem) {
    if (!canMarkImportant) return;
    startTransition(async () => {
      const res = await fetch(`/api/attachments/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isImportant: !item.isImportant }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("updateImportantFailed"));
        return;
      }
      setAttachments((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? { ...row, isImportant: Boolean(data.isImportant ?? !item.isImportant) }
            : row,
        ),
      );
    });
  }

  const uploadControl = canUpload ? (
    <label className="inline-flex cursor-pointer">
      <input
        type="file"
        className="hidden"
        disabled={isPending}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            setError("");
            setPendingFile(file);
          }
          e.target.value = "";
        }}
      />
      <span
        className={cn(
          "interactive-press inline-flex items-center gap-2 rounded-[5px] bg-primary font-medium text-white hover:bg-primary-hover",
          compact ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm",
        )}
      >
        <FileUp className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {t("upload")}
      </span>
    </label>
  ) : null;

  const list = (
    <div className={cn("space-y-2", compact ? "space-y-2" : "space-y-3")}>
      {error && (
        <p className="rounded-[5px] bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {attachments.length === 0 ? (
        <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          {t("empty")}
        </p>
      ) : (
        attachments.map((item) => {
          const canDelete = canDeleteAll || item.uploadedBy.id === currentUserId;
          return (
            <div
              key={item.id}
              className={cn(
                "flex items-start justify-between gap-3",
                compact
                  ? cn(
                      "border-b border-border/60 py-2.5 last:border-b-0",
                      item.isImportant && "attachment-important",
                    )
                  : cn(
                      "rounded-[5px] border p-3",
                      item.isImportant
                        ? "attachment-important border-primary/30"
                        : "border-border bg-surface/80",
                    ),
              )}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  setViewerItem(item);
                }}
                className="interactive-press min-w-0 flex-1 rounded-md text-left hover:[filter:none] active:[filter:none]"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  {item.isImportant ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-white">
                      <Star className="h-3 w-3 fill-current" />
                      {t("important")}
                    </span>
                  ) : null}
                  <p
                    className={cn(
                      "truncate font-medium text-primary hover:underline",
                      compact ? "text-xs" : "text-sm",
                    )}
                  >
                    {item.fileName}
                  </p>
                  {item.labelName ? (
                    <span className="rounded-full bg-primary-muted px-2 py-0.5 text-[11px] font-medium text-primary">
                      {item.labelName}
                    </span>
                  ) : null}
                </div>
                {compact ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {item.uploadedBy.name}
                    {item.origin?.kind === "comment" ? ` · ${t("commentOrigin")}` : ""}
                    {" · "}
                    {formatBytes(item.sizeBytes)}
                  </p>
                ) : (
                  <div className="mt-2 space-y-1 border-t border-border/80 pt-2 text-xs text-muted-foreground">
                    <p>
                      <span className="font-medium text-muted-foreground">{t("uploadedBy")}:</span>{" "}
                      {item.uploadedBy.name}
                    </p>
                    <p>
                      <span className="font-medium text-muted-foreground">{t("source")}:</span>{" "}
                      {item.origin?.label ?? t("defaultSource")}
                      {item.origin?.matterCode ? ` (${item.origin.matterCode})` : ""}
                    </p>
                    <p>
                      <span className="font-medium text-muted-foreground">{t("date")}:</span>{" "}
                      {formatDateTime(item.createdAt)}
                      {" · "}
                      {formatBytes(item.sizeBytes)}
                    </p>
                  </div>
                )}
              </button>
              <div className="flex shrink-0 gap-1">
                {canMarkImportant ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleToggleImportant(item)}
                    className={cn(
                      "hover:bg-primary-muted hover:text-primary hover:[filter:none] active:[filter:none]",
                      item.isImportant && "text-primary",
                    )}
                    aria-label={
                      item.isImportant ? t("unmarkImportant") : t("markImportant")
                    }
                    title={item.isImportant ? t("unmarkImportant") : t("markImportant")}
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        item.isImportant && "fill-current",
                      )}
                    />
                  </Button>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setViewerItem(item);
                  }}
                  className="hover:bg-primary-muted hover:text-primary hover:[filter:none] active:[filter:none]"
                  aria-label={tCommon("viewFile")}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleDownload(item.id)}
                  className="hover:bg-primary-muted hover:text-primary hover:[filter:none] active:[filter:none]"
                  aria-label={tCommon("download")}
                >
                  <Download className="h-4 w-4" />
                </Button>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleDelete(item.id, item.fileName)}
                    className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 hover:[filter:none] active:[filter:none]"
                    aria-label={t("delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );

  const viewer = (
    <AttachmentViewer
      attachment={viewerItem}
      open={!!viewerItem}
      onClose={() => setViewerItem(null)}
    />
  );

  const uploadDialog = (
    <AttachmentUploadDialog
      open={!!pendingFile}
      file={pendingFile}
      labels={labels}
      onCancel={() => setPendingFile(null)}
      onConfirm={({ labelId, customLabel }) => {
        const file = pendingFile;
        setPendingFile(null);
        if (file) runUpload(file, labelId, customLabel);
      }}
    />
  );

  if (compact) {
    return (
      <>
        {dialog}
        {uploadDialog}
        {viewer}
        <div className="min-w-0 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" />
              {t("title")}
              {attachments.length > 0 ? ` (${attachments.length})` : ""}
            </p>
            {uploadControl}
          </div>
          {list}
        </div>
      </>
    );
  }

  return (
    <>
      {dialog}
      {uploadDialog}
      {viewer}
      <Card className="rounded-[5px]">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5 text-primary" />
            {t("attachedTitle")}
          </CardTitle>
          {uploadControl}
        </CardHeader>
        <CardContent>{list}</CardContent>
      </Card>
    </>
  );
}
