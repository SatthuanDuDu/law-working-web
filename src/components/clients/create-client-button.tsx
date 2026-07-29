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
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={t("newClient")}
        title={t("newClient")}
        className="h-10 w-10 shrink-0 rounded-md p-0 [&_svg]:h-4 [&_svg]:w-4"
      >
        <Plus />
      </Button>
      <ClientFormModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
