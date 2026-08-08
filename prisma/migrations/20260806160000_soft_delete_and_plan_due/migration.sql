-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'PLAN_DUE';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Matter" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MatterPlanStep" ADD COLUMN "reminderSentAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Client_deletedAt_idx" ON "Client"("deletedAt");

-- CreateIndex
CREATE INDEX "Matter_deletedAt_idx" ON "Matter"("deletedAt");
