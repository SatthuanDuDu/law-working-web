import type { Role } from "@prisma/client";

/** @deprecated Prefer useLabelMaps() / getLabelMaps() for locale-aware labels. */
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  LAWYER: "Luật sư",
  SUPPORT: "Nhân viên hỗ trợ",
};

/** @deprecated Prefer useLabelMaps() / getLabelMaps(). */
export const MATTER_STATUS_LABELS = {
  NEW: "Mới",
  IN_PROGRESS: "Đang xử lý",
  ON_HOLD: "Tạm dừng",
  CLOSED: "Đóng",
  ARCHIVED: "Lưu trữ",
} as const;

/** @deprecated Prefer useLabelMaps() / getLabelMaps(). */
export const MATTER_TYPE_LABELS = {
  CIVIL: "Dân sự",
  CRIMINAL: "Hình sự",
  CORPORATE: "Doanh nghiệp",
  LABOR: "Lao động",
  FAMILY: "Hôn nhân gia đình",
  OTHER: "Khác",
} as const;

/** @deprecated Prefer useLabelMaps() / getLabelMaps(). */
export const CLIENT_BUSINESS_TYPE_LABELS = {
  LLC: "Công ty TNHH",
  JSC: "Công ty cổ phần",
  SOLE_PROPRIETOR: "Doanh nghiệp tư nhân",
  PARTNERSHIP: "Công ty hợp danh",
  INDIVIDUAL: "Cá nhân",
  OTHER: "Khác",
} as const;

/** @deprecated Prefer useLabelMaps() / getLabelMaps(). */
export const MATTER_PLAN_STEP_STATUS_LABELS = {
  NOT_STARTED: "Chưa thực hiện",
  IN_PROGRESS: "Đang thực hiện",
  DONE: "Hoàn thành",
  BLOCKED: "Bị chặn",
} as const;

export const VIETNAM_CITY_SUGGESTIONS = [
  "Hà Nội",
  "TP. Hồ Chí Minh",
  "Đà Nẵng",
  "Hải Phòng",
  "Cần Thơ",
  "Huế",
  "Nha Trang",
  "Vũng Tàu",
  "Biên Hòa",
  "Bình Dương",
  "Long An",
  "Đồng Nai",
  "Quảng Ninh",
  "Bắc Ninh",
  "Hải Dương",
] as const;

/** @deprecated Prefer useLabelMaps() / getLabelMaps(). */
export const TASK_STATUS_LABELS = {
  TODO: "Chưa làm",
  IN_PROGRESS: "Đang làm",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
} as const;

/** @deprecated Prefer useLabelMaps() / getLabelMaps(). */
export const TASK_PRIORITY_LABELS = {
  LOW: "Thấp",
  MEDIUM: "Vừa",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
} as const;

/** @deprecated Prefer useLabelMaps() / getLabelMaps(). */
export const NOTIFICATION_TYPE_LABELS = {
  TASK_ASSIGNED: "Giao việc",
  TASK_DUE: "Hạn công việc",
  GENERAL: "Chung",
  MENTION: "Nhắc đến",
  CHAT_MESSAGE: "Tin nhắn",
} as const;

export type NavLabelKey =
  | "dashboard"
  | "matters"
  | "clients"
  | "calendar"
  | "workload"
  | "expenses"
  | "users"
  | "workTypes"
  | "attachmentLabels"
  | "departments"
  | "auditLogs";

export const NAV_ITEMS = [
  { href: "/dashboard", labelKey: "dashboard" as const, icon: "LayoutDashboard" },
  { href: "/matters", labelKey: "matters" as const, icon: "Briefcase" },
  { href: "/clients", labelKey: "clients" as const, icon: "Users" },
  { href: "/chat", labelKey: "chat" as const, icon: "MessageCircle" },
  { href: "/calendar", labelKey: "calendar" as const, icon: "CalendarDays" },
] as const;

export const MANAGER_NAV_ITEMS = [
  { href: "/workload", labelKey: "workload" as const, icon: "Gauge" },
  { href: "/expenses", labelKey: "expenses" as const, icon: "Wallet" },
] as const;

export const ADMIN_NAV_ITEMS = [
  { href: "/admin/users", labelKey: "users" as const, icon: "UserCog" },
  { href: "/admin/work-types", labelKey: "workTypes" as const, icon: "Tags" },
  {
    href: "/admin/attachment-labels",
    labelKey: "attachmentLabels" as const,
    icon: "Bookmark",
  },
  { href: "/admin/departments", labelKey: "departments" as const, icon: "Building2" },
  { href: "/admin/audit-logs", labelKey: "auditLogs" as const, icon: "ScrollText" },
] as const;
