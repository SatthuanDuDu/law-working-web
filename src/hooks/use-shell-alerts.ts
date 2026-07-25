"use client";

import { useCallback, useEffect, useState, startTransition } from "react";
import type { UrgentReminderItem } from "@/components/layout/urgent-reminder-stack";

export type ShellNotificationPreview = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  type: string;
  createdAt: string;
};

type ShellAlerts = {
  unreadCount: number;
  urgentReminders: UrgentReminderItem[];
  unreadChatCount: number;
  upcomingDueCount: number;
  latestUnread: ShellNotificationPreview[];
};

const EMPTY: ShellAlerts = {
  unreadCount: 0,
  urgentReminders: [],
  unreadChatCount: 0,
  upcomingDueCount: 0,
  latestUnread: [],
};
/** Faster when tab visible so in-app toasts appear sooner. */
const REFRESH_MS = 20_000;

async function fetchShellAlerts(): Promise<ShellAlerts | null> {
  try {
    const res = await fetch("/api/shell-alerts", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<ShellAlerts>;
    return {
      unreadCount: typeof data.unreadCount === "number" ? data.unreadCount : 0,
      urgentReminders: Array.isArray(data.urgentReminders)
        ? data.urgentReminders
        : [],
      unreadChatCount:
        typeof data.unreadChatCount === "number" ? data.unreadChatCount : 0,
      upcomingDueCount:
        typeof data.upcomingDueCount === "number" ? data.upcomingDueCount : 0,
      latestUnread: Array.isArray(data.latestUnread) ? data.latestUnread : [],
    };
  } catch {
    return null;
  }
}

export function useShellAlerts() {
  const [alerts, setAlerts] = useState<ShellAlerts>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  const apply = useCallback((next: ShellAlerts) => {
    startTransition(() => {
      setAlerts(next);
      setHydrated(true);
    });
  }, []);

  const refresh = useCallback(async () => {
    const next = await fetchShellAlerts();
    if (next) apply(next);
  }, [apply]);

  useEffect(() => {
    let cancelled = false;

    void fetchShellAlerts().then((next) => {
      if (!cancelled && next) apply(next);
    });

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void fetchShellAlerts().then((next) => {
        if (!cancelled && next) apply(next);
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void fetchShellAlerts().then((next) => {
        if (!cancelled && next) apply(next);
      });
    }, REFRESH_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.clearInterval(timer);
    };
  }, [apply]);

  return { ...alerts, hydrated, refresh };
}
