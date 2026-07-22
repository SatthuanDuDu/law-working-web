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
  matterExpenseSchema,
  taskSchema,
  userSchema,
  workTypeSchema,
  attachmentLabelSchema,
  parseDateOfBirthInput,
} from "@/lib/validations";
import { canManageUsers, isAdmin, isManagerOrAbove } from "@/lib/permissions";
import { generateMatterCode } from "@/lib/matter-code";
import { generateClientCode } from "@/lib/client-code";
import { getAccessibleClientIds, getAccessibleMatterIds, assertMatterNotArchived } from "@/lib/access";
import { deleteObject } from "@/lib/storage";
import { actionError } from "@/i18n/server-labels";
import type { MatterPlanStepStatus } from "@prisma/client";
import {
  locationToPrismaFields,
  parseLocationFromFormData,
} from "@/lib/location";
import {
  allocateUniqueUsername,
  isValidUsername,
  normalizeUsername,
} from "@/lib/username";

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
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser) return { error: await actionError("userNotFound") };

  const valid = await bcrypt.compare(parsed.data.currentPassword, dbUser.password);
  if (!valid) return { error: await actionError("wrongPassword") };

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
    code: formData.get("code"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    city: formData.get("city"),
    businessType: formData.get("businessType"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const manualCode = parsed.data.code?.trim() || "";
  let code = manualCode;
  if (code) {
    const existingCode = await prisma.client.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existingCode) return { error: "Mã khách hàng đã được sử dụng" };
  } else {
    code = await generateClientCode(prisma);
  }

  const client = await prisma.client.create({
    data: {
      code,
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
    details: `${client.code} · ${client.name}`,
  });

  revalidateClients();
  return { success: true };
}

export async function updateClientAction(clientId: string, formData: FormData) {
  const user = await requireAuth();
  if (!isManagerOrAbove(user.role)) {
    return { error: await actionError("noPermissionEditClient") };
  }

  const accessibleIds = await getAccessibleClientIds(user.id, user.role);
  if (accessibleIds && !accessibleIds.includes(clientId)) {
    return { error: await actionError("noPermissionThisClientEdit") };
  }

  const existing = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, code: true },
  });
  if (!existing) return { error: await actionError("clientNotFound") };

  const parsed = clientSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    city: formData.get("city"),
    businessType: formData.get("businessType"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const nextCode = parsed.data.code?.trim() || existing.code;
  if (nextCode !== existing.code) {
    const codeTaken = await prisma.client.findUnique({
      where: { code: nextCode },
      select: { id: true },
    });
    if (codeTaken) return { error: "Mã khách hàng đã được sử dụng" };
  }

  try {
    const client = await prisma.client.update({
      where: { id: clientId },
      data: {
        code: nextCode,
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
      action: "UPDATE",
      entityType: "Client",
      entityId: client.id,
      details: `${client.code} · ${client.name}`,
    });

    revalidateClients();
    return { success: true };
  } catch (error) {
    console.error("updateClientAction failed:", error);
    return { error: await actionError("cannotUpdateClient") };
  }
}

export async function deleteClientAction(clientId: string) {
  const user = await requireAuth();
  if (!isManagerOrAbove(user.role)) {
    return { error: await actionError("noPermissionDeleteClient") };
  }

  const accessibleIds = await getAccessibleClientIds(user.id, user.role);
  if (accessibleIds && !accessibleIds.includes(clientId)) {
    return { error: await actionError("noPermissionThisClient") };
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      _count: { select: { matters: true } },
    },
  });
  if (!client) return { error: await actionError("clientNotFound") };

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
    return { error: await actionError("cannotDeleteClient") };
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
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
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
        return { error: await actionError("clientGone") };
      }
    }

    if (parsed.data.clientMode === "new") {
      const client = await prisma.client.create({
        data: {
          code: await generateClientCode(prisma),
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
    return { error: await actionError("onlyManagerEditMatter") };
  }

  const existing = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { id: true, code: true, clientId: true },
  });
  if (!existing) return { error: await actionError("matterNotFound") };

  const parsed = parseMatterFormPayload(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
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
      return { error: await actionError("invalidLeadLawyer") };
    }

    let clientId = parsed.data.clientId ?? existing.clientId;

    if (parsed.data.clientMode === "new") {
      const client = await prisma.client.create({
        data: {
          code: await generateClientCode(prisma),
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
        return { error: await actionError("clientGoneShort") };
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
    return { error: await actionError("cannotUpdateMatter") };
  }
}

export async function deleteMatterAction(matterId: string) {
  const user = await requireAuth();
  if (!isManagerOrAbove(user.role)) {
    return { error: await actionError("onlyManagerDeleteMatter") };
  }

  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: { id: true, code: true, title: true },
  });
  if (!matter) return { error: await actionError("matterNotFound") };

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
    return { error: await actionError("cannotDeleteMatter") };
  }
}

