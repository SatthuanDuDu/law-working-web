"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
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
import type { UrgentReminderItem } from "@/components/layout/urgent-reminder-stack";
import { isUrgentReminderActive } from "@/lib/urgent-reminder-window";

type TabKey = "unread" | "all";

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

function formatCountdown(
  msRemaining: number,
  t: ReturnType<typeof useTranslations>,
  tCommon: ReturnType<typeof useTranslations>,
): string {
  if (msRemaining <= 0) return t("overdue");
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
    return formatCountdown(startsAt - now, t, tCommon);
  }
  if (item.endsAt) {
    const endsAt = new Date(item.endsAt).getTime();
    if (!Number.isNaN(endsAt)) {
      return formatCountdown(endsAt - now, t, tCommon);
    }
  }
  return t("overdue");
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
  const [panelAnchor, setPanelAnchor] = useState<{
    top: number;
    right: number;
    width: number;
  } | null>(null);
  const [isDesktopPanel, setIsDesktopPanel] = useState(false);
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

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        const target = event.target as HTMLElement | null;
        if (target?.closest("[data-notification-panel]")) return;
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

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

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={t("title")}
        aria-expanded={open}
        className="interactive-press relative rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-primary"
        onClick={() => (open ? setOpen(false) : openPanel())}
      >
        <Bell className="h-5 w-5" />
        {displayedUnread > 0 && (
          <span className="absolute right-1 top-1 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
        )}
      </button>

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
              onClick={() => setOpen(false)}
            />
            <aside
              data-notification-panel
              style={desktopPanelStyle}
              className={cn(
                "floating-panel fixed z-50 flex min-w-0 flex-col overflow-hidden border border-border bg-surface shadow-[var(--shadow-overlay)]",
                "inset-x-0 bottom-0 max-h-[min(78dvh,100%)] w-full rounded-t-xl sm:inset-auto sm:bottom-auto sm:max-h-[min(70vh,28rem)] sm:rounded-lg",
                panelActive && "is-active",
              )}
            >
              <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden" />

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
                  onClick={() => setOpen(false)}
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
                                onClick={() => setOpen(false)}
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
                              setOpen(false);
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
