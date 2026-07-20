import { DashboardShell } from "@/components/layout/dashboard-shell";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getUrgentReminders } from "@/lib/urgent-reminders";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const [unreadCount, urgentReminders] = await Promise.all([
    prisma.notification.count({
      where: { userId: user.id, isRead: false },
    }),
    getUrgentReminders(user.id, user.role),
  ]);

  return (
    <DashboardShell
      user={user}
      unreadCount={unreadCount}
      urgentReminders={urgentReminders}
    >
      {children}
    </DashboardShell>
  );
}
