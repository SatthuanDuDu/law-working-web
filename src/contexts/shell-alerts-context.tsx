"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import type { UrgentReminderItem } from "@/components/layout/urgent-reminder-stack";

export type ShellNotificationPreview = {
  id: string;
  title: string;
  message: string;
  link: string | null;
  type: string;
  createdAt: string;
};

export type ShellAlertsState = {
  unreadCount: number;
  urgentReminders: UrgentReminderItem[];
  unreadChatCount: number;
  upcomingDueCount: number;
  latestUnread: ShellNotificationPreview[];
  hydrated: boolean;
  refresh: () => Promise<void>;
};

const EMPTY: Omit<ShellAlertsState, "hydrated" | "refresh"> = {
  unreadCount: 0,
  urgentReminders: [],
  unreadChatCount: 0,
  upcomingDueCount: 0,
  latestUnread: [],
};

/** Fallback poll when SSE is down. */
const FALLBACK_REFRESH_MS = 45_000;
/** Slower backup while SSE is connected. */
const SSE_BACKUP_REFRESH_MS = 60_000;

/** Dispatched when SSE sends a chat nudge (chat-workspace listens). */
export const CHAT_SSE_REFRESH_EVENT = "nslaw:chat-refresh";

async function fetchShellAlerts(): Promise<Omit<ShellAlertsState, "hydrated" | "refresh"> | null> {
  try {
    const res = await fetch("/api/shell-alerts", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<typeof EMPTY>;
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

const ShellAlertsContext = createContext<ShellAlertsState | null>(null);

export function ShellAlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState(EMPTY);
  const [hydrated, setHydrated] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const refreshRef = useRef<() => Promise<void>>(async () => {});

  const apply = useCallback((next: Omit<ShellAlertsState, "hydrated" | "refresh">) => {
    startTransition(() => {
      setAlerts(next);
      setHydrated(true);
    });
  }, []);

  const refresh = useCallback(async () => {
    const next = await fetchShellAlerts();
    if (next) apply(next);
  }, [apply]);

  refreshRef.current = refresh;

  useEffect(() => {
    let cancelled = false;

    void fetchShellAlerts().then((next) => {
      if (!cancelled && next) apply(next);
    });

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [apply]);

  // SSE nudges — primary refresh path when connected.
  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (closed) return;
      es?.close();
      es = new EventSource("/api/events");

      es.addEventListener("shell-alerts", () => {
        setSseConnected(true);
        void refreshRef.current();
      });

      es.addEventListener("chat", () => {
        setSseConnected(true);
        window.dispatchEvent(new Event(CHAT_SSE_REFRESH_EVENT));
      });

      es.onopen = () => {
        setSseConnected(true);
      };

      es.onerror = () => {
        setSseConnected(false);
        es?.close();
        es = null;
        if (closed) return;
        // Reconnect after a short delay; interval fallback covers the gap.
        retryTimer = setTimeout(connect, 5_000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      es?.close();
      setSseConnected(false);
    };
  }, []);

  // Interval: 60s backup while SSE healthy, 45s fallback when not.
  useEffect(() => {
    const ms = sseConnected ? SSE_BACKUP_REFRESH_MS : FALLBACK_REFRESH_MS;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refreshRef.current();
    }, ms);
    return () => window.clearInterval(timer);
  }, [sseConnected]);

  const value = useMemo<ShellAlertsState>(
    () => ({ ...alerts, hydrated, refresh }),
    [alerts, hydrated, refresh],
  );

  return (
    <ShellAlertsContext.Provider value={value}>{children}</ShellAlertsContext.Provider>
  );
}

export function useShellAlertsContext(): ShellAlertsState {
  const ctx = useContext(ShellAlertsContext);
  if (!ctx) {
    throw new Error("useShellAlertsContext must be used within ShellAlertsProvider");
  }
  return ctx;
}
