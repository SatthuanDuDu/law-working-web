const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Deadline used for "time remaining" on urgent popups:
 * prefer dueAt; if missing, window ends 2h after startedAt (same as active window).
 */
export function getUrgentDeadlineMs(
  startsAtIso: string,
  endsAtIso: string | null,
): number | null {
  const startsAt = new Date(startsAtIso).getTime();
  if (Number.isNaN(startsAt)) return null;
  if (endsAtIso) {
    const endsAt = new Date(endsAtIso).getTime();
    if (!Number.isNaN(endsAt)) return endsAt;
  }
  return startsAt + TWO_HOURS_MS;
}

export type UrgentRemainingParts =
  | { overdue: true }
  | {
      overdue: false;
      days: number;
      hours: number;
      minutes: number;
      totalMinutes: number;
    };

/** Break remaining ms into display parts (ceil to whole minutes). */
export function getUrgentRemainingParts(msRemaining: number): UrgentRemainingParts {
  if (msRemaining <= 0) return { overdue: true };
  const totalMinutes = Math.max(1, Math.ceil(msRemaining / 60_000));
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  return { overdue: false, days, hours, minutes, totalMinutes };
}
