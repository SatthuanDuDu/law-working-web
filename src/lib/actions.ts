"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { createAuditLog } from "@/lib/audit";
import {
  changePasswordSchema,
  clientSchema,
  dailyLogSchema,
  departmentSchema,
  matterSchema,
  taskSchema,
  userSchema,
  workTypeSchema,
} from "@/lib/validations";
import { canManageUsers } from "@/lib/permissions";

function revalidateApp() {
  revalidatePath("/dashboard");
  revalidatePath("/daily-logs");
  revalidatePath("/matters");
  revalidatePath("/clients");
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/workload");
  revalidatePath("/approvals");
  revalidatePath("/reports");
  revalidatePath("/notifications");
}

export async function changePasswordAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return { error: "Không tìm thấy người dùng" };

  const valid = await bcrypt.compare(parsed.data.currentPassword, dbUser.password);
  if (!valid) return { error: "Mật khẩu hiện tại không đúng" };

  const password = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { password },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "User",
    entityId: user.id,
    details: "Đổi mật khẩu",
  });

  return { success: true };
}

export async function createDailyLogAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = dailyLogSchema.safeParse({
    date: formData.get("date"),
    description: formData.get("description"),
    hours: formData.get("hours") || 0,
    minutes: formData.get("minutes") || 0,
    isBillable: formData.get("isBillable") === "on",
    status: formData.get("status"),
    matterId: formData.get("matterId") || null,
    clientId: formData.get("clientId") || null,
    workTypeId: formData.get("workTypeId") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  const totalMinutes = parsed.data.hours * 60 + parsed.data.minutes;
  if (totalMinutes <= 0) return { error: "Thời gian phải lớn hơn 0" };

  const log = await prisma.dailyLog.create({
    data: {
      date: new Date(parsed.data.date),
      description: parsed.data.description,
      minutes: totalMinutes,
      isBillable: parsed.data.isBillable,
      status: parsed.data.status,
      userId: user.id,
      matterId: parsed.data.matterId || null,
      clientId: parsed.data.clientId || null,
      workTypeId: parsed.data.workTypeId || null,
      approvedById: null,
      approvedAt: null,
      rejectionNote: null,
    },
  });

  if (parsed.data.status === "PENDING_APPROVAL") {
    const managers = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
      select: { id: true },
    });
    if (managers.length > 0) {
      await prisma.notification.createMany({
        data: managers.map((m) => ({
          userId: m.id,
          type: "TIMESHEET_APPROVAL" as const,
          title: "Timesheet chờ duyệt",
          message: `${user.name} gửi duyệt: ${parsed.data.description}`,
          link: "/approvals",
        })),
      });
    }
  }

  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entityType: "DailyLog",
    entityId: log.id,
    details: parsed.data.description,
  });

  revalidateApp();
  return { success: true };
}

export async function updateDailyLogAction(id: string, formData: FormData) {
  const user = await requireAuth();
  const existing = await prisma.dailyLog.findUnique({ where: { id } });
  if (!existing) return { error: "Không tìm thấy bản ghi" };
  if (existing.userId !== user.id && user.role !== "ADMIN" && user.role !== "MANAGER") {
    return { error: "Không có quyền chỉnh sửa" };
  }

  const parsed = dailyLogSchema.safeParse({
    date: formData.get("date"),
    description: formData.get("description"),
    hours: formData.get("hours") || 0,
    minutes: formData.get("minutes") || 0,
    isBillable: formData.get("isBillable") === "on",
    status: formData.get("status"),
    matterId: formData.get("matterId") || null,
    clientId: formData.get("clientId") || null,
    workTypeId: formData.get("workTypeId") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  const totalMinutes = parsed.data.hours * 60 + parsed.data.minutes;
  if (totalMinutes <= 0) return { error: "Thời gian phải lớn hơn 0" };

  await prisma.dailyLog.update({
    where: { id },
    data: {
      date: new Date(parsed.data.date),
      description: parsed.data.description,
      minutes: totalMinutes,
      isBillable: parsed.data.isBillable,
      status: parsed.data.status,
      matterId: parsed.data.matterId || null,
      clientId: parsed.data.clientId || null,
      workTypeId: parsed.data.workTypeId || null,
      ...(parsed.data.status === "PENDING_APPROVAL"
        ? { approvedById: null, approvedAt: null, rejectionNote: null }
        : {}),
    },
  });

  if (parsed.data.status === "PENDING_APPROVAL") {
    const managers = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER"] }, isActive: true },
      select: { id: true },
    });
    if (managers.length > 0) {
      await prisma.notification.createMany({
        data: managers.map((m) => ({
          userId: m.id,
          type: "TIMESHEET_APPROVAL" as const,
          title: "Timesheet chờ duyệt",
          message: `${user.name} gửi duyệt: ${parsed.data.description}`,
          link: "/approvals",
        })),
      });
    }
  }

  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "DailyLog",
    entityId: id,
    details: parsed.data.description,
  });

  revalidateApp();
  return { success: true };
}

