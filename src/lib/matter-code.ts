import type { MatterType } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";
import { MATTER_TYPE_LABELS } from "@/lib/constants";

const MATTER_TYPE_CODES: Record<MatterType, string> = {
  CIVIL: "DS",
  CRIMINAL: "HS",
  CORPORATE: "DN",
  LABOR: "LD",
  FAMILY: "HN",
  OTHER: "OT",
};

const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";

export function getMatterTypeCode(type: MatterType, customTypeLabel?: string | null) {
  if (type === "OTHER" && customTypeLabel?.trim()) {
    const normalized = customTypeLabel
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 3);
    return normalized || "OT";
  }
  return MATTER_TYPE_CODES[type];
}

export function getVietnamDayRange(now = new Date()) {
  const dateId = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIMEZONE,
  })
    .format(now)
    .replace(/-/g, "");

  const vnDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIMEZONE,
  }).format(now);

  const start = new Date(`${vnDate}T00:00:00+07:00`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  return { dateId, start, end };
}

export function buildMatterCode(
  type: MatterType,
  customTypeLabel: string | null | undefined,
  dailySequence: number,
  now = new Date(),
) {
  const typeCode = getMatterTypeCode(type, customTypeLabel);
  const { dateId } = getVietnamDayRange(now);
  const sequence = String(dailySequence).padStart(3, "0");
  return `${typeCode}-${dateId}-${now.getTime()}-${sequence}`;
}

export async function countTodayMatters(db: Pick<PrismaClient, "matter">) {
  const { start, end } = getVietnamDayRange();
  return db.matter.count({
    where: {
      createdAt: {
        gte: start,
        lt: end,
      },
    },
  });
}

export async function generateMatterCode(
  db: Pick<PrismaClient, "matter">,
  type: MatterType,
  customTypeLabel?: string | null,
) {
  const todayCount = await countTodayMatters(db);
  return buildMatterCode(type, customTypeLabel, todayCount + 1);
}

export function getMatterTypeDisplay(
  type: MatterType,
  customTypeLabel?: string | null,
) {
  if (type === "OTHER" && customTypeLabel?.trim()) {
    return customTypeLabel.trim();
  }
  return MATTER_TYPE_LABELS[type];
}
