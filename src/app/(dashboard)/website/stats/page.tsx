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

async function saveStat(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);

  const id = String(formData.get("id") ?? "") || null;
  const labelVi = String(formData.get("labelVi") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim() || slugify(labelVi);
  const value = String(formData.get("value") ?? "").trim();
  const order = Number(formData.get("order") ?? 0) || 0;

  const vi = { label: labelVi };
  const en = { label: String(formData.get("labelEn") ?? "").trim() };

  const stat = id
    ? await cmsDb.statItem.update({ where: { id }, data: { key, value, order } })
    : await cmsDb.statItem.create({ data: { key, value, order } });

  for (const [locale, text] of [
    ["vi", vi],
    ["en", en],
  ] as const) {
    await cmsDb.statItemTranslation.upsert({
      where: { statId_locale: { statId: stat.id, locale } },
      update: text,
      create: { statId: stat.id, locale, ...text },
    });
  }

  await revalidatePublicSite();
  redirect("/website/stats");
}

async function deleteStat(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await cmsDb.statItem.delete({ where: { id } });
  await revalidatePublicSite();
  redirect("/website/stats");
}

export default async function WebsiteStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { edit, new: isNew } = await searchParams;
  const stats = await cmsDb.statItem.findMany({
    orderBy: { order: "asc" },
    include: { translations: true },
  });

  const editing =
    isNew === "1" ? null : edit ? (stats.find((s) => s.id === edit) ?? null) : null;
  const showForm = isNew === "1" || Boolean(editing);
  const vi = editing?.translations.find((t) => t.locale === "vi");
  const en = editing?.translations.find((t) => t.locale === "en");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Thống kê</h1>
          <p className="mt-2 text-sm text-muted-foreground">Số liệu nổi bật trên trang chủ.</p>
        </div>
        <Button asChild>
          <Link href="/website/stats?new=1">Thêm thống kê</Link>
        </Button>
      </div>

      {showForm ? (
        <form
          id={WEBSITE_CMS_FORM_ID}
          action={saveStat}
          className="space-y-4 rounded-md border border-border bg-surface p-4"
        >
          {editing ? (
            <>
              <input type="hidden" name="id" value={editing.id} />
              <input type="hidden" name="key" value={editing.key} />
            </>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Giá trị" htmlFor="value" required>
              <Input id="value" name="value" defaultValue={editing?.value} required />
            </Field>
            <Field label="Thứ tự" htmlFor="order">
              <Input id="order" name="order" type="number" defaultValue={editing?.order ?? stats.length} />
            </Field>
          </div>
          <LocalePair>
            <Field label="Nhãn (VI)" htmlFor="labelVi" required>
              <Input id="labelVi" name="labelVi" defaultValue={vi?.label} required />
            </Field>
            <Field label="Label (EN)" htmlFor="labelEn" required>
              <Input id="labelEn" name="labelEn" defaultValue={en?.label} required />
            </Field>
          </LocalePair>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Lưu</Button>
            <Button asChild variant="outline">
              <Link href="/website/stats">Huỷ</Link>
            </Button>
            {editing ? (
              <button
                type="submit"
                formAction={deleteStat}
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
              <TH className="px-4 py-3">Giá trị</TH>
              <TH className="px-4 py-3">Nhãn (VI)</TH>
              <TH className="px-4 py-3" />
            </TR>
          </THead>
          <TBody>
            {stats.length === 0 ? (
              <TableEmptyRow colSpan={4}>Chưa có số liệu nào.</TableEmptyRow>
            ) : (
              stats.map((stat) => {
              const label = stat.translations.find((t) => t.locale === "vi")?.label ?? "—";
              return (
                <TR key={stat.id}>
                  <TD className="px-4 py-3">{stat.order}</TD>
                  <TD className="px-4 py-3 font-medium">{stat.value}</TD>
                  <TD className="px-4 py-3">{label}</TD>
                  <TD className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <Link
                        href={`/website/stats?edit=${stat.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        Sửa
                      </Link>
                      <form action={deleteStat} className="inline">
                        <input type="hidden" name="id" value={stat.id} />
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
