"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, FileText, ImageIcon, Paperclip } from "lucide-react";
import type { WalletTxAttachment } from "@/lib/wallet-actions";
import { cn } from "@/lib/utils";

function isImageMime(mime: string) {
  return mime.startsWith("image/");
}

/** Compact receipt control: count only by default; expand to show file names. */
export function WalletReceiptLinks({
  attachments,
  className,
}: {
  attachments: WalletTxAttachment[];
  className?: string;
}) {
  const t = useTranslations("wallet");
  const [open, setOpen] = useState(false);
  if (!attachments.length) return null;

  return (
    <div className={cn("min-w-0", className)}>
      <button
        type="button"
        className="interactive-press inline-flex h-7 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
        aria-expanded={open}
        aria-label={t("receipts")}
        onClick={() => setOpen((v) => !v)}
      >
        <Paperclip className="size-3 shrink-0" aria-hidden />
        <span className="tabular-nums">{attachments.length}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-150",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <ul className="mt-1.5 space-y-1">
          {attachments.map((file) => {
            const Icon = isImageMime(file.mimeType) ? ImageIcon : FileText;
            return (
              <li key={file.id}>
                <a
                  href={`/api/attachments/${file.id}/content?disposition=inline`}
                  target="_blank"
                  rel="noreferrer"
                  className="interactive-press inline-flex max-w-full items-center gap-1.5 rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground hover:bg-muted/50"
                  title={file.fileName}
                >
                  <Icon
                    className="size-3.5 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <span className="truncate">{file.fileName}</span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
