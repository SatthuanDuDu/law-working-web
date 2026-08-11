"use client";

import { useTranslations } from "next-intl";
import { FileText, ImageIcon, Paperclip } from "lucide-react";
import type { WalletTxAttachment } from "@/lib/wallet-actions";
import { cn } from "@/lib/utils";

function isImageMime(mime: string) {
  return mime.startsWith("image/");
}

export function WalletReceiptLinks({
  attachments,
  className,
}: {
  attachments: WalletTxAttachment[];
  className?: string;
}) {
  const t = useTranslations("wallet");
  if (!attachments.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5 pt-0.5", className)}>
      <span className="sr-only">{t("receipts")}</span>
      {attachments.map((file) => {
        const Icon = isImageMime(file.mimeType) ? ImageIcon : FileText;
        return (
          <a
            key={file.id}
            href={`/api/attachments/${file.id}/content?disposition=inline`}
            target="_blank"
            rel="noreferrer"
            className="interactive-press inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-muted/50"
            title={file.fileName}
          >
            <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">{file.fileName}</span>
          </a>
        );
      })}
      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
        <Paperclip className="size-3" aria-hidden />
        {attachments.length}
      </span>
    </div>
  );
}
