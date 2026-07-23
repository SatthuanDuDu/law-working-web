"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { cn } from "@/lib/utils";

export type ViewerAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
};

function isImageMime(mimeType: string, fileName?: string) {
  if (mimeType.startsWith("image/")) return true;
  if (!fileName) return false;
  return /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(fileName);
}

function isPdfMime(mimeType: string, fileName: string) {
  return (
    mimeType === "application/pdf" ||
    fileName.toLowerCase().endsWith(".pdf")
  );
}

/** Same-origin proxy — works when MinIO public endpoint is Docker-internal. */
function attachmentContentUrl(
  id: string,
  disposition: "inline" | "attachment" = "inline",
) {
  const q = disposition === "attachment" ? "?disposition=attachment" : "";
  return `/api/attachments/${id}/content${q}`;
}

export function AttachmentViewer({
  attachment,
  open,
  onClose,
}: {
  attachment: ViewerAttachment | null;
  open: boolean;
  onClose: () => void;
}) {
  const { mounted } = useOverlayAnimation(open);
  const active = open;

  if (!mounted || !attachment) return null;

  return createPortal(
    <AttachmentViewerPanel
      key={attachment.id}
      attachment={attachment}
      active={active}
      onClose={onClose}
    />,
    document.body,
  );
}

function AttachmentViewerPanel({
  attachment,
  active,
  onClose,
}: {
  attachment: ViewerAttachment;
  active: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("attachments");
  const tCommon = useTranslations("common");
  const previewImageFailedMessage = t("previewImageFailed");
  const [mediaReady, setMediaReady] = useState(false);
  const [error, setError] = useState("");

  const previewUrl = attachmentContentUrl(attachment.id, "inline");
  const downloadUrl = attachmentContentUrl(attachment.id, "attachment");
  const isImage = isImageMime(attachment.mimeType, attachment.fileName);
  const isPdf = isPdfMime(attachment.mimeType, attachment.fileName);
  const canInline = isImage || isPdf;
  const showLoader = Boolean(previewUrl) && canInline && !mediaReady && !error;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function handleDownload() {
    window.open(downloadUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label={tCommon("close")}
        className={cn(
          "overlay-backdrop absolute inset-0 bg-black/40",
          active && "is-active",
        )}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attachment-viewer-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-overlay)]"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2
            id="attachment-viewer-title"
            className="min-w-0 truncate text-sm font-semibold text-foreground sm:text-base"
          >
            {attachment.fileName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={tCommon("close")}
            className="interactive-press shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground hover:[filter:none] active:[filter:none]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative min-h-64 min-w-0 flex-1 overflow-auto bg-muted/40 p-3 sm:p-4">
          {error ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          ) : null}

          {!error && showLoader ? (
            <div className="absolute inset-0 z-[1] flex items-center justify-center bg-muted/40 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : null}

          {!error && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={attachment.fileName}
              onLoad={() => setMediaReady(true)}
              onError={() => {
                setMediaReady(true);
                setError(previewImageFailedMessage);
              }}
              className={cn(
                "mx-auto max-h-[70vh] w-auto max-w-full object-contain",
                !mediaReady && "opacity-0",
              )}
            />
          ) : null}

          {!error && isPdf ? (
            <iframe
              title={attachment.fileName}
              src={previewUrl}
              onLoad={() => setMediaReady(true)}
              className={cn(
                "h-[70vh] w-full rounded-md border border-border bg-surface",
                !mediaReady && "opacity-0",
              )}
            />
          ) : null}

          {!error && !canInline ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <p className="text-sm text-muted-foreground">
                {t("unsupportedPreview")}
              </p>
              <p className="text-xs text-muted-foreground/70">
                {attachment.mimeType || "unknown"}
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {tCommon("close")}
          </Button>
          <Button type="button" onClick={handleDownload}>
            <Download className="h-4 w-4" />
            {tCommon("download")}
          </Button>
        </div>
      </div>
    </div>
  );
}