export async function deleteDailyLogAction(id: string) {
  const user = await requireAuth();
  const existing = await prisma.dailyLog.findUnique({ where: { id } });
  if (!existing) return { error: "Không tìm thấy bản ghi" };
  if (existing.userId !== user.id && user.role !== "ADMIN" && user.role !== "MANAGER") {
    return { error: "Không có quyền xóa" };
  }

  await prisma.dailyLog.delete({ where: { id } });
  await createAuditLog({
    userId: user.id,
    action: "DELETE",
    entityType: "DailyLog",
    entityId: id,
  });

  revalidateApp();
  return { success: true };
}

export async function approveDailyLogAction(id: string) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const existing = await prisma.dailyLog.findUnique({ where: { id } });
  if (!existing) return { error: "Không tìm thấy bản ghi" };
  if (existing.status !== "PENDING_APPROVAL") {
    return { error: "Bản ghi không ở trạng thái chờ duyệt" };
  }

  await prisma.dailyLog.update({
    where: { id },
    data: {
      status: "COMPLETED",
      approvedById: user.id,
      approvedAt: new Date(),
      rejectionNote: null,
    },
  });

  await prisma.notification.create({
    data: {
      userId: existing.userId,
      type: "TIMESHEET_APPROVAL",
      title: "Timesheet đã được duyệt",
      message: `"${existing.description}" đã được phê duyệt.`,
      link: "/daily-logs",
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "DailyLog",
    entityId: id,
    details: `Duyệt timesheet: ${existing.description}`,
  });

  revalidatePath("/approvals");
  revalidateApp();
  return { success: true };
}

export async function rejectDailyLogAction(id: string, formData: FormData) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const existing = await prisma.dailyLog.findUnique({ where: { id } });
  if (!existing) return { error: "Không tìm thấy bản ghi" };
  if (existing.status !== "PENDING_APPROVAL") {
    return { error: "Bản ghi không ở trạng thái chờ duyệt" };
  }

  const rejectionNote = String(formData.get("rejectionNote") ?? "").trim();
  if (!rejectionNote) return { error: "Vui lòng nhập lý do từ chối" };

  await prisma.dailyLog.update({
    where: { id },
    data: {
      status: "REJECTED",
      approvedById: user.id,
      approvedAt: new Date(),
      rejectionNote,
    },
  });

  await prisma.notification.create({
    data: {
      userId: existing.userId,
      type: "TIMESHEET_APPROVAL",
      title: "Timesheet bị từ chối",
      message: `"${existing.description}" bị từ chối: ${rejectionNote}`,
      link: "/daily-logs",
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "DailyLog",
    entityId: id,
    details: `Từ chối timesheet: ${rejectionNote}`,
  });

  revalidatePath("/approvals");
  revalidateApp();
  return { success: true };
}

export async function createClientAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  const client = await prisma.client.create({
    data: {
      name: parsed.data.name,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      notes: parsed.data.notes || null,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entityType: "Client",
    entityId: client.id,
    details: client.name,
  });

  revalidateApp();
  return { success: true };
}

export async function createMatterAction(formData: FormData) {
  const user = await requireAuth();
  const memberIds = formData.getAll("memberIds").map(String);

  const parsed = matterSchema.safeParse({
    code: formData.get("code"),
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    status: formData.get("status"),
    clientId: formData.get("clientId"),
    leadLawyerId: formData.get("leadLawyerId"),
    memberIds,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  const matter = await prisma.matter.create({
    data: {
      code: parsed.data.code,
      title: parsed.data.title,
      description: parsed.data.description || null,
      type: parsed.data.type,
      status: parsed.data.status,
      clientId: parsed.data.clientId,
      leadLawyerId: parsed.data.leadLawyerId,
      members: {
        create: Array.from(
          new Set([parsed.data.leadLawyerId, ...(parsed.data.memberIds ?? [])]),
        ).map((userId) => ({ userId })),
      },
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entityType: "Matter",
    entityId: matter.id,
    details: matter.code,
  });

  revalidateApp();
  return { success: true };
}

export async function createTaskAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    status: formData.get("status"),
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate") || null,
    assigneeId: formData.get("assigneeId"),
    matterId: formData.get("matterId") || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  const task = await prisma.task.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description || null,
      status: parsed.data.status,
      priority: parsed.data.priority,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      assigneeId: parsed.data.assigneeId,
      createdById: user.id,
      matterId: parsed.data.matterId || null,
    },
  });

  await prisma.notification.create({
    data: {
      userId: parsed.data.assigneeId,
      type: "TASK_ASSIGNED",
      title: "Được giao việc mới",
      message: `Bạn được giao: ${parsed.data.title}`,
      link: "/tasks",
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entityType: "Task",
    entityId: task.id,
    details: task.title,
  });

  revalidateApp();
  return { success: true };
}

