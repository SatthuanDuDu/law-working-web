"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { PageHeader } from "@/components/layout/page-header";
import { UtilitySpeedDial } from "@/components/layout/utility-speed-dial";
import { CommandPalette } from "@/components/layout/command-palette";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { NotificationToastHost } from "@/components/notifications/notification-toast-host";
import {
  PageMetaProvider,
  usePageMeta,
  type PageMeta,
} from "@/contexts/page-meta-context";
import { PersonalTodoPanel } from "@/components/personal-todo/personal-todo-panel";
import { PersonalTodoPanelProvider } from "@/contexts/personal-todo-panel-context";
import { ShellAlertsProvider } from "@/contexts/shell-alerts-context";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { getPageMeta } from "@/lib/page-meta";
import type { SessionUser } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";

function PathnameMetaSync() {
  const pathname = usePathname();
  const { setMeta } = usePageMeta();
  const tPages = useTranslations("pages");

  // Static routes only. Dynamic /matters/[id]… titles come from serverMeta + PageHeaderSlot.
  useLayoutEffect(() => {
    const isDynamicMatter =
      pathname.startsWith("/matters/") && pathname !== "/matters";
    if (isDynamicMatter) return;
    setMeta(getPageMeta(pathname, tPages));
  }, [pathname, setMeta]); // eslint-disable-line react-hooks/exhaustive-deps -- tPages intentionally omitted

  return null;
}

function ServerMetaSync({ meta }: { meta: PageMeta }) {
  const { setMeta } = usePageMeta();
  const lastKey = useRef("");

  useLayoutEffect(() => {
    const key = meta.title;
    if (lastKey.current === key) return;
    lastKey.current = key;
    setMeta(meta);
  }, [meta, meta.title, setMeta]);

  return null;
}

export function DashboardShell({
  user,
  children,
  serverMeta,
}: {
  user: SessionUser;
  children: React.ReactNode;
  serverMeta: PageMeta;
}) {
  const pathname = usePathname();
  const tPages = useTranslations("pages");
  const clientMeta = useMemo(() => getPageMeta(pathname, tPages), [pathname, tPages]);
  const initialMeta = serverMeta ?? clientMeta;
  // Sticky toolbars under page header — no main top padding (calendar + website CMS).
  const flushTopUnderHeader =
    pathname.startsWith("/calendar") || pathname.startsWith("/website");

  return (
    <SidebarProvider>
      <PageMetaProvider initialMeta={initialMeta}>
        <ShellAlertsProvider>
          <Suspense fallback={null}>
          <PersonalTodoPanelProvider>
            <ServerMetaSync meta={serverMeta} />
            <PathnameMetaSync />
            <ServiceWorkerRegister />
            <div className="flex h-dvh min-h-0 bg-transparent">
              <div className="sticky top-0 z-30 hidden h-dvh shrink-0 transition-[width] duration-300 ease-in-out lg:block">
                <Sidebar user={user} variant="desktop" />
              </div>
              <Sidebar user={user} variant="mobile" />
              <div className="liquid-glass-canvas flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
                <PageHeader />
                <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
                  <main
                    className={cn(
                      "min-w-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8",
                      flushTopUnderHeader
                        ? "pt-0"
                        : "pt-4 sm:pt-6 lg:pt-8",
                    )}
                  >
                    {children}
                  </main>
                  <PersonalTodoPanel />
                </div>
              </div>
              <UtilitySpeedDial />
              <NotificationToastHost />
              <CommandPalette />
            </div>
          </PersonalTodoPanelProvider>
          </Suspense>
        </ShellAlertsProvider>
      </PageMetaProvider>
    </SidebarProvider>
  );
}