async function assertCanEditMatterPlan(userId: string, role: Parameters<typeof isManagerOrAbove>[0], matterId: string) {
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    include: { members: { select: { userId: true } } },
  });
  if (!matter) return { error: await actionError("matterNotFound"), matter: null };

  if (matter.status === "ARCHIVED") {
    return {
      error: "Vụ việc đã lưu trữ — chỉ được xem, không thể chỉnh sửa" as const,
      matter: null,
    };
  }

  const matterIds = await getAccessibleMatterIds(userId, role);
  if (matterIds && !matterIds.includes(matterId)) {
    return { error: await actionError("noMatterAccess"), matter: null };
  }

  const canEdit =
    isManagerOrAbove(role) ||
    matter.leadLawyerId === userId ||
    matter.members.some((member) => member.userId === userId);

  if (!canEdit) {
    return { error: await actionError("noPlanEdit"), matter: null };
  }

  return { error: null, matter };
}

async function assertCanAccessMatter(
  userId: string,
  role: Parameters<typeof isManagerOrAbove>[0],
  matterId: string,
) {
  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    select: {
      id: true,
      code: true,
      leadLawyerId: true,
      members: { select: { userId: true } },
    },
  });
  if (!matter) return { error: await actionError("matterNotFound"), matter: null };

  const matterIds = await getAccessibleMatterIds(userId, role);
  if (matterIds && !matterIds.includes(matterId)) {
    return { error: await actionError("noMatterAccess"), matter: null };
  }

  const canAccess =
    isManagerOrAbove(role) ||
    matter.leadLawyerId === userId ||
    matter.members.some((member) => member.userId === userId);

  if (!canAccess) {
    return { error: await actionError("noMatterAccess"), matter: null };
  }

  return { error: null, matter };
}

function parseMentionIds(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === "string");
    }
    return [];
  } catch {
    return [];
  }
}

function parseAttachmentIds(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === "string");
    }
    return [];
  } catch {
    return [];
  }
}

