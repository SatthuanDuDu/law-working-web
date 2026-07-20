"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useMatterFormData } from "@/hooks/use-matter-form-data";

const CreateMatterModal = dynamic(
  () =>
    import("@/components/matters/create-matter-modal").then((mod) => ({
      default: mod.CreateMatterModal,
    })),
  { ssr: false },
);

export function CreateMatterButton() {
  const t = useTranslations("matters");
  const [open, setOpen] = useState(false);
  const { formData, loading, ensureLoaded } = useMatterFormData();

  async function handleOpen() {
    const data = await ensureLoaded();
    if (data) setOpen(true);
  }

  return (
    <>
      <Button
        type="button"
        className="shrink-0"
        onClick={() => void handleOpen()}
        disabled={loading}
        aria-label={t("create")}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{t("create")}</span>
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
