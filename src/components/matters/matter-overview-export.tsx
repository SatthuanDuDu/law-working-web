"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { FileDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMatterOverviewAction } from "@/lib/matter-overview-actions";
import {
  downloadMatterOverviewDocx,
  downloadMatterOverviewPdf,
} from "@/lib/export-matter-overview";
import { cn } from "@/lib/utils";

export function MatterOverviewExport({
  matterId,
  className,
}: {
  matterId: string;
  className?: string;
}) {
  const t = useTranslations("matters.overviewExport");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function run(kind: "pdf" | "docx") {
    setError("");
    startTransition(async () => {
      try {
        const result = await getMatterOverviewAction(matterId);
        if (result.error || !result.overview) {
          setError(result.error || t("failed"));
          return;
        }
        if (kind === "pdf") {
          await downloadMatterOverviewPdf(result.overview);
        } else {
          await downloadMatterOverviewDocx(result.overview);
        }
      } catch (err) {
        console.error(err);
        setError(t("failed"));
      }
    });
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-md border border-primary/15 bg-primary-muted/80 p-2.5 sm:p-3",
        className,
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
        {t("label")}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={pending}
          className="interactive-press h-9 min-w-[7.5rem] flex-1 gap-1.5 px-3 text-sm sm:flex-none"
          onClick={() => run("pdf")}
        >
          <FileDown className="h-4 w-4 shrink-0" aria-hidden />
          {t("exportPdf")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="default"
          disabled={pending}
          className="interactive-press h-9 min-w-[7.5rem] flex-1 gap-1.5 px-3 text-sm sm:flex-none"
          onClick={() => run("docx")}
        >
          <FileText className="h-4 w-4 shrink-0" aria-hidden />
          {t("exportWord")}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
