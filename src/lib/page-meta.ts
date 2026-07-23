import type { PageMeta } from "@/contexts/page-meta-context";

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
