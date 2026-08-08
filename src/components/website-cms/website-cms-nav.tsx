"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useState } from "react";
import {
  BarChart3,
  Building2,
  Eye,
  File,
  FileText,
  Images,
  Inbox,
  LayoutDashboard,
  ListOrdered,
  MessageSquareQuote,
  Save,
  Scale,
  Settings,
  Tags,
  Type,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { WEBSITE_CMS_FORM_ID } from "@/lib/website-cms";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Tổng quan",
    items: [{ href: "/website", label: "Tổng quan", icon: LayoutDashboard }],
  },
  {
    label: "Nội dung",
    items: [
      { href: "/website/practice-areas", label: "Lĩnh vực", icon: Scale },
      { href: "/website/lawyers", label: "Đội ngũ", icon: Users },
      { href: "/website/posts", label: "Tin tức", icon: FileText },
      { href: "/website/categories", label: "Danh mục", icon: Tags },
      { href: "/website/pages", label: "Trang", icon: File },
    ],
  },
  {
    label: "Trang chủ",
    items: [
      { href: "/website/section-copy", label: "Nội dung khối", icon: Type },
      { href: "/website/process-steps", label: "Quy trình", icon: ListOrdered },
      { href: "/website/stats", label: "Thống kê", icon: BarChart3 },
      { href: "/website/testimonials", label: "Cảm nhận", icon: MessageSquareQuote },
    ],
  },
  {
    label: "Hệ thống",
    items: [
      { href: "/website/offices", label: "Văn phòng", icon: Building2 },
      { href: "/website/media", label: "Media", icon: Images },
      { href: "/website/settings", label: "Cài đặt site", icon: Settings },
      { href: "/website/inquiries", label: "Yêu cầu tư vấn", icon: Inbox },
      { href: "/website/preview", label: "Xem trước", icon: Eye },
      { href: "/website/traffic", label: "Lượt truy cập", icon: BarChart3 },
    ],
  },
];

const FLAT_NAV = NAV_GROUPS.flatMap((group) => group.items);

export function WebsiteCmsNav() {
  const pathname = usePathname();
  const [canSave, setCanSave] = useState(false);

  useLayoutEffect(() => {
    function sync() {
      setCanSave(Boolean(document.getElementById(WEBSITE_CMS_FORM_ID)));
    }

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [pathname]);

  return (
    <div
      className="sticky z-10 -mx-1 flex items-center gap-2 rounded-md border border-border bg-surface p-2 shadow-sm"
      style={{ top: "var(--page-header-offset)" }}
    >
      <nav
        aria-label="Điều hướng Website CMS"
        className="flex min-w-0 flex-1 gap-1 overflow-x-auto"
      >
        {FLAT_NAV.map((item) => {
          const isActive =
            item.href === "/website"
              ? pathname === "/website"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "interactive-press flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold whitespace-nowrap",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {canSave ? (
        <Button
          type="submit"
          form={WEBSITE_CMS_FORM_ID}
          size="sm"
          className="shrink-0"
        >
          <Save className="size-3.5" aria-hidden />
          Lưu
        </Button>
      ) : null}
    </div>
  );
}
