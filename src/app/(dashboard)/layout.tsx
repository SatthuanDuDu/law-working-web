import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getMatterFormData } from "@/lib/matter-form-data";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const [unreadCount, matterFormData] = await Promise.all([
    prisma.notification.count({
      where: { userId: user.id, isRead: false },
    }),
    getMatterFormData(user),
  ]);

  return (
    <DashboardShell
      user={user}
      unreadCount={unreadCount}
      matterFormData={matterFormData}
    >
      {children}
    </DashboardShell>
  );
}
