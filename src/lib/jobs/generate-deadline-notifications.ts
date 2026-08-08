import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { generateDeadlineReminders } from "@/lib/deadline-reminders";

const prisma = new PrismaClient();

async function main() {
  const result = await generateDeadlineReminders(prisma);
  console.log(
    `Created ${result.taskReminders} task + ${result.planReminders} plan deadline notifications.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
