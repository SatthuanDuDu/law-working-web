import type { PageMeta } from "@/contexts/page-meta-context";

const PAGE_META: Record<string, PageMeta> = {
  "/dashboard": {
    title: "Dashboard",
    description: "Tổng quan công việc hôm nay",
  },
  "/matters": {
    title: "Vụ việc",
    description: "Quản lý vụ việc và thành viên tham gia",
  },
  "/clients": {
    title: "Khách hàng",
    description: "Quản lý thông tin khách hàng",
  },
  "/tasks": {
    title: "Giao việc",
    description: "Tạo và theo dõi công việc nội bộ",
  },
  "/calendar": {
    title: "Lịch & hạn",
    description: "Theo dõi deadline task và hạn công việc",
  },
  "/settings": {
    title: "Cài đặt",
    description: "Quản lý tài khoản cá nhân",
  },
  "/workload": {
    title: "Workload",
    description: "Phân bổ công việc theo nhân viên và phòng ban",
  },
  "/admin/users": {
    title: "Quản lý nhân viên",
    description: "Tạo tài khoản và đặt lại mật khẩu khi nhân viên quên",
  },
  "/admin/work-types": {
    title: "Loại công việc",
    description: "Cấu hình danh mục loại công việc trong kế hoạch vụ việc",
  },
  "/admin/departments": {
    title: "Phòng ban",
    description: "Cấu hình phòng ban nội bộ",
  },
  "/admin/audit-logs": {
    title: "Nhật ký hệ thống",
    description: "Theo dõi thao tác quan trọng trong hệ thống",
  },
};

export function getPageMeta(pathname: string): PageMeta {
  if (PAGE_META[pathname]) return PAGE_META[pathname];

  if (pathname.startsWith("/matters/")) {
    return {
      title: "Chi tiết vụ việc",
      description: "Thông tin và tài liệu vụ việc",
    };
  }

  return { title: "Luật Work Manager" };
}
