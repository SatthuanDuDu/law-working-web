import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const step = await prisma.matterPlanStep.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (!step) {
    console.log("NO_STEP");
    return;
  }

  const nextStatus = step.status === "DONE" ? "IN_PROGRESS" : "DONE";
  const updated = await prisma.matterPlanStep.update({
    where: { id: step.id },
    data: {
      status: nextStatus,
      statusChangedAt: new Date(),
    },
  });
  console.log("OK", updated.id, updated.status, updated.statusChangedAt?.toISOString());

  await prisma.matterPlanStep.update({
    where: { id: step.id },
    data: {
      status: step.status,
      statusChangedAt: step.statusChangedAt,
    },
  });
  console.log("RESTORED", step.status);
}

main()
  .catch((error) => {
    console.error("FAIL", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
