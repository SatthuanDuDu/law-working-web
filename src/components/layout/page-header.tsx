"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { getAdjacentNav, getBreadcrumbs } from "@/lib/navigation";
import { NotificationPanel } from "@/components/notifications/notification-panel";

export function PageHeader({
  userRole,
  title,
  description,
  unreadCount,
}: {
  userRole: Role;
  title: string;
  description?: string;
  unreadCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const breadcrumbs = getBreadcrumbs(pathname);
  const { prev, next } = getAdjacentNav(pathname, userRole);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-white px-8 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!prev}
                onClick={() => prev && router.push(prev.href)}
                aria-label="Tab trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!next}
                onClick={() => next && router.push(next.href)}
                aria-label="Tab sau"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1">
              {breadcrumbs.map((crumb, index) => (
                <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                  {index > 0 && <span className="text-slate-300">/</span>}
                  {crumb.href ? (
                    <Link href={crumb.href} className="hover:text-primary hover:underline">
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="font-medium text-slate-700">{crumb.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-primary">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          )}
        </div>
        <NotificationPanel unreadCount={unreadCount} />
      </div>
    </header>
  );
}
