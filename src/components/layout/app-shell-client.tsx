"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { PageHeader } from "@/components/layout/page-header";
import type { SessionUser } from "@/lib/permissions";

export function AppShellClient({
  user,
  unreadCount,
  title,
  description,
  children,
}: {
  user: SessionUser;
  unreadCount: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-background">
      <div className="sticky top-0 h-screen shrink-0">
        <Sidebar user={user} />
      </div>
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <PageHeader
          userRole={user.role}
          title={title}
          description={description}
          unreadCount={unreadCount}
        />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
