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

export const DAILY_LOG_STATUS_LABELS = {
  IN_PROGRESS: "Đang làm",
  COMPLETED: "Hoàn thành",
  PENDING_APPROVAL: "Chờ duyệt",
  REJECTED: "Từ chối",
} as const;

export const TASK_STATUS_LABELS = {
  TODO: "Chưa làm",
  IN_PROGRESS: "Đang làm",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
} as const;

export const TASK_PRIORITY_LABELS = {
  LOW: "Thấp",
  MEDIUM: "Trung bình",
  HIGH: "Cao",
  URGENT: "Khẩn cấp",
} as const;

export const NOTIFICATION_TYPE_LABELS = {
  TASK_ASSIGNED: "Giao việc",
  TASK_DUE: "Hạn công việc",
  TIMESHEET_APPROVAL: "Phê duyệt timesheet",
  GENERAL: "Chung",
} as const;

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/daily-logs", label: "Công việc hàng ngày", icon: "ClipboardList" },
  { href: "/matters", label: "Vụ việc", icon: "Briefcase" },
  { href: "/clients", label: "Khách hàng", icon: "Users" },
  { href: "/tasks", label: "Giao việc", icon: "CheckSquare" },
  { href: "/calendar", label: "Lịch & hạn", icon: "CalendarDays" },
  { href: "/reports", label: "Báo cáo", icon: "BarChart3" },
  { href: "/settings", label: "Cài đặt", icon: "Settings" },
] as const;

export const MANAGER_NAV_ITEMS = [
  { href: "/approvals", label: "Phê duyệt timesheet", icon: "ClipboardCheck" },
  { href: "/workload", label: "Workload", icon: "Gauge" },
] as const;

export const ADMIN_NAV_ITEMS = [
  { href: "/admin/users", label: "Nhân viên", icon: "UserCog" },
  { href: "/admin/work-types", label: "Loại công việc", icon: "Tags" },
  { href: "/admin/departments", label: "Phòng ban", icon: "Building2" },
  { href: "/admin/audit-logs", label: "Nhật ký hệ thống", icon: "ScrollText" },
] as const;
