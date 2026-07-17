"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { PageHeader } from "@/components/layout/page-header";
import { PageMetaProvider, usePageMeta } from "@/contexts/page-meta-context";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { getPageMeta } from "@/lib/page-meta";
import type { SessionUser } from "@/lib/permissions";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useMemo } from "react";

function PathnameMetaSync() {
  const pathname = usePathname();
  const { setMeta } = usePageMeta();

  useLayoutEffect(() => {
    setMeta(getPageMeta(pathname));
  }, [pathname, setMeta]);

  return null;
}

export function DashboardShell({
  user,
  unreadCount,
  children,
}: {
  user: SessionUser;
  unreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const initialMeta = useMemo(() => getPageMeta(pathname), [pathname]);

  return (
    <SidebarProvider>
      <PageMetaProvider initialMeta={initialMeta}>
        <PathnameMetaSync />
        <div className="flex min-h-screen bg-muted/40">
          <div className="sticky top-0 z-30 hidden h-screen shrink-0 transition-[width] duration-300 ease-in-out lg:block">
            <Sidebar user={user} variant="desktop" />
          </div>
          <Sidebar user={user} variant="mobile" />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <PageHeader unreadCount={unreadCount} />
            <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
          </div>
        </div>
      </PageMetaProvider>
    </SidebarProvider>
  );
}
