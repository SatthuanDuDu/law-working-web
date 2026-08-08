"use client";

import {
  useShellAlertsContext,
  type ShellAlertsState,
  type ShellNotificationPreview,
} from "@/contexts/shell-alerts-context";

export type { ShellNotificationPreview, ShellAlertsState };

/** Shared shell alerts — polling runs once in ShellAlertsProvider. */
export function useShellAlerts(): ShellAlertsState {
  return useShellAlertsContext();
}
