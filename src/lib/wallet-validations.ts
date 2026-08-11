import { z } from "zod";
import { EXPENSE_TYPES } from "@/lib/validations";

export const allocateBudgetSchema = z.object({
  walletUserId: z.string().min(1, "Vui lòng chọn nhân viên"),
  amountVnd: z
    .string()
    .trim()
    .regex(/^\d+$/, "Số tiền không hợp lệ")
    .refine((v) => BigInt(v) > BigInt(0), "Số tiền phải lớn hơn 0"),
  note: z.string().max(500).optional().nullable(),
});

export const clientReceiptSchema = z.object({
  amountVnd: z
    .string()
    .trim()
    .regex(/^\d+$/, "Số tiền không hợp lệ")
    .refine((v) => BigInt(v) > BigInt(0), "Số tiền phải lớn hơn 0"),
  toUserId: z.string().min(1, "Vui lòng chọn người nhận bàn giao"),
  matterId: z.string().min(1, "Vui lòng chọn vụ việc"),
  matterPlanStepId: z.string().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export const moneyConfirmRecipientSchema = z.object({
  confirmationId: z.string().min(1),
  response: z.enum(["ACCEPT", "REJECT", "DISPUTE"]),
  disputeNote: z.string().max(1000).optional().nullable(),
});

export const moneyConfirmAllocatorSchema = z.object({
  confirmationId: z.string().min(1),
});

export const spendCategorySchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên nhóm").max(100),
  requiresMatter: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(100),
});

export const walletSpendSchema = z
  .object({
    spendCategoryId: z.string().min(1, "Vui lòng chọn nhóm chi"),
    amountVnd: z
      .string()
      .trim()
      .regex(/^\d+$/, "Số tiền không hợp lệ")
      .refine((v) => BigInt(v) > BigInt(0), "Số tiền phải lớn hơn 0"),
    detail: z.string().max(2000).optional().nullable(),
    matterId: z.string().optional().nullable(),
    matterPlanStepId: z.string().optional().nullable(),
    expenseType: z.enum(EXPENSE_TYPES).optional().nullable(),
    customTypeLabel: z.string().optional().nullable(),
    note: z.string().max(500).optional().nullable(),
    /** Client hint; server re-checks from DB. */
    requiresMatter: z
      .union([z.literal("true"), z.literal("false"), z.boolean()])
      .optional()
      .transform((v) => v === true || v === "true"),
  })
  .superRefine((data, ctx) => {
    if (!data.detail?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vui lòng mô tả chi tiết chi phí",
        path: ["detail"],
      });
    }
    if (data.requiresMatter) {
      if (!data.matterId?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Vui lòng chọn vụ việc",
          path: ["matterId"],
        });
      }
      if (!data.expenseType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Vui lòng chọn loại chi phí vụ việc",
          path: ["expenseType"],
        });
      }
      if (data.expenseType === "OTHER" && !data.customTypeLabel?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Vui lòng nhập loại chi phí",
          path: ["customTypeLabel"],
        });
      }
    }
  });
