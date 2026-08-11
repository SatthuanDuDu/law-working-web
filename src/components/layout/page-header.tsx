"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBreadcrumbs } from "@/lib/navigation";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { CreateMatterButton } from "@/components/matters/create-matter-button";
import { HEADER_TOOLBAR_BTN } from "@/components/layout/header-toolbar";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/components/layout/command-palette";
import { UrgentReminderStack } from "@/components/layout/urgent-reminder-stack";
import { usePageMeta } from "@/contexts/page-meta-context";
import { useSidebar } from "@/contexts/sidebar-context";
import { useVisitHistoryNav } from "@/hooks/use-visit-history-nav";
import { useShellAlerts } from "@/hooks/use-shell-alerts";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export function PageHeader() {
  const pathname = usePathname();
  const { meta } = usePageMeta();
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tAccount = useTranslations("account");
  const breadcrumbs = getBreadcrumbs(pathname, tNav, tCommon);
  const { canGoBack, canGoForward, goBack, goForward } = useVisitHistoryNav();
  const { openMobile } = useSidebar();
  const { unreadCount, urgentReminders } = useShellAlerts();
  const showBreadcrumbs = pathname !== "/dashboard";
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;

    function syncOffset() {
      const node = headerRef.current;
      if (!node) return;
      const height = node.getBoundingClientRect().height;
      document.documentElement.style.setProperty(
        "--page-header-offset",
        `${Math.ceil(height)}px`,
      );
    }

    syncOffset();
    const observer = new ResizeObserver(syncOffset);
    observer.observe(el);
    window.addEventListener("resize", syncOffset);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncOffset);
    };
  }, [meta.title, showBreadcrumbs, pathname]);

  return (
    <header ref={headerRef} className="page-header-shell sticky top-0 z-20">
      <div className="page-header-panel">
        <div className="flex items-center justify-between gap-2 sm:px-1 lg:px-2">
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(HEADER_TOOLBAR_BTN, "lg:hidden")}
              onClick={openMobile}
              aria-label={tAccount("openMenu")}
              title={tAccount("openMenu")}
            >
              <Menu />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={HEADER_TOOLBAR_BTN}
              disabled={!canGoBack}
              onClick={goBack}
              aria-label={tCommon("back")}
              title={tCommon("back")}
            >
              <ChevronLeft />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={HEADER_TOOLBAR_BTN}
              disabled={!canGoForward}
              onClick={goForward}
              aria-label={tCommon("forward")}
              title={tCommon("forward")}
            >
              <ChevronRight />
            </Button>
          </div>

          <div className="relative flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={HEADER_TOOLBAR_BTN}
              onClick={() => window.dispatchEvent(new Event(OPEN_COMMAND_PALETTE_EVENT))}
              aria-label={tCommon("search")}
              title={`${tCommon("search")} (Ctrl/⌘ K)`}
            >
              <Search />
            </Button>
            <CreateMatterButton />
            <NotificationPanel
              unreadCount={unreadCount}
              urgentReminders={urgentReminders}
            />
            <div className="absolute right-0 top-[calc(100%+0.375rem)] z-30">
              <UrgentReminderStack items={urgentReminders} />
            </div>
          </div>
        </div>

        {meta.title ? (
          <h1 className="mt-2 min-w-0 break-words text-lg font-bold leading-snug text-foreground sm:text-xl lg:text-2xl">
            {meta.title}
          </h1>
        ) : null}

        {showBreadcrumbs ? (
          <nav
            aria-label={tCommon("breadcrumb")}
            className="mt-1 hidden flex-wrap items-center gap-1 text-sm text-muted-foreground sm:flex"
          >
            {breadcrumbs.map((crumb, index) => (
              <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                {index > 0 && <span className="text-border">/</span>}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="interactive-link text-muted-foreground hover:text-foreground"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
      </div>
    </header>
  );
}
