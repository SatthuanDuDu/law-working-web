"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type NotificationToastItem = {
  /** Stable key for React + dismiss tracking */
  key: string;
  title: string;
  message: string;
  link: string | null;
  notificationId?: string;
};

const AUTO_DISMISS_MS = 6_000;
const AUTO_DISMISS_TOUCH_MS = 8_000;
const EXIT_MS = 320;
const MAX_VISIBLE = 3;

function ToastCard({
  item,
  onDismiss,
}: {
  item: NotificationToastItem;
  onDismiss: (key: string) => void;
}) {
  const t = useTranslations("notifications");
  const [entered, setEntered] = useState(false);
  const [exiting, setExiting] = useState(false);
  const pausedRef = useRef(false);
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
      onDismiss(item.key);
    }, EXIT_MS);
  }

  function dismissMs() {
    const coarse =
      typeof window !== "undefined" &&
      window.matchMedia("(pointer: coarse)").matches;
    return coarse ? AUTO_DISMISS_TOUCH_MS : AUTO_DISMISS_MS;
  }

  function armTimer() {
    clearTimer();
    if (pausedRef.current || exiting) return;
    timerRef.current = window.setTimeout(() => {
      if (!pausedRef.current) beginExit();
    }, dismissMs());
  }

  function pause() {
    pausedRef.current = true;
    clearTimer();
  }

  function resume() {
    pausedRef.current = false;
    armTimer();
  }

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    armTimer();
    return () => {
      window.cancelAnimationFrame(frame);
      clearTimer();
      if (exitTimerRef.current != null) {
        window.clearTimeout(exitTimerRef.current);
      }
    };
    // Mount once per toast key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const href = item.link || "/dashboard";

  return (
    <div
      role="status"
      aria-live="polite"
      onPointerEnter={pause}
      onPointerLeave={resume}
      onPointerDown={pause}
      className={cn(
        "pointer-events-auto w-[min(22rem,calc(100dvw-1.5rem))] max-w-[calc(100%-0.5rem)] overflow-hidden rounded-md border border-border bg-surface shadow-[var(--shadow-overlay)]",
        "transition-transform duration-300 ease-out will-change-transform",
        "motion-reduce:transition-none",
        // Relative % avoids Chrome mobile horizontal overflow from 100vw.
        entered && !exiting ? "translate-x-0" : "translate-x-[110%]",
        "motion-reduce:translate-x-0",
        exiting && "motion-reduce:opacity-0 motion-reduce:translate-x-0",
      )}
    >
      <div className="flex gap-2.5 p-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Bell className="h-4 w-4" aria-hidden />
        </div>
        <Link
          href={href}
          onClick={() => beginExit()}
          className="interactive-press min-w-0 flex-1 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <p className="truncate text-sm font-semibold text-foreground">
            {item.title}
          </p>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {item.message}
          </p>
          <p className="mt-1.5 text-[11px] font-medium text-primary">
            {t("toastOpen")}
          </p>
        </Link>
        <button
          type="button"
          onClick={() => beginExit()}
          className="interactive-press -mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={t("toastDismiss")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function NotificationToastStack({
  items,
  onDismiss,
}: {
  items: NotificationToastItem[];
  onDismiss: (key: string) => void;
}) {
  const visible = items.slice(0, MAX_VISIBLE);

  if (visible.length === 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed z-[60] flex flex-col gap-2",
        // Under sticky header; safe-area for notched phones / Chrome Android.
        "top-[max(4.5rem,calc(env(safe-area-inset-top,0px)+4rem))]",
        "right-[max(0.75rem,env(safe-area-inset-right,0px))]",
        "left-auto max-w-[calc(100dvw-1.5rem)]",
      )}
      aria-label="Thông báo mới"
    >
      {visible.map((item) => (
        <ToastCard key={item.key} item={item} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