export async function createCommentAction(formData: FormData) {
  const user = await requireAuth();

  const matterId = formData.get("matterId");
  const rawStepId = formData.get("matterPlanStepId");
  const rawBody = formData.get("body");
  const attachmentIds = Array.from(new Set(parseAttachmentIds(formData.get("attachmentIds"))));

  if (typeof matterId !== "string" || !matterId) {
    return { error: await actionError("missingMatter") };
  }
  const body = typeof rawBody === "string" ? rawBody.trim() : "";
  const location = parseLocationFromFormData(formData);
  if (!body && attachmentIds.length === 0 && !location) {
    return { error: await actionError("commentEmpty") };
  }
  if (body.length > 5000) return { error: await actionError("commentTooLong") };

  const matterPlanStepId =
    typeof rawStepId === "string" && rawStepId ? rawStepId : null;

  const access = await assertCanAccessMatter(user.id, user.role, matterId);
  if (access.error || !access.matter) return { error: access.error ?? (await actionError("noPermission")) };
  const matter = access.matter;

  const archived = await assertMatterNotArchived(matterId);
  if (archived.error) return { error: archived.error };

  if (matterPlanStepId) {
    const step = await prisma.matterPlanStep.findUnique({
      where: { id: matterPlanStepId },
      select: { matterId: true },
    });
    if (!step || step.matterId !== matterId) {
      return { error: "Không tìm thấy bước kế hoạch" };
    }
  }

  if (attachmentIds.length > 0) {
    const pending = await prisma.attachment.findMany({
      where: {
        id: { in: attachmentIds },
        uploadedById: user.id,
        matterId,
        commentId: null,
        matterPlanStepId: null,
      },
      select: { id: true },
    });
    if (pending.length !== attachmentIds.length) {
      return { error: "File đính kèm không hợp lệ hoặc đã được dùng" };
    }
  }

  const allowedUserIds = new Set<string>([
    matter.leadLawyerId,
    ...matter.members.map((member) => member.userId),
  ]);
  const mentionedUserIds = Array.from(new Set(parseMentionIds(formData.get("mentionedUserIds"))))
    .filter((id) => allowedUserIds.has(id) && id !== user.id);

  try {
    const comment = await prisma.$transaction(async (tx) => {
      const created = await tx.comment.create({
        data: {
          matterId,
          matterPlanStepId,
          authorId: user.id,
          body: body || (location ? "(Vị trí)" : "(Đính kèm)"),
          ...locationToPrismaFields(location),
        },
      });

      if (attachmentIds.length > 0) {
        await tx.attachment.updateMany({
          where: {
            id: { in: attachmentIds },
            uploadedById: user.id,
            matterId,
            commentId: null,
            matterPlanStepId: null,
          },
          data: {
            commentId: created.id,
            matterPlanStepId,
          },
        });
      }

      if (mentionedUserIds.length > 0) {
        await tx.commentMention.createMany({
          data: mentionedUserIds.map((userId) => ({
            commentId: created.id,
            userId,
          })),
        });

        const link = matterPlanStepId
          ? `/matters/${matterId}/plan`
          : `/matters/${matterId}/report`;
        await tx.notification.createMany({
          data: mentionedUserIds.map((userId) => ({
            userId,
            type: "MENTION" as const,
            title: "Bạn được nhắc đến",
            message: `${user.name} đã nhắc bạn trong ${matter.code}`,
            link,
          })),
        });
      }

      return created;
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "Comment",
      entityId: comment.id,
      details: `${matter.code}: ${body.slice(0, 120) || "(Đính kèm)"}`,
    });

    revalidatePath(`/matters/${matterId}/report`);
    revalidatePath(`/matters/${matterId}/plan`);
    revalidatePath(`/matters/${matterId}`);
    return { success: true, commentId: comment.id };
  } catch (error) {
    console.error("createCommentAction failed:", error);
    return {
      error:
        "Không thể gửi bình luận. Hãy refresh trang; nếu vẫn lỗi chạy `npx prisma generate` rồi restart `npm run dev`.",
    };
  }
}

export async function updateCommentAction(formData: FormData) {
  const user = await requireAuth();

  const commentId = formData.get("commentId");
  const rawBody = formData.get("body");
  const removeAttachmentIds = Array.from(
    new Set(parseAttachmentIds(formData.get("removeAttachmentIds"))),
  );

  if (typeof commentId !== "string" || !commentId) {
    return { error: "Thiếu thông tin bình luận" };
  }

  const body = typeof rawBody === "string" ? rawBody.trim() : "";
  if (body.length > 5000) return { error: await actionError("commentTooLong") };

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      authorId: true,
      matterId: true,
      locationLat: true,
      locationLng: true,
      attachments: {
        select: { id: true, storageKey: true, fileName: true },
      },
    },
  });
  if (!comment) return { error: "Không tìm thấy bình luận" };
  if (comment.authorId !== user.id) {
    return { error: "Chỉ tác giả mới được sửa bình luận này" };
  }

  const archived = await assertMatterNotArchived(comment.matterId);
  if (archived.error) return { error: archived.error };

  const remainingAttachments = comment.attachments.filter(
    (a) => !removeAttachmentIds.includes(a.id),
  );
  if (removeAttachmentIds.length > 0) {
    const ownedIds = new Set(comment.attachments.map((a) => a.id));
    if (removeAttachmentIds.some((id) => !ownedIds.has(id))) {
      return { error: "File đính kèm không thuộc bình luận này" };
    }
  }

  const locationTouched =
    formData.has("locationCleared") ||
    formData.has("locationLat") ||
    formData.has("locationLng") ||
    formData.has("locationName");
  const parsedLocation = locationTouched
    ? parseLocationFromFormData(formData)
    : undefined;
  const hasLocationAfter = locationTouched
    ? parsedLocation != null
    : comment.locationLat != null && comment.locationLng != null;

  if (!body && remainingAttachments.length === 0 && !hasLocationAfter) {
    return { error: await actionError("commentEmpty") };
  }

  const toRemove = comment.attachments.filter((a) =>
    removeAttachmentIds.includes(a.id),
  );
  for (const attachment of toRemove) {
    try {
      await deleteObject(attachment.storageKey);
    } catch {
      // Object may already be missing.
    }
  }

  await prisma.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.attachment.deleteMany({
        where: {
          id: { in: toRemove.map((a) => a.id) },
          commentId: comment.id,
        },
      });
    }
    await tx.comment.update({
      where: { id: commentId },
      data: {
        body:
          body ||
          (hasLocationAfter ? "(Vị trí)" : "(Đính kèm)"),
        ...(locationTouched
          ? locationToPrismaFields(parsedLocation ?? null)
          : {}),
      },
    });
  });

  revalidatePath(`/matters/${comment.matterId}/report`);
  revalidatePath(`/matters/${comment.matterId}/plan`);
  revalidatePath(`/matters/${comment.matterId}`);
  return { success: true };
}

