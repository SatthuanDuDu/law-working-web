import type { Role } from "@prisma/client";
import { ADMIN_NAV_ITEMS, MANAGER_NAV_ITEMS, NAV_ITEMS } from "@/lib/constants";
import { canAccessAdmin, isManagerOrAbove } from "@/lib/permissions";

export type NavItem = { href: string; labelKey: string; label?: string };

const ROUTE_NAV_KEYS: Record<string, string> = {
  "/dashboard": "dashboard",
  "/matters": "matters",
  "/clients": "clients",
  "/tasks": "tasks",
  "/calendar": "calendar",
  "/settings": "settings",
  "/workload": "workload",
  "/admin/users": "users",
  "/admin/work-types": "workTypes",
  "/admin/attachment-labels": "attachmentLabels",
  "/admin/departments": "departments",
  "/admin/audit-logs": "auditLogs",
};

type NavT = (key: string) => string;

export function getNavItemsForRole(role: Role, tNav?: NavT): NavItem[] {
  const label = (key: string, fallback: string) => (tNav ? tNav(key) : fallback);

  const items: NavItem[] = NAV_ITEMS.map((item) => ({
    href: item.href,
    labelKey: item.labelKey,
    label: label(item.labelKey, item.labelKey),
  }));

  if (isManagerOrAbove(role)) {
    items.push(
      ...MANAGER_NAV_ITEMS.map((item) => ({
        href: item.href,
        labelKey: item.labelKey,
        label: label(item.labelKey, item.labelKey),
      })),
    );
  }

  if (canAccessAdmin(role)) {
    items.push(
      ...ADMIN_NAV_ITEMS.map((item) => ({
        href: item.href,
        labelKey: item.labelKey,
        label: label(item.labelKey, item.labelKey),
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

export function getAdjacentNav(pathname: string, role: Role, tNav?: NavT) {
  const items = getNavItemsForRole(role, tNav);
  const index = findActiveNavIndex(pathname, items);

  return {
    prev: index > 0 ? items[index - 1] : null,
    next: index >= 0 && index < items.length - 1 ? items[index + 1] : null,
  };
}

export function getBreadcrumbs(
  pathname: string,
  tNav?: NavT,
  tCommon?: NavT,
): { label: string; href?: string }[] {
  const home = tCommon ? tCommon("home") : "Trang chủ";
  const crumbs: { label: string; href?: string }[] = [
    { label: home, href: "/dashboard" },
  ];

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [{ label: home }];
  }

  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    currentPath += `/${segments[i]}`;
    const isLast = i === segments.length - 1;
    const navKey = ROUTE_NAV_KEYS[currentPath];
    const knownLabel = navKey
      ? tNav
        ? tNav(navKey)
        : navKey
      : undefined;

    if (knownLabel) {
      crumbs.push({
        label: knownLabel,
        href: isLast ? undefined : currentPath,
      });
      continue;
    }

    if (segments[i - 1] === "matters") {
      const matterPath = `/matters/${segments[i]}`;
      const detail = tNav ? tNav("matterDetail") : "Chi tiết vụ việc";
      if (isLast) {
        crumbs.push({ label: detail });
      } else {
        crumbs.push({ label: detail, href: matterPath });
      }
      continue;
    }

    if (segments[i - 2] === "matters") {
      const keyMap: Record<string, string> = {
        plan: "plan",
        report: "report",
      };
      const key = keyMap[segments[i]];
      crumbs.push({
        label: key && tNav ? tNav(key) : (key ?? segments[i]),
      });
    }
  }

  return crumbs;
}
