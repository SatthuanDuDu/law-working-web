const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Active window: from 2h before thời gian diễn ra (startedAt)
 * until hết thời gian dự kiến hoàn thành (dueAt).
 * If dueAt is missing, window ends 2h after startedAt.
 */
export function isUrgentReminderActive(
  nowMs: number,
  startsAtIso: string,
  endsAtIso: string | null,
): boolean {
  const startsAt = new Date(startsAtIso).getTime();
  if (Number.isNaN(startsAt)) return false;
  const windowStart = startsAt - TWO_HOURS_MS;
  const windowEnd = endsAtIso
    ? new Date(endsAtIso).getTime()
    : startsAt + TWO_HOURS_MS;
  if (Number.isNaN(windowEnd)) return false;
  return nowMs >= windowStart && nowMs <= windowEnd;
}
