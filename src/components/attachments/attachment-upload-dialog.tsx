"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  AttachmentLabelFields,
  resolveLabelPayload,
} from "@/components/attachments/attachment-label-fields";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { cn } from "@/lib/utils";

type LabelOption = { id: string; name: string };

function UploadLabelForm({
  file,
  labels,
  onCancel,
  onConfirm,
}: {
  file: File;
  labels: LabelOption[];
  onCancel: () => void;
  onConfirm: (payload: {
    labelId: string | null;
    customLabel: string | null;
  }) => void;
}) {
  const t = useTranslations("attachments");
  const tCommon = useTranslations("common");
  const [labelChoice, setLabelChoice] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [error, setError] = useState("");

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
    });
  }

  return (
    <>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("uploadDocument")}{" "}
        <span className="font-medium text-foreground">{file.name}</span>
      </p>
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
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
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
  file,
  labels,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  file: File | null;
  labels: LabelOption[];
  onCancel: () => void;
  onConfirm: (payload: {
    labelId: string | null;
    customLabel: string | null;
  }) => void;
}) {
  const t = useTranslations("attachments");
  const tCommon = useTranslations("common");
  const { mounted, active } = useOverlayAnimation(open);
  const fileKey = file ? `${file.name}-${file.size}-${file.lastModified}` : "none";

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onCancel]);

  if (!mounted || !file) return null;

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
          file={file}
          labels={labels}
          onCancel={onCancel}
          onConfirm={onConfirm}
        />
      </div>
    </div>
  );
}