export async function updateTaskStatusAction(id: string, status: string) {
  const user = await requireAuth();
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return { error: "Không tìm thấy công việc" };

  if (
    task.assigneeId !== user.id &&
    task.createdById !== user.id &&
    user.role !== "ADMIN" &&
    user.role !== "MANAGER"
  ) {
    return { error: "Không có quyền cập nhật" };
  }

  await prisma.task.update({
    where: { id },
    data: { status: status as "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED" },
  });

  revalidateApp();
  return { success: true };
}

export async function markNotificationReadAction(id: string) {
  const user = await requireAuth();
  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { isRead: true },
  });
  revalidateApp();
  return { success: true };
}

export async function markAllNotificationsReadAction() {
  const user = await requireAuth();
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
  revalidateApp();
  return { success: true };
}

export async function createUserAction(formData: FormData) {
  const user = await requireRole(["ADMIN"]);
  if (!canManageUsers(user.role)) return { error: "Không có quyền" };

  const parsed = userSchema.safeParse({
    email: formData.get("email"),
    name: formData.get("name"),
    password: formData.get("password"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || null,
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  if (!parsed.data.password) return { error: "Vui lòng nhập mật khẩu" };

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) return { error: "Email đã được sử dụng" };

  const password = await bcrypt.hash(parsed.data.password, 10);
  const created = await prisma.user.create({
    data: {
      email: parsed.data.email,
      name: parsed.data.name,
      password,
      role: parsed.data.role,
      departmentId: parsed.data.departmentId || null,
      isActive: parsed.data.isActive,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entityType: "User",
    entityId: created.id,
    details: created.email,
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function resetUserPasswordAction(userId: string, formData: FormData) {
  const admin = await requireRole(["ADMIN"]);
  const newPassword = String(formData.get("newPassword") ?? "");
  if (newPassword.length < 6) {
    return { error: "Mật khẩu mới tối thiểu 6 ký tự" };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: "Không tìm thấy nhân viên" };

  const password = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { password },
  });

  await createAuditLog({
    userId: admin.id,
    action: "UPDATE",
    entityType: "User",
    entityId: userId,
    details: `Đặt lại mật khẩu cho ${target.email}`,
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function deleteUserAction(userId: string) {
  const admin = await requireRole(["ADMIN"]);
  if (!canManageUsers(admin.role)) return { error: "Không có quyền" };

  if (userId === admin.id) {
    return { error: "Không thể xóa tài khoản của chính bạn" };
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          dailyLogs: true,
          assignedTasks: true,
          createdTasks: true,
          ledMatters: true,
          uploadedFiles: true,
        },
      },
    },
  });

  if (!target) return { error: "Không tìm thấy nhân viên" };

  const { dailyLogs, assignedTasks, createdTasks, ledMatters, uploadedFiles } =
    target._count;

  if (
    dailyLogs > 0 ||
    assignedTasks > 0 ||
    createdTasks > 0 ||
    ledMatters > 0 ||
    uploadedFiles > 0
  ) {
    return {
      error:
        "Không thể xóa nhân viên đã có dữ liệu liên quan. Vui lòng khóa tài khoản thay vì xóa.",
    };
  }

  if (target.role === "ADMIN") {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN", isActive: true },
    });
    if (adminCount <= 1) {
      return { error: "Không thể xóa quản trị viên cuối cùng" };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.dailyLog.updateMany({
      where: { approvedById: userId },
      data: { approvedById: null },
    });
    await tx.user.delete({ where: { id: userId } });
  });

  await createAuditLog({
    userId: admin.id,
    action: "DELETE",
    entityType: "User",
    entityId: userId,
    details: target.email,
  });

  revalidatePath("/admin/users");
  return { success: true };
}

export async function createWorkTypeAction(formData: FormData) {
  const user = await requireRole(["ADMIN"]);
  const parsed = workTypeSchema.safeParse({
    name: formData.get("name"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  const workType = await prisma.workType.create({ data: parsed.data });
  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entityType: "WorkType",
    entityId: workType.id,
    details: workType.name,
  });

  revalidatePath("/admin/work-types");
  return { success: true };
}

export async function createDepartmentAction(formData: FormData) {
  const user = await requireRole(["ADMIN"]);
  const parsed = departmentSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  const department = await prisma.department.create({ data: parsed.data });
  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entityType: "Department",
    entityId: department.id,
    details: department.name,
  });

  revalidatePath("/admin/departments");
  return { success: true };
}
