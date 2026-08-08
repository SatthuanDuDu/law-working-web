import { notFound, redirect } from "next/navigation";

import { PracticeAreaForm } from "@/components/website-cms/practice-area-form";
import { slugify } from "@/lib/utils";
import { cmsDb } from "@/lib/cms-db";
import { revalidatePublicSite } from "@/lib/cms-revalidate";
import { requireRole } from "@/lib/session";

async function savePracticeArea(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Missing id");

  const key = String(formData.get("key") ?? "").trim();
  const icon = String(formData.get("icon") ?? "scale");
  const order = Number(formData.get("order") ?? 0) || 0;
  const featured = formData.get("featured") === "on";
  const status = formData.get("status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const coverKey = String(formData.get("coverKey") ?? "") || null;

  const vi = {
    slug:
      String(formData.get("slugVi") ?? "").trim() ||
      slugify(String(formData.get("nameVi") ?? "")),
    name: String(formData.get("nameVi") ?? "").trim(),
    summary: String(formData.get("summaryVi") ?? "").trim(),
    body: String(formData.get("bodyVi") ?? "").trim(),
    highlights: String(formData.get("highlightsVi") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };
  const en = {
    slug:
      String(formData.get("slugEn") ?? "").trim() ||
      slugify(String(formData.get("nameEn") ?? "")),
    name: String(formData.get("nameEn") ?? "").trim(),
    summary: String(formData.get("summaryEn") ?? "").trim(),
    body: String(formData.get("bodyEn") ?? "").trim(),
    highlights: String(formData.get("highlightsEn") ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  };

  await cmsDb.practiceArea.update({
    where: { id },
    data: {
      ...(key ? { key } : {}),
      icon,
      order,
      featured,
      status,
      coverKey,
    },
  });

  for (const [locale, text] of [
    ["vi", vi],
    ["en", en],
  ] as const) {
    await cmsDb.practiceAreaTranslation.upsert({
      where: {
        practiceAreaId_locale: { practiceAreaId: id, locale },
      },
      update: text,
      create: { practiceAreaId: id, locale, ...text },
    });
  }

  await revalidatePublicSite();
  redirect("/website/practice-areas");
}

async function deletePracticeArea(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await cmsDb.practiceArea.delete({ where: { id } });
  await revalidatePublicSite();
  redirect("/website/practice-areas");
}

export default async function EditPracticeAreaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { id } = await params;
  const area = await cmsDb.practiceArea.findUnique({
    where: { id },
    include: { translations: true },
  });
  if (!area) notFound();

  const vi = area.translations.find((t) => t.locale === "vi");
  const en = area.translations.find((t) => t.locale === "en");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Sửa lĩnh vực</h1>
        <form action={deletePracticeArea}>
          <input type="hidden" name="id" value={area.id} />
          <button
            type="submit"
            className="text-sm font-semibold text-red-600 hover:underline"
          >
            Xoá
          </button>
        </form>
      </div>
      <PracticeAreaForm
        action={savePracticeArea}
        initial={{
          id: area.id,
          key: area.key,
          icon: area.icon,
          order: area.order,
          featured: area.featured,
          status: area.status,
          coverKey: area.coverKey,
          nameVi: vi?.name ?? "",
          slugVi: vi?.slug ?? "",
          summaryVi: vi?.summary ?? "",
          bodyVi: vi?.body ?? "",
          highlightsVi: (vi?.highlights ?? []).join("\n"),
          nameEn: en?.name ?? "",
          slugEn: en?.slug ?? "",
          summaryEn: en?.summary ?? "",
          bodyEn: en?.body ?? "",
          highlightsEn: (en?.highlights ?? []).join("\n"),
        }}
      />
    </div>
  );
}
