"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { isUrgentReminderActive } from "@/lib/urgent-reminder-window";

export type UrgentReminderItem = {
  id: string;
  title: string;
  href: string;
  /** ISO time of thời gian diễn ra (startedAt) */
  startsAt: string;
  /** ISO time of thời gian dự kiến hoàn thành (dueAt) */
  endsAt: string | null;
  timeLabel: string;
};

/** In-memory only — reload trang hiện lại ngay; tắt thì ẩn đúng 2 phút */
const REDISPLAY_AFTER_MS = 2 * 60 * 1000;

function dismissKey(item: UrgentReminderItem) {
  return `${item.id}:${item.startsAt}`;
}

function isDismissedTemporarily(
  dismissedAtMs: number | undefined,
  now: number,
): boolean {
  if (dismissedAtMs == null) return false;
  return now - dismissedAtMs < REDISPLAY_AFTER_MS;
}

function formatCountdown(
  msRemaining: number,
  phase: "to-start" | "to-due",
  t: ReturnType<typeof useTranslations>,
  tCommon: ReturnType<typeof useTranslations>,
): string {
  if (msRemaining <= 0) {
    return phase === "to-due" ? t("overdue") : t("overdue");
  }
  const totalMinutes = Math.ceil(msRemaining / 60_000);
  if (totalMinutes < 60) {
    return t("remaining", { value: tCommon("minutes", { count: totalMinutes }) });
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return t("remaining", { value: tCommon("hours", { count: hours }) });
  }
  return t("remaining", {
    value: tCommon("hoursMinutes", { hours, mins: minutes }),
  });
}

function reminderCountdown(
  item: UrgentReminderItem,
  now: number,
  t: ReturnType<typeof useTranslations>,
  tCommon: ReturnType<typeof useTranslations>,
): string {
  const startsAt = new Date(item.startsAt).getTime();
  if (now < startsAt) {
    return formatCountdown(startsAt - now, "to-start", t, tCommon);
  }
  if (item.endsAt) {
    const endsAt = new Date(item.endsAt).getTime();
    if (!Number.isNaN(endsAt)) {
      return formatCountdown(endsAt - now, "to-due", t, tCommon);
    }
  }
  return t("overdue");
}

function useNowTicker(intervalMs = 10_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Marquee khi chữ dài hơn ô — đo overflow sau khi ép min-w-0. */
function MarqueeTitle({ text }: { text: string }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const measure = measureRef.current;
    if (!viewport || !measure) return;

    const check = () => {
      // viewport đã min-w-0 / w-full nên clientWidth = bề rộng thật của chip
      const box = viewport.clientWidth;
      const need = measure.scrollWidth;
      setOverflows(box > 0 && need > box + 1);
    };

    check();
    const id = window.requestAnimationFrame(() => {
      check();
      window.requestAnimationFrame(check);
    });
    const observer = new ResizeObserver(check);
    observer.observe(viewport);
    return () => {
      window.cancelAnimationFrame(id);
      observer.disconnect();
    };
  }, [text]);

  const durationSec = Math.min(30, Math.max(10, Math.round(text.length * 0.2)));

  return (
    <div
      ref={viewportRef}
      className="relative min-h-[0.875rem] min-w-0 flex-1 overflow-hidden"
      title={text}
    >
      <span
        ref={measureRef}
        className="pointer-events-none absolute -left-[9999px] top-0 whitespace-nowrap text-[10px] font-medium leading-none"
        aria-hidden
      >
        {text}
      </span>

      {overflows ? (
        <div
          className="urgent-reminder-marquee-track flex w-max whitespace-nowrap text-[10px] font-medium leading-none text-white"
          style={{ animationDuration: `${durationSec}s` }}
        >
          <span className="inline-block shrink-0 pr-8">{text}</span>
          <span className="inline-block shrink-0 pr-8" aria-hidden>
            {text}
          </span>
        </div>
      ) : (
        <p className="truncate text-[10px] font-medium leading-none text-white">
          {text}
        </p>
      )}
    </div>
  );
}

