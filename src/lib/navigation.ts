import type { Role } from "@prisma/client";
import { ADMIN_NAV_ITEMS, MANAGER_NAV_ITEMS, NAV_ITEMS } from "@/lib/constants";
import { canAccessAdmin, isManagerOrAbove } from "@/lib/permissions";

export type NavItem = { href: string; label: string };

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/daily-logs": "Công việc hàng ngày",
  "/matters": "Vụ việc",
  "/clients": "Khách hàng",
  "/tasks": "Giao việc",
  "/calendar": "Lịch & hạn",
  "/reports": "Báo cáo",
  "/settings": "Cài đặt",
  "/approvals": "Phê duyệt timesheet",
  "/workload": "Workload",
  "/admin/users": "Nhân viên",
  "/admin/work-types": "Loại công việc",
  "/admin/departments": "Phòng ban",
  "/admin/audit-logs": "Nhật ký hệ thống",
};

export function getNavItemsForRole(role: Role): NavItem[] {
  const items: NavItem[] = NAV_ITEMS.map((item) => ({
    href: item.href,
    label: item.label,
  }));

  if (isManagerOrAbove(role)) {
    items.push(
      ...MANAGER_NAV_ITEMS.map((item) => ({
        href: item.href,
        label: item.label,
      })),
    );
  }

  if (canAccessAdmin(role)) {
    items.push(
      ...ADMIN_NAV_ITEMS.map((item) => ({
        href: item.href,
        label: item.label,
      })),
    );
  }

  return items;
}

function findActiveNavIndex(pathname: string, items: NavItem[]): number {
  let bestIndex = -1;
  let bestLength = -1;

  items.forEach((item, index) => {
    const matches =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (matches && item.href.length > bestLength) {
      bestIndex = index;
      bestLength = item.href.length;
    }
  });

  return bestIndex;
}

export function getAdjacentNav(pathname: string, role: Role) {
  const items = getNavItemsForRole(role);
  const index = findActiveNavIndex(pathname, items);

  return {
    prev: index > 0 ? items[index - 1] : null,
    next: index >= 0 && index < items.length - 1 ? items[index + 1] : null,
  };
}

export function getBreadcrumbs(pathname: string): { label: string; href?: string }[] {
  const crumbs: { label: string; href?: string }[] = [
    { label: "Trang chủ", href: "/dashboard" },
  ];

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [{ label: "Trang chủ" }];
  }

  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    currentPath += `/${segments[i]}`;
    const isLast = i === segments.length - 1;
    const knownLabel = ROUTE_LABELS[currentPath];

    if (knownLabel) {
      crumbs.push({
        label: knownLabel,
        href: isLast ? undefined : currentPath,
      });
      continue;
    }

    if (segments[i - 1] === "matters" && isLast) {
      crumbs.push({ label: "Chi tiết vụ việc" });
    }
  }

  return crumbs;
}
