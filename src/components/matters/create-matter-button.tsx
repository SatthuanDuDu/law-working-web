"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useMatterFormData } from "@/hooks/use-matter-form-data";
import { HEADER_TOOLBAR_BTN_SOLID } from "@/components/layout/header-toolbar";
import { cn } from "@/lib/utils";

const CreateMatterModal = dynamic(
  () =>
    import("@/components/matters/create-matter-modal").then((mod) => ({
      default: mod.CreateMatterModal,
    })),
  { ssr: false },
);

export function CreateMatterButton({
  variant = "header",
}: {
  /** `header` = compact icon in page header; `toolbar` = labeled CTA on list pages. */
  variant?: "header" | "toolbar";
}) {
  const t = useTranslations("matters");
  const [open, setOpen] = useState(false);
  const { formData, loading, ensureLoaded } = useMatterFormData();

  async function handleOpen() {
    const data = await ensureLoaded();
    if (data) setOpen(true);
  }

  const isToolbar = variant === "toolbar";

  return (
    <>
      <Button
        type="button"
        size={isToolbar ? "sm" : "icon"}
        className={cn(
          isToolbar
            ? "interactive-press shrink-0 gap-1.5"
            : cn(HEADER_TOOLBAR_BTN_SOLID, "header-create-btn"),
        )}
        onClick={() => void handleOpen()}
        disabled={loading}
        aria-label={t("create")}
        title={t("create")}
      >
        {loading ? (
          <Loader2
            className={cn("animate-spin", isToolbar && "h-3.5 w-3.5")}
            aria-hidden
          />
        ) : (
          <Plus className={isToolbar ? "h-3.5 w-3.5" : undefined} aria-hidden />
        )}
        {isToolbar ? (
          <>
            <span className="sm:hidden">{t("createShort")}</span>
            <span className="hidden sm:inline">{t("create")}</span>
          </>
        ) : null}
      </Button>
      {open && formData ? (
        <CreateMatterModal
          open={open}
          formData={formData}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
