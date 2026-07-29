import type { PageMeta } from "@/contexts/page-meta-context";
import { prisma } from "@/lib/prisma";

type PagesT = {
  (key: `${string}.title`): string;
};

const PAGE_KEYS: Record<string, string> = {
  "/dashboard": "dashboard",
  "/matters": "matters",
  "/clients": "clients",
  "/tasks": "tasks",
  "/calendar": "calendar",
  "/settings": "settings",
  "/workload": "workload",
  "/expenses": "expenses",
  "/admin/users": "users",
  "/admin/work-types": "workTypes",
  "/admin/departments": "departments",
  "/admin/audit-logs": "auditLogs",
  "/admin/attachment-labels": "attachmentLabels",
};

export function getPageMeta(pathname: string, tPages?: PagesT): PageMeta {
  const key = PAGE_KEYS[pathname];
  if (key && tPages) {
    return { title: tPages(`${key}.title`) };
  }

  if (key) {
    return { title: key };
  }

  if (pathname.startsWith("/matters/")) {
    if (/\/plan\/?$/.test(pathname)) {
      return {
        title: tPages ? tPages("plan.title") : "Lên kế hoạch vụ việc",
      };
    }
    if (/\/report\/?$/.test(pathname)) {
      return {
        title: tPages ? tPages("report.title") : "Báo cáo vụ việc",
      };
    }
    return {
      title: tPages ? tPages("matterDetail.title") : "Chi tiết vụ việc",
    };
  }

  return {
    title: tPages ? tPages("fallback.title") : "NSLAW Work Manager",
  };
}

/**
 * Server-side meta for dashboard shell (correct on first paint / SSR).
 * Loads matter title for /matters/[id] hub so header is not stuck on the
 * generic "Chi tiết vụ việc" placeholder while the page segment streams.
 */
export async function resolveServerPageMeta(
  pathname: string,
  tPages?: PagesT,
): Promise<PageMeta> {
  const match = pathname.match(/^\/matters\/([^/]+)(?:\/(plan|report))?\/?$/);
  if (match) {
    const [, id, section] = match;
    const matter = await prisma.matter.findUnique({
      where: { id },
      select: {
        title: true,
        code: true,
        client: { select: { name: true } },
      },
    });
    if (matter) {
      if (section === "plan") {
        return {
          title: tPages ? tPages("plan.title") : "Lên kế hoạch vụ việc",
        };
      }
      if (section === "report") {
        return {
          title: tPages ? tPages("report.title") : "Báo cáo vụ việc",
        };
      }
      return { title: matter.title };
    }
  }

  return getPageMeta(pathname, tPages);
}
