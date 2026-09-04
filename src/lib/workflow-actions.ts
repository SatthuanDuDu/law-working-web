"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { createAuditLog } from "@/lib/audit";
import { workflowTemplateSchema } from "@/lib/validations";

function parseWorkflowStepsJson(raw: string | null | undefined) {
  if (!raw?.trim()) return { error: "Thiếu danh sách bước workflow" as const };
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return { error: "Danh sách bước không hợp lệ" as const };
    }
    return { steps: parsed as unknown[] };
  } catch {
    return { error: "Danh sách bước không hợp lệ" as const };
  }
}

function normalizeWorkflowPayload(formData: FormData) {
  const stepsRaw = formData.get("stepsJson");
  const stepsParsed = parseWorkflowStepsJson(
    typeof stepsRaw === "string" ? stepsRaw : null,
  );
  if ("error" in stepsParsed) return { error: stepsParsed.error };

  const validated = workflowTemplateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || null,
    isActive: formData.get("isActive") === "on" || formData.get("isActive") === "true",
    steps: stepsParsed.steps,
  });

  if (!validated.success) {
    return {
      error: validated.error.issues[0]?.message ?? "Dữ liệu workflow không hợp lệ",
    };
  }

  return { data: validated.data };
}

export async function createWorkflowTemplateAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const parsed = normalizeWorkflowPayload(formData);
  if ("error" in parsed) return { error: parsed.error };

  try {
    const template = await prisma.workflowTemplate.create({
      data: {
        name: parsed.data.name.trim(),
        description: parsed.data.description?.trim() || null,
        isActive: parsed.data.isActive,
        createdById: user.id,
        steps: {
          create: parsed.data.steps.map((step, index) => ({
            title: step.title.trim(),
            description: step.description?.trim() || null,
            sortOrder: index + 1,
          })),
        },
      },
    });

    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "WorkflowTemplate",
      entityId: template.id,
      details: template.name,
    });

    revalidatePath("/workflows");
    return { success: true, templateId: template.id };
  } catch (error) {
    console.error("createWorkflowTemplateAction failed:", error);
    return { error: "Không thể tạo workflow" };
  }
}

export async function updateWorkflowTemplateAction(
  templateId: string,
  formData: FormData,
) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const existing = await prisma.workflowTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, name: true },
  });
  if (!existing) return { error: "Không tìm thấy workflow" };

  const parsed = normalizeWorkflowPayload(formData);
  if ("error" in parsed) return { error: parsed.error };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.workflowTemplateStep.deleteMany({ where: { templateId } });
      await tx.workflowTemplate.update({
        where: { id: templateId },
        data: {
          name: parsed.data.name.trim(),
          description: parsed.data.description?.trim() || null,
          isActive: parsed.data.isActive,
          steps: {
            create: parsed.data.steps.map((step, index) => ({
              title: step.title.trim(),
              description: step.description?.trim() || null,
              sortOrder: index + 1,
            })),
          },
        },
      });
    });

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "WorkflowTemplate",
      entityId: templateId,
      details: parsed.data.name.trim(),
    });

    revalidatePath("/workflows");
    return { success: true };
  } catch (error) {
    console.error("updateWorkflowTemplateAction failed:", error);
    return { error: "Không thể cập nhật workflow" };
  }
}

export async function deleteWorkflowTemplateAction(templateId: string) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const existing = await prisma.workflowTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, name: true },
  });
  if (!existing) return { error: "Không tìm thấy workflow" };

  try {
    await prisma.workflowTemplate.delete({ where: { id: templateId } });
    await createAuditLog({
      userId: user.id,
      action: "DELETE",
      entityType: "WorkflowTemplate",
      entityId: templateId,
      details: existing.name,
    });
    revalidatePath("/workflows");
    return { success: true };
  } catch (error) {
    console.error("deleteWorkflowTemplateAction failed:", error);
    return { error: "Không thể xóa workflow" };
  }
}

export async function setWorkflowTemplateActiveAction(
  templateId: string,
  isActive: boolean,
) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const existing = await prisma.workflowTemplate.findUnique({
    where: { id: templateId },
    select: { id: true, name: true },
  });
  if (!existing) return { error: "Không tìm thấy workflow" };

  try {
    await prisma.workflowTemplate.update({
      where: { id: templateId },
      data: { isActive },
    });
    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "WorkflowTemplate",
      entityId: templateId,
      details: `${existing.name}: ${isActive ? "active" : "inactive"}`,
    });
    revalidatePath("/workflows");
    return { success: true };
  } catch (error) {
    console.error("setWorkflowTemplateActiveAction failed:", error);
    return { error: "Không thể cập nhật trạng thái workflow" };
  }
}

export async function listActiveWorkflowTemplatesAction() {
  await requireAuth();
  const templates = await prisma.workflowTemplate.findMany({
    where: { isActive: true },
    include: {
      steps: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { name: "asc" },
  });

  return templates.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    steps: template.steps.map((step) => ({
      id: step.id,
      title: step.title,
      description: step.description,
      sortOrder: step.sortOrder,
    })),
  }));
}
