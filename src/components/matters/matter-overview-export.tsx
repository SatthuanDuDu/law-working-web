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
    <div className={cn("space-y-1.5", className)}>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          className="interactive-press h-9 gap-1.5 px-3 text-sm"
          onClick={() => run("pdf")}
        >
          <FileDown className="h-3.5 w-3.5" aria-hidden />
          {t("exportPdf")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending}
          className="interactive-press h-9 gap-1.5 px-3 text-sm"
          onClick={() => run("docx")}
        >
          <FileText className="h-3.5 w-3.5" aria-hidden />
          {t("exportWord")}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
