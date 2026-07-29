const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export { TWO_HOURS_MS };

/**
 * Urgent popup window for incomplete plans:
 * - With dueAt: only within the last 2 hours before dueAt (countdown ≤ 2h).
 * - Without dueAt: from 2h before startedAt until 2h after startedAt.
 */
export function isUrgentReminderActive(
  nowMs: number,
  startsAtIso: string,
  endsAtIso: string | null,
): boolean {
  const startsAt = new Date(startsAtIso).getTime();
  if (Number.isNaN(startsAt)) return false;

  let windowStart: number;
  let windowEnd: number;

  if (endsAtIso) {
    const endsAt = new Date(endsAtIso).getTime();
    if (Number.isNaN(endsAt)) return false;
    windowStart = endsAt - TWO_HOURS_MS;
    windowEnd = endsAt;
  } else {
    windowStart = startsAt - TWO_HOURS_MS;
    windowEnd = startsAt + TWO_HOURS_MS;
  }

  return nowMs >= windowStart && nowMs <= windowEnd;
}
