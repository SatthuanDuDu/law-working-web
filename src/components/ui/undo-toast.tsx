"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const AUTO_DISMISS_MS = 10_000;
const EXIT_MS = 280;

export type UndoToastProps = {
  message: string;
  undoLabel?: string;
  onUndo: () => void | Promise<void>;
  onDismiss?: () => void;
  /** Remount key when a new delete happens */
  toastKey: string;
};

export function UndoToast({
  message,
  undoLabel = "Hoàn tác",
  onUndo,
  onDismiss,
  toastKey,
}: UndoToastProps) {
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const timerRef = useRef<number | null>(null);
  const exitTimerRef = useRef<number | null>(null);

  function clearTimer() {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function beginExit() {
    if (exiting) return;
    clearTimer();
    setExiting(true);
    exitTimerRef.current = window.setTimeout(() => {
      onDismiss?.();
    }, EXIT_MS);
  }

  useEffect(() => {
    setEntered(false);
    setExiting(false);
    setBusy(false);
    const frame = window.requestAnimationFrame(() => setEntered(true));
    clearTimer();
    timerRef.current = window.setTimeout(() => beginExit(), AUTO_DISMISS_MS);
    return () => {
      window.cancelAnimationFrame(frame);
      clearTimer();
      if (exitTimerRef.current != null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
    // Reset lifecycle when toastKey changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toastKey]);

  async function handleUndo() {
    if (busy || exiting) return;
    setBusy(true);
    clearTimer();
    try {
      await onUndo();
    } finally {
      beginExit();
    }
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-center p-4 sm:justify-end sm:p-6"
      role="status"
      aria-live="polite"
    >
      <div
        className={cn(
          "pointer-events-auto flex max-w-md items-center gap-3 rounded-md border border-border bg-surface px-3 py-2.5 shadow-[var(--shadow-overlay)]",
          "transition-all duration-300 ease-out will-change-transform",
          "motion-reduce:transition-none",
          entered && !exiting
            ? "translate-y-0 opacity-100"
            : "translate-y-3 opacity-0",
        )}
      >
        <p className="min-w-0 flex-1 text-sm text-foreground">{message}</p>
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleUndo()}
          className="interactive-press shrink-0 rounded-md px-2.5 py-1.5 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          {undoLabel}
        </button>
      </div>
    </div>
  );
}
