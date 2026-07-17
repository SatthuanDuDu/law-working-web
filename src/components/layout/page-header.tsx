"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBreadcrumbs } from "@/lib/navigation";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { CreateMatterButton } from "@/components/matters/create-matter-button";
import { usePageMeta } from "@/contexts/page-meta-context";
import { useSidebar } from "@/contexts/sidebar-context";
import { useVisitHistoryNav } from "@/hooks/use-visit-history-nav";

export function PageHeader({ unreadCount }: { unreadCount: number }) {
  const pathname = usePathname();
  const { meta } = usePageMeta();
  const breadcrumbs = getBreadcrumbs(pathname);
  const { canGoBack, canGoForward, goBack, goForward } = useVisitHistoryNav();
  const { openMobile } = useSidebar();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4 lg:px-8">
      <div className="flex items-start justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 lg:hidden"
                onClick={openMobile}
                aria-label="Mở menu"
                title="Mở menu"
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
                aria-label="Quay lại trang trước"
                title="Quay lại trang trước"
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
                aria-label="Tới trang tiếp theo"
                title="Tới trang tiếp theo"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <nav aria-label="Breadcrumb" className="hidden flex-wrap items-center gap-1 sm:flex">
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {index > 0 && <span className="text-slate-300">/</span>}
                  {crumb.href ? (
                    <Link
                      href={crumb.href}
                      className="interactive-link text-slate-500"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-slate-700">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>
          <h1 className="mt-2 truncate text-xl font-bold text-primary sm:whitespace-normal sm:text-2xl">
            {meta.title}
          </h1>
          {meta.description && (
            <p className="mt-1 text-sm text-slate-500">{meta.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CreateMatterButton />
          <NotificationPanel unreadCount={unreadCount} />
        </div>
      </div>
    </header>
  );
}
