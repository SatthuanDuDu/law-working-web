"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBreadcrumbs } from "@/lib/navigation";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { CreateMatterButton } from "@/components/matters/create-matter-button";
import { UrgentReminderStack } from "@/components/layout/urgent-reminder-stack";
import { usePageMeta } from "@/contexts/page-meta-context";
import { useSidebar } from "@/contexts/sidebar-context";
import { useVisitHistoryNav } from "@/hooks/use-visit-history-nav";
import { useShellAlerts } from "@/hooks/use-shell-alerts";
import { useTranslations } from "next-intl";

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

  return (
    <header className="page-header-shell sticky top-0 z-20">
      <div className="page-header-panel">
        <div className="flex items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 lg:hidden"
                  onClick={openMobile}
                  aria-label={tAccount("openMenu")}
                  title={tAccount("openMenu")}
                >
                  <Menu className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!canGoBack}
                  onClick={goBack}
                  aria-label={tCommon("back")}
                  title={tCommon("back")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={!canGoForward}
                  onClick={goForward}
                  aria-label={tCommon("forward")}
                  title={tCommon("forward")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <nav aria-label={tCommon("breadcrumb")} className="hidden flex-wrap items-center gap-1 sm:flex">
                {breadcrumbs.map((crumb, index) => (
                  <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                    {index > 0 && <span className="text-border">/</span>}
                    {crumb.href ? (
                      <Link
                        href={crumb.href}
                        className="interactive-link text-muted-foreground"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </nav>
            </div>
            <h1 className="mt-2 truncate text-xl font-bold text-primary sm:whitespace-normal sm:text-2xl">
              {meta.title}
            </h1>
            {meta.description && (
              <p className="mt-1 text-sm text-muted-foreground">{meta.description}</p>
            )}
          </div>
          <div className="relative shrink-0">
            <div className="flex items-center gap-2">
              <CreateMatterButton />
              <NotificationPanel
                unreadCount={unreadCount}
                urgentReminders={urgentReminders}
              />
            </div>
            <div className="absolute right-0 top-[calc(100%+0.375rem)] z-30">
              <UrgentReminderStack items={urgentReminders} />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
