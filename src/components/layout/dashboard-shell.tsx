"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { PageHeader } from "@/components/layout/page-header";
import type { UrgentReminderItem } from "@/components/layout/urgent-reminder-stack";
import { PageMetaProvider, usePageMeta } from "@/contexts/page-meta-context";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { getPageMeta } from "@/lib/page-meta";
import type { SessionUser } from "@/lib/permissions";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useMemo } from "react";

function PathnameMetaSync() {
  const pathname = usePathname();
  const { setMeta } = usePageMeta();
  const tPages = useTranslations("pages");

  useLayoutEffect(() => {
    setMeta(getPageMeta(pathname, tPages));
  }, [pathname, setMeta, tPages]);

  return null;
}

export function DashboardShell({
  user,
  unreadCount,
  urgentReminders,
  children,
}: {
  user: SessionUser;
  unreadCount: number;
  urgentReminders: UrgentReminderItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const tPages = useTranslations("pages");
  const initialMeta = useMemo(() => getPageMeta(pathname, tPages), [pathname, tPages]);

  return (
    <SidebarProvider>
      <PageMetaProvider initialMeta={initialMeta}>
        <PathnameMetaSync />
        <div className="flex min-h-screen bg-transparent">
          <div className="sticky top-0 z-30 hidden h-screen shrink-0 transition-[width] duration-300 ease-in-out lg:block">
            <Sidebar user={user} variant="desktop" />
          </div>
          <Sidebar user={user} variant="mobile" />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <PageHeader
              unreadCount={unreadCount}
              urgentReminders={urgentReminders}
            />
            <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
          </div>
        </div>
      </PageMetaProvider>
    </SidebarProvider>
  );
}
