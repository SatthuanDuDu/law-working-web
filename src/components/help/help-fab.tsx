"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CircleHelp } from "lucide-react";
import { HelpPanel } from "@/components/help/help-panel";
import { cn } from "@/lib/utils";

export function HelpFab() {
  const t = useTranslations("help");
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);

  function handleOpen() {
    setSession((n) => n + 1);
    setOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        aria-label={t("fabLabel")}
        title={t("fabLabel")}
        aria-expanded={open}
        className={cn(
          "interactive-press fixed z-40 flex h-14 w-14 items-center justify-center rounded-full",
          // Stack above expense FAB (3.5rem) + gap 0.75rem + 1rem base + safe area
          "bottom-[max(5.5rem,calc(1rem+3.5rem+0.75rem+env(safe-area-inset-bottom)))]",
          "right-[max(1rem,env(safe-area-inset-right))]",
          "bg-primary text-primary-foreground shadow-[var(--shadow-overlay)]",
          "hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          open && "ring-2 ring-primary/30",
        )}
      >
        <CircleHelp className="h-6 w-6" aria-hidden />
      </button>
      <HelpPanel key={session} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
