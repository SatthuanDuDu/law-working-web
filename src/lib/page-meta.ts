import type { PageMeta } from "@/contexts/page-meta-context";
import { prisma } from "@/lib/prisma";

type PagesT = {
  (key: `${string}.title`): string;
  (key: `${string}.description`): string;
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
    return {
      title: tPages(`${key}.title`),
      description: tPages(`${key}.description`),
    };
  }

  if (key) {
    return { title: key };
  }

  if (pathname.startsWith("/matters/")) {
    if (/\/plan\/?$/.test(pathname)) {
      if (tPages) {
        return {
          title: tPages("plan.title"),
          description: tPages("plan.description"),
        };
      }
      return {
        title: "Lên kế hoạch vụ việc",
        description: "Dựng và theo dõi lộ trình thực hiện vụ việc",
      };
    }
    if (/\/report\/?$/.test(pathname)) {
      if (tPages) {
        return {
          title: tPages("report.title"),
          description: tPages("report.description"),
        };
      }
      return {
        title: "Báo cáo vụ việc",
        description: "Tổng hợp hoạt động và tiến độ vụ việc",
      };
    }
    if (tPages) {
      return {
        title: tPages("matterDetail.title"),
        description: tPages("matterDetail.description"),
      };
    }
    return {
      title: "Chi tiết vụ việc",
      description: "Thông tin và tài liệu vụ việc",
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
          description: `${matter.code} • ${matter.title}`,
        };
      }
      if (section === "report") {
        return {
          title: tPages ? tPages("report.title") : "Báo cáo vụ việc",
          description: `${matter.code} • ${matter.title}`,
        };
      }
      return {
        title: matter.title,
        description: `${matter.code} • ${matter.client.name}`,
      };
    }
  }

  return getPageMeta(pathname, tPages);
}
