import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { LocalePair } from "@/components/website-cms/locale-pair";
import { slugify } from "@/lib/utils";
import { cmsDb } from "@/lib/cms-db";
import { revalidatePublicSite } from "@/lib/cms-revalidate";
import { requireRole } from "@/lib/session";
import { WEBSITE_CMS_FORM_ID } from "@/lib/website-cms";

async function savePage(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);

  const id = String(formData.get("id") ?? "") || null;
  const titleVi = String(formData.get("titleVi") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim() || slugify(titleVi);
  const status = formData.get("status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";

  const vi = {
    title: titleVi,
    eyebrow: String(formData.get("eyebrowVi") ?? "").trim(),
    intro: String(formData.get("introVi") ?? "").trim(),
    body: String(formData.get("bodyVi") ?? "").trim(),
    seoTitle: String(formData.get("seoTitleVi") ?? "").trim() || null,
    seoDescription: String(formData.get("seoDescriptionVi") ?? "").trim() || null,
  };
  const en = {
    title: String(formData.get("titleEn") ?? "").trim(),
    eyebrow: String(formData.get("eyebrowEn") ?? "").trim(),
    intro: String(formData.get("introEn") ?? "").trim(),
    body: String(formData.get("bodyEn") ?? "").trim(),
    seoTitle: String(formData.get("seoTitleEn") ?? "").trim() || null,
    seoDescription: String(formData.get("seoDescriptionEn") ?? "").trim() || null,
  };

  const page = id
    ? await cmsDb.page.update({ where: { id }, data: { status } })
    : await cmsDb.page.create({ data: { key, status } });

  for (const [locale, text] of [
    ["vi", vi],
    ["en", en],
  ] as const) {
    await cmsDb.pageTranslation.upsert({
      where: { pageId_locale: { pageId: page.id, locale } },
      update: text,
      create: { pageId: page.id, locale, ...text },
    });
  }

  await revalidatePublicSite();
  redirect("/website/pages");
}

async function deletePage(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await cmsDb.page.delete({ where: { id } });
  await revalidatePublicSite();
  redirect("/website/pages");
}

export default async function WebsitePagesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { edit, new: isNew } = await searchParams;
  const pages = await cmsDb.page.findMany({
    orderBy: { key: "asc" },
    include: { translations: true },
  });

  const editing =
    isNew === "1"
      ? null
      : edit
        ? (pages.find((p) => p.id === edit || p.key === edit) ?? null)
        : null;
  const showForm = isNew === "1" || Boolean(editing);
  const vi = editing?.translations.find((t) => t.locale === "vi");
  const en = editing?.translations.find((t) => t.locale === "en");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Trang nội dung</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Trang độc lập (giới thiệu, điều khoản, bảo mật…).
          </p>
        </div>
        <Button asChild>
          <Link href="/website/pages?new=1">Thêm trang</Link>
        </Button>
      </div>

      {showForm ? (
        <form
          id={WEBSITE_CMS_FORM_ID}
          action={savePage}
          className="space-y-4 rounded-md border border-border bg-surface p-6"
        >
          {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
          <Field label="Trạng thái" htmlFor="status">
            <Select id="status" name="status" defaultValue={editing?.status ?? "PUBLISHED"}>
              <option value="PUBLISHED">Công khai</option>
              <option value="DRAFT">Nháp</option>
            </Select>
          </Field>
          <LocalePair>
            <Field label="Tiêu đề (VI)" htmlFor="titleVi" required>
              <Input id="titleVi" name="titleVi" defaultValue={vi?.title} required />
            </Field>
            <Field label="Title (EN)" htmlFor="titleEn" required>
              <Input id="titleEn" name="titleEn" defaultValue={en?.title} required />
            </Field>
            <Field label="Dòng nhỏ (VI)" htmlFor="eyebrowVi">
              <Input id="eyebrowVi" name="eyebrowVi" defaultValue={vi?.eyebrow ?? ""} />
            </Field>
            <Field label="Eyebrow (EN)" htmlFor="eyebrowEn">
              <Input id="eyebrowEn" name="eyebrowEn" defaultValue={en?.eyebrow ?? ""} />
            </Field>
            <Field label="Mở đầu (VI)" htmlFor="introVi" required>
              <Textarea id="introVi" name="introVi" defaultValue={vi?.intro} required />
            </Field>
            <Field label="Intro (EN)" htmlFor="introEn" required>
              <Textarea id="introEn" name="introEn" defaultValue={en?.intro} required />
            </Field>
            <Field label="Nội dung (VI)" htmlFor="bodyVi">
              <Textarea id="bodyVi" name="bodyVi" className="min-h-40" defaultValue={vi?.body ?? ""} />
            </Field>
            <Field label="Body (EN)" htmlFor="bodyEn">
              <Textarea id="bodyEn" name="bodyEn" className="min-h-40" defaultValue={en?.body ?? ""} />
            </Field>
            <Field label="SEO title (VI)" htmlFor="seoTitleVi">
              <Input id="seoTitleVi" name="seoTitleVi" defaultValue={vi?.seoTitle ?? ""} />
            </Field>
            <Field label="SEO title (EN)" htmlFor="seoTitleEn">
              <Input id="seoTitleEn" name="seoTitleEn" defaultValue={en?.seoTitle ?? ""} />
            </Field>
            <Field label="SEO description (VI)" htmlFor="seoDescriptionVi">
              <Textarea id="seoDescriptionVi" name="seoDescriptionVi" defaultValue={vi?.seoDescription ?? ""} />
            </Field>
            <Field label="SEO description (EN)" htmlFor="seoDescriptionEn">
              <Textarea id="seoDescriptionEn" name="seoDescriptionEn" defaultValue={en?.seoDescription ?? ""} />
            </Field>
          </LocalePair>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Lưu</Button>
            <Button asChild variant="outline">
              <Link href="/website/pages">Huỷ</Link>
            </Button>
            {editing ? (
              <button
                type="submit"
                formAction={deletePage}
                className="text-sm font-semibold text-red-700 hover:underline"
              >
                Xoá
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Tiêu đề (VI)</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pages.map((page) => {
              const title = page.translations.find((t) => t.locale === "vi")?.title ?? "—";
              return (
                <tr key={page.id}>
                  <td className="px-4 py-3 font-medium">{title}</td>
                  <td className="px-4 py-3">
                    {page.status === "PUBLISHED" ? "Công khai" : "Nháp"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <Link
                        href={`/website/pages?edit=${page.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        Sửa
                      </Link>
                      <form action={deletePage} className="inline">
                        <input type="hidden" name="id" value={page.id} />
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
