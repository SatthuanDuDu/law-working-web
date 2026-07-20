import type { PrismaClient } from "@prisma/client";

const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";

function getVietnamYear(now = new Date()) {
  return new Intl.DateTimeFormat("en", {
    timeZone: VIETNAM_TIMEZONE,
    year: "numeric",
  }).format(now);
}

export function buildClientCode(year: string, sequence: number) {
  return `KH-${year}-${String(sequence).padStart(4, "0")}`;
}

export async function generateClientCode(db: Pick<PrismaClient, "client">) {
  const year = getVietnamYear();
  const prefix = `KH-${year}-`;
  const latest = await db.client.findFirst({
    where: { code: { startsWith: prefix } },
    orderBy: { code: "desc" },
    select: { code: true },
  });

  let next = 1;
  if (latest?.code) {
    const tail = latest.code.slice(prefix.length);
    const parsed = Number.parseInt(tail, 10);
    if (Number.isFinite(parsed)) next = parsed + 1;
  }

  // Avoid rare collisions under concurrent creates
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = buildClientCode(year, next + attempt);
    const existing = await db.client.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!existing) return code;
  }

  return `KH-${year}-${Date.now()}`;
}
