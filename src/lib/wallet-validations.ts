import { z } from "zod";
import { EXPENSE_TYPES } from "@/lib/validations";

const positiveVnd = z
  .string()
  .trim()
  .regex(/^\d+$/, "Số tiền không hợp lệ")
  .refine((v) => BigInt(v) > BigInt(0), "Số tiền phải lớn hơn 0");

export const allocateBudgetSchema = z.object({
  walletUserId: z.string().min(1, "Vui lòng chọn nhân viên"),
  amountVnd: positiveVnd,
  note: z.string().max(500).optional().nullable(),
  /** Optional: when set, allocate into an existing PENDING_FUNDING/OPEN package. */
  budgetPackageId: z.string().optional().nullable(),
  /** Optional: create a named package instead of legacy allocate-only. */
  packageName: z.string().trim().max(200).optional().nullable(),
});

export const createBudgetPackageSchema = z.object({
  name: z.string().trim().min(1, "Vui lòng nhập tên gói").max(200),
  ownerUserId: z.string().min(1, "Vui lòng chọn nhân viên"),
  amountVnd: positiveVnd,
  note: z.string().max(500).optional().nullable(),
  matterId: z.string().optional().nullable(),
});

export const updateBudgetPackageSchema = z.object({
  packageId: z.string().min(1),
  name: z.string().trim().min(1, "Vui lòng nhập tên gói").max(200),
  note: z.string().max(500).optional().nullable(),
});

export const topupBudgetPackageSchema = z.object({
  packageId: z.string().min(1),
  amountVnd: positiveVnd,
  note: z.string().max(500).optional().nullable(),
});

export const requestTopupSchema = z.object({
  packageId: z.string().min(1),
  amountVnd: positiveVnd,
  reason: z.string().trim().min(3, "Vui lòng nhập lý do").max(500),
});

export const decideTopupSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(500).optional().nullable(),
});

export const requestSettlePackageSchema = z
  .object({
    packageId: z.string().min(1),
    settleMode: z.enum(["REFUND", "CARRY_FORWARD"]),
    carryToPackageId: z.string().optional().nullable(),
    note: z.string().max(500).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.settleMode === "CARRY_FORWARD" && !data.carryToPackageId?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Vui lòng chọn gói đích để chuyển số dư",
        path: ["carryToPackageId"],
      });
    }
  });

export const decideSettlePackageSchema = z.object({
  confirmationId: z.string().min(1),
  decision: z.enum(["APPROVE", "REJECT"]),
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
    amountVnd: positiveVnd,
    budgetPackageId: z.string().min(1, "Vui lòng chọn gói chi phí"),
    /** Optional second package to cover overspend. */
    splitFromPackageId: z.string().optional().nullable(),
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
    if (
      data.splitFromPackageId?.trim() &&
      data.splitFromPackageId.trim() === data.budgetPackageId
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Gói bù phải khác gói chính",
        path: ["splitFromPackageId"],
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

/** Update an existing SPEND debit (same fields as create + id + justification). */
export const walletUpdateSpendSchema = walletSpendSchema.and(
  z.object({
    transactionId: z.string().min(1, "Thiếu mã giao dịch"),
    justification: z
      .string()
      .trim()
      .min(3, "Vui lòng nhập lý do sửa (ít nhất 3 ký tự)")
      .max(1000),
  }),
);
