"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { createAuditLog } from "@/lib/audit";
import {
  changePasswordSchema,
  clientSchema,
  departmentSchema,
  matterPlanStepSchema,
  matterPlanStepUpdateSchema,
  reorderMatterPlanStepsSchema,
  matterSchema,
  taskSchema,
  userSchema,
  workTypeSchema,
} from "@/lib/validations";
import { canManageUsers, isManagerOrAbove } from "@/lib/permissions";
import { generateMatterCode } from "@/lib/matter-code";
import { getAccessibleClientIds, getAccessibleMatterIds } from "@/lib/access";
import type { MatterPlanStepStatus } from "@prisma/client";

function revalidateClients() {
  revalidatePath("/clients");
  revalidatePath("/matters");
  revalidatePath("/dashboard");
}

function revalidateMatters() {
  revalidatePath("/matters");
  revalidatePath("/dashboard");
  revalidatePath("/workload");
}

function revalidateTasks() {
  revalidatePath("/tasks");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
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

export async function createClientAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    city: formData.get("city"),
    businessType: formData.get("businessType"),
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
      city: parsed.data.city?.trim() || null,
      businessType: parsed.data.businessType ?? null,
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

  revalidateClients();
  return { success: true };
}

export async function deleteClientAction(clientId: string) {
  const user = await requireAuth();
  if (!isManagerOrAbove(user.role)) {
    return { error: "Chỉ Admin/Quản lý mới được xóa khách hàng" };
  }

  const accessibleIds = await getAccessibleClientIds(user.id, user.role);
  if (accessibleIds && !accessibleIds.includes(clientId)) {
    return { error: "Không có quyền xóa khách hàng này" };
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      _count: { select: { matters: true } },
    },
  });
  if (!client) return { error: "Không tìm thấy khách hàng" };

  if (client._count.matters > 0) {
    return {
      error: `Không thể xóa vì còn ${client._count.matters} vụ việc liên quan. Hãy xử lý hoặc xóa các vụ việc trước.`,
    };
  }

  try {
    await prisma.client.delete({ where: { id: clientId } });

    await createAuditLog({
      userId: user.id,
      action: "DELETE",
      entityType: "Client",
      entityId: clientId,
      details: client.name,
    });

    revalidateClients();
    return { success: true };
  } catch (error) {
    console.error("deleteClientAction failed:", error);
    return { error: "Không thể xóa khách hàng" };
  }
}

