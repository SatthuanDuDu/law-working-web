"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, Clock, X } from "lucide-react";
import type { Notification, NotificationType } from "@prisma/client";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { useLocale, useTranslations } from "next-intl";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { UrgentReminderItem } from "@/components/layout/urgent-reminder-stack";
import { isUrgentReminderActive } from "@/lib/urgent-reminder-window";

type TabKey = "unread" | "read";
type FilterType = NotificationType | "URGENT_DUE" | "";

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
  const { notificationType } = useLabelMaps();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("unread");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterType, setFilterType] = useState<FilterType>("");
  const [readLocally, setReadLocally] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [now, setNow] = useState(() => Date.now());
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
      urgentReminders.filter((item) =>
        isUrgentReminderActive(now, item.startsAt, item.endsAt),
      ),
    [urgentReminders, now],
  );

  const displayedUnread = Math.max(0, unreadCount - readLocally) + activeUrgent.length;

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, [open]);

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
        right: Math.max(16, window.innerWidth - rect.right),
        width: Math.min(448, Math.max(320, window.innerWidth - 32)),
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
    setNow(Date.now());
    loadNotifications();
  }

  const filteredUrgent = useMemo(() => {
    if (filterType && filterType !== "URGENT_DUE") return [];
    return activeUrgent.filter((item) => {
      if (!filterDate) return true;
      const itemDate = new Date(item.startsAt).toISOString().split("T")[0];
      return itemDate === filterDate;
    });
  }, [activeUrgent, filterType, filterDate]);

  const filtered = useMemo(() => {
    if (filterType === "URGENT_DUE") return [];
    return notifications.filter((item) => {
      if (tab === "unread" && item.isRead) return false;
      if (tab === "read" && !item.isRead) return false;
      if (filterType && item.type !== filterType) return false;
      if (filterDate) {
        const itemDate = new Date(item.createdAt).toISOString().split("T")[0];
        if (itemDate !== filterDate) return false;
      }
      return true;
    });
  }, [notifications, tab, filterType, filterDate]);

  const showUrgent = filteredUrgent.length > 0 && (tab === "unread" || tab === "read");
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
                "overlay-backdrop fixed inset-0 z-40 bg-slate-900/25 sm:hidden",
                panelActive && "is-active",
              )}
              onClick={() => setOpen(false)}
            />
            <aside
              data-notification-panel
              style={desktopPanelStyle}
              className={cn(
                "floating-panel fixed z-50 flex min-w-0 flex-col overflow-hidden border border-border bg-surface shadow-[var(--shadow-overlay)]",
                "inset-x-0 bottom-0 max-h-[min(88dvh,100%)] w-full rounded-t-lg sm:inset-auto sm:bottom-auto sm:max-h-[min(66vh,32rem)] sm:rounded-lg",
                panelActive && "is-active",
              )}
            >
            <div className="flex items-start justify-between gap-2 border-b border-border bg-surface px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-foreground">{t("title")}</h2>
                {displayedUnread > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {displayedUnread} {t("unread").toLowerCase()}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending || Math.max(0, unreadCount - readLocally) === 0}
                  onClick={markAllRead}
                  aria-label={t("markAllRead")}
                >
                  <span className="sm:hidden">{t("markAllRead")}</span>
                  <span className="hidden sm:inline">{t("markAllRead")}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  aria-label={tCommon("close")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-border bg-surface px-4 py-2">
              <button
                type="button"
                className={cn(
                  "interactive-press shrink-0 rounded-md px-3 py-1.5 text-sm",
                  tab === "unread"
                    ? "bg-primary text-white hover:bg-primary-hover"
                    : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setTab("unread")}
              >
                {t("unread")}
              </button>
              <button
                type="button"
                className={cn(
                  "interactive-press shrink-0 rounded-md px-3 py-1.5 text-sm",
                  tab === "read"
                    ? "bg-primary text-white hover:bg-primary-hover"
                    : "text-muted-foreground hover:bg-muted",
                )}
                onClick={() => setTab("read")}
              >
                {tCommon("all")}
              </button>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-2 border-b border-border bg-surface px-4 py-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="filter-date" className="text-xs">
                  Lọc theo ngày
                </Label>
                <Input
                  id="filter-date"
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="filter-type" className="text-xs">
                  Loại thông báo
                </Label>
                <Select
                  id="filter-type"
                  value={filterType}
                  onChange={(e) =>
                    setFilterType(e.target.value as FilterType)
                  }
                >
                  <option value="">{tCommon("all")}</option>
                  <option value="URGENT_DUE">{t("urgentType")}</option>
                  {Object.entries(notificationType).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-surface px-4 py-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
              ) : listEmpty ? (
                <p className="text-sm text-muted-foreground">{t("empty")}</p>
              ) : (
                <div className="space-y-3">
                  {showUrgent ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                        {t("urgentSection")}
                      </p>
                      {filteredUrgent.map((item) => {
                        const countdown = reminderCountdown(
                          item,
                          now,
                          tReminder,
                          tCommon,
                        );
                        return (
                          <div
                            key={`urgent:${item.id}:${item.startsAt}`}
                            className="rounded-md border border-rose-200 bg-rose-50 p-3 dark:border-rose-900/50 dark:bg-rose-950/30"
                          >
                            <div className="flex min-w-0 items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <Link
                                  href={item.href}
                                  className="interactive-link break-words font-medium text-foreground"
                                  onClick={() => setOpen(false)}
                                >
                                  {item.title}
                                </Link>
                                <p className="mt-1 flex min-w-0 items-center gap-1 break-words text-sm text-rose-800 dark:text-rose-200">
                                  <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                  <span>
                                    {t("urgentMessage", {
                                      time: item.timeLabel,
                                      countdown,
                                    })}
                                  </span>
                                </p>
                                <p className="mt-2 break-words text-xs text-muted-foreground">
                                  {t("urgentType")}
                                </p>
                                <Link
                                  href={item.href}
                                  className="interactive-link mt-2 inline-block text-sm text-primary"
                                  onClick={() => setOpen(false)}
                                >
                                  {tCommon("details")}
                                </Link>
                              </div>
                              <Badge variant="warning" className="shrink-0">
                                {t("urgentSection")}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {filtered.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "rounded-md border p-3",
                        notification.isRead
                          ? "border-border bg-muted"
                          : "border-primary/20 bg-primary-muted",
                      )}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-medium text-foreground">
                            {notification.title}
                          </p>
                          <p className="mt-1 break-words text-sm text-muted-foreground">
                            {notification.message}
                          </p>
                          <p className="mt-2 break-words text-xs text-muted-foreground">
                            {formatDateTime(notification.createdAt, locale)} •{" "}
                            {notificationType[notification.type]}
                          </p>
                          {notification.link && (
                            <Link
                              href={notification.link}
                              className="interactive-link mt-2 inline-block text-sm text-primary"
                              onClick={() => {
                                markRead(notification.id);
                                setOpen(false);
                              }}
                            >
                              {tCommon("details")}
                            </Link>
                          )}
                        </div>
                        {!notification.isRead && (
                          <Badge variant="warning" className="shrink-0">
                            {t("unread")}
                          </Badge>
                        )}
                      </div>
                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          disabled={isPending}
                          onClick={() => markRead(notification.id)}
                        >
                          {t("markAllRead")}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            </aside>
          </>,
          document.body,
        )}
    </div>
  );
}
