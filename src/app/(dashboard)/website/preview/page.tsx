import { PreviewFrame } from "@/components/website-cms/preview-frame";
import { getSitePreviewHref } from "@/lib/cms-edit-targets";
import { requireRole } from "@/lib/session";

export default async function WebsitePreviewPage() {
  await requireRole(["ADMIN", "MANAGER"]);
  const siteUrl = getSitePreviewHref();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Xem trước</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Xem website công khai tại{" "}
          <a
            href={siteUrl}
            className="font-medium text-primary underline"
            target="_blank"
            rel="noreferrer"
          >
            {siteUrl}
          </a>
          .
        </p>
      </div>
      <PreviewFrame siteUrl={siteUrl} />
    </div>
  );
}
