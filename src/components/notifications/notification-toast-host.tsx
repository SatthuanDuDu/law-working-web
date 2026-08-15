"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  NotificationToastStack,
  type NotificationToastItem,
} from "@/components/notifications/notification-toast-stack";
import {
  useShellAlerts,
  type ShellNotificationPreview,
} from "@/hooks/use-shell-alerts";

function previewToToast(item: ShellNotificationPreview): NotificationToastItem {
  return {
    key: item.id,
    title: item.title,
    message: item.message,
    link: item.link,
    notificationId: item.id,
  };
}

function toAppPath(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.origin !== window.location.origin) return "/dashboard";
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/dashboard";
  } catch {
    return url.startsWith("/") ? url : "/dashboard";
  }
}

/**
 * Watches shell-alerts + service-worker push messages and surfaces new
 * notifications as sliding toasts (right edge). Skips the first snapshot so
 * existing unread items do not toast on every page load.
 */
export function NotificationToastHost() {
  const router = useRouter();
  const { latestUnread, hydrated } = useShellAlerts();
  const [toasts, setToasts] = useState<NotificationToastItem[]>([]);
  const seededRef = useRef(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const toastKeysRef = useRef<Set<string>>(new Set());

  const pushToast = useCallback((item: NotificationToastItem) => {
    if (toastKeysRef.current.has(item.key)) return;
    toastKeysRef.current.add(item.key);
    setToasts((prev) => [item, ...prev].slice(0, 5));
  }, []);

  const dismissToast = useCallback((key: string) => {
    toastKeysRef.current.delete(key);
    setToasts((prev) => prev.filter((item) => item.key !== key));
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    if (!seededRef.current) {
      for (const item of latestUnread) {
        knownIdsRef.current.add(item.id);
      }
      seededRef.current = true;
      return;
    }

    for (const item of latestUnread) {
      if (knownIdsRef.current.has(item.id)) continue;
      knownIdsRef.current.add(item.id);
      pushToast(previewToToast(item));
    }
  }, [hydrated, latestUnread, pushToast]);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || typeof data !== "object") return;

      if (data.type === "NSLAW_NAVIGATE" && typeof data.url === "string") {
        router.push(toAppPath(data.url));
        return;
      }

      if (data.type !== "NSLAW_NOTIFICATION") return;
      const payload = data.payload as {
        title?: string;
        message?: string;
        link?: string;
        tag?: string;
        notificationId?: string | null;
      } | null;
      if (!payload?.title) return;

      // Prefer the DB id so polling never re-toasts the same notification.
      const key =
        payload.notificationId ||
        `push:${payload.tag || payload.title}:${payload.message || ""}`;
      if (payload.notificationId) {
        knownIdsRef.current.add(payload.notificationId);
      }

      pushToast({
        key,
        title: payload.title,
        message: payload.message || "",
        link: payload.link || "/dashboard",
        notificationId: payload.notificationId || undefined,
      });
    }

    navigator.serviceWorker?.addEventListener("message", onMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", onMessage);
    };
  }, [pushToast, router]);

  return <NotificationToastStack items={toasts} onDismiss={dismissToast} />;
}
