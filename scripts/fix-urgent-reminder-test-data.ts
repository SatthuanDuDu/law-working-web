import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const now = new Date();
  // Window: started 30m ago, due in 90m → clearly inside [startedAt-2h, dueAt]
  const startedAt = new Date(now.getTime() - 30 * 60 * 1000);
  const dueAt = new Date(now.getTime() + 90 * 60 * 1000);

  const tests = await prisma.matterPlanStep.findMany({
    where: { title: { contains: "Test reminder" } },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });

  if (tests.length === 0) {
    console.log("No [Test reminder] steps found.");
    return;
  }

  for (let i = 0; i < tests.length; i++) {
    const step = tests[i];
    const start = new Date(startedAt.getTime() + i * 5 * 60 * 1000);
    const due = new Date(dueAt.getTime() + i * 10 * 60 * 1000);
    await prisma.matterPlanStep.update({
      where: { id: step.id },
      data: {
        status: i === 0 ? "IN_PROGRESS" : "NOT_STARTED",
        startedAt: start,
        dueAt: due,
      },
    });
    console.log("updated", {
      title: step.title.slice(0, 50),
      status: i === 0 ? "IN_PROGRESS" : "NOT_STARTED",
      startedAt: start.toISOString(),
      dueAt: due.toISOString(),
    });
  }

  // Also fix the open "Tìm hiểu..." step if due already passed
  const open = await prisma.matterPlanStep.findMany({
    where: {
      status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
      startedAt: { not: null },
      title: { not: { contains: "Test reminder" } },
    },
    select: { id: true, title: true, dueAt: true, startedAt: true },
  });
  for (const step of open) {
    if (step.dueAt && step.dueAt.getTime() < now.getTime()) {
      const start = new Date(now.getTime() - 20 * 60 * 1000);
      const due = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      await prisma.matterPlanStep.update({
        where: { id: step.id },
        data: { startedAt: start, dueAt: due },
      });
      console.log("extended open step", step.title.slice(0, 40), {
        startedAt: start.toISOString(),
        dueAt: due.toISOString(),
      });
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
