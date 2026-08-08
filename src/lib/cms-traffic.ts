import { cmsDb } from "@/lib/cms-db";

function startOfUtcDay(date: Date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addUtcDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export type TrafficSummary = {
  today: number;
  last7Days: number;
};

function emptyTrafficSummary(): TrafficSummary {
  return { today: 0, last7Days: 0 };
}

function isMissingTrafficTable(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2021"
  );
}

/** Cheap totals for dashboard KPI cards. */
export async function getTrafficSummary(): Promise<TrafficSummary> {
  const today = startOfUtcDay(new Date());
  const sevenDaysAgo = addUtcDays(today, -6);

  try {
    const [todayRows, last7Rows] = await Promise.all([
      cmsDb.pageViewDaily.findMany({ where: { day: today }, select: { views: true } }),
      cmsDb.pageViewDaily.findMany({
        where: { day: { gte: sevenDaysAgo } },
        select: { views: true },
      }),
    ]);

    return {
      today: todayRows.reduce((sum, row) => sum + row.views, 0),
      last7Days: last7Rows.reduce((sum, row) => sum + row.views, 0),
    };
  } catch (error) {
    if (isMissingTrafficTable(error)) return emptyTrafficSummary();
    throw error;
  }
}

export type TrafficReport = {
  today: number;
  last7Days: number;
  last30Days: number;
  topPaths: { path: string; views: number }[];
  dailyTotals: { day: string; views: number }[];
};

/** Full breakdown for the /website/traffic page. */
export async function getTrafficReport(): Promise<TrafficReport> {
  const today = startOfUtcDay(new Date());
  const sevenDaysAgo = addUtcDays(today, -6);
  const thirtyDaysAgo = addUtcDays(today, -29);

  let rows: Awaited<ReturnType<typeof cmsDb.pageViewDaily.findMany>> = [];
  try {
    rows = await cmsDb.pageViewDaily.findMany({
      where: { day: { gte: thirtyDaysAgo } },
      orderBy: { day: "asc" },
    });
  } catch (error) {
    if (!isMissingTrafficTable(error)) throw error;
  }

  let todayTotal = 0;
  let last7Total = 0;
  let last30Total = 0;
  const byPath = new Map<string, number>();
  const byDay = new Map<string, number>();

  for (const row of rows) {
    last30Total += row.views;
    if (row.day.getTime() === today.getTime()) todayTotal += row.views;
    if (row.day.getTime() >= sevenDaysAgo.getTime()) last7Total += row.views;

    byPath.set(row.path, (byPath.get(row.path) ?? 0) + row.views);

    const dayKey = row.day.toISOString().slice(0, 10);
    byDay.set(dayKey, (byDay.get(dayKey) ?? 0) + row.views);
  }

  const topPaths = [...byPath.entries()]
    .map(([path, views]) => ({ path, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 20);

  const dailyTotals = [...byDay.entries()]
    .map(([day, views]) => ({ day, views }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));

  return {
    today: todayTotal,
    last7Days: last7Total,
    last30Days: last30Total,
    topPaths,
    dailyTotals,
  };
}
