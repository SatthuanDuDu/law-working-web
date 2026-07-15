import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Quản trị viên",
  MANAGER: "Quản lý",
  LAWYER: "Luật sư",
  SUPPORT: "Nhân viên hỗ trợ",
};

export const MATTER_STATUS_LABELS = {
  NEW: "Mới",
  IN_PROGRESS: "Đang xử lý",
  ON_HOLD: "Tạm dừng",
  CLOSED: "Đóng",
} as const;

export const MATTER_TYPE_LABELS = {
  CIVIL: "Dân sự",
  CRIMINAL: "Hình sự",
  CORPORATE: "Doanh nghiệp",
  LABOR: "Lao động",
  FAMILY: "Hôn nhân gia đình",
  OTHER: "Khác",
} as const;

export const CLIENT_BUSINESS_TYPE_LABELS = {
  LLC: "Công ty TNHH",
  JSC: "Công ty cổ phần",
  SOLE_PROPRIETOR: "Doanh nghiệp tư nhân",
  PARTNERSHIP: "Công ty hợp danh",
  INDIVIDUAL: "Cá nhân",
  OTHER: "Khác",
} as const;

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

export const TASK_STATUS_LABELS = {
  TODO: "Chưa làm",
  IN_PROGRESS: "Đang làm",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
} as const;

export const TASK_PRIORITY_LABELS = {
  LOW: "Thấp",
  MEDIUM: "Vừa",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
} as const;

export const NOTIFICATION_TYPE_LABELS = {
  TASK_ASSIGNED: "Giao việc",
  TASK_DUE: "Hạn công việc",
  GENERAL: "Chung",
} as const;

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/matters", label: "Vụ việc", icon: "Briefcase" },
  { href: "/clients", label: "Khách hàng", icon: "Users" },
  { href: "/calendar", label: "Lịch & hạn", icon: "CalendarDays" },
] as const;

export const MANAGER_NAV_ITEMS = [
  { href: "/workload", label: "Workload", icon: "Gauge" },
] as const;

export const ADMIN_NAV_ITEMS = [
  { href: "/admin/users", label: "Nhân viên", icon: "UserCog" },
  { href: "/admin/work-types", label: "Loại công việc", icon: "Tags" },
  { href: "/admin/departments", label: "Phòng ban", icon: "Building2" },
  { href: "/admin/audit-logs", label: "Nhật ký hệ thống", icon: "ScrollText" },
] as const;
