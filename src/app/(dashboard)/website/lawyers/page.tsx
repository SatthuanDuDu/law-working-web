import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { LocalePair } from "@/components/website-cms/locale-pair";
import { MediaUploadField } from "@/components/website-cms/media-upload-field";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { slugify } from "@/lib/utils";
import { cmsDb } from "@/lib/cms-db";
import { revalidatePublicSite } from "@/lib/cms-revalidate";
import { requireRole } from "@/lib/session";
import { WEBSITE_CMS_FORM_ID } from "@/lib/website-cms";

async function saveLawyer(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);

  const id = String(formData.get("id") ?? "") || null;
  const name = String(formData.get("name") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim() || slugify(name);
  const email = String(formData.get("email") ?? "") || null;
  const phone = String(formData.get("phone") ?? "") || null;
  const photoKey = String(formData.get("photoKey") ?? "") || null;
  const order = Number(formData.get("order") ?? 0) || 0;
  const featured = formData.get("featured") === "on";
  const status = formData.get("status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const areaIds = formData.getAll("areaIds").map(String);

  const vi = {
    slug: String(formData.get("slugVi") ?? "").trim() || slugify(name),
    title: String(formData.get("titleVi") ?? "").trim(),
    shortBio: String(formData.get("shortBioVi") ?? "").trim(),
    bio: String(formData.get("bioVi") ?? "").trim(),
    education: String(formData.get("educationVi") ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
    languages: String(formData.get("languagesVi") ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  };
  const en = {
    slug: String(formData.get("slugEn") ?? "").trim() || slugify(name),
    title: String(formData.get("titleEn") ?? "").trim(),
    shortBio: String(formData.get("shortBioEn") ?? "").trim(),
    bio: String(formData.get("bioEn") ?? "").trim(),
    education: String(formData.get("educationEn") ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
    languages: String(formData.get("languagesEn") ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  };

  const lawyer = id
    ? await cmsDb.lawyer.update({
        where: { id },
        data: { key, name, email, phone, photoKey, order, featured, status },
      })
    : await cmsDb.lawyer.create({
        data: { key, name, email, phone, photoKey, order, featured, status },
      });

  for (const [locale, text] of [
    ["vi", vi],
    ["en", en],
  ] as const) {
    await cmsDb.lawyerTranslation.upsert({
      where: { lawyerId_locale: { lawyerId: lawyer.id, locale } },
      update: text,
      create: { lawyerId: lawyer.id, locale, ...text },
    });
  }

  await cmsDb.lawyerPracticeArea.deleteMany({ where: { lawyerId: lawyer.id } });
  if (areaIds.length > 0) {
    await cmsDb.lawyerPracticeArea.createMany({
      data: areaIds.map((practiceAreaId) => ({
        lawyerId: lawyer.id,
        practiceAreaId,
      })),
    });
  }

  await revalidatePublicSite();
  redirect("/website/lawyers");
}

async function deleteLawyer(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await cmsDb.lawyer.delete({ where: { id } });
  await revalidatePublicSite();
  redirect("/website/lawyers");
}

export default async function WebsiteLawyersPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { edit, new: isNew } = await searchParams;
  const [lawyers, areas] = await Promise.all([
    cmsDb.lawyer.findMany({
      orderBy: { order: "asc" },
      include: {
        translations: true,
        practiceAreas: true,
      },
    }),
    cmsDb.practiceArea.findMany({
      include: { translations: { where: { locale: "vi" } } },
      orderBy: { order: "asc" },
    }),
  ]);

  const editing =
    isNew === "1" ? null : edit ? (lawyers.find((l) => l.id === edit) ?? null) : null;
  const showForm = isNew === "1" || Boolean(editing);
  const vi = editing?.translations.find((t) => t.locale === "vi");
  const en = editing?.translations.find((t) => t.locale === "en");
  const selectedAreas = new Set(
    editing?.practiceAreas.map((p) => p.practiceAreaId) ?? [],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Đội ngũ luật sư</h1>
          <p className="mt-2 text-sm text-muted-foreground">Hồ sơ công khai trên website.</p>
        </div>
        <Button asChild>
          <Link href="/website/lawyers?new=1">Thêm luật sư</Link>
        </Button>
      </div>

      {showForm ? (
        <form
          id={WEBSITE_CMS_FORM_ID}
          action={saveLawyer}
          className="space-y-4 rounded-md border border-border bg-surface p-6"
        >
          {editing ? (
            <>
              <input type="hidden" name="id" value={editing.id} />
              <input type="hidden" name="key" value={editing.key} />
              <input type="hidden" name="slugVi" value={vi?.slug ?? ""} />
              <input type="hidden" name="slugEn" value={en?.slug ?? ""} />
            </>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ tên" htmlFor="name" required>
              <Input id="name" name="name" defaultValue={editing?.name} required />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} />
            </Field>
            <Field label="Điện thoại" htmlFor="phone">
              <Input id="phone" name="phone" defaultValue={editing?.phone ?? ""} />
            </Field>
            <Field label="Thứ tự" htmlFor="order">
              <Input id="order" name="order" type="number" defaultValue={editing?.order ?? 0} />
            </Field>
            <Field label="Trạng thái" htmlFor="status">
              <Select id="status" name="status" defaultValue={editing?.status ?? "PUBLISHED"}>
                <option value="PUBLISHED">Công khai</option>
                <option value="DRAFT">Nháp</option>
              </Select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={editing?.featured ?? true}
              className="size-4 accent-primary"
            />
            Hiển thị trên trang chủ
          </label>
          <MediaUploadField name="photoKey" label="Ảnh chân dung" defaultValue={editing?.photoKey} />

          <LocalePair>
            <Field label="Chức danh (VI)" htmlFor="titleVi" required>
              <Input id="titleVi" name="titleVi" defaultValue={vi?.title} required />
            </Field>
            <Field label="Title (EN)" htmlFor="titleEn" required>
              <Input id="titleEn" name="titleEn" defaultValue={en?.title} required />
            </Field>
            <Field label="Tóm tắt (VI)" htmlFor="shortBioVi" required>
              <Textarea id="shortBioVi" name="shortBioVi" defaultValue={vi?.shortBio} required />
            </Field>
            <Field label="Short bio (EN)" htmlFor="shortBioEn" required>
              <Textarea id="shortBioEn" name="shortBioEn" defaultValue={en?.shortBio} required />
            </Field>
            <Field label="Tiểu sử (VI)" htmlFor="bioVi" required>
              <Textarea id="bioVi" name="bioVi" className="min-h-36" defaultValue={vi?.bio} required />
            </Field>
            <Field label="Bio (EN)" htmlFor="bioEn" required>
              <Textarea id="bioEn" name="bioEn" className="min-h-36" defaultValue={en?.bio} required />
            </Field>
            <Field label="Học vấn (VI)" htmlFor="educationVi">
              <Textarea id="educationVi" name="educationVi" defaultValue={(vi?.education ?? []).join("\n")} />
            </Field>
            <Field label="Education (EN)" htmlFor="educationEn">
              <Textarea id="educationEn" name="educationEn" defaultValue={(en?.education ?? []).join("\n")} />
            </Field>
            <Field label="Ngôn ngữ (VI)" htmlFor="languagesVi">
              <Textarea id="languagesVi" name="languagesVi" defaultValue={(vi?.languages ?? []).join("\n")} />
            </Field>
            <Field label="Languages (EN)" htmlFor="languagesEn">
              <Textarea id="languagesEn" name="languagesEn" defaultValue={(en?.languages ?? []).join("\n")} />
            </Field>
          </LocalePair>

          <fieldset>
            <legend className="text-sm font-semibold">Lĩnh vực phụ trách</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {areas.map((area) => (
                <label key={area.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="areaIds"
                    value={area.id}
                    defaultChecked={selectedAreas.has(area.id)}
                    className="size-4 accent-primary"
                  />
                  {area.translations[0]?.name ?? "—"}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex gap-3">
            <Button type="submit">Lưu</Button>
            <Button asChild variant="outline">
              <Link href="/website/lawyers">Huỷ</Link>
            </Button>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Họ tên</th>
              <th className="px-4 py-3">Chức danh</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {lawyers.map((lawyer) => {
              const title = lawyer.translations.find((t) => t.locale === "vi")?.title ?? "—";
              return (
                <tr key={lawyer.id}>
                  <td className="px-4 py-3 font-medium">{lawyer.name}</td>
                  <td className="px-4 py-3">{title}</td>
                  <td className="px-4 py-3">
                    {lawyer.status === "PUBLISHED" ? "Công khai" : "Nháp"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <Link
                        href={`/website/lawyers?edit=${lawyer.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        Sửa
                      </Link>
                      <form action={deleteLawyer} className="inline">
                        <input type="hidden" name="id" value={lawyer.id} />
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
