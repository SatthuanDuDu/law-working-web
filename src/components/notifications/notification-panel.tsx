"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, X } from "lucide-react";
import type { Notification, NotificationType } from "@prisma/client";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions";
import { NOTIFICATION_TYPE_LABELS } from "@/lib/constants";
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

  const displayedUnread = Math.max(0, unreadCount - readLocally);

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
    <>
      <button
        type="button"
        aria-label="Thông báo"
        className="relative rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 hover:text-primary"
        onClick={openPanel}
      >
        <Bell className="h-5 w-5" />
        {displayedUnread > 0 && (
          <span className="absolute right-1 top-1 flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Đóng thông báo"
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside
            className={cn(
              "absolute right-0 top-0 flex h-[66vh] w-1/3 min-w-[320px] max-w-lg flex-col",
              "border-l border-white/40 bg-white/85 shadow-2xl backdrop-blur-md",
            )}
          >
            <div className="flex items-center justify-between border-b border-slate-200/80 px-4 py-3">
              <div>
                <h2 className="font-semibold text-slate-900">Thông báo</h2>
                {displayedUnread > 0 && (
                  <p className="text-xs text-slate-500">{displayedUnread} chưa đọc</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isPending || displayedUnread === 0}
                  onClick={markAllRead}
                >
                  Đánh dấu đã đọc
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

            <div className="flex gap-1 border-b border-slate-200/80 px-4 py-2">
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm",
                  tab === "unread"
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
                onClick={() => setTab("unread")}
              >
                Thông báo mới
              </button>
              <button
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm",
                  tab === "read"
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:bg-slate-100",
                )}
                onClick={() => setTab("read")}
              >
                Đã đọc
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 border-b border-slate-200/80 px-4 py-3">
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

            <div className="flex-1 overflow-y-auto px-4 py-3">
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
                        "rounded-lg border p-3",
                        notification.isRead
                          ? "border-slate-200 bg-white/70"
                          : "border-primary/20 bg-primary-muted/80",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">
                            {notification.title}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {notification.message}
                          </p>
                          <p className="mt-2 text-xs text-slate-400">
                            {formatDateTime(notification.createdAt)} •{" "}
                            {NOTIFICATION_TYPE_LABELS[notification.type]}
                          </p>
                          {notification.link && (
                            <Link
                              href={notification.link}
                              className="mt-2 inline-block text-sm text-primary hover:underline"
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
                          <Badge variant="warning">Mới</Badge>
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
        </div>
      )}
    </>
  );
}
