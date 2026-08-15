"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, CheckCheck, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { enUS, vi as viLocale } from "date-fns/locale";
import type { Notification } from "@prisma/client";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions";
import { useLocale, useTranslations } from "next-intl";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HEADER_TOOLBAR_BTN } from "@/components/layout/header-toolbar";
import type { UrgentReminderItem } from "@/components/layout/urgent-reminder-stack";
import { isUrgentReminderActive } from "@/lib/urgent-reminder-window";
import {
  getUrgentDeadlineMs,
  getUrgentRemainingParts,
} from "@/lib/urgent-reminder-countdown";

type TabKey = "unread" | "all";

const SHEET_DISMISS_PX = 96;
const SHEET_EXPAND_PX = 48;
const SHEET_COLLAPSE_PX = 56;

/** Stable client clock for useSyncExternalStore (must not return a new value every read). */
let clientNowCache = 0;
let clientNowInterval: number | null = null;
const clientNowListeners = new Set<() => void>();

function subscribeClientNow(onStoreChange: () => void) {
  clientNowListeners.add(onStoreChange);
  if (clientNowCache === 0) clientNowCache = Date.now();
  if (clientNowInterval == null) {
    clientNowInterval = window.setInterval(() => {
      clientNowCache = Date.now();
      clientNowListeners.forEach((listener) => listener());
    }, 10_000);
  }
  return () => {
    clientNowListeners.delete(onStoreChange);
    if (clientNowListeners.size === 0 && clientNowInterval != null) {
      window.clearInterval(clientNowInterval);
      clientNowInterval = null;
    }
  };
}

function getClientNow() {
  if (clientNowCache === 0) clientNowCache = Date.now();
  return clientNowCache;
}

function getServerNow() {
  return 0;
}

function formatRelativeTime(
  date: Date | string,
  locale: string,
  now: number,
): string {
  const value = new Date(date).getTime();
  if (Number.isNaN(value) || now <= 0) return "";
  return formatDistanceToNow(value, {
    addSuffix: true,
    locale: locale === "en" ? enUS : viLocale,
  });
}

function formatCountdownValue(
  parts: Exclude<ReturnType<typeof getUrgentRemainingParts>, { overdue: true }>,
  tCommon: ReturnType<typeof useTranslations>,
): string {
  const { days, hours, minutes, totalMinutes } = parts;
  if (days > 0) {
    if (minutes === 0) {
      return tCommon("daysHours", { days, hours });
    }
    return tCommon("daysHoursMinutes", { days, hours, mins: minutes });
  }
  if (totalMinutes < 60) {
    return tCommon("minutes", { count: totalMinutes });
  }
  if (minutes === 0) {
    return tCommon("hours", { count: hours });
  }
  return tCommon("hoursMinutes", { hours, mins: minutes });
}

function reminderCountdown(
  item: UrgentReminderItem,
  now: number,
  t: ReturnType<typeof useTranslations>,
  tCommon: ReturnType<typeof useTranslations>,
): string {
  const deadline = getUrgentDeadlineMs(item.startsAt, item.endsAt);
  if (deadline == null) return t("overdue");
  const parts = getUrgentRemainingParts(deadline - now);
  if (parts.overdue) return t("overdue");
  return t("remaining", { value: formatCountdownValue(parts, tCommon) });
}

