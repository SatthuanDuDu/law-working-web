import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại"),
  newPassword: z.string().min(6, "Mật khẩu mới tối thiểu 6 ký tự"),
  confirmPassword: z.string().min(6, "Xác nhận mật khẩu tối thiểu 6 ký tự"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Mật khẩu xác nhận không khớp",
  path: ["confirmPassword"],
});

export const dailyLogSchema = z.object({
  date: z.string().min(1),
  description: z.string().min(1, "Vui lòng nhập nội dung công việc"),
  hours: z.coerce.number().min(0).max(24),
  minutes: z.coerce.number().min(0).max(59),
  isBillable: z.boolean().default(true),
  status: z.enum(["IN_PROGRESS", "COMPLETED", "PENDING_APPROVAL", "REJECTED"]),
  matterId: z.string().optional().nullable(),
  clientId: z.string().optional().nullable(),
  workTypeId: z.string().optional().nullable(),
});

export const matterSchema = z.object({
  code: z.string().min(1, "Vui lòng nhập mã vụ việc"),
  title: z.string().min(1, "Vui lòng nhập tên vụ việc"),
  description: z.string().optional().nullable(),
  type: z.enum(["CIVIL", "CRIMINAL", "CORPORATE", "LABOR", "FAMILY", "OTHER"]),
  status: z.enum(["NEW", "IN_PROGRESS", "ON_HOLD", "CLOSED"]),
  clientId: z.string().min(1, "Vui lòng chọn khách hàng"),
  leadLawyerId: z.string().min(1, "Vui lòng chọn luật sư phụ trách"),
  memberIds: z.array(z.string()).optional(),
});

export const clientSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên khách hàng"),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const taskSchema = z.object({
  title: z.string().min(1, "Vui lòng nhập tiêu đề"),
  description: z.string().optional().nullable(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  dueDate: z.string().optional().nullable(),
  assigneeId: z.string().min(1, "Vui lòng chọn người nhận"),
  matterId: z.string().optional().nullable(),
});

export const userSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6).optional(),
  role: z.enum(["ADMIN", "MANAGER", "LAWYER", "SUPPORT"]),
  departmentId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

export const workTypeSchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean().default(true),
});

export const departmentSchema = z.object({
  name: z.string().min(1),
});