export async function createMatterAction(formData: FormData) {
  const user = await requireAuth();
  const memberIds = formData.getAll("memberIds").map(String);
  const clientPhones = formData
    .getAll("clientPhones")
    .map(String)
    .map((phone) => phone.trim())
    .filter(Boolean);
  const type = String(formData.get("type") ?? "OTHER");
  const customTypeLabel = String(formData.get("customTypeLabel") ?? "").trim() || null;

  const parsed = matterSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    type,
    customTypeLabel,
    clientMode: formData.get("clientMode"),
    clientId: formData.get("clientId") || null,
    clientName: formData.get("clientName") || null,
    clientPhone:
      clientPhones.length > 0
        ? clientPhones.join(", ")
        : String(formData.get("clientPhone") ?? "").trim() || null,
    clientAddress: formData.get("clientAddress") || null,
    clientCity: formData.get("clientCity") || null,
    leadLawyerId: formData.get("leadLawyerId"),
    memberIds,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  try {
    const leadLawyer = await prisma.user.findFirst({
      where: {
        id: parsed.data.leadLawyerId,
        isActive: true,
        role: { in: ["LAWYER", "MANAGER", "ADMIN"] },
      },
      select: { id: true },
    });
    if (!leadLawyer) {
      return {
        error:
          "Luật sư phụ trách không hợp lệ. Hãy đăng xuất rồi đăng nhập lại, hoặc chọn lại luật sư chính.",
      };
    }

    let clientId = parsed.data.clientId ?? "";

    if (parsed.data.clientMode === "existing") {
      const existingClient = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true },
      });
      if (!existingClient) {
        return { error: "Khách hàng đã chọn không còn tồn tại. Vui lòng chọn lại." };
      }
    }

    if (parsed.data.clientMode === "new") {
      const client = await prisma.client.create({
        data: {
          name: parsed.data.clientName!.trim(),
          phone: parsed.data.clientPhone?.trim() || null,
          address: parsed.data.clientAddress?.trim() || null,
          city: parsed.data.clientCity?.trim() || null,
        },
      });
      clientId = client.id;
    }

    const matterType = parsed.data.type;
    const memberIds = Array.from(
      new Set([parsed.data.leadLawyerId, ...(parsed.data.memberIds ?? [])]),
    );
    const validMembers = await prisma.user.findMany({
      where: { id: { in: memberIds }, isActive: true },
      select: { id: true },
    });
    const validMemberIds = validMembers.map((member) => member.id);
    if (!validMemberIds.includes(parsed.data.leadLawyerId)) {
      return {
        error:
          "Phiên đăng nhập không còn khớp database. Hãy đăng xuất rồi đăng nhập lại bằng tài khoản demo.",
      };
    }

    const matter = await prisma.$transaction(async (tx) => {
      const code = await generateMatterCode(tx, matterType, parsed.data.customTypeLabel);

      return tx.matter.create({
        data: {
          code,
          title: parsed.data.title,
          description: parsed.data.description || null,
          type: matterType,
          customTypeLabel:
            matterType === "OTHER" && parsed.data.customTypeLabel?.trim()
              ? parsed.data.customTypeLabel.trim()
              : null,
          status: "NEW",
          clientId,
          leadLawyerId: parsed.data.leadLawyerId,
          members: {
            create: validMemberIds.map((userId) => ({ userId })),
          },
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Matter",
      entityId: matter.id,
      details: matter.code,
    });

    revalidateMatters();
    if (parsed.data.clientMode === "new") {
      revalidatePath("/clients");
    }
    return { success: true, matterId: matter.id, code: matter.code };
  } catch (error) {
    console.error("createMatterAction failed:", error);
    const message =
      error instanceof Error && error.message.includes("Unique constraint")
        ? "Mã vụ việc bị trùng. Vui lòng thử tạo lại."
        : "Không thể tạo vụ việc. Hãy đăng xuất rồi đăng nhập lại; nếu vẫn lỗi chạy `npx prisma db push` rồi thử lại.";
    return { error: message };
  }
}

function parseMatterFormPayload(formData: FormData) {
  const memberIds = formData.getAll("memberIds").map(String);
  const clientPhones = formData
    .getAll("clientPhones")
    .map(String)
    .map((phone) => phone.trim())
    .filter(Boolean);
  const type = String(formData.get("type") ?? "OTHER");
  const customTypeLabel = String(formData.get("customTypeLabel") ?? "").trim() || null;

  return matterSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    type,
    customTypeLabel,
    clientMode: formData.get("clientMode"),
    clientId: formData.get("clientId") || null,
    clientName: formData.get("clientName") || null,
    clientPhone:
      clientPhones.length > 0
        ? clientPhones.join(", ")
        : String(formData.get("clientPhone") ?? "").trim() || null,
    clientAddress: formData.get("clientAddress") || null,
    clientCity: formData.get("clientCity") || null,
    leadLawyerId: formData.get("leadLawyerId"),
    memberIds,
  });
}

export async function updateMatterAction(matterId: string, formData: FormData) {
  const user = await requireAuth();
  if (!isManagerOrAbove(user.role)) {
    return { error: "Chỉ Admin/Quản lý mới được sửa vụ việc" };
  }

  const existing = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { id: true, code: true, clientId: true },
  });
  if (!existing) return { error: "Không tìm thấy vụ việc" };

  const parsed = parseMatterFormPayload(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  try {
    const leadLawyer = await prisma.user.findFirst({
      where: {
        id: parsed.data.leadLawyerId,
        isActive: true,
        role: { in: ["LAWYER", "MANAGER", "ADMIN"] },
      },
      select: { id: true },
    });
    if (!leadLawyer) {
      return { error: "Luật sư phụ trách không hợp lệ" };
    }

    let clientId = parsed.data.clientId ?? existing.clientId;

    if (parsed.data.clientMode === "new") {
      const client = await prisma.client.create({
        data: {
          name: parsed.data.clientName!.trim(),
          phone: parsed.data.clientPhone?.trim() || null,
          address: parsed.data.clientAddress?.trim() || null,
          city: parsed.data.clientCity?.trim() || null,
        },
      });
      clientId = client.id;
    } else {
      const existingClient = await prisma.client.findUnique({
        where: { id: clientId },
        select: { id: true },
      });
      if (!existingClient) {
        return { error: "Khách hàng đã chọn không còn tồn tại" };
      }

      await prisma.client.update({
        where: { id: clientId },
        data: {
          phone: parsed.data.clientPhone?.trim() || null,
          address: parsed.data.clientAddress?.trim() || null,
          city: parsed.data.clientCity?.trim() || null,
        },
      });
    }

    const memberIds = Array.from(
      new Set([parsed.data.leadLawyerId, ...(parsed.data.memberIds ?? [])]),
    );
    const validMembers = await prisma.user.findMany({
      where: { id: { in: memberIds }, isActive: true },
      select: { id: true },
    });
    const validMemberIds = validMembers.map((member) => member.id);

    await prisma.$transaction(async (tx) => {
      await tx.matterMember.deleteMany({ where: { matterId } });
      await tx.matter.update({
        where: { id: matterId },
        data: {
          title: parsed.data.title,
          description: parsed.data.description || null,
          type: parsed.data.type,
          customTypeLabel:
            parsed.data.type === "OTHER" && parsed.data.customTypeLabel?.trim()
              ? parsed.data.customTypeLabel.trim()
              : null,
          clientId,
          leadLawyerId: parsed.data.leadLawyerId,
          members: {
            create: validMemberIds.map((userId) => ({ userId })),
          },
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "Matter",
      entityId: matterId,
      details: existing.code,
    });

    revalidateMatters();
    revalidatePath(`/matters/${matterId}`);
    return { success: true, matterId };
  } catch (error) {
    console.error("updateMatterAction failed:", error);
    return { error: "Không thể cập nhật vụ việc" };
  }
}

export async function deleteMatterAction(matterId: string) {
  const user = await requireAuth();
  if (!isManagerOrAbove(user.role)) {
    return { error: "Chỉ Admin/Quản lý mới được xóa vụ việc" };
  }

  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { id: true, code: true, title: true },
  });
  if (!matter) return { error: "Không tìm thấy vụ việc" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: { matterId },
        data: { matterId: null },
      });
      await tx.matter.delete({ where: { id: matterId } });
    });

    await createAuditLog({
      userId: user.id,
      action: "DELETE",
      entityType: "Matter",
      entityId: matterId,
      details: `${matter.code} — ${matter.title}`,
    });

    revalidateMatters();
    return { success: true };
  } catch (error) {
    console.error("deleteMatterAction failed:", error);
    return { error: "Không thể xóa vụ việc" };
  }
}