export async function deleteCommentAction(commentId: string) {
  const user = await requireAuth();

  const comment = await prisma.comment.findUnique({
    where: { id: commentId },
    select: {
      id: true,
      authorId: true,
      matterId: true,
      attachments: { select: { id: true, storageKey: true, fileName: true } },
    },
  });
  if (!comment) return { error: "Không tìm thấy bình luận" };

  if (!isAdmin(user.role)) {
    return { error: "Chỉ quản trị viên mới được xóa bình luận" };
  }

  const archived = await assertMatterNotArchived(comment.matterId);
  if (archived.error) return { error: archived.error };

  for (const attachment of comment.attachments) {
    try {
      await deleteObject(attachment.storageKey);
    } catch {
      // Object may already be missing; still remove DB row via cascade.
    }
  }

  await prisma.comment.delete({ where: { id: commentId } });

  await createAuditLog({
    userId: user.id,
    action: "DELETE",
    entityType: "Comment",
    entityId: commentId,
    details: `Matter ${comment.matterId}`,
  });

  revalidatePath(`/matters/${comment.matterId}/report`);
  revalidatePath(`/matters/${comment.matterId}/plan`);
  revalidatePath(`/matters/${comment.matterId}`);
  return { success: true };
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
    priority: formData.get("priority") || "MEDIUM",
    locationName: formData.get("locationName") || null,
    locationAddress: formData.get("locationAddress") || null,
    locationPlaceId: formData.get("locationPlaceId") || null,
    locationLat: formData.get("locationLat") || null,
    locationLng: formData.get("locationLng") || null,
    locationCleared: formData.get("locationCleared") || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const access = await assertCanEditMatterPlan(user.id, user.role, parsed.data.matterId);
  if (access.error || !access.matter) return { error: access.error ?? (await actionError("noPermission")) };

  const last = await prisma.matterPlanStep.findFirst({
    where: { matterId: parsed.data.matterId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const location = parseLocationFromFormData(formData);

  try {
    const step = await prisma.matterPlanStep.create({
      data: {
        matterId: parsed.data.matterId,
        title: parsed.data.title.trim(),
        workTypeId: parsed.data.workTypeId || null,
        startedAt: parsed.data.startedAt ? new Date(parsed.data.startedAt) : null,
        dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null,
        status: parsed.data.status as MatterPlanStepStatus,
        priority: parsed.data.priority,
        sortOrder: (last?.sortOrder ?? 0) + 1,
        ...locationToPrismaFields(location),
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "MatterPlanStep",
      entityId: step.id,
      details: `${access.matter.code}: ${step.title}`,
    });

    revalidatePath(`/matters/${parsed.data.matterId}`);
    revalidatePath(`/matters/${parsed.data.matterId}/plan`);
    revalidatePath("/calendar");
    revalidatePath("/", "layout");
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
    priority: formData.get("priority") || undefined,
    locationName: formData.has("locationName")
      ? formData.get("locationName") || null
      : undefined,
    locationAddress: formData.has("locationAddress")
      ? formData.get("locationAddress") || null
      : undefined,
    locationPlaceId: formData.has("locationPlaceId")
      ? formData.get("locationPlaceId") || null
      : undefined,
    locationLat: formData.has("locationLat")
      ? formData.get("locationLat") || null
      : undefined,
    locationLng: formData.has("locationLng")
      ? formData.get("locationLng") || null
      : undefined,
    locationCleared: formData.has("locationCleared")
      ? formData.get("locationCleared") || null
      : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const step = await prisma.matterPlanStep.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, matterId: true, status: true, title: true },
  });
  if (!step) return { error: "Không tìm thấy bước kế hoạch" };

  const access = await assertCanEditMatterPlan(user.id, user.role, step.matterId);
  if (access.error) return { error: access.error };

  const nextStatus = parsed.data.status as MatterPlanStepStatus | undefined;
  const statusChanged =
    nextStatus !== undefined && nextStatus !== step.status;

  const locationTouched =
    formData.has("locationCleared") ||
    formData.has("locationLat") ||
    formData.has("locationLng") ||
    formData.has("locationName");
  const locationFields = locationTouched
    ? locationToPrismaFields(parseLocationFromFormData(formData))
    : null;

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
      ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
      ...(locationFields ?? {}),
    },
  });

  const title = parsed.data.title?.trim() || step.title;
  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "MatterPlanStep",
    entityId: step.id,
    details: statusChanged
      ? `${access.matter?.code ?? step.matterId}: ${title} → ${nextStatus}`
      : `${access.matter?.code ?? step.matterId}: ${title}`,
  });

  revalidatePath("/dashboard");
  revalidatePath("/calendar");
  revalidatePath(`/matters/${step.matterId}`);
  revalidatePath(`/matters/${step.matterId}/plan`);
  // Layout (urgent reminders in header) refreshes via path revalidation
  revalidatePath("/", "layout");
  return { success: true };
}

