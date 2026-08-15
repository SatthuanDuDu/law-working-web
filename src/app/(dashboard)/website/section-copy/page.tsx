import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import {
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableEmptyRow,
} from "@/components/ui/table";
import { LocalePair } from "@/components/website-cms/locale-pair";
import { cmsDb } from "@/lib/cms-db";
import { revalidatePublicSite } from "@/lib/cms-revalidate";
import { requireRole } from "@/lib/session";
import { WEBSITE_CMS_FORM_ID } from "@/lib/website-cms";

const SECTION_GROUP_LABELS: Record<string, string> = {
  home: "Trang chủ",
  about: "Giới thiệu",
  practiceAreas: "Lĩnh vực",
  team: "Đội ngũ",
  insights: "Tin tức",
  contact: "Liên hệ",
  footer: "Chân trang",
  nav: "Menu",
};

function sectionGroupLabel(group: string) {
  return SECTION_GROUP_LABELS[group] ?? group;
}

async function saveSectionCopy(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);

  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/website/section-copy");

  const vi = {
    eyebrow: String(formData.get("eyebrowVi") ?? "").trim(),
    title: String(formData.get("titleVi") ?? "").trim(),
    description: String(formData.get("descriptionVi") ?? "").trim(),
    ctaLabel: String(formData.get("ctaLabelVi") ?? "").trim(),
  };
  const en = {
    eyebrow: String(formData.get("eyebrowEn") ?? "").trim(),
    title: String(formData.get("titleEn") ?? "").trim(),
    description: String(formData.get("descriptionEn") ?? "").trim(),
    ctaLabel: String(formData.get("ctaLabelEn") ?? "").trim(),
  };

  for (const [locale, text] of [
    ["vi", vi],
    ["en", en],
  ] as const) {
    await cmsDb.sectionCopyTranslation.upsert({
      where: { copyId_locale: { copyId: id, locale } },
      update: text,
      create: { copyId: id, locale, ...text },
    });
  }

  await revalidatePublicSite();
  redirect("/website/section-copy");
}

export default async function WebsiteSectionCopyPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { edit } = await searchParams;
  const items = await cmsDb.sectionCopy.findMany({
    orderBy: [{ group: "asc" }, { order: "asc" }],
    include: { translations: true },
  });

  const editing = edit ? (items.find((i) => i.id === edit || i.key === edit) ?? null) : null;
  const showForm = Boolean(editing);
  const vi = editing?.translations.find((t) => t.locale === "vi");
  const en = editing?.translations.find((t) => t.locale === "en");

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const list = groups.get(item.group) ?? [];
    list.push(item);
    groups.set(item.group, list);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Nội dung section</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Chỉnh sửa tiêu đề / mô tả các khối đã được seed. Không thêm hoặc xoá cấu
          trúc từ đây.
        </p>
      </div>

      {showForm && editing ? (
        <form
          id={WEBSITE_CMS_FORM_ID}
          action={saveSectionCopy}
          className="space-y-4 rounded-md border border-border bg-surface p-4"
        >
          <input type="hidden" name="id" value={editing.id} />
          <p className="text-sm font-semibold text-foreground">{editing.label}</p>
          <LocalePair>
            <Field label="Dòng nhỏ (VI)" htmlFor="eyebrowVi">
              <Input id="eyebrowVi" name="eyebrowVi" defaultValue={vi?.eyebrow ?? ""} />
            </Field>
            <Field label="Eyebrow (EN)" htmlFor="eyebrowEn">
              <Input id="eyebrowEn" name="eyebrowEn" defaultValue={en?.eyebrow ?? ""} />
            </Field>
            <Field label="Tiêu đề (VI)" htmlFor="titleVi">
              <Input id="titleVi" name="titleVi" defaultValue={vi?.title ?? ""} />
            </Field>
            <Field label="Title (EN)" htmlFor="titleEn">
              <Input id="titleEn" name="titleEn" defaultValue={en?.title ?? ""} />
            </Field>
            <Field label="Mô tả (VI)" htmlFor="descriptionVi">
              <Textarea id="descriptionVi" name="descriptionVi" defaultValue={vi?.description ?? ""} />
            </Field>
            <Field label="Description (EN)" htmlFor="descriptionEn">
              <Textarea id="descriptionEn" name="descriptionEn" defaultValue={en?.description ?? ""} />
            </Field>
            <Field label="Nhãn CTA (VI)" htmlFor="ctaLabelVi">
              <Input id="ctaLabelVi" name="ctaLabelVi" defaultValue={vi?.ctaLabel ?? ""} />
            </Field>
            <Field label="CTA label (EN)" htmlFor="ctaLabelEn">
              <Input id="ctaLabelEn" name="ctaLabelEn" defaultValue={en?.ctaLabel ?? ""} />
            </Field>
          </LocalePair>
          <div className="flex gap-3">
            <Button type="submit">Lưu</Button>
            <Button asChild variant="outline">
              <Link href="/website/section-copy">Huỷ</Link>
            </Button>
          </div>
        </form>
      ) : null}

      <div className="space-y-6">
        {[...groups.entries()].map(([group, groupItems]) => (
          <div key={group} className="overflow-hidden rounded-md border border-border bg-surface">
            <div className="border-b border-border bg-muted/50 px-4 py-3">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground">
                {sectionGroupLabel(group)}
              </p>
            </div>
            <Table>
              <THead className="border-b border-border">
                <TR>
                  <TH className="px-4 py-3">Mục</TH>
                  <TH className="px-4 py-3">Tiêu đề (VI)</TH>
                  <TH className="px-4 py-3" />
                </TR>
              </THead>
              <TBody>
                {groupItems.length === 0 ? (
                  <TableEmptyRow colSpan={3}>Chưa có nội dung.</TableEmptyRow>
                ) : (
                  groupItems.map((item) => {
                    const title =
                      item.translations.find((t) => t.locale === "vi")?.title || "—";
                    return (
                      <TR key={item.id}>
                        <TD className="px-4 py-3 font-medium">{item.label}</TD>
                        <TD className="px-4 py-3">{title}</TD>
                        <TD className="px-4 py-3 text-right">
                          <Link
                            href={`/website/section-copy?edit=${item.id}`}
                            className="font-semibold text-primary hover:underline"
                          >
                            Sửa
                          </Link>
                        </TD>
                      </TR>
                    );
                  })
                )}
              </TBody>
            </Table>
          </div>
        ))}
      </div>
    </div>
  );
}
