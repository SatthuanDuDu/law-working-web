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
import { Field, Input } from "@/components/ui/field";
import { LocalePair } from "@/components/website-cms/locale-pair";
import { slugify } from "@/lib/utils";
import { cmsDb } from "@/lib/cms-db";
import { revalidatePublicSite } from "@/lib/cms-revalidate";
import { requireRole } from "@/lib/session";
import { WEBSITE_CMS_FORM_ID } from "@/lib/website-cms";

async function saveCategory(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);

  const id = String(formData.get("id") ?? "") || null;
  const nameVi = String(formData.get("nameVi") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim() || slugify(nameVi);
  const order = Number(formData.get("order") ?? 0) || 0;

  const vi = {
    slug: String(formData.get("slugVi") ?? "").trim() || slugify(nameVi),
    name: nameVi,
  };
  const en = {
    slug:
      String(formData.get("slugEn") ?? "").trim() ||
      slugify(String(formData.get("nameEn") ?? "")),
    name: String(formData.get("nameEn") ?? "").trim(),
  };

  const category = id
    ? await cmsDb.postCategory.update({ where: { id }, data: { key, order } })
    : await cmsDb.postCategory.create({ data: { key, order } });

  for (const [locale, text] of [
    ["vi", vi],
    ["en", en],
  ] as const) {
    await cmsDb.postCategoryTranslation.upsert({
      where: { categoryId_locale: { categoryId: category.id, locale } },
      update: text,
      create: { categoryId: category.id, locale, ...text },
    });
  }

  await revalidatePublicSite();
  redirect("/website/categories");
}

async function deleteCategory(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await cmsDb.postCategory.delete({ where: { id } });
  await revalidatePublicSite();
  redirect("/website/categories");
}

export default async function WebsiteCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { edit, new: isNew } = await searchParams;
  const categories = await cmsDb.postCategory.findMany({
    orderBy: { order: "asc" },
    include: { translations: true },
  });

  const editing =
    isNew === "1" ? null : edit ? (categories.find((c) => c.id === edit) ?? null) : null;
  const showForm = isNew === "1" || Boolean(editing);
  const vi = editing?.translations.find((t) => t.locale === "vi");
  const en = editing?.translations.find((t) => t.locale === "en");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Danh mục tin</h1>
          <p className="mt-2 text-sm text-muted-foreground">Phân loại bài viết tin tức pháp lý.</p>
        </div>
        <Button asChild>
          <Link href="/website/categories?new=1">Thêm danh mục</Link>
        </Button>
      </div>

      {showForm ? (
        <form
          id={WEBSITE_CMS_FORM_ID}
          action={saveCategory}
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
          <Field label="Thứ tự" htmlFor="order">
            <Input
              id="order"
              name="order"
              type="number"
              defaultValue={editing?.order ?? categories.length}
            />
          </Field>
          <LocalePair>
            <Field label="Tên (VI)" htmlFor="nameVi" required>
              <Input id="nameVi" name="nameVi" defaultValue={vi?.name} required />
            </Field>
            <Field label="Name (EN)" htmlFor="nameEn" required>
              <Input id="nameEn" name="nameEn" defaultValue={en?.name} required />
            </Field>
          </LocalePair>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Lưu</Button>
            <Button asChild variant="outline">
              <Link href="/website/categories">Huỷ</Link>
            </Button>
            {editing ? (
              <button
                type="submit"
                formAction={deleteCategory}
                className="text-sm font-semibold text-red-700 hover:underline"
              >
                Xoá
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <Table>
          <THead className="border-b border-border bg-muted/50">
            <TR>
              <TH className="px-4 py-3">Thứ tự</TH>
              <TH className="px-4 py-3">Tên (VI)</TH>
              <TH className="px-4 py-3" />
            </TR>
          </THead>
          <TBody>
            {categories.length === 0 ? (
              <TableEmptyRow colSpan={3}>Chưa có chuyên mục nào.</TableEmptyRow>
            ) : (
              categories.map((category) => {
              const t = category.translations.find((tr) => tr.locale === "vi");
              return (
                <TR key={category.id}>
                  <TD className="px-4 py-3">{category.order}</TD>
                  <TD className="px-4 py-3 font-medium">{t?.name ?? "—"}</TD>
                  <TD className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <Link
                        href={`/website/categories?edit=${category.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        Sửa
                      </Link>
                      <form action={deleteCategory} className="inline">
                        <input type="hidden" name="id" value={category.id} />
                        <button type="submit" className="font-semibold text-red-700 hover:underline">
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
