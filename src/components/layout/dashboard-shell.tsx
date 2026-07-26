"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { PageHeader } from "@/components/layout/page-header";
import { UtilitySpeedDial } from "@/components/layout/utility-speed-dial";
import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register";
import { NotificationToastHost } from "@/components/notifications/notification-toast-host";
import {
  PageMetaProvider,
  usePageMeta,
  type PageMeta,
} from "@/contexts/page-meta-context";
import { SidebarProvider } from "@/contexts/sidebar-context";
import { getPageMeta } from "@/lib/page-meta";
import type { SessionUser } from "@/lib/permissions";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useMemo, useRef } from "react";

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
    const key = `${meta.title}\0${meta.description ?? ""}`;
    if (lastKey.current === key) return;
    lastKey.current = key;
    setMeta(meta);
    // Intentionally depend on title/description strings, not meta object identity.
  }, [meta, meta.title, meta.description, setMeta]);

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

  return (
    <SidebarProvider>
      <PageMetaProvider initialMeta={initialMeta}>
        <ServerMetaSync meta={serverMeta} />
        <PathnameMetaSync />
        <ServiceWorkerRegister />
        <div className="flex min-h-screen bg-transparent">
          <div className="sticky top-0 z-30 hidden h-screen shrink-0 transition-[width] duration-300 ease-in-out lg:block">
            <Sidebar user={user} variant="desktop" />
          </div>
          <Sidebar user={user} variant="mobile" />
          <div className="flex min-h-screen min-w-0 flex-1 flex-col">
            <PageHeader />
            <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
          </div>
          <UtilitySpeedDial />
          <NotificationToastHost />
        </div>
      </PageMetaProvider>
    </SidebarProvider>
  );
}
