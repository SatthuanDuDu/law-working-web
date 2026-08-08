import { redirect } from "next/navigation";

import { PracticeAreaForm } from "@/components/website-cms/practice-area-form";
import { slugify } from "@/lib/utils";
import { cmsDb } from "@/lib/cms-db";
import { revalidatePublicSite } from "@/lib/cms-revalidate";
import { requireRole } from "@/lib/session";

async function savePracticeArea(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);

  const key =
    String(formData.get("key") ?? "").trim() ||
    slugify(String(formData.get("nameVi") ?? ""));
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

  if (!vi.name || !en.name) {
    throw new Error("Tên tiếng Việt và tiếng Anh là bắt buộc");
  }

  const area = await cmsDb.practiceArea.create({
    data: { key, icon, order, featured, status, coverKey },
  });

  for (const [locale, text] of [
    ["vi", vi],
    ["en", en],
  ] as const) {
    await cmsDb.practiceAreaTranslation.upsert({
      where: {
        practiceAreaId_locale: { practiceAreaId: area.id, locale },
      },
      update: text,
      create: { practiceAreaId: area.id, locale, ...text },
    });
  }

  await revalidatePublicSite();
  redirect("/website/practice-areas");
}

export default async function NewPracticeAreaPage() {
  await requireRole(["ADMIN", "MANAGER"]);
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <h1 className="text-2xl font-semibold text-foreground">Thêm lĩnh vực</h1>
      <PracticeAreaForm action={savePracticeArea} />
    </div>
  );
}