export function NotificationPanel({
  unreadCount,
  urgentReminders = [],
}: {
  unreadCount: number;
  urgentReminders?: UrgentReminderItem[];
}) {
  const t = useTranslations("notifications");
  const tReminder = useTranslations("reminder");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("unread");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [readLocally, setReadLocally] = useState(0);
  const [isPending, startTransition] = useTransition();
  const now = useSyncExternalStore(
    subscribeClientNow,
    getClientNow,
    getServerNow,
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const sheetDragRef = useRef<{
    pointerId: number;
    startY: number;
  } | null>(null);
  const [panelAnchor, setPanelAnchor] = useState<{
    top: number;
    right: number;
    width: number;
  } | null>(null);
  const [isDesktopPanel, setIsDesktopPanel] = useState(false);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [sheetDragY, setSheetDragY] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);
  const { mounted: panelMounted, active: panelActive } = useOverlayAnimation(open);

  const activeUrgent = useMemo(
    () =>
      now <= 0
        ? []
        : urgentReminders.filter((item) =>
            isUrgentReminderActive(now, item.startsAt, item.endsAt),
          ),
    [urgentReminders, now],
  );

  const displayedUnread =
    Math.max(0, unreadCount - readLocally) + activeUrgent.length;

  const closePanel = useCallback(() => {
    setOpen(false);
    setSheetExpanded(false);
    setSheetDragY(0);
    setSheetDragging(false);
    sheetDragRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        const target = event.target as HTMLElement | null;
        if (target?.closest("[data-notification-panel]")) return;
        closePanel();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePanel();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, closePanel]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 640px)");
    function sync() {
      setIsDesktopPanel(media.matches);
    }
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!open || !isDesktopPanel) return;

    function measurePanel() {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPanelAnchor({
        top: rect.bottom + 6,
        right: Math.max(12, window.innerWidth - rect.right),
        width: Math.min(360, Math.max(300, window.innerWidth - 24)),
      });
    }

    measurePanel();
    window.addEventListener("resize", measurePanel);
    window.addEventListener("scroll", measurePanel, true);
    return () => {
      window.removeEventListener("resize", measurePanel);
      window.removeEventListener("scroll", measurePanel, true);
    };
  }, [open, isDesktopPanel]);

  const desktopPanelStyle =
    open && isDesktopPanel && panelAnchor
      ? {
          top: panelAnchor.top,
          right: panelAnchor.right,
          width: panelAnchor.width,
        }
      : undefined;

  const mobileSheetStyle = useMemo((): CSSProperties | undefined => {
    if (isDesktopPanel) return undefined;

    const dismissY = Math.max(0, sheetDragY);
    const expandPull = Math.max(0, -sheetDragY);
    const baseMax = sheetExpanded ? "min(94dvh, 100%)" : "min(78dvh, 100%)";
    const style: CSSProperties = {
      maxHeight:
        sheetDragging && expandPull > 0
          ? `min(94dvh, calc(${sheetExpanded ? "94dvh" : "78dvh"} + ${expandPull}px))`
          : baseMax,
    };

    if (sheetDragging || dismissY > 0) {
      style.transform = `translateY(${dismissY}px)`;
      style.transition = sheetDragging ? "none" : undefined;
    }

    return style;
  }, [isDesktopPanel, sheetDragY, sheetDragging, sheetExpanded]);

  function endSheetDrag(deltaY: number) {
    setSheetDragging(false);
    sheetDragRef.current = null;

    if (deltaY >= SHEET_DISMISS_PX) {
      closePanel();
      return;
    }

    if (deltaY <= -SHEET_EXPAND_PX) {
      setSheetExpanded(true);
      setSheetDragY(0);
      return;
    }

    if (sheetExpanded && deltaY >= SHEET_COLLAPSE_PX) {
      setSheetExpanded(false);
      setSheetDragY(0);
      return;
    }

    setSheetDragY(0);
  }

  function onSheetHandlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (isDesktopPanel || event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    sheetDragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
    };
    setSheetDragging(true);
    setSheetDragY(0);
  }

  function onSheetHandlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setSheetDragY(event.clientY - drag.startY);
  }

  function onSheetHandlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    endSheetDrag(event.clientY - drag.startY);
  }

  function onSheetHandlePointerCancel(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = sheetDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    endSheetDrag(0);
  }

  function loadNotifications() {
    setLoading(true);
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => setNotifications(data.notifications ?? []))
      .finally(() => setLoading(false));
  }

  function openPanel() {
    setOpen(true);
    loadNotifications();
  }

  const filtered = useMemo(() => {
    return notifications.filter((item) => {
      if (tab === "unread" && item.isRead) return false;
      return true;
    });
  }, [notifications, tab]);

  const showUrgent = activeUrgent.length > 0 && tab === "unread";
  const listEmpty = !loading && filtered.length === 0 && !showUrgent;

  function markRead(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setReadLocally((count) => count + 1);
    });
  }

  function markAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setReadLocally(unreadCount);
    });
  }

  const unreadLeft = Math.max(0, unreadCount - readLocally);
  const backdropDragFade =
    !isDesktopPanel && sheetDragY > 0
      ? Math.max(0.15, 1 - sheetDragY / (SHEET_DISMISS_PX * 1.6))
      : undefined;

  return (
    <div ref={rootRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={
          displayedUnread > 0
            ? `${t("title")} (${displayedUnread})`
            : t("title")
        }
        aria-expanded={open}
        className={cn(HEADER_TOOLBAR_BTN, "relative")}
        onClick={() => (open ? closePanel() : openPanel())}
      >
        <Bell />
        {displayedUnread > 0 ? (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center",
              "rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none",
              "text-white tabular-nums shadow-sm ring-2 ring-canvas",
            )}
            aria-hidden
          >
            {displayedUnread > 99 ? "99+" : displayedUnread}
          </span>
        ) : null}
      </Button>

      {panelMounted &&
        createPortal(
          <>
            <button
              type="button"
              aria-label={tCommon("close")}
              data-notification-panel
              className={cn(
                "overlay-backdrop fixed inset-0 z-40 bg-slate-900/30 sm:hidden",
                panelActive && "is-active",
              )}
              style={
                backdropDragFade != null
                  ? { opacity: panelActive ? backdropDragFade : undefined }
                  : undefined
              }
              onClick={closePanel}
            />
            <aside
              data-notification-panel
              style={{ ...desktopPanelStyle, ...mobileSheetStyle }}
              className={cn(
                "floating-panel fixed z-50 flex min-w-0 flex-col overflow-hidden border border-border bg-surface shadow-[var(--shadow-overlay)]",
                "inset-x-0 bottom-0 max-h-[min(78dvh,100%)] w-full rounded-t-xl sm:inset-auto sm:bottom-auto sm:max-h-[min(70vh,28rem)] sm:rounded-lg",
                sheetExpanded && !isDesktopPanel && "max-h-[min(94dvh,100%)]",
                panelActive && "is-active",
              )}
            >
              <div
                role="button"
                aria-label={t("dragSheet")}
                tabIndex={0}
                className={cn(
                  "flex touch-none flex-col items-center pb-1 pt-2 sm:hidden",
                  "cursor-grab active:cursor-grabbing",
                )}
                onPointerDown={onSheetHandlePointerDown}
                onPointerMove={onSheetHandlePointerMove}
                onPointerUp={onSheetHandlePointerUp}
                onPointerCancel={onSheetHandlePointerCancel}
                onKeyDown={(event) => {
                  if (event.key === "Escape") closePanel();
                  if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSheetExpanded(true);
                  }
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    if (sheetExpanded) setSheetExpanded(false);
                    else closePanel();
                  }
                }}
              >
                <span className="h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden />
              </div>

              <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-2 sm:gap-2 sm:px-3.5 sm:py-2.5">
                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                  {displayedUnread > 0
                    ? `${t("title")} (${displayedUnread})`
                    : t("title")}
                </h2>
                <button
                  type="button"
                  disabled={isPending || unreadLeft === 0}
                  onClick={markAllRead}
                  aria-label={t("markAllRead")}
                  title={t("markAllRead")}
                  className={cn(
                    "interactive-press inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium",
                    unreadLeft === 0
                      ? "text-muted-foreground/50"
                      : "text-primary hover:bg-primary-muted",
                  )}
                >
                  <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                  <span>{t("markAllReadShort")}</span>
                </button>
                <button
                  type="button"
                  onClick={closePanel}
                  aria-label={tCommon("close")}
                  className="interactive-press inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="flex shrink-0 gap-1 px-3 pb-2 pt-1.5 sm:px-3.5">
                {(
                  [
                    { key: "unread" as const, label: t("unread") },
                    { key: "all" as const, label: tCommon("all") },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={cn(
                      "interactive-press flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium sm:flex-none sm:px-3",
                      tab === item.key
                        ? "bg-primary text-white"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    onClick={() => setTab(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                {loading ? (
                  <p className="px-3.5 py-6 text-center text-sm text-muted-foreground">
                    {tCommon("loading")}
                  </p>
                ) : listEmpty ? (
                  <p className="px-3.5 py-6 text-center text-sm text-muted-foreground">
                    {t("empty")}
                  </p>
                ) : (
                  <ul className="divide-y divide-border/70">
                    {showUrgent
                      ? activeUrgent.map((item) => {
                          const countdown = reminderCountdown(
                            item,
                            now,
                            tReminder,
                            tCommon,
                          );
                          return (
                            <li key={`urgent:${item.id}:${item.startsAt}`}>
                              <Link
                                href={item.href}
                                onClick={closePanel}
                                className="interactive-press flex items-start gap-2 px-3 py-2 hover:bg-rose-50/80 sm:px-3.5 dark:hover:bg-rose-950/20"
                              >
                                <span
                                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-500"
                                  aria-hidden
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-[13px] font-semibold leading-snug text-foreground">
                                    {item.title}
                                  </span>
                                  <span className="mt-0.5 block truncate text-xs leading-snug text-muted-foreground">
                                    {t("urgentType")} · {item.timeLabel}
                                  </span>
                                  <span className="mt-1 block text-[11px] leading-none tabular-nums text-rose-700 dark:text-rose-300">
                                    {countdown}
                                  </span>
                                </span>
                              </Link>
                            </li>
                          );
                        })
                      : null}

                    {filtered.map((notification) => {
                      const href = notification.link || "#";
                      const relative = formatRelativeTime(
                        notification.createdAt,
                        locale,
                        now,
                      );
                      return (
                        <li key={notification.id}>
                          <Link
                            href={href}
                            onClick={() => {
                              if (!notification.isRead) {
                                markRead(notification.id);
                              }
                              closePanel();
                            }}
                            className={cn(
                              "interactive-press flex items-start gap-2 px-3 py-2 transition-colors sm:px-3.5",
                              notification.isRead
                                ? "hover:bg-muted/50"
                                : "bg-primary-muted/30 hover:bg-primary-muted/50",
                            )}
                          >
                            <span
                              className={cn(
                                "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                                notification.isRead
                                  ? "bg-transparent"
                                  : "bg-primary",
                              )}
                              aria-hidden
                            />
                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  "block truncate text-[13px] leading-snug text-foreground",
                                  !notification.isRead
                                    ? "font-semibold"
                                    : "font-medium",
                                )}
                              >
                                {notification.title}
                              </span>
                              {notification.message ? (
                                <span className="mt-0.5 block truncate text-xs leading-snug text-muted-foreground">
                                  {notification.message}
                                </span>
                              ) : null}
                              {relative ? (
                                <time
                                  dateTime={String(notification.createdAt)}
                                  className="mt-1 block text-[11px] leading-none text-muted-foreground/80"
                                >
                                  {relative}
                                </time>
                              ) : null}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </aside>
          </>,
          document.body,
        )}
    </div>
  );
}
