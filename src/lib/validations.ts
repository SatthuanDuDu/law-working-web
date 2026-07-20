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

export const matterSchema = z.object({
  title: z.string().min(1, "Vui lòng nhập tên vụ việc"),
  description: z.string().optional().nullable(),
  type: z.enum(["CIVIL", "CRIMINAL", "CORPORATE", "LABOR", "FAMILY", "OTHER"]),
  customTypeLabel: z.string().optional().nullable(),
  clientMode: z.enum(["existing", "new"]),
  clientId: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  clientPhone: z.string().optional().nullable(),
  clientAddress: z.string().optional().nullable(),
  clientCity: z.string().optional().nullable(),
  leadLawyerId: z.string().min(1, "Vui lòng chọn luật sư phụ trách"),
  memberIds: z.array(z.string()).optional(),
}).superRefine((data, ctx) => {
  if (data.clientMode === "existing" && !data.clientId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Vui lòng chọn khách hàng",
      path: ["clientId"],
    });
  }
  if (data.clientMode === "new" && !data.clientName?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Vui lòng nhập họ và tên khách hàng",
      path: ["clientName"],
    });
  }
  if (data.type === "OTHER" && !data.customTypeLabel?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Vui lòng nhập loại vụ",
      path: ["customTypeLabel"],
    });
  }
});

export const matterPlanStepSchema = z.object({
  matterId: z.string().min(1),
  title: z.string().min(1, "Vui lòng nhập chi tiết công việc"),
  workTypeId: z.string().optional().nullable(),
  startedAt: z.string().optional().nullable(),
  dueAt: z.string().optional().nullable(),
  status: z
    .enum(["NOT_STARTED", "IN_PROGRESS", "DONE", "BLOCKED"])
    .default("NOT_STARTED"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  locationName: z.string().optional().nullable(),
  locationAddress: z.string().optional().nullable(),
  locationPlaceId: z.string().optional().nullable(),
  locationLat: z.string().optional().nullable(),
  locationLng: z.string().optional().nullable(),
  locationCleared: z.string().optional().nullable(),
});

export const matterPlanStepUpdateSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  workTypeId: z.string().optional().nullable(),
  startedAt: z.string().optional().nullable(),
  dueAt: z.string().optional().nullable(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "DONE", "BLOCKED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  locationName: z.string().optional().nullable(),
  locationAddress: z.string().optional().nullable(),
  locationPlaceId: z.string().optional().nullable(),
  locationLat: z.string().optional().nullable(),
  locationLng: z.string().optional().nullable(),
  locationCleared: z.string().optional().nullable(),
});

export const reorderMatterPlanStepsSchema = z.object({
  matterId: z.string().min(1),
  orderedIds: z.array(z.string().min(1)).min(1),
});

export const clientSchema = z.object({
  name: z.string().min(1, "Vui lòng nhập tên khách hàng"),
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  businessType: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z
      .enum(["LLC", "JSC", "SOLE_PROPRIETOR", "PARTNERSHIP", "INDIVIDUAL", "OTHER"])
      .nullable()
      .optional(),
  ),
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

export const attachmentLabelSchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean().default(true),
});

export const departmentSchema = z.object({
  name: z.string().min(1),
});
