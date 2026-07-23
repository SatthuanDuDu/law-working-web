"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/card";
import {
  AttachmentLabelFields,
  resolveLabelPayload,
} from "@/components/attachments/attachment-label-fields";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { cn } from "@/lib/utils";

type LabelOption = { id: string; name: string };
export type FolderOption = { id: string; name: string };

function UploadLabelForm({
  files,
  labels,
  folders,
  initialFolderId,
  onCancel,
  onConfirm,
}: {
  files: File[];
  labels: LabelOption[];
  folders?: FolderOption[];
  initialFolderId?: string | null;
  onCancel: () => void;
  onConfirm: (payload: {
    labelId: string | null;
    customLabel: string | null;
    folderId: string | null;
  }) => void;
}) {
  const t = useTranslations("attachments");
  const tCommon = useTranslations("common");
  const [labelChoice, setLabelChoice] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [folderId, setFolderId] = useState(initialFolderId ?? "");
  const [error, setError] = useState("");

  const showFolders = folders !== undefined;
  const fileSummary =
    files.length === 1
      ? files[0]!.name
      : t("uploadFileCount", { count: files.length });

  function handleConfirm() {
    const resolved = resolveLabelPayload(labelChoice, customLabel, {
      customLabelRequired: t("customLabelRequired"),
      labelRequired: t("labelRequired"),
    });
    if (!resolved.ok) {
      setError(resolved.error);
      return;
    }
    onConfirm({
      labelId: resolved.labelId,
      customLabel: resolved.customLabel,
      folderId: folderId || null,
    });
  }

  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("uploadDocument")}{" "}
        <span className="font-medium text-foreground">{fileSummary}</span>
      </p>
      {files.length > 1 ? (
        <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {files.slice(0, 20).map((file) => (
            <li key={`${file.name}-${file.size}-${file.lastModified}`} className="truncate">
              {file.name}
            </li>
          ))}
          {files.length > 20 ? (
            <li>{t("uploadMoreFiles", { count: files.length - 20 })}</li>
          ) : null}
        </ul>
      ) : null}
      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium text-foreground">{t("labelAria")}</p>
        <AttachmentLabelFields
          labels={labels}
          labelChoice={labelChoice}
          customLabel={customLabel}
          onLabelChoiceChange={(value) => {
            setLabelChoice(value);
            setError("");
          }}
          onCustomLabelChange={(value) => {
            setCustomLabel(value);
            setError("");
          }}
        />
      </div>
      {showFolders ? (
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="upload-folder">{t("folderLabel")}</Label>
          <Select
            id="upload-folder"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            className="h-10"
          >
            <option value="">{t("folderUnfiled")}</option>
            {(folders ?? []).map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          {tCommon("cancel")}
        </Button>
        <Button type="button" onClick={handleConfirm}>
          {t("upload")}
        </Button>
      </div>
    </>
  );
}

export function AttachmentUploadDialog({
  open,
  files,
  file = null,
  labels,
  folders,
  initialFolderId,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /** Prefer `files`; `file` kept for older call sites. */
  files?: File[];
  file?: File | null;
  labels: LabelOption[];
  folders?: FolderOption[];
  initialFolderId?: string | null;
  onCancel: () => void;
  onConfirm: (payload: {
    labelId: string | null;
    customLabel: string | null;
    folderId: string | null;
  }) => void;
}) {
  const t = useTranslations("attachments");
  const tCommon = useTranslations("common");
  const { mounted, active } = useOverlayAnimation(open);
  const resolvedFiles = files?.length
    ? files
    : file
      ? [file]
      : [];
  const fileKey = resolvedFiles
    .map((f) => `${f.name}-${f.size}-${f.lastModified}`)
    .join("|");

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onCancel]);

  if (!mounted || resolvedFiles.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={tCommon("close")}
        className={cn("overlay-backdrop absolute inset-0 bg-black/30", active && "is-active")}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-label-dialog-title"
        className={cn(
          "overlay-panel relative z-10 w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-[var(--shadow-overlay)]",
          active && "is-active",
        )}
      >
        <h2
          id="upload-label-dialog-title"
          className="text-lg font-semibold text-foreground"
        >
          {t("uploadConfirmTitle")}
        </h2>
        <UploadLabelForm
          key={fileKey}
          files={resolvedFiles}
          labels={labels}
          folders={folders}
          initialFolderId={initialFolderId}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </div>
    </div>
  );
}
