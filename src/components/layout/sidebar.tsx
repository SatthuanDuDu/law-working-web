"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Settings,
  UserCog,
  Tags,
  Bookmark,
  Building2,
  ScrollText,
  LogOut,
  CalendarDays,
  Gauge,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  UserRound,
  Loader2,
  Check,
  Languages,
  Monitor,
  Moon,
  Sun,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { ADMIN_NAV_ITEMS, MANAGER_NAV_ITEMS, NAV_ITEMS } from "@/lib/constants";
import { canAccessAdmin, isManagerOrAbove } from "@/lib/permissions";
import type { Role } from "@prisma/client";
import { signOut } from "next-auth/react";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { useSidebar } from "@/contexts/sidebar-context";
import { useLabelMaps } from "@/i18n/use-label-maps";
import { setLocaleAction } from "@/lib/locale-actions";
import type { Locale } from "@/i18n/config";

const iconMap = {
  LayoutDashboard,
  Briefcase,
  Users,
  Settings,
  UserCog,
  Tags,
  Bookmark,
  Building2,
  ScrollText,
  CalendarDays,
  Gauge,
  MessageCircle,
};

function SidebarTooltip({
  label,
  show,
  children,
}: {
  label: string;
  show: boolean;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  function showTooltip() {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition({
      top: rect.top + rect.height / 2,
      left: rect.right + 1,
    });
    setVisible(true);
  }

  function hideTooltip() {
    setVisible(false);
  }

  if (!show) {
    return <>{children}</>;
  }

  return (
    <>
      <div
        ref={anchorRef}
        className="relative"
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {children}
      </div>
      {visible &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[9999] -translate-y-1/2"
            style={{ top: position.top, left: position.left }}
          >
            <div className="relative rounded-lg bg-slate-900/95 px-3 py-1.5 text-xs font-medium text-white shadow-lg backdrop-blur-sm">
              <span
                aria-hidden
                className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 border-y-[5px] border-r-[6px] border-y-transparent border-r-slate-900/95"
              />
              {label}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function SidebarEdgeToggle({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar"}
      onClick={onToggle}
      className="group/rail absolute top-20 right-0 bottom-28 z-20 hidden w-5 cursor-pointer border-0 bg-transparent p-0 lg:block"
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 right-0 flex h-40 w-5 -translate-y-1/2 items-center justify-end",
          "opacity-0 transition-opacity duration-200 ease-out delay-0",
          "group-hover/rail:opacity-100 group-hover/rail:delay-500",
          "group-focus-visible/rail:opacity-100 group-focus-visible/rail:delay-0",
        )}
      >
        <span className="absolute top-1/2 right-0 h-36 w-1.5 -translate-y-1/2 rounded-full bg-white/85" />
        <span className="relative z-[1] mr-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/40 text-white">
          {collapsed ? (
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          ) : (
            <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
          )}
        </span>
      </span>
    </button>
  );
}

function NavLinkContent({
  Icon,
  label,
  collapsed,
}: {
  Icon: (typeof iconMap)[keyof typeof iconMap];
  label: string;
  collapsed: boolean;
}) {
  const { pending } = useLinkStatus();

  return (
    <>
      {pending ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <Icon className="h-4 w-4 shrink-0" />
      )}
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
    </>
  );
}

function NavLink({
  href,
  label,
  icon,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: keyof typeof iconMap;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const Icon = iconMap[icon];

  return (
    <SidebarTooltip label={label} show={collapsed}>
      <Link
        href={href}
        onClick={onNavigate}
        className={cn(
          "interactive-press flex min-h-10 items-center rounded-md text-sm",
          collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
          active
            ? "bg-white text-primary font-medium shadow-sm"
            : "text-white/80 hover:bg-white/10 hover:text-white",
        )}
      >
        <NavLinkContent Icon={Icon} label={label} collapsed={collapsed} />
      </Link>
    </SidebarTooltip>
  );
}

function AccountMenu({
  user,
  collapsed,
  onSignOut,
}: {
  user: { name: string; role: Role };
  collapsed: boolean;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("account");
  const { roles } = useLabelMaps();
  const locale = useLocale();
  const { theme, setTheme } = useTheme();
  const [isLocalePending, startLocaleTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<{
    mode: "collapsed" | "expanded";
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  } | null>(null);
  const menuId = useId();
  const settingsActive =
    pathname === "/settings" || pathname.startsWith("/settings/");

  const measureMenu = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return null;

    if (collapsed) {
      return {
        mode: "collapsed" as const,
        top: Math.max(8, rect.bottom - 280),
        left: rect.right + 8,
        width: Math.max(rect.width, 200),
      };
    }

    return {
      mode: "expanded" as const,
      bottom: Math.max(8, window.innerHeight - rect.top + 4),
      left: rect.left,
      width: rect.width,
    };
  }, [collapsed]);

  function openMenu() {
    const next = measureMenu();
    if (next) setMenuBox(next);
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
    setMenuBox(null);
  }

  function toggleMenu() {
    if (open) {
      closeMenu();
      return;
    }
    openMenu();
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
      setMenuBox(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        setMenuBox(null);
      }
    }

    function onReposition() {
      const next = measureMenu();
      if (next) setMenuBox(next);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, measureMenu]);

  function changeLocale(next: Locale) {
    if (next === locale) return;
    startLocaleTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  const menu =
    open && menuBox
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={t("menuLabel")}
            style={
              menuBox.mode === "collapsed"
                ? {
                    top: menuBox.top,
                    left: menuBox.left,
                    width: menuBox.width,
                  }
                : {
                    bottom: menuBox.bottom,
                    left: menuBox.left,
                    width: menuBox.width,
                  }
            }
            className="fixed z-[60] overflow-hidden rounded-[5px] border border-border bg-surface py-1 shadow-[var(--shadow-overlay)]"
          >
            <div className="border-b border-border px-3 py-2">
              <p className="truncate text-sm font-medium text-foreground">
                {user.name}
              </p>
              <p className="text-xs text-muted-foreground">{roles[user.role]}</p>
            </div>
            <Link
              href="/settings"
              role="menuitem"
              onClick={closeMenu}
              className={cn(
                "interactive-press flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted",
                settingsActive && "bg-muted font-medium",
              )}
            >
              <Settings className="h-4 w-4 shrink-0 text-muted-foreground" />
              {t("settings")}
            </Link>

            <div className="border-t border-border px-3 py-2">
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Languages className="h-3 w-3" />
                {t("language")}
              </p>
              <div className="grid grid-cols-2 gap-1">
                {(
                  [
                    { value: "vi" as const, label: t("languageVi") },
                    { value: "en" as const, label: t("languageEn") },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={locale === opt.value}
                    disabled={isLocalePending}
                    onClick={() => changeLocale(opt.value)}
                    className={cn(
                      "interactive-press flex items-center justify-between gap-1 rounded-md px-2 py-1.5 text-left text-xs",
                      locale === opt.value
                        ? "bg-primary-muted font-medium text-primary"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {locale === opt.value ? (
                      <Check className="h-3 w-3 shrink-0" />
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-border px-3 py-2">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("theme")}
              </p>
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    { value: "light", label: t("themeLight"), Icon: Sun },
                    { value: "dark", label: t("themeDark"), Icon: Moon },
                    { value: "system", label: t("themeSystem"), Icon: Monitor },
                  ] as const
                ).map((opt) => {
                  const active = (theme ?? "system") === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      onClick={() => setTheme(opt.value)}
                      className={cn(
                        "interactive-press flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[10px]",
                        active
                          ? "bg-primary-muted font-medium text-primary"
                          : "text-foreground hover:bg-muted",
                      )}
                    >
                      <opt.Icon className="h-3.5 w-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => {
                closeMenu();
                onSignOut();
              }}
              className="interactive-press flex w-full items-center gap-2.5 border-t border-border px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
            >
              <LogOut className="h-4 w-4 shrink-0" />
              {t("signOut")}
            </button>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={rootRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          onClick={toggleMenu}
          className={cn(
            "interactive-press flex w-full items-center rounded-md transition-colors",
            collapsed
              ? "justify-center px-2 py-2.5 text-white/80 hover:bg-white/10 hover:text-white"
              : "gap-3 bg-white/10 px-3 py-3 text-left hover:bg-white/15",
            open && (collapsed ? "bg-white/10 text-white" : "bg-white/15"),
          )}
        >
          {collapsed ? (
            <UserRound className="h-4 w-4 shrink-0" />
          ) : (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="text-xs text-white/60">{roles[user.role]}</p>
              </div>
              <ChevronUp
                className={cn(
                  "h-4 w-4 shrink-0 text-white/50 transition-transform",
                  open && "rotate-180",
                )}
                aria-hidden
              />
            </>
          )}
        </button>
      </div>
      {menu}
    </>
  );
}

export function Sidebar({
  user,
  variant = "desktop",
}: {
  user: { name: string; role: Role };
  variant?: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const { confirm, dialog } = useConfirmDialog();
  const { collapsed, toggleCollapsed, mobileOpen, closeMobile } = useSidebar();
  const t = useTranslations("account");

  function handleSignOut() {
    confirm({
      title: t("signOut"),
      message: t("signOutConfirm"),
      confirmLabel: t("signOut"),
      onConfirm: () =>
        signOut({
          callbackUrl: `${window.location.origin}/login`,
        }),
    });
  }

  useEffect(() => {
    if (variant !== "mobile" || !mobileOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMobile();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [variant, mobileOpen, closeMobile]);

  if (variant === "mobile") {
    return (
      <>
        {dialog}
        {mobileOpen ? (
          <button
            type="button"
            aria-label={t("closeMenu")}
            className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
            onClick={closeMobile}
          />
        ) : null}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[min(20rem,86vw)] flex-col overflow-hidden border-r border-primary/20 bg-primary text-white shadow-xl transition-transform duration-300 ease-out lg:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full pointer-events-none",
          )}
          aria-hidden={!mobileOpen}
        >
          <SidebarContent
            user={user}
            pathname={pathname}
            collapsed={false}
            onToggleCollapsed={toggleCollapsed}
            onNavigate={closeMobile}
            onSignOut={handleSignOut}
            showEdgeToggle={false}
          />
        </aside>
      </>
    );
  }

  return (
    <>
      {dialog}
      <aside
        className={cn(
          "relative flex h-full flex-col overflow-visible border-r border-primary/20 bg-primary text-white transition-all duration-300 ease-in-out",
          collapsed ? "w-[4.75rem]" : "w-64",
        )}
      >
        <SidebarContent
          user={user}
          pathname={pathname}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
          onSignOut={handleSignOut}
          showEdgeToggle
        />
      </aside>
    </>
  );
}

function SidebarContent({
  user,
  pathname,
  collapsed,
  onToggleCollapsed,
  onNavigate,
  onSignOut,
  showEdgeToggle,
}: {
  user: { name: string; role: Role };
  pathname: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onNavigate?: () => void;
  onSignOut: () => void;
  showEdgeToggle: boolean;
}) {
  const tAccount = useTranslations("account");
  const tNav = useTranslations("nav");

  return (
    <>
      {showEdgeToggle ? (
        <SidebarEdgeToggle collapsed={collapsed} onToggle={onToggleCollapsed} />
      ) : null}

      <div
        className={cn(
          "flex items-center border-b border-white/10 bg-white/5 py-5 backdrop-blur-md",
          collapsed ? "justify-center px-3" : "gap-3 px-6",
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white ring-1 ring-white/20">
          <Image
            src="/logo-nslaw.png"
            alt="NSLAW"
            width={40}
            height={40}
            className="h-full w-full object-contain"
          />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">NSLAW</p>
            <p className="text-xs text-white/60">{tAccount("brandSubtitle")}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <NavLink
              key={item.href}
              href={item.href}
              label={tNav(item.labelKey)}
              icon={item.icon as keyof typeof iconMap}
              active={active}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          );
        })}

        {isManagerOrAbove(user.role) && (
          <div className="pt-4">
            {!collapsed && (
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                {tAccount("sectionManager")}
              </p>
            )}
            {MANAGER_NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={tNav(item.labelKey)}
                  icon={item.icon as keyof typeof iconMap}
                  active={active}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              );
            })}
          </div>
        )}

        {canAccessAdmin(user.role) && (
          <div className="pt-4">
            {!collapsed && (
              <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wide text-white/40">
                {tAccount("sectionAdmin")}
              </p>
            )}
            {ADMIN_NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <NavLink
                  key={item.href}
                  href={item.href}
                  label={tNav(item.labelKey)}
                  icon={item.icon as keyof typeof iconMap}
                  active={active}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              );
            })}
          </div>
        )}
      </nav>

      <div className="relative z-40 border-t border-white/10 px-3 py-4">
        <AccountMenu
          user={user}
          collapsed={collapsed}
          onSignOut={onSignOut}
        />
      </div>
    </>
  );
}
