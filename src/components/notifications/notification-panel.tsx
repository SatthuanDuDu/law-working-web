"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import type { Notification, NotificationType } from "@prisma/client";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/constants";
import { useOverlayAnimation } from "@/hooks/use-overlay-animation";
import { Button } from "@/components/ui/button";
import { Label, Select } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

type TabKey = "unread" | "read";

export function NotificationPanel({ unreadCount }: { unreadCount: number }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabKey>("unread");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState("");
  const [filterType, setFilterType] = useState<NotificationType | "">("");
  const [readLocally, setReadLocally] = useState(0);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const [panelAnchor, setPanelAnchor] = useState<{
    top: number;
    right: number;
    width: number;
  } | null>(null);
  const [isDesktopPanel, setIsDesktopPanel] = useState(false);
  const { mounted: panelMounted, active: panelActive } = useOverlayAnimation(open);

  const displayedUnread = Math.max(0, unreadCount - readLocally);

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
    if (!open || !isDesktopPanel) {
      setPanelAnchor(null);
      return;
    }

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
      if (tab === "read" && !item.isRead) return false;
      if (filterType && item.type !== filterType) return false;
      if (filterDate) {
        const itemDate = new Date(item.createdAt).toISOString().split("T")[0];
        if (itemDate !== filterDate) return false;
      }
      return true;
    });
  }, [notifications, tab, filterType, filterDate]);

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
        aria-label="Thông báo"
        aria-expanded={open}
        className="interactive-press relative rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-primary"
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
              aria-label="Đóng thông báo"
              data-notification-panel
              className={cn(
                "overlay-backdrop fixed inset-0 z-40 bg-slate-900/25 sm:hidden",
                panelActive && "is-active",
              )}
              onClick={() => setOpen(false)}
            />
            <aside
              data-notification-panel
              style={
                isDesktopPanel && panelAnchor
                  ? {
                      top: panelAnchor.top,
                      right: panelAnchor.right,
                      width: panelAnchor.width,
                    }
                  : undefined
              }
              className={cn(
                "floating-panel fixed z-50 flex min-w-0 flex-col overflow-hidden border border-slate-200 bg-white shadow-[var(--shadow-overlay)]",
                "inset-x-0 bottom-0 max-h-[min(88dvh,100%)] w-full rounded-t-lg sm:inset-auto sm:bottom-auto sm:max-h-[min(66vh,32rem)] sm:rounded-lg",
                panelActive && "is-active",
              )}
            >
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-slate-900">Thông báo</h2>
                {displayedUnread > 0 && (
                  <p className="text-xs text-slate-500">{displayedUnread} chưa đọc</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending || displayedUnread === 0}
                  onClick={markAllRead}
                  aria-label="Đánh dấu đã đọc"
                >
                  <span className="sm:hidden">Đã đọc</span>
                  <span className="hidden sm:inline">Đánh dấu đã đọc</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  aria-label="Đóng"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-4 py-2">
              <button
                type="button"
                className={cn(
                  "interactive-press shrink-0 rounded-md px-3 py-1.5 text-sm",
                  tab === "unread"
                    ? "bg-primary text-white hover:bg-primary-hover"
                    : "text-slate-600 hover:bg-slate-100",
                )}
                onClick={() => setTab("unread")}
              >
                Thông báo mới
              </button>
              <button
                type="button"
                className={cn(
                  "interactive-press shrink-0 rounded-md px-3 py-1.5 text-sm",
                  tab === "read"
                    ? "bg-primary text-white hover:bg-primary-hover"
                    : "text-slate-600 hover:bg-slate-100",
                )}
                onClick={() => setTab("read")}
              >
                Đã đọc
              </button>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-2 border-b border-slate-200 bg-white px-4 py-3 sm:grid-cols-2">
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
                    setFilterType(e.target.value as NotificationType | "")
                  }
                >
                  <option value="">Tất cả</option>
                  {Object.entries(NOTIFICATION_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white px-4 py-3">
              {loading ? (
                <p className="text-sm text-slate-500">Đang tải...</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-slate-500">Không có thông báo nào.</p>
              ) : (
                <div className="space-y-3">
                  {filtered.map((notification) => (
                    <div
                      key={notification.id}
                      className={cn(
                        "rounded-md border p-3",
                        notification.isRead
                          ? "border-slate-200 bg-slate-50"
                          : "border-primary/20 bg-primary-muted",
                      )}
                    >
                      <div className="flex min-w-0 items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-medium text-slate-900">
                            {notification.title}
                          </p>
                          <p className="mt-1 break-words text-sm text-slate-600">
                            {notification.message}
                          </p>
                          <p className="mt-2 break-words text-xs text-slate-400">
                            {formatDateTime(notification.createdAt)} •{" "}
                            {NOTIFICATION_TYPE_LABELS[notification.type]}
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
                              Xem chi tiết
                            </Link>
                          )}
                        </div>
                        {!notification.isRead && (
                          <Badge variant="warning" className="shrink-0">
                            Mới
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
                          Đánh dấu đã đọc
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
