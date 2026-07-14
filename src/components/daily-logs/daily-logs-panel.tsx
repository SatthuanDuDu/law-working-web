"use client";

import { useState } from "react";
import { DailyLogForm } from "@/components/daily-logs/daily-log-form";
import { DailyLogList } from "@/components/daily-logs/daily-log-list";
import type { DailyLog, User, Matter, Client, WorkType } from "@prisma/client";

type LogWithRelations = DailyLog & {
  user: User;
  matter: Matter | null;
  client: Client | null;
  workType: WorkType | null;
};

export function DailyLogsPanel({
  logs,
  matters,
  clients,
  workTypes,
  canEditAll,
  currentUserId,
}: {
  logs: LogWithRelations[];
  matters: { id: string; code: string; title: string }[];
  clients: { id: string; name: string }[];
  workTypes: { id: string; name: string }[];
  canEditAll: boolean;
  currentUserId: string;
}) {
  const [editing, setEditing] = useState<LogWithRelations | null>(null);

  return (
    <div className="grid gap-8 xl:grid-cols-[380px_1fr]">
      <DailyLogForm
        matters={matters}
        clients={clients}
        workTypes={workTypes}
        editing={editing}
        onCancelEdit={() => setEditing(null)}
        onSaved={() => setEditing(null)}
      />
      <DailyLogList
        logs={logs}
        canEditAll={canEditAll}
        currentUserId={currentUserId}
        onEdit={(log) => setEditing(log)}
      />
    </div>
  );
}
