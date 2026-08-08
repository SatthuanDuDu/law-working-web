import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cmsDb } from "@/lib/cms-db";
import { revalidatePublicSite } from "@/lib/cms-revalidate";
import { requireRole } from "@/lib/session";
import { cn } from "@/lib/utils";

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
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Thứ tự</th>
              <th className="px-4 py-3 font-semibold">Tên (VI)</th>
              <th className="px-4 py-3 font-semibold">Name (EN)</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {areas.map((area) => {
              const vi = area.translations.find((t) => t.locale === "vi");
              const en = area.translations.find((t) => t.locale === "en");
              return (
                <tr key={area.id} className="interactive-row">
                  <td className="px-4 py-3">{area.order}</td>
                  <td className="px-4 py-3 font-medium">{vi?.name ?? "—"}</td>
                  <td className="px-4 py-3">{en?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold",
                        area.status === "PUBLISHED"
                          ? "bg-primary-muted text-primary"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {area.status === "PUBLISHED" ? "Công khai" : "Nháp"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <Link
                        href={`/website/practice-areas/${area.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        Sửa
                      </Link>
                      <form action={deletePracticeArea} className="inline">
                        <input type="hidden" name="id" value={area.id} />
                        <button type="submit" className="font-semibold text-red-700 hover:underline">
                          Xoá
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
