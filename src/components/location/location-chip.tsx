"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { LocationValue } from "@/lib/location";
import { locationDisplayLabel } from "@/lib/location";
import { MapPreviewModal } from "@/components/location/map-preview-modal";

type Props = {
  location: LocationValue;
  className?: string;
};

export function LocationChip({ location, className }: Props) {
  const t = useTranslations("location");
  const [open, setOpen] = useState(false);
  const label = locationDisplayLabel(location);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "interactive-press inline-flex max-w-full items-start gap-1.5 rounded-md border border-primary/20 bg-primary-muted px-2.5 py-1 text-left text-sm font-medium text-primary",
          className,
        )}
        title={t("openMap")}
        aria-label={`${t("openMap")}: ${label}`}
      >
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 break-words whitespace-normal">{label}</span>
      </button>      <MapPreviewModal
        open={open}
        onClose={() => setOpen(false)}
        location={location}
      />
    </>
  );
}
