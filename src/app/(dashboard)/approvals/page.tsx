import { AppShell } from "@/components/layout/app-shell";
import { ApprovalList } from "@/components/approvals/approval-list";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export default async function ApprovalsPage() {
  const user = await requireRole(["ADMIN", "MANAGER"]);

  const logs = await prisma.dailyLog.findMany({
    where: { status: "PENDING_APPROVAL" },
    include: {
      user: { select: { name: true } },
      matter: { select: { code: true } },
      workType: { select: { name: true } },
    },
    orderBy: { date: "desc" },
  });

  const serialized = logs.map((log) => ({
    id: log.id,
    date: log.date.toISOString(),
    description: log.description,
    minutes: log.minutes,
    isBillable: log.isBillable,
    user: log.user,
    matter: log.matter,
    workType: log.workType,
  }));

  return (
    <AppShell
      user={user}
      title="Phê duyệt timesheet"
      description="Duyệt hoặc từ chối bản ghi giờ làm nhân viên gửi lên"
    >
      <ApprovalList logs={serialized} />
    </AppShell>
  );
}