export function UrgentReminderStack({
  items,
}: {
  items: UrgentReminderItem[];
}) {
  const now = useNowTicker(5_000);
  /** key → dismissedAt timestamp (ms). Mất khi reload → popup hiện liền. */
  const [dismissedAt, setDismissedAt] = useState<Record<string, number>>({});
  const reappearTimers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const timers = reappearTimers.current;
    return () => {
      for (const id of timers.values()) window.clearTimeout(id);
      timers.clear();
    };
  }, []);

  // Clear legacy localStorage so old dismiss không kẹt sau khi đổi sang in-memory
  useEffect(() => {
    try {
      window.localStorage.removeItem("nslaw:dismissed-urgent-reminders");
    } catch {
      /* ignore */
    }
  }, []);

  const visible = useMemo(() => {
    return items.filter((item) => {
      if (isDismissedTemporarily(dismissedAt[dismissKey(item)], now)) {
        return false;
      }
      return isUrgentReminderActive(now, item.startsAt, item.endsAt);
    });
  }, [dismissedAt, items, now]);

  const dismiss = useCallback((item: UrgentReminderItem) => {
    const key = dismissKey(item);
    const at = Date.now();
    setDismissedAt((prev) => ({ ...prev, [key]: at }));

    const existing = reappearTimers.current.get(key);
    if (existing) window.clearTimeout(existing);

    const timerId = window.setTimeout(() => {
      reappearTimers.current.delete(key);
      setDismissedAt((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, REDISPLAY_AFTER_MS);
    reappearTimers.current.set(key, timerId);
  }, []);

  if (visible.length === 0) return null;

  const showScrollHint = visible.length > 2;

  return (
    <UrgentReminderList
      items={visible}
      now={now}
      onDismiss={dismiss}
      showScrollHint={showScrollHint}
    />
  );
}

function UrgentReminderList({
  items,
  now,
  onDismiss,
  showScrollHint,
}: {
  items: UrgentReminderItem[];
  now: number;
  onDismiss: (item: UrgentReminderItem) => void;
  showScrollHint: boolean;
}) {
  const t = useTranslations("reminder");
  const tCommon = useTranslations("common");
  const listRef = useRef<HTMLUListElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(showScrollHint);
  const [box, setBox] = useState<{
    top: number;
    right: number;
    width: number;
  } | null>(null);
  const placed = box != null;

  const syncScrollHint = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    setCanScrollDown(remaining > 2);
  }, []);

  const measure = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = {
      top: rect.top,
      right: Math.max(0, window.innerWidth - rect.right),
      width: rect.width,
    };
    setBox((prev) => {
      if (
        prev &&
        prev.top === next.top &&
        prev.right === next.right &&
        prev.width === next.width
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  useLayoutEffect(() => {
    measure();
  }, [items, measure]);

  useLayoutEffect(() => {
    if (!placed) return;
    syncScrollHint();

    const el = panelRef.current;
    if (!el) return;

    el.style.transition = "none";
    el.style.transform = "translateX(100vw)";

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      // 2nd frame: first paint already showed off-screen position
      raf2 = requestAnimationFrame(() => {
        el.style.transition =
          "transform 1.05s cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "translateX(0)";
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [placed, syncScrollHint]);

  useEffect(() => {
    function onReposition() {
      measure();
    }
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [measure]);

  const panel =
    box != null
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[30]"
            style={{
              top: box.top,
              right: box.right,
              width: box.width,
              willChange: "transform",
            }}
          >
            <div className="urgent-reminder-window relative w-full overflow-hidden rounded-md shadow-[var(--shadow-overlay)]">
              <ul
                ref={listRef}
                onScroll={syncScrollHint}
                className="relative z-[1] flex max-h-[3.25rem] flex-col overflow-y-auto overscroll-contain"
                aria-label={t("dismiss")}
              >
                {items.map((item, index) => {
                  const countdown = reminderCountdown(item, now, t, tCommon);
                  return (
                    <li
                      key={dismissKey(item)}
                      className={cn(
                        "min-w-0 shrink-0",
                        index > 0 && "border-t border-white/20",
                      )}
                    >
                      <div className="flex min-w-0 items-center gap-0.5 px-1.5 py-1 text-white">
                        <Link
                          href={item.href}
                          className="interactive-press flex min-w-0 flex-1 items-center gap-1 overflow-hidden hover:[filter:none] active:[filter:none]"
                        >
                          <span className="inline-flex shrink-0 items-center gap-0.5 text-[9px] font-semibold tabular-nums leading-none text-white/95">
                            <Clock className="h-2.5 w-2.5 shrink-0" aria-hidden />
                            <span>{item.timeLabel}</span>
                            <span className="font-medium text-white/80">·</span>
                            <span className="max-w-[3.75rem] truncate font-medium text-white/85">
                              {countdown}
                            </span>
                          </span>
                          <MarqueeTitle text={item.title} />
                        </Link>
                        <button
                          type="button"
                          onClick={() => onDismiss(item)}
                          className="interactive-press flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/90 hover:bg-white/15 hover:[filter:none] active:[filter:none]"
                          aria-label={`${t("dismiss")}: ${item.title}`}
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              {showScrollHint && canScrollDown ? (
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex justify-center bg-gradient-to-t from-rose-700/95 to-transparent pb-px pt-2"
                  aria-hidden
                >
                  <ChevronDown className="h-3 w-3 animate-bounce text-white/95" />
                </div>
              ) : null}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={anchorRef}
        className="pointer-events-none h-0 w-[min(100vw-2rem,19.5rem)] sm:w-[21rem]"
        aria-hidden
      />
      {panel}
    </>
  );
}
