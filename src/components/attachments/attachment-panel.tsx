"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Eye,
  FileUp,
  Download,
  Trash2,
  Paperclip,
  Star,
  FolderPlus,
  Folder,
  Replace,
  ChevronDown,
  ChevronUp,
  Lock,
} from "lucide-react";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { AttachmentViewer } from "@/components/attachments/attachment-viewer";
import { AttachmentUploadDialog } from "@/components/attachments/attachment-upload-dialog";
import { AttachmentAccessDialog } from "@/components/attachments/attachment-access-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, cn } from "@/lib/utils";
import type { AttachmentOrigin } from "@/lib/attachment-origin";
import type { AttachmentAccessMode } from "@prisma/client";

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
  folderId?: string | null;
  folderName?: string | null;
  isImportant?: boolean;
  version?: number;
  versionGroupId?: string;
  versionCount?: number;
  accessMode?: AttachmentAccessMode;
};

type AttachmentVersionItem = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  version: number;
  isLatest: boolean;
  createdAt: string;
  uploadedBy: { id: string; name: string };
};

type LabelOption = { id: string; name: string };
type FolderItem = { id: string; name: string; attachmentCount: number };

type FolderFilter = "all" | "unfiled" | string;

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
  canManageAccess = false,
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
  /** Lead lawyer / manager: set per-file viewer allow/deny lists. */
  canManageAccess?: boolean;
  initialAttachments?: AttachmentItem[];
  compact?: boolean;
}) {
  const t = useTranslations("attachments");
  const tCommon = useTranslations("common");
  const [attachments, setAttachments] = useState<AttachmentItem[]>(initialAttachments);
  const [labels, setLabels] = useState<LabelOption[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [folderFilter, setFolderFilter] = useState<FolderFilter>("all");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [error, setError] = useState("");
  const [viewerItem, setViewerItem] = useState<AttachmentItem | null>(null);
  const [accessItem, setAccessItem] = useState<AttachmentItem | null>(null);
  const [expandedVersionsId, setExpandedVersionsId] = useState<string | null>(null);
  const [versionsByAttachment, setVersionsByAttachment] = useState<
    Record<string, AttachmentVersionItem[]>
  >({});
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const dropInputRef = useRef<HTMLInputElement>(null);
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    pct: number;
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const { confirm, dialog } = useConfirmDialog();

  function queuePendingFiles(files: File[]) {
    if (files.length === 0) return;
    setError("");
    setPendingFiles(files);
  }

  // Folders apply to any matter attachment (hub, report, plan step). Compact
  // only hides the folder filter bar — upload dialog still offers folder pick.
  const foldersEnabled = Boolean(matterId);
  const showFolderBar = foldersEnabled && !compact;
  // Version replace/history for matter docs (including plan-step main files).
  const canVersion = Boolean(matterId);
  const accessEnabled = Boolean(matterId) && canManageAccess;

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

  const refreshFolders = useCallback(async () => {
    if (!matterId || !foldersEnabled) return;
    const res = await fetch(`/api/matter-folders?matterId=${matterId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || t("folderLoadFailed"));
      return;
    }
    setFolders(data.folders ?? []);
  }, [matterId, foldersEnabled, t]);

  useEffect(() => {
    if (!matterId || !foldersEnabled) return;
    let cancelled = false;
    async function loadFolders() {
      const res = await fetch(`/api/matter-folders?matterId=${matterId}`);
      const data = await res.json().catch(() => ({}));
      if (cancelled || !res.ok) return;
      setFolders(data.folders ?? []);
    }
    void loadFolders();
    return () => {
      cancelled = true;
    };
  }, [matterId, foldersEnabled]);

  async function refreshAttachments(nextFilter: FolderFilter = folderFilter) {
    const params = new URLSearchParams({
      ...(matterId ? { matterId } : {}),
      ...(taskId ? { taskId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(matterPlanStepId ? { matterPlanStepId, stepOnly: "1" } : {}),
    });
    if (foldersEnabled && nextFilter !== "all") {
      params.set("folderId", nextFilter);
    }
    const res = await fetch(`/api/attachments?${params.toString()}`);
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

  function selectFolderFilter(next: FolderFilter) {
    setFolderFilter(next);
    startTransition(async () => {
      await refreshAttachments(next);
    });
  }
  function runUploadBatch(
    files: File[],
    labelId: string | null,
    customLabel: string | null,
    folderId: string | null,
  ) {
    startTransition(async () => {
      setError("");
      setUploadProgress({
        pct: 0,
        current: 1,
        total: files.length,
        fileName: files[0]?.name ?? "",
      });
      let failed = 0;
      try {
        for (let index = 0; index < files.length; index++) {
          const file = files[index]!;
          setUploadProgress({
            pct: Math.round((index / files.length) * 100),
            current: index + 1,
            total: files.length,
            fileName: file.name,
          });

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
              folderId: foldersEnabled ? folderId : null,
            }),
          });

          const prepared = await prepare.json().catch(() => ({}));
          if (!prepare.ok) {
            failed += 1;
            setError(prepared.error || t("uploadSessionFailed"));
            continue;
          }

          const { putAttachmentBytes } = await import("@/lib/browser-upload");
          const uploaded = await putAttachmentBytes({
            attachmentId: prepared.attachment.id,
            uploadUrl: prepared.uploadUrl,
            file,
            mimeType: file.type || "application/octet-stream",
            onProgress: (filePct) => {
              const overall = Math.round(
                ((index + filePct / 100) / files.length) * 100,
              );
              setUploadProgress({
                pct: overall,
                current: index + 1,
                total: files.length,
                fileName: file.name,
              });
            },
          });

          if (!uploaded.ok) {
            await fetch(`/api/attachments/${prepared.attachment.id}`, {
              method: "DELETE",
            });
            failed += 1;
            setError(
              uploaded.corsLikely ? t("uploadCorsFailed") : t("uploadFailed"),
            );
          }
        }

        await refreshAttachments();
        await refreshFolders();
        if (failed > 0 && failed === files.length) {
          // error already set
        } else if (failed > 0) {
          setError(t("uploadPartialFailed", { failed, total: files.length }));
        }
      } finally {
        setUploadProgress(null);
      }
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

  function handleDelete(item: AttachmentItem) {
    const count = item.versionCount ?? 1;
    confirm({
      title:
        count > 1 ? t("deleteAllVersionsConfirmTitle") : t("deleteConfirmTitle"),
      message:
        count > 1
          ? t("deleteAllVersionsConfirmMessage", {
              name: item.fileName,
              count,
            })
          : t("deleteConfirmMessage", { name: item.fileName }),
      confirmLabel: tCommon("delete"),
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const url = canVersion
            ? `/api/attachments/${item.id}?scope=group`
            : `/api/attachments/${item.id}`;
          const res = await fetch(url, { method: "DELETE" });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error || t("deleteFailed"));
            return;
          }
          if (expandedVersionsId === item.id) setExpandedVersionsId(null);
          await refreshAttachments();
          await refreshFolders();
        });
      },
    });
  }

  function handleDeleteVersion(parent: AttachmentItem, version: AttachmentVersionItem) {
    confirm({
      title: t("deleteVersionConfirmTitle"),
      message: t("deleteVersionConfirmMessage", {
        version: version.version,
        name: version.fileName,
      }),
      confirmLabel: tCommon("delete"),
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const res = await fetch(`/api/attachments/${version.id}`, {
            method: "DELETE",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error || t("deleteFailed"));
            return;
          }
          await refreshAttachments();
          await refreshFolders();
          if (expandedVersionsId === parent.id) {
            // Parent id may be gone if we deleted the latest row — resolve via group.
            const listRes = await fetch(
              `/api/attachments?${new URLSearchParams({
                ...(matterId ? { matterId } : {}),
                ...(matterPlanStepId ? { matterPlanStepId, stepOnly: "1" } : {}),
              }).toString()}`,
            );
            const listData = await listRes.json().catch(() => ({}));
            const head = (listData.attachments ?? []).find(
              (row: AttachmentItem) =>
                row.versionGroupId === parent.versionGroupId ||
                row.id === parent.id,
            ) as AttachmentItem | undefined;

            if (!head || (head.versionCount ?? 1) <= 1) {
              setExpandedVersionsId(null);
              setVersionsByAttachment((prev) => {
                const next = { ...prev };
                delete next[parent.id];
                return next;
              });
              return;
            }

            const refreshed = await fetch(`/api/attachments/${head.id}/versions`);
            const payload = await refreshed.json().catch(() => ({}));
            if (refreshed.ok && Array.isArray(payload.versions)) {
              setVersionsByAttachment((prev) => {
                const next = { ...prev };
                delete next[parent.id];
                next[head.id] = payload.versions;
                return next;
              });
              setExpandedVersionsId(head.id);
            } else {
              setExpandedVersionsId(null);
            }
          }
        });
      },
    });
  }

  function openReplacePicker(itemId: string) {
    setReplaceTargetId(itemId);
    replaceInputRef.current?.click();
  }

  function handleReplaceFileSelected(fileList: FileList | null) {
    const file = fileList?.[0];
    const targetId = replaceTargetId;
    setReplaceTargetId(null);
    if (replaceInputRef.current) replaceInputRef.current.value = "";
    if (!file || !targetId) return;

    startTransition(async () => {
      setError("");
      setUploadProgress({
        pct: 0,
        current: 1,
        total: 1,
        fileName: file.name,
      });
      try {
        const prepare = await fetch(`/api/attachments/${targetId}/replace`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type || "application/octet-stream",
            sizeBytes: file.size,
          }),
        });
        const prepared = await prepare.json().catch(() => ({}));
        if (!prepare.ok) {
          setError(prepared.error || t("replaceFailed"));
          return;
        }

        const { putAttachmentBytes } = await import("@/lib/browser-upload");
        const uploaded = await putAttachmentBytes({
          attachmentId: prepared.attachment.id,
          uploadUrl: prepared.uploadUrl,
          file,
          mimeType: file.type || "application/octet-stream",
          onProgress: (pct) => {
            setUploadProgress({
              pct,
              current: 1,
              total: 1,
              fileName: file.name,
            });
          },
        });

        if (!uploaded.ok) {
          await fetch(`/api/attachments/${prepared.attachment.id}`, {
            method: "DELETE",
          });
          setError(
            uploaded.corsLikely ? t("uploadCorsFailed") : t("replaceFailed"),
          );
          return;
        }

        const committed = await fetch(
          `/api/attachments/${prepared.attachment.id}/commit-version`,
          { method: "POST" },
        );
        if (!committed.ok) {
          await fetch(`/api/attachments/${prepared.attachment.id}`, {
            method: "DELETE",
          });
          const data = await committed.json().catch(() => ({}));
          setError(data.error || t("replaceFailed"));
          return;
        }

        setExpandedVersionsId(null);
        await refreshAttachments();
        await refreshFolders();
      } finally {
        setUploadProgress(null);
      }
    });
  }

  async function toggleVersions(item: AttachmentItem) {
    if (expandedVersionsId === item.id) {
      setExpandedVersionsId(null);
      return;
    }
    setExpandedVersionsId(item.id);
    if (versionsByAttachment[item.id]?.length) return;
    startTransition(async () => {
      const res = await fetch(`/api/attachments/${item.id}/versions`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("loadVersionsFailed"));
        setExpandedVersionsId(null);
        return;
      }
      setVersionsByAttachment((prev) => ({
        ...prev,
        [item.id]: data.versions ?? [],
      }));
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

  function handleCreateFolder() {
    if (!matterId || !newFolderName.trim()) return;
    startTransition(async () => {
      const res = await fetch("/api/matter-folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matterId, name: newFolderName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || t("folderCreateFailed"));
        return;
      }
      setNewFolderName("");
      setCreatingFolder(false);
      await refreshFolders();
      if (data.folder?.id) {
        selectFolderFilter(data.folder.id);
      }
    });
  }

  function handleDeleteFolder(folder: FolderItem) {
    confirm({
      title: t("folderDeleteTitle"),
      message: t("folderDeleteMessage", { name: folder.name }),
      confirmLabel: tCommon("delete"),
      variant: "destructive",
      onConfirm: () => {
        startTransition(async () => {
          const res = await fetch(`/api/matter-folders/${folder.id}`, {
            method: "DELETE",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            setError(data.error || t("folderDeleteFailed"));
            return;
          }
          if (folderFilter === folder.id) setFolderFilter("all");
          await refreshFolders();
          await refreshAttachments(
            folderFilter === folder.id ? "all" : folderFilter,
          );
        });
      },
    });
  }

  const uploadControl = canUpload ? (
    <label className="inline-flex cursor-pointer">
      <input
        type="file"
        className="hidden"
        multiple
        disabled={isPending}
        onChange={(e) => {
          queuePendingFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <span
        className={cn(
          "interactive-press inline-flex items-center gap-2 rounded-md bg-primary font-medium text-white hover:bg-primary-hover",
          compact ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm",
        )}
      >
        <FileUp className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
        {t("upload")}
      </span>
    </label>
  ) : null;

  const dropZone = canUpload ? (
    <div
      role="button"
      tabIndex={isPending ? -1 : 0}
      aria-label={t("dragDropHint")}
      onClick={() => {
        if (isPending) return;
        dropInputRef.current?.click();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isPending) return;
        setDragActive(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isPending) return;
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setDragActive(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (isPending) return;
        queuePendingFiles(Array.from(e.dataTransfer.files ?? []));
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!isPending) dropInputRef.current?.click();
        }
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed px-3 text-center transition-colors",
        compact ? "py-3" : "py-5",
        dragActive
          ? "border-primary bg-primary-muted text-primary"
          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:bg-primary-muted/40",
        isPending && "pointer-events-none cursor-default opacity-60",
      )}
    >
      <input
        ref={dropInputRef}
        type="file"
        className="hidden"
        multiple
        disabled={isPending}
        onChange={(e) => {
          queuePendingFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      <FileUp className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
      <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
        {t("dragDropHint")}
      </p>
    </div>
  ) : null;

  const progressBar = uploadProgress ? (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">
          {t("uploading")}
          {uploadProgress.fileName ? ` · ${uploadProgress.fileName}` : ""}
          {uploadProgress.total > 1
            ? ` (${uploadProgress.current}/${uploadProgress.total})`
            : ""}
        </span>
        <span className="shrink-0 tabular-nums">
          {t("uploadPercent", { pct: uploadProgress.pct })}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={uploadProgress.pct}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out"
          style={{ width: `${uploadProgress.pct}%` }}
        />
      </div>
    </div>
  ) : null;

  const folderBar = showFolderBar ? (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => selectFolderFilter("all")}
          className={cn(
            "interactive-press inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
            folderFilter === "all"
              ? "bg-primary text-white"
              : "bg-muted text-muted-foreground hover:bg-primary-muted hover:text-primary",
          )}
        >
          <Folder className="h-3.5 w-3.5" />
          {t("folderAll")}
        </button>
        <button
          type="button"
          onClick={() => selectFolderFilter("unfiled")}
          className={cn(
            "interactive-press inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
            folderFilter === "unfiled"
              ? "bg-primary text-white"
              : "bg-muted text-muted-foreground hover:bg-primary-muted hover:text-primary",
          )}
        >
          {t("folderUnfiled")}
        </button>
        {folders.map((folder) => (
          <div key={folder.id} className="inline-flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => selectFolderFilter(folder.id)}
              className={cn(
                "interactive-press inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                folderFilter === folder.id
                  ? "bg-primary text-white"
                  : "bg-muted text-muted-foreground hover:bg-primary-muted hover:text-primary",
              )}
            >
              <Folder className="h-3.5 w-3.5" />
              {folder.name}
              <span className="tabular-nums opacity-80">({folder.attachmentCount})</span>
            </button>
            {canUpload ? (
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleDeleteFolder(folder)}
                className="interactive-press rounded-md p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-700"
                aria-label={t("folderDeleteTitle")}
                title={t("folderDeleteTitle")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        ))}
        {canUpload ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => setCreatingFolder((v) => !v)}
            className="interactive-press inline-flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:bg-primary-muted hover:text-primary"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            {t("folderCreate")}
          </button>
        ) : null}
      </div>
      {creatingFolder ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder={t("folderNamePlaceholder")}
            className="h-9 sm:max-w-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleCreateFolder();
              }
            }}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending || !newFolderName.trim()}
              onClick={handleCreateFolder}
              className="interactive-press"
            >
              {tCommon("save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setCreatingFolder(false);
                setNewFolderName("");
              }}
            >
              {tCommon("cancel")}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  const list = (
    <div className={cn("space-y-2", compact ? "space-y-2" : "space-y-3")}>
      {canVersion ? (
        <input
          ref={replaceInputRef}
          type="file"
          className="hidden"
          disabled={isPending}
          onChange={(e) => {
            handleReplaceFileSelected(e.target.files);
          }}
        />
      ) : null}
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
      {attachments.length === 0 ? (
        <p className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
          {t("empty")}
        </p>
      ) : (
        attachments.map((item) => {
          const canDelete = canDeleteAll || (canUpload && item.uploadedBy.id === currentUserId);
          const canReplace = canVersion && canDelete;
          const versionCount = item.versionCount ?? 1;
          const versionsExpanded = expandedVersionsId === item.id;
          const versions = versionsByAttachment[item.id] ?? [];

          return (
            <div
              key={item.id}
              className={cn(
                "min-w-0",
                compact
                  ? cn(
                      "border-b border-border/60 last:border-b-0",
                      item.isImportant
                        ? "attachment-important"
                        : "py-2.5",
                    )
                  : cn(
                      "border-b border-border/60 last:border-b-0",
                      item.isImportant
                        ? "attachment-important"
                        : "py-3",
                    ),
              )}
            >
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex min-w-0 items-start gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        setViewerItem(item);
                      }}
                      title={item.fileName}
                      className={cn(
                        "interactive-press min-w-0 flex-1 break-words rounded-md text-left font-medium text-primary hover:underline hover:[filter:none] active:[filter:none] sm:truncate sm:break-normal",
                        compact ? "text-xs" : "text-sm",
                      )}
                    >
                      {item.fileName}
                    </button>
                    {canMarkImportant ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleToggleImportant(item)}
                        className={cn(
                          "h-8 w-8 shrink-0 px-0 hover:bg-primary-muted hover:text-primary hover:[filter:none] active:[filter:none] sm:hidden",
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
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {item.isImportant ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-muted px-3 py-1.5 text-[11px] font-medium leading-none text-primary">
                        <Star className="h-3 w-3 shrink-0 fill-current" aria-hidden />
                        {t("important")}
                      </span>
                    ) : null}
                    {item.labelName ? (
                      <span className="rounded-full bg-primary-muted px-2 py-0.5 text-[11px] font-medium text-primary">
                        {item.labelName}
                      </span>
                    ) : null}
                    {item.folderName ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {item.folderName}
                      </span>
                    ) : null}
                    {canVersion && versionCount > 1 ? (
                      <button
                        type="button"
                        onClick={() => void toggleVersions(item)}
                        className="interactive-press inline-flex items-center gap-1 rounded-full bg-accent-muted px-2 py-0.5 text-[11px] font-medium text-accent"
                        title={t("versionsTitle")}
                      >
                        {t("versionsCount", { count: versionCount })}
                        {versionsExpanded ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>
                    ) : null}
                    {item.accessMode && item.accessMode !== "ALL_MEMBERS" ? (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                        title={
                          item.accessMode === "ALLOWLIST"
                            ? t("accessModeAllow")
                            : t("accessModeDeny")
                        }
                      >
                        <Lock className="h-3 w-3" />
                        {item.accessMode === "ALLOWLIST"
                          ? t("accessBadgeAllow")
                          : t("accessBadgeDeny")}
                      </span>
                    ) : null}
                  </div>

                  {compact ? (
                    <div className="space-y-0.5 text-[11px] text-muted-foreground">
                      <p className="break-words">
                        <span className="font-medium text-muted-foreground">
                          {t("uploadedBy")}:
                        </span>{" "}
                        {item.uploadedBy.name}
                        {item.origin?.kind === "comment"
                          ? ` · ${t("commentOrigin")}`
                          : ""}
                      </p>
                      <p className="break-words">
                        <span className="font-medium text-muted-foreground">
                          {t("date")}:
                        </span>{" "}
                        {formatDateTime(item.createdAt)}
                        {" · "}
                        {formatBytes(item.sizeBytes)}
                        {item.version ? (
                          <>
                            {" · "}
                            {t("versionLabel", { version: item.version })}
                          </>
                        ) : null}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        setViewerItem(item);
                      }}
                      className="interactive-press w-full min-w-0 space-y-1 rounded-md border-t border-border/80 pt-2 text-left text-xs text-muted-foreground hover:[filter:none] active:[filter:none]"
                    >
                      <p className="break-words">
                        <span className="font-medium text-muted-foreground">{t("uploadedBy")}:</span>{" "}
                        {item.uploadedBy.name}
                      </p>
                      <p className="break-words">
                        <span className="font-medium text-muted-foreground">{t("source")}:</span>{" "}
                        {item.origin?.label ?? t("defaultSource")}
                      </p>
                      {item.origin?.matterCode ? (
                        <p className="break-all font-mono text-[11px] text-muted-foreground/90">
                          {item.origin.matterCode}
                        </p>
                      ) : null}
                      <p className="break-words">
                        <span className="font-medium text-muted-foreground">{t("date")}:</span>{" "}
                        {formatDateTime(item.createdAt)}
                        {" · "}
                        {formatBytes(item.sizeBytes)}
                        {item.version ? (
                          <>
                            {" · "}
                            {t("versionLabel", { version: item.version })}
                          </>
                        ) : null}
                      </p>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1 sm:max-w-[12rem] sm:shrink-0 sm:justify-end lg:max-w-none">
                  {canMarkImportant ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleToggleImportant(item)}
                      className={cn(
                        "hidden h-8 w-8 px-0 hover:bg-primary-muted hover:text-primary hover:[filter:none] active:[filter:none] sm:inline-flex",
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
                  {accessEnabled ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => setAccessItem(item)}
                      className={cn(
                        "h-8 w-8 px-0 hover:bg-primary-muted hover:text-primary hover:[filter:none] active:[filter:none]",
                        item.accessMode &&
                          item.accessMode !== "ALL_MEMBERS" &&
                          "text-primary",
                      )}
                      aria-label={t("accessTitle")}
                      title={t("accessTitle")}
                    >
                      <Lock className="h-4 w-4" />
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
                    className="h-8 w-8 px-0"
                    aria-label={tCommon("viewFile")}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleDownload(item.id)}
                    className="h-8 w-8 px-0 hover:bg-primary-muted hover:text-primary hover:[filter:none] active:[filter:none]"
                    aria-label={tCommon("download")}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canReplace ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => openReplacePicker(item.id)}
                      className="h-8 w-8 px-0 hover:bg-primary-muted hover:text-primary hover:[filter:none] active:[filter:none]"
                      aria-label={t("replace")}
                      title={t("replace")}
                    >
                      <Replace className="h-4 w-4" />
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleDelete(item)}
                      className="h-8 w-8 px-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 hover:[filter:none] active:[filter:none]"
                      aria-label={t("delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>

              {canVersion && versionsExpanded ? (
                <div className="mt-3 w-full space-y-2 border-t border-border/80 pt-3">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("versionsTitle")}
                  </p>
                  {versions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{tCommon("loading")}</p>
                  ) : (
                    versions.map((version) => {
                      const canDeleteVersion =
                        canDeleteAll ||
                        (canUpload && version.uploadedBy.id === currentUserId);
                      return (
                        <div
                          key={version.id}
                          className="flex flex-col gap-2 rounded-md bg-muted/60 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 space-y-0.5 text-xs text-muted-foreground">
                            <p className="truncate font-medium text-foreground">
                              {t("versionLabel", { version: version.version })}
                              {version.isLatest ? (
                                <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                                  {t("versionLatest")}
                                </span>
                              ) : null}
                              <span className="ml-1.5 font-normal text-muted-foreground">
                                · {version.fileName}
                              </span>
                            </p>
                            <p className="truncate">
                              {version.uploadedBy.name}
                              {" · "}
                              {formatDateTime(version.createdAt)}
                              {" · "}
                              {formatBytes(version.sizeBytes)}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isPending}
                              onClick={() =>
                                setViewerItem({
                                  ...item,
                                  id: version.id,
                                  fileName: version.fileName,
                                  mimeType: version.mimeType,
                                  sizeBytes: version.sizeBytes,
                                  createdAt: version.createdAt,
                                  uploadedBy: version.uploadedBy,
                                  version: version.version,
                                })
                              }
                              aria-label={tCommon("viewFile")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isPending}
                              onClick={() => handleDownload(version.id)}
                              aria-label={tCommon("download")}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {canDeleteVersion ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isPending}
                                onClick={() => handleDeleteVersion(item, version)}
                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                aria-label={t("delete")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : null}
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

  const accessDialog = (
    <AttachmentAccessDialog
      attachmentId={accessItem?.id ?? ""}
      fileName={accessItem?.fileName ?? ""}
      open={!!accessItem}
      onClose={() => setAccessItem(null)}
      onSaved={(mode) => {
        if (!accessItem) return;
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === accessItem.id ? { ...a, accessMode: mode } : a,
          ),
        );
      }}
    />
  );

  const uploadDialog = (
    <AttachmentUploadDialog
      open={pendingFiles.length > 0}
      files={pendingFiles}
      labels={labels}
      folders={foldersEnabled ? folders : undefined}
      initialFolderId={
        foldersEnabled && folderFilter !== "all" && folderFilter !== "unfiled"
          ? folderFilter
          : null
      }
      onCancel={() => setPendingFiles([])}
      onConfirm={({ labelId, customLabel, folderId }) => {
        const files = pendingFiles;
        setPendingFiles([]);
        if (files.length) runUploadBatch(files, labelId, customLabel, folderId);
      }}
    />
  );

  if (compact) {
    return (
      <>
        {dialog}
        {uploadDialog}
        {viewer}
        {accessDialog}
        <div className="min-w-0 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Paperclip className="h-3.5 w-3.5" />
              {t("title")}
              {attachments.length > 0 ? ` (${attachments.length})` : ""}
            </p>
            {uploadControl}
          </div>
          {dropZone}
          {progressBar}
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
      {accessDialog}
      <Card className="rounded-md">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="h-5 w-5 text-primary" />
            {t("attachedTitle")}
          </CardTitle>
          {uploadControl}
        </CardHeader>
        <CardContent className="space-y-4">
          {dropZone}
          {progressBar}
          {folderBar}
          {list}
        </CardContent>
      </Card>
    </>
  );
}
