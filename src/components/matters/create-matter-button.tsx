"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MatterFormData } from "@/lib/matter-form-data";
import { CreateMatterModal } from "@/components/matters/create-matter-modal";

export function CreateMatterButton({ formData }: { formData: MatterFormData }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        className="shrink-0"
        onClick={() => setOpen(true)}
        aria-label="Tạo vụ việc"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Tạo vụ việc</span>
      </Button>
      <CreateMatterModal
        open={open}
        formData={formData}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
