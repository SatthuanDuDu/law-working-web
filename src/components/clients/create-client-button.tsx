"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ClientFormModal } from "@/components/clients/client-form";
import { Button } from "@/components/ui/button";

export function CreateClientButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Khách hàng mới"
        className="interactive-press h-10 shrink-0 rounded-full px-5 shadow-sm"
      >
        <Plus className="h-4 w-4" />
        Khách hàng mới
      </Button>
      <ClientFormModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
