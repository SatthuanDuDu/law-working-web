import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableEmptyRow,
} from "@/components/ui/table";
import { StatusChip } from "@/components/ui/status-chip";
import { cmsDb } from "@/lib/cms-db";
import { revalidatePublicSite } from "@/lib/cms-revalidate";
import { requireRole } from "@/lib/session";

async function deletePracticeArea(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await cmsDb.practiceArea.delete({ where: { id } });
  await revalidatePublicSite();
  redirect("/website/practice-areas");
}

export default async function WebsitePracticeAreasPage() {
  const areas = await cmsDb.practiceArea.findMany({
    orderBy: { order: "asc" },
    include: { translations: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Lĩnh vực hành nghề</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Nội dung song ngữ Việt / Anh.
          </p>
        </div>
        <Button asChild>
          <Link href="/website/practice-areas/new">Thêm lĩnh vực</Link>
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <Table>
          <THead className="border-b border-border bg-muted/50">
            <TR>
              <TH className="px-4 py-3">Thứ tự</TH>
              <TH className="px-4 py-3">Tên (VI)</TH>
              <TH className="px-4 py-3">Name (EN)</TH>
              <TH className="px-4 py-3">Trạng thái</TH>
              <TH className="px-4 py-3" />
            </TR>
          </THead>
          <TBody>
            {areas.length === 0 ? (
              <TableEmptyRow colSpan={5}>Chưa có lĩnh vực nào.</TableEmptyRow>
            ) : (
              areas.map((area) => {
                const vi = area.translations.find((t) => t.locale === "vi");
                const en = area.translations.find((t) => t.locale === "en");
                return (
                  <TR key={area.id} className="interactive-row">
                    <TD className="px-4 py-3">{area.order}</TD>
                    <TD className="px-4 py-3 font-medium">{vi?.name ?? "—"}</TD>
                    <TD className="px-4 py-3">{en?.name ?? "—"}</TD>
                    <TD className="px-4 py-3">
                      <StatusChip
                        label={area.status === "PUBLISHED" ? "Công khai" : "Nháp"}
                        tone={area.status === "PUBLISHED" ? "primary" : "slate"}
                      />
                    </TD>
                    <TD className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <Link
                          href={`/website/practice-areas/${area.id}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          Sửa
                        </Link>
                        <form action={deletePracticeArea} className="inline">
                          <input type="hidden" name="id" value={area.id} />
                          <button
                            type="submit"
                            className="font-semibold text-red-700 hover:underline"
                          >
                            Xoá
                          </button>
                        </form>
                      </div>
                    </TD>
                  </TR>
                );
              })
            )}
          </TBody>
        </Table>
      </div>
    </div>
  );
}
