"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  Users,
  CheckSquare,
  BarChart3,
  Settings,
  UserCog,
  Tags,
  Building2,
  ScrollText,
  Scale,
  LogOut,
  CalendarDays,
  Gauge,
  ClipboardCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_NAV_ITEMS, MANAGER_NAV_ITEMS, NAV_ITEMS, ROLE_LABELS } from "@/lib/constants";
import { canAccessAdmin, isManagerOrAbove } from "@/lib/permissions";
import type { Role } from "@prisma/client";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

const iconMap = {
  LayoutDashboard,
  ClipboardList,
  Briefcase,
  Users,
  CheckSquare,
  BarChart3,
  Settings,
  UserCog,
  Tags,
  Building2,
  ScrollText,
  CalendarDays,
  Gauge,
  ClipboardCheck,
};

export function Sidebar({
  user,
}: {
  user: { name: string; role: Role };
}) {
  const pathname = usePathname();
  const { confirm, dialog } = useConfirmDialog();

  function handleSignOut() {
    confirm({
      title: "Đăng xuất",
      message: "Bạn có chắc muốn đăng xuất khỏi hệ thống?",
      confirmLabel: "Đăng xuất",
      onConfirm: () => signOut({ callbackUrl: "/login" }),
    });
  }

  return (
    <>
      {dialog}
      <aside className="flex h-full w-64 flex-col border-r border-primary/20 bg-primary text-white">
        <div className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-primary">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold">Luật Work</p>
            <p className="text-xs text-white/60">Quản lý nội bộ</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap];
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                  active
                    ? "bg-white text-primary font-medium"
                    : "text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
              </Link>
            );
          })}

          {isManagerOrAbove(user.role) && (
            <div className="pt-4">
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                Quản lý
              </p>
              {MANAGER_NAV_ITEMS.map((item) => {
                const Icon = iconMap[item.icon as keyof typeof iconMap];
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-white text-primary font-medium"
                        : "text-white/80 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {canAccessAdmin(user.role) && (
            <div className="pt-4">
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                Quản trị
              </p>
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = iconMap[item.icon as keyof typeof iconMap];
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                      active
                        ? "bg-white text-primary font-medium"
                        : "text-white/80 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <div className="mb-3 rounded-lg bg-white/10 px-3 py-3">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="text-xs text-white/60">{ROLE_LABELS[user.role]}</p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-white/80 hover:bg-white/10 hover:text-white"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </Button>
        </div>
      </aside>
    </>
  );
}
