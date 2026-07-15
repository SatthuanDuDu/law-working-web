"use client";

import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { cn } from "@/lib/utils";

export function ConfirmDialog({
  open,
  title,
  message,
  content,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  variant = "default",
  size = "default",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  content?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  size?: "default" | "large";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { mounted, active } = useOverlayAnimation(open);

  useEffect(() => {
    if (!mounted) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mounted, onCancel]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Đóng"
        className={cn("overlay-backdrop absolute inset-0 bg-black/30", active && "is-active")}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className={cn(
          "overlay-panel relative z-10 w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-xl",
          size === "large" ? "max-w-2xl" : "max-w-md",
          active && "is-active",
        )}
      >
        <h2 id="confirm-dialog-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        {message ? <p className="mt-2 text-sm text-slate-600">{message}</p> : null}
        {content}
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
