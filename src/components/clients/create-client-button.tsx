"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { ClientFormModal } from "@/components/clients/client-form";
import { Button } from "@/components/ui/button";

export function CreateClientButton() {
  const t = useTranslations("clients");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={t("create")}
        className="interactive-press shrink-0 gap-1.5"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        <span className="sm:hidden">{t("createShort")}</span>
        <span className="hidden sm:inline">{t("create")}</span>
      </Button>
      <ClientFormModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