export async function deleteMatterPlanStepAction(stepId: string) {
  const user = await requireAuth();
  const step = await prisma.matterPlanStep.findUnique({
    where: { id: stepId },
    select: { id: true, matterId: true, title: true, matter: { select: { code: true } } },
  });
  if (!step) return { error: "Không tìm thấy bước kế hoạch" };

  const access = await assertCanEditMatterPlan(user.id, user.role, step.matterId);
  if (access.error) return { error: access.error };

  await prisma.matterPlanStep.delete({ where: { id: stepId } });

  await createAuditLog({
    userId: user.id,
    action: "DELETE",
    entityType: "MatterPlanStep",
    entityId: stepId,
    details: `${step.matter.code}: ${step.title}`,
  });

  revalidatePath(`/matters/${step.matterId}`);
  revalidatePath(`/matters/${step.matterId}/plan`);
  return { success: true };
}

export async function reorderMatterPlanStepsAction(matterId: string, orderedIds: string[]) {
  const user = await requireAuth();
  const parsed = reorderMatterPlanStepsSchema.safeParse({ matterId, orderedIds });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
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
  const allowed = ["NEW", "IN_PROGRESS", "ON_HOLD", "CLOSED", "ARCHIVED"] as const;
  if (!allowed.includes(status as (typeof allowed)[number])) {
    return { error: "Trạng thái không hợp lệ" };
  }

  const matter = await prisma.matter.findUnique({
    where: { id: matterId },
    include: { leadLawyer: true },
  });
  if (!matter) return { error: await actionError("matterNotFound") };

  const matterIds = await import("@/lib/access").then((m) =>
    m.getAccessibleMatterIds(user.id, user.role),
  );
  if (matterIds && !matterIds.includes(matterId)) {
    return { error: "Không có quyền cập nhật vụ việc này" };
  }

  const nextStatus = status as (typeof allowed)[number];
  const leavingArchive = matter.status === "ARCHIVED" && nextStatus !== "ARCHIVED";
  const enteringArchive = nextStatus === "ARCHIVED" && matter.status !== "ARCHIVED";

  if ((enteringArchive || leavingArchive) && !isAdmin(user.role)) {
    return { error: "Chỉ quản trị viên mới được lưu trữ hoặc tái kích hoạt vụ việc" };
  }

  if (matter.status === "ARCHIVED" && !isAdmin(user.role)) {
    return { error: "Vụ việc đã lưu trữ — không thể đổi trạng thái" };
  }

  const previousStatus = matter.status;
  const updated = await prisma.matter.update({
    where: { id: matterId },
    data: { status: nextStatus },
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

  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "Matter",
    entityId: matterId,
    details: `${matter.code}: ${previousStatus} → ${nextStatus}`,
  });

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
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
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

  await createAuditLog({
    userId: user.id,
    action: "UPDATE",
    entityType: "Task",
    entityId: id,
    details: `${task.title}: ${task.status} → ${status}`,
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
  if (!canManageUsers(user.role)) return { error: await actionError("noPermission") };

  const parsed = userSchema.safeParse({
    username: formData.get("username"),
    email: formData.get("email"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    password: formData.get("password"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || null,
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  if (!parsed.data.password) return { error: "Vui lòng nhập mật khẩu" };

  const username = await allocateUniqueUsername({
    fullName: parsed.data.name,
    preferred: parsed.data.username,
    isTaken: async (candidate) => {
      const existing = await prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      return Boolean(existing);
    },
  });

  if (!username) {
    return { error: "Không tạo được tên người dùng unique từ họ tên" };
  }

  const existingEmail = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true },
  });
  if (existingEmail) return { error: "Email đã được sử dụng" };

  const password = await bcrypt.hash(parsed.data.password, 10);
  const created = await prisma.user.create({
    data: {
      username,
      email: parsed.data.email,
      name: parsed.data.name,
      phone: parsed.data.phone?.trim() || null,
      dateOfBirth: parseDateOfBirthInput(parsed.data.dateOfBirth),
      gender: parsed.data.gender ?? null,
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
    details: `${created.username} · ${created.email}`,
  });

  const { addUserToAllConversation } = await import("@/lib/chat-actions");
  await addUserToAllConversation(created.id);

  revalidatePath("/admin/users");
  return { success: true };
}

export async function updateUserAction(userId: string, formData: FormData) {
  const admin = await requireRole(["ADMIN"]);
  if (!canManageUsers(admin.role)) return { error: await actionError("noPermission") };

  const parsed = userSchema.safeParse({
    username: formData.get("username"),
    email: formData.get("email"),
    name: formData.get("name"),
    phone: formData.get("phone"),
    dateOfBirth: formData.get("dateOfBirth"),
    gender: formData.get("gender"),
    role: formData.get("role"),
    departmentId: formData.get("departmentId") || null,
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: await actionError("userNotFoundStaff") };

  const username = normalizeUsername(parsed.data.username);

  if (username !== target.username) {
    if (!isValidUsername(username)) {
      return {
        error: "Tên người dùng tối thiểu 8 ký tự và phải có dấu chấm (vd. vinh.tran)",
      };
    }
    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (existing) return { error: "Tên người dùng đã được sử dụng" };
  }

  if (parsed.data.email !== target.email) {
    const existing = await prisma.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (existing) return { error: await actionError("emailInUse") };
  }

  if (userId === admin.id && !parsed.data.isActive) {
    return { error: await actionError("cannotDeactivateSelf") };
  }

  if (
    target.role === "ADMIN" &&
    (parsed.data.role !== "ADMIN" || !parsed.data.isActive)
  ) {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN", isActive: true },
    });
    if (adminCount <= 1) {
      return { error: await actionError("cannotDemoteLastAdmin") };
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        username,
        email: parsed.data.email,
        name: parsed.data.name,
        phone: parsed.data.phone?.trim() || null,
        dateOfBirth: parseDateOfBirthInput(parsed.data.dateOfBirth),
        gender: parsed.data.gender ?? null,
        role: parsed.data.role,
        departmentId: parsed.data.departmentId || null,
        isActive: parsed.data.isActive,
      },
    });

    await createAuditLog({
      userId: admin.id,
      action: "UPDATE",
      entityType: "User",
      entityId: updated.id,
      details: `${updated.username} · ${updated.email}`,
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("updateUserAction failed:", error);
    return { error: await actionError("cannotUpdateUser") };
  }
}

export async function setUserActiveAction(userId: string, isActive: boolean) {
  const admin = await requireRole(["ADMIN"]);
  if (!canManageUsers(admin.role)) return { error: await actionError("noPermission") };

  if (userId === admin.id && !isActive) {
    return { error: await actionError("cannotDeactivateSelf") };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return { error: await actionError("userNotFoundStaff") };

  if (target.isActive === isActive) {
    return { success: true };
  }

  if (target.role === "ADMIN" && !isActive) {
    const adminCount = await prisma.user.count({
      where: { role: "ADMIN", isActive: true },
    });
    if (adminCount <= 1) {
      return { error: await actionError("cannotDeactivateLastAdmin") };
    }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive },
    });

    await createAuditLog({
      userId: admin.id,
      action: "UPDATE",
      entityType: "User",
      entityId: userId,
      details: isActive
        ? `Kích hoạt tài khoản ${target.email}`
        : `Khóa tài khoản ${target.email}`,
    });

    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("setUserActiveAction failed:", error);
    return { error: await actionError("cannotUpdateUser") };
  }
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
  if (!canManageUsers(admin.role)) return { error: await actionError("noPermission") };

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
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
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

export async function updateWorkTypeAction(workTypeId: string, formData: FormData) {
  const user = await requireRole(["ADMIN"]);
  const parsed = workTypeSchema.safeParse({
    name: formData.get("name"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const existing = await prisma.workType.findUnique({ where: { id: workTypeId } });
  if (!existing) return { error: await actionError("workTypeNotFound") };

  if (parsed.data.name !== existing.name) {
    const duplicate = await prisma.workType.findUnique({
      where: { name: parsed.data.name },
    });
    if (duplicate) return { error: await actionError("workTypeNameInUse") };
  }

  try {
    const workType = await prisma.workType.update({
      where: { id: workTypeId },
      data: {
        name: parsed.data.name,
        isActive: parsed.data.isActive,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "WorkType",
      entityId: workType.id,
      details: workType.name,
    });

    revalidatePath("/admin/work-types");
    return { success: true };
  } catch (error) {
    console.error("updateWorkTypeAction failed:", error);
    return { error: await actionError("cannotUpdateWorkType") };
  }
}

export async function setWorkTypeActiveAction(workTypeId: string, isActive: boolean) {
  const user = await requireRole(["ADMIN"]);

  const existing = await prisma.workType.findUnique({ where: { id: workTypeId } });
  if (!existing) return { error: await actionError("workTypeNotFound") };

  if (existing.isActive === isActive) {
    return { success: true };
  }

  try {
    await prisma.workType.update({
      where: { id: workTypeId },
      data: { isActive },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "WorkType",
      entityId: workTypeId,
      details: isActive
        ? `Kích hoạt loại công việc ${existing.name}`
        : `Ngưng loại công việc ${existing.name}`,
    });

    revalidatePath("/admin/work-types");
    return { success: true };
  } catch (error) {
    console.error("setWorkTypeActiveAction failed:", error);
    return { error: await actionError("cannotUpdateWorkType") };
  }
}

export async function deleteWorkTypeAction(workTypeId: string) {
  const user = await requireRole(["ADMIN"]);

  const existing = await prisma.workType.findUnique({
    where: { id: workTypeId },
    include: { _count: { select: { planSteps: true } } },
  });
  if (!existing) return { error: await actionError("workTypeNotFound") };

  if (existing._count.planSteps > 0) {
    return { error: await actionError("cannotDeleteWorkTypeInUse") };
  }

  try {
    await prisma.workType.delete({ where: { id: workTypeId } });

    await createAuditLog({
      userId: user.id,
      action: "DELETE",
      entityType: "WorkType",
      entityId: workTypeId,
      details: existing.name,
    });

    revalidatePath("/admin/work-types");
    return { success: true };
  } catch (error) {
    console.error("deleteWorkTypeAction failed:", error);
    return { error: await actionError("cannotDeleteWorkType") };
  }
}

export async function createAttachmentLabelAction(formData: FormData) {
  const user = await requireRole(["ADMIN"]);
  const parsed = attachmentLabelSchema.safeParse({
    name: formData.get("name"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const label = await prisma.attachmentLabel.create({ data: parsed.data });
  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entityType: "AttachmentLabel",
    entityId: label.id,
    details: label.name,
  });

  revalidatePath("/admin/attachment-labels");
  return { success: true };
}

export async function createDepartmentAction(formData: FormData) {
  const user = await requireRole(["ADMIN"]);
  const parsed = departmentSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
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

export async function updateDepartmentAction(departmentId: string, formData: FormData) {
  const user = await requireRole(["ADMIN"]);
  const parsed = departmentSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const existing = await prisma.department.findUnique({ where: { id: departmentId } });
  if (!existing) return { error: await actionError("departmentNotFound") };

  if (parsed.data.name !== existing.name) {
    const duplicate = await prisma.department.findUnique({
      where: { name: parsed.data.name },
    });
    if (duplicate) return { error: await actionError("departmentNameInUse") };
  }

  try {
    const department = await prisma.department.update({
      where: { id: departmentId },
      data: { name: parsed.data.name },
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "Department",
      entityId: department.id,
      details: department.name,
    });

    revalidatePath("/admin/departments");
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("updateDepartmentAction failed:", error);
    return { error: await actionError("cannotUpdateDepartment") };
  }
}

export async function deleteDepartmentAction(departmentId: string) {
  const user = await requireRole(["ADMIN"]);

  const existing = await prisma.department.findUnique({
    where: { id: departmentId },
    include: { _count: { select: { users: true } } },
  });
  if (!existing) return { error: await actionError("departmentNotFound") };

  if (existing._count.users > 0) {
    return { error: await actionError("cannotDeleteDepartmentInUse") };
  }

  try {
    await prisma.department.delete({ where: { id: departmentId } });

    await createAuditLog({
      userId: user.id,
      action: "DELETE",
      entityType: "Department",
      entityId: departmentId,
      details: existing.name,
    });

    revalidatePath("/admin/departments");
    revalidatePath("/admin/users");
    return { success: true };
  } catch (error) {
    console.error("deleteDepartmentAction failed:", error);
    return { error: await actionError("cannotDeleteDepartment") };
  }
}

const OPEN_MATTER_STATUSES = ["NEW", "IN_PROGRESS", "ON_HOLD"] as const;

export async function getOpenMattersForExpenseAction() {
  const user = await requireAuth();
  const accessibleIds = await getAccessibleMatterIds(user.id, user.role);

  if (accessibleIds && accessibleIds.length === 0) {
    return { matters: [] as { id: string; code: string; title: string }[] };
  }

  const matters = await prisma.matter.findMany({
    where: {
      status: { in: [...OPEN_MATTER_STATUSES] },
      ...(accessibleIds ? { id: { in: accessibleIds } } : {}),
    },
    select: { id: true, code: true, title: true },
    orderBy: [{ updatedAt: "desc" }, { code: "asc" }],
  });

  return { matters };
}

export async function createMatterExpenseAction(formData: FormData) {
  const user = await requireAuth();
  const parsed = matterExpenseSchema.safeParse({
    matterId: formData.get("matterId"),
    type: formData.get("type"),
    customTypeLabel: formData.get("customTypeLabel"),
    amountVnd: formData.get("amountVnd"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const accessibleIds = await getAccessibleMatterIds(user.id, user.role);
  if (accessibleIds && !accessibleIds.includes(parsed.data.matterId)) {
    return { error: await actionError("noMatterAccess") };
  }

  const matter = await prisma.matter.findUnique({
    where: { id: parsed.data.matterId },
    select: { id: true, code: true, title: true, status: true },
  });
  if (!matter) return { error: await actionError("matterNotFound") };
  if (!OPEN_MATTER_STATUSES.includes(matter.status as (typeof OPEN_MATTER_STATUSES)[number])) {
    return { error: await actionError("matterNotOpen") };
  }

  const amountVnd = BigInt(parsed.data.amountVnd);
  const customTypeLabel =
    parsed.data.type === "OTHER" ? parsed.data.customTypeLabel?.trim() || null : null;

  try {
    const expense = await prisma.matterExpense.create({
      data: {
        matterId: matter.id,
        type: parsed.data.type,
        customTypeLabel,
        amountVnd,
        createdById: user.id,
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "MatterExpense",
      entityId: expense.id,
      details: `${matter.code}: ${amountVnd.toString()} VND`,
    });

    revalidatePath(`/matters/${matter.id}`);
    revalidatePath("/matters");
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error) {
    console.error("createMatterExpenseAction failed:", error);
    return { error: await actionError("cannotCreateExpense") };
  }
}

