"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { createAuditLog } from "@/lib/audit";
import { actionError } from "@/i18n/server-labels";
import { spendCategorySchema } from "@/lib/wallet-validations";

export async function createSpendCategoryAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const parsed = spendCategorySchema.safeParse({
    name: formData.get("name"),
    requiresMatter: formData.get("requiresMatter") === "on",
    isActive: formData.get("isActive") === "on",
    sortOrder: formData.get("sortOrder") || 100,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const duplicate = await prisma.spendCategory.findUnique({
    where: { name: parsed.data.name },
  });
  if (duplicate) {
    return { error: await actionError("spendCategoryNameInUse") };
  }

  try {
    const row = await prisma.spendCategory.create({
      data: {
        name: parsed.data.name,
        requiresMatter: parsed.data.requiresMatter,
        isActive: parsed.data.isActive,
        sortOrder: parsed.data.sortOrder,
        isSystem: false,
      },
    });
    await createAuditLog({
      userId: user.id,
      action: "CREATE",
      entityType: "SpendCategory",
      entityId: row.id,
      details: row.name,
    });
    revalidatePath("/admin/spend-categories");
    revalidatePath("/wallet");
    revalidatePath("/expenses");
    return { success: true };
  } catch (error) {
    console.error("createSpendCategoryAction failed:", error);
    return { error: await actionError("cannotCreateSpendCategory") };
  }
}

export async function updateSpendCategoryAction(
  categoryId: string,
  formData: FormData,
) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const parsed = spendCategorySchema.safeParse({
    name: formData.get("name"),
    requiresMatter: formData.get("requiresMatter") === "on",
    isActive: formData.get("isActive") === "on",
    sortOrder: formData.get("sortOrder") || 100,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? (await actionError("invalidData")) };
  }

  const existing = await prisma.spendCategory.findUnique({ where: { id: categoryId } });
  if (!existing) return { error: await actionError("spendCategoryNotFound") };

  if (parsed.data.name !== existing.name) {
    const duplicate = await prisma.spendCategory.findUnique({
      where: { name: parsed.data.name },
    });
    if (duplicate) return { error: await actionError("spendCategoryNameInUse") };
  }

  try {
    const row = await prisma.spendCategory.update({
      where: { id: categoryId },
      data: {
        name: parsed.data.name,
        // System MATTER must keep requiresMatter=true
        requiresMatter: existing.isSystem && existing.code === "MATTER"
          ? true
          : parsed.data.requiresMatter,
        isActive: parsed.data.isActive,
        sortOrder: parsed.data.sortOrder,
      },
    });
    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "SpendCategory",
      entityId: row.id,
      details: row.name,
    });
    revalidatePath("/admin/spend-categories");
    revalidatePath("/wallet");
    revalidatePath("/expenses");
    return { success: true };
  } catch (error) {
    console.error("updateSpendCategoryAction failed:", error);
    return { error: await actionError("cannotUpdateSpendCategory") };
  }
}

export async function setSpendCategoryActiveAction(
  categoryId: string,
  isActive: boolean,
) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const existing = await prisma.spendCategory.findUnique({ where: { id: categoryId } });
  if (!existing) return { error: await actionError("spendCategoryNotFound") };

  try {
    await prisma.spendCategory.update({
      where: { id: categoryId },
      data: { isActive },
    });
    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "SpendCategory",
      entityId: categoryId,
      details: `${existing.name}: ${isActive ? "active" : "inactive"}`,
    });
    revalidatePath("/admin/spend-categories");
    revalidatePath("/wallet");
    revalidatePath("/expenses");
    return { success: true };
  } catch (error) {
    console.error("setSpendCategoryActiveAction failed:", error);
    return { error: await actionError("cannotUpdateSpendCategory") };
  }
}

export async function deleteSpendCategoryAction(categoryId: string) {
  const user = await requireRole(["ADMIN", "MANAGER"]);
  const existing = await prisma.spendCategory.findUnique({ where: { id: categoryId } });
  if (!existing) return { error: await actionError("spendCategoryNotFound") };
  if (existing.isSystem) {
    return { error: await actionError("cannotDeleteSystemSpendCategory") };
  }

  const inUse = await prisma.walletTransaction.count({
    where: { spendCategoryId: categoryId },
  });
  if (inUse > 0) {
    return { error: await actionError("cannotDeleteSpendCategoryInUse") };
  }

  try {
    await prisma.spendCategory.delete({ where: { id: categoryId } });
    await createAuditLog({
      userId: user.id,
      action: "DELETE",
      entityType: "SpendCategory",
      entityId: categoryId,
      details: existing.name,
    });
    revalidatePath("/admin/spend-categories");
    revalidatePath("/wallet");
    revalidatePath("/expenses");
    return { success: true };
  } catch (error) {
    console.error("deleteSpendCategoryAction failed:", error);
    return { error: await actionError("cannotDeleteSpendCategory") };
  }
}
