"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CircleDollarSign } from "lucide-react";
import {
  AddExpenseModal,
  type ExpenseMatterOption,
} from "@/components/expenses/add-expense-modal";
import { getOpenMattersForExpenseAction } from "@/lib/actions";
import { cn } from "@/lib/utils";

export function AddExpenseFab() {
  const t = useTranslations("expense");
  const [open, setOpen] = useState(false);
  const [matters, setMatters] = useState<ExpenseMatterOption[]>([]);
  const [loadingMatters, setLoadingMatters] = useState(false);
  const [, startTransition] = useTransition();

  function handleOpen() {
    setOpen(true);
    setLoadingMatters(true);
    startTransition(async () => {
      try {
        const result = await getOpenMattersForExpenseAction();
        setMatters(result.matters);
      } catch {
        setMatters([]);
      } finally {
        setLoadingMatters(false);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t("fabLabel")}
        title={t("fabLabel")}
        className={cn(
          "interactive-press fixed z-40 flex h-14 w-14 items-center justify-center rounded-full",
          "bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]",
          "bg-primary text-primary-foreground shadow-[var(--shadow-overlay)]",
          "hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        )}
      >
        <CircleDollarSign className="h-6 w-6" aria-hidden />
      </button>
      <AddExpenseModal
        open={open}
        onClose={() => setOpen(false)}
        matters={matters}
        loadingMatters={loadingMatters}
      />
    </>
  );
}