async function assertCanEditMatterPlan(userId: string, role: Parameters<typeof isManagerOrAbove>[0], matterId: string) {
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    include: { members: { select: { userId: true } } },
  });
  if (!matter) return { error: "Không tìm thấy vụ việc" as const, matter: null };

  const matterIds = await getAccessibleMatterIds(userId, role);
  if (matterIds && !matterIds.includes(matterId)) {
    return { error: "Không có quyền truy cập vụ việc này" as const, matter: null };
  }

  const canEdit =
    isManagerOrAbove(role) ||
    matter.leadLawyerId === userId ||
    matter.members.some((member) => member.userId === userId);

  if (!canEdit) {
    return { error: "Không có quyền chỉnh kế hoạch vụ việc" as const, matter: null };
  }

  return { error: null, matter };
}

export async function createMatterPlanStepAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = matterPlanStepSchema.safeParse({
    matterId: formData.get("matterId"),
    title: formData.get("title"),
    workTypeId: formData.get("workTypeId") || null,
    startedAt: formData.get("startedAt") || null,
    dueAt: formData.get("dueAt") || null,
    status: formData.get("status") || "NOT_STARTED",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  const access = await assertCanEditMatterPlan(user.id, user.role, parsed.data.matterId);
  if (access.error || !access.matter) return { error: access.error ?? "Không có quyền" };

  const last = await prisma.matterPlanStep.findFirst({
    where: { matterId: parsed.data.matterId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  try {
    const step = await prisma.matterPlanStep.create({
      data: {
        matterId: parsed.data.matterId,
        title: parsed.data.title.trim(),
        workTypeId: parsed.data.workTypeId || null,
        startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        status: parsed.data.status as MatterPlanStepStatus,
        sortOrder: (last?.sortOrder ?? 0) + 1,
      },
    });

    revalidatePath(`/matters/${parsed.data.matterId}`);
    revalidatePath(`/matters/${parsed.data.matterId}/plan`);
    return { success: true, stepId: step.id };
  } catch (error) {
    console.error("createMatterPlanStepAction failed:", error);
    return {
      error:
        "Không thể thêm bước kế hoạch. Hãy refresh trang; nếu vẫn lỗi chạy `npx prisma generate` rồi restart `npm run dev`.",
    };
  }
}

export async function updateMatterPlanStepAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = matterPlanStepUpdateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title") || undefined,
    workTypeId: formData.has("workTypeId") ? formData.get("workTypeId") || null : undefined,
    startedAt: formData.has("startedAt") ? formData.get("startedAt") || null : undefined,
    dueAt: formData.has("dueAt") ? formData.get("dueAt") || null : undefined,
    status: formData.get("status") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  const step = await prisma.matterPlanStep.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, matterId: true, status: true },
  });
  if (!step) return { error: "Không tìm thấy bước kế hoạch" };

  const access = await assertCanEditMatterPlan(user.id, user.role, step.matterId);
  if (access.error) return { error: access.error };

  const nextStatus = parsed.data.status as MatterPlanStepStatus | undefined;
  const statusChanged =
    nextStatus !== undefined && nextStatus !== step.status;

  await prisma.matterPlanStep.update({
    where: { id: step.id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title.trim() } : {}),
      ...(parsed.data.workTypeId !== undefined
        ? { workTypeId: parsed.data.workTypeId || null }
        : {}),
      ...(parsed.data.startedAt !== undefined
        ? { startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null }
        : {}),
      ...(parsed.data.dueAt !== undefined
        ? { dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null }
        : {}),
      ...(nextStatus !== undefined
        ? {
            status: nextStatus,
            ...(statusChanged ? { statusChangedAt: new Date() } : {}),
          }
        : {}),
    },
  });

  revalidatePath(`/matters/${step.matterId}`);
  revalidatePath(`/matters/${step.matterId}/plan`);
  return { success: true };
}

