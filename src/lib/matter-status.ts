import type { MatterStatus } from "@prisma/client";

/** View-only: no edits, no matter-linked deadline/urgent reminders. */
export const MATTER_EDIT_LOCKED_STATUSES = ["ARCHIVED", "TERMINATED"] as const;

export type MatterEditLockedStatus =
  (typeof MATTER_EDIT_LOCKED_STATUSES)[number];

export function isMatterEditLocked(
  status: MatterStatus | string | null | undefined,
): boolean {
  return status === "ARCHIVED" || status === "TERMINATED";
}

export const MATTER_EDIT_LOCKED_MESSAGE =
  "Vụ việc đã lưu trữ hoặc chấm dứt — chỉ được xem, không thể chỉnh sửa" as const;
