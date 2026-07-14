import { AppShellClient } from "@/components/layout/app-shell-client";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/permissions";

export async function AppShell({
  user,
  children,
  title,
  description,
}: {
  user: SessionUser;
  children: React.ReactNode;
  title: string;
  description?: string;
}) {
  const unreadCount = await prisma.notification.count({
    where: { userId: user.id, isRead: false },
  });

  return (
    <AppShellClient
      user={user}
      unreadCount={unreadCount}
      title={title}
      description={description}
    >
      {children}
    </AppShellClient>
  );
}
