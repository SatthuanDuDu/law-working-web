import { PrismaClient } from "@prisma/client";
import { isUrgentReminderActive } from "../src/lib/urgent-reminder-window";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  const nowMs = now.getTime();

  console.log("now ISO:", now.toISOString());
  console.log("now local:", now.toString());

  const tests = await prisma.matterPlanStep.findMany({
    where: { title: { contains: "Test reminder" } },
    select: {
      title: true,
      status: true,
      startedAt: true,
      dueAt: true,
      matter: { select: { code: true } },
    },
    orderBy: { startedAt: "asc" },
  });

  console.log("\n=== Test reminder steps ===", tests.length);
  for (const s of tests) {
    const active =
      s.startedAt != null &&
      isUrgentReminderActive(
        nowMs,
        s.startedAt.toISOString(),
        s.dueAt?.toISOString() ?? null,
      );
    console.log({
      title: s.title.slice(0, 55),
      status: s.status,
      startedAt: s.startedAt?.toISOString() ?? "NULL",
      dueAt: s.dueAt?.toISOString() ?? "NULL",
      active,
      reason: !s.startedAt
        ? "missing startedAt"
        : s.dueAt && s.dueAt < s.startedAt
          ? "dueAt before startedAt"
          : active
            ? "IN WINDOW"
            : "outside window (need now in [startedAt-2h, dueAt])",
    });
  }

  const open = await prisma.matterPlanStep.findMany({
    where: {
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      startedAt: { not: null },
    },
    select: {
      title: true,
      status: true,
      startedAt: true,
      dueAt: true,
    },
    take: 20,
  });
  console.log("\n=== Open steps with startedAt ===", open.length);
  for (const s of open) {
    const active = isUrgentReminderActive(
      nowMs,
      s.startedAt!.toISOString(),
      s.dueAt?.toISOString() ?? null,
    );
    console.log({
      title: s.title.slice(0, 40),
      startedAt: s.startedAt!.toISOString(),
      dueAt: s.dueAt?.toISOString() ?? "NULL",
      active,
    });
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