export async function deleteMatterPlanStepAction(stepId: string) {
  const user = await requireAuth();
  const step = await prisma.matterPlanStep.findUnique({
    where: { id: stepId },
    select: { id: true, matterId: true },
  });
  if (!step) return { error: "Không tìm thấy bước kế hoạch" };

  const access = await assertCanEditMatterPlan(user.id, user.role, step.matterId);
  if (access.error) return { error: access.error };

  await prisma.matterPlanStep.delete({ where: { id: stepId } });
  revalidatePath(`/matters/${step.matterId}`);
  revalidatePath(`/matters/${step.matterId}/plan`);
  return { success: true };
}

export async function reorderMatterPlanStepsAction(matterId: string, orderedIds: string[]) {
  const user = await requireAuth();
  const parsed = reorderMatterPlanStepsSchema.safeParse({ matterId, orderedIds });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" };
  }

  const access = await assertCanEditMatterPlan(user.id, user.role, parsed.data.matterId);
  if (access.error) return { error: access.error };

  const existing = await prisma.matterPlanStep.findMany({
    where: { matterId: parsed.data.matterId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((step) => step.id));

  if (
    parsed.data.orderedIds.length !== existingIds.size ||
    parsed.data.orderedIds.some((id) => !existingIds.has(id))
  ) {
    return { error: "Danh sách bước không khớp với kế hoạch hiện tại" };
  }

  await prisma.$transaction(
    parsed.data.orderedIds.map((id, index) =>
      prisma.matterPlanStep.update({
        where: { id },
        data: { sortOrder: index + 1 },
      }),
    ),
  );

  revalidatePath(`/matters/${parsed.data.matterId}`);
  revalidatePath(`/matters/${parsed.data.matterId}/plan`);
  return { success: true };
}

export async function updateMatterStatusAction(matterId: string, status: string) {
  const user = await requireAuth();
  const allowed = ["NEW", "IN_PROGRESS", "ON_HOLD", "CLOSED"] as const;
  if (!allowed.includes(status as (typeof allowed)[number])) {
    return { error: "Trạng thái không hợp lệ" };
  }

  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    include: { leadLawyer: true },
  });
  if (!matter) return { error: "Không tìm thấy vụ việc" };

  const matterIds = await import("@/lib/access").then((m) =>
    m.getAccessibleMatterIds(user.id, user.role),
  );
  if (matterIds && !matterIds.includes(matterId)) {
    return { error: "Không có quyền cập nhật vụ việc này" };
  }

  const previousStatus = matter.status;
  const updated = await prisma.matter.update({
    where: { id: matterId },
    data: { status: status as (typeof allowed)[number] },
  });

  if (previousStatus === "NEW" && updated.status === "IN_PROGRESS") {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });

    if (admins.length > 0) {
      await prisma.notification.createMany({
        data: admins.map((admin) => ({
          userId: admin.id,
          type: "GENERAL",
          title: "Vụ việc bắt đầu xử lý",
          message: `${user.name} đã bắt đầu xử lý vụ việc ${matter.code} - ${matter.title}`,
          link: `/matters/${matter.id}`,
        })),
      });
    }
  }

  revalidateMatters();
  revalidatePath(`/matters/${matterId}`);
  revalidatePath(`/matters/${matterId}/plan`);
  revalidatePath(`/matters/${matterId}/report`);
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

  revalidateTasks();
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

  revalidateTasks();
  return { success: true };
}

export async function markNotificationReadAction(id: string) {
  const user = await requireAuth();
  await prisma.notification.updateMany({
    where: { id, userId: user.id },
    data: { isRead: true },
  });
  return { success: true };
}

export async function markAllNotificationsReadAction() {
  const user = await requireAuth();
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true },
  });
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
          assignedTasks: true,
          createdTasks: true,
          ledMatters: true,
          uploadedFiles: true,
        },
      },
    },
  });

  if (!target) return { error: "Không tìm thấy nhân viên" };

  const { assignedTasks, createdTasks, ledMatters, uploadedFiles } = target._count;

  if (
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

  await prisma.user.delete({ where: { id: userId } });

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
