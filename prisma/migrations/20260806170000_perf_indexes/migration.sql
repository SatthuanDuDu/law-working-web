-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Matter_status_idx" ON "Matter"("status");

-- CreateIndex
CREATE INDEX "MatterPlanStep_dueAt_idx" ON "MatterPlanStep"("dueAt");

-- CreateIndex
CREATE INDEX "MatterPlanStep_status_dueAt_idx" ON "MatterPlanStep"("status", "dueAt");

-- CreateIndex
CREATE INDEX "MatterPlanStep_startedAt_idx" ON "MatterPlanStep"("startedAt");

-- CreateIndex
CREATE INDEX "Task_assigneeId_status_dueDate_idx" ON "Task"("assigneeId", "status", "dueDate");
