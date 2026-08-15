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
import { LocalePair } from "@/components/website-cms/locale-pair";
import { MediaUploadField } from "@/components/website-cms/media-upload-field";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { slugify } from "@/lib/utils";
import { cmsDb } from "@/lib/cms-db";
import { revalidatePublicSite } from "@/lib/cms-revalidate";
import { requireRole } from "@/lib/session";
import { WEBSITE_CMS_FORM_ID } from "@/lib/website-cms";

async function saveTestimonial(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);

  const id = String(formData.get("id") ?? "") || null;
  const authorName = String(formData.get("authorName") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim() || slugify(authorName);
  const avatarKey = String(formData.get("avatarKey") ?? "") || null;
  const rating = Number(formData.get("rating") ?? 5) || 5;
  const order = Number(formData.get("order") ?? 0) || 0;
  const status = formData.get("status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";

  const vi = {
    authorRole: String(formData.get("authorRoleVi") ?? "").trim(),
    quote: String(formData.get("quoteVi") ?? "").trim(),
  };
  const en = {
    authorRole: String(formData.get("authorRoleEn") ?? "").trim(),
    quote: String(formData.get("quoteEn") ?? "").trim(),
  };

  const testimonial = id
    ? await cmsDb.testimonial.update({
        where: { id },
        data: { key, authorName, avatarKey, rating, order, status },
      })
    : await cmsDb.testimonial.create({
        data: { key, authorName, avatarKey, rating, order, status },
      });

  for (const [locale, text] of [
    ["vi", vi],
    ["en", en],
  ] as const) {
    await cmsDb.testimonialTranslation.upsert({
      where: { testimonialId_locale: { testimonialId: testimonial.id, locale } },
      update: text,
      create: { testimonialId: testimonial.id, locale, ...text },
    });
  }

  await revalidatePublicSite();
  redirect("/website/testimonials");
}

async function deleteTestimonial(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await cmsDb.testimonial.delete({ where: { id } });
  await revalidatePublicSite();
  redirect("/website/testimonials");
}

export default async function WebsiteTestimonialsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { edit, new: isNew } = await searchParams;
  const testimonials = await cmsDb.testimonial.findMany({
    orderBy: { order: "asc" },
    include: { translations: true },
  });

  const editing =
    isNew === "1" ? null : edit ? (testimonials.find((t) => t.id === edit) ?? null) : null;
  const showForm = isNew === "1" || Boolean(editing);
  const vi = editing?.translations.find((t) => t.locale === "vi");
  const en = editing?.translations.find((t) => t.locale === "en");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Cảm nhận khách hàng</h1>
          <p className="mt-2 text-sm text-muted-foreground">Cảm nhận khách hàng hiển thị trên trang chủ.</p>
        </div>
        <Button asChild>
          <Link href="/website/testimonials?new=1">Thêm cảm nhận</Link>
        </Button>
      </div>

      {showForm ? (
        <form
          id={WEBSITE_CMS_FORM_ID}
          action={saveTestimonial}
          className="space-y-4 rounded-md border border-border bg-surface p-4"
        >
          {editing ? (
            <>
              <input type="hidden" name="id" value={editing.id} />
              <input type="hidden" name="key" value={editing.key} />
            </>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Họ tên" htmlFor="authorName" required>
              <Input id="authorName" name="authorName" defaultValue={editing?.authorName} required />
            </Field>
            <Field label="Đánh giá (1–5)" htmlFor="rating">
              <Input id="rating" name="rating" type="number" min={1} max={5} defaultValue={editing?.rating ?? 5} />
            </Field>
            <Field label="Thứ tự" htmlFor="order">
              <Input
                id="order"
                name="order"
                type="number"
                defaultValue={editing?.order ?? testimonials.length}
              />
            </Field>
            <Field label="Trạng thái" htmlFor="status">
              <Select id="status" name="status" defaultValue={editing?.status ?? "PUBLISHED"}>
                <option value="PUBLISHED">Công khai</option>
                <option value="DRAFT">Nháp</option>
              </Select>
            </Field>
          </div>
          <MediaUploadField name="avatarKey" label="Ảnh đại diện" defaultValue={editing?.avatarKey} />
          <LocalePair>
            <Field label="Vai trò (VI)" htmlFor="authorRoleVi" required>
              <Input id="authorRoleVi" name="authorRoleVi" defaultValue={vi?.authorRole} required />
            </Field>
            <Field label="Role (EN)" htmlFor="authorRoleEn" required>
              <Input id="authorRoleEn" name="authorRoleEn" defaultValue={en?.authorRole} required />
            </Field>
            <Field label="Nội dung (VI)" htmlFor="quoteVi" required>
              <Textarea id="quoteVi" name="quoteVi" className="min-h-28" defaultValue={vi?.quote} required />
            </Field>
            <Field label="Quote (EN)" htmlFor="quoteEn" required>
              <Textarea id="quoteEn" name="quoteEn" className="min-h-28" defaultValue={en?.quote} required />
            </Field>
          </LocalePair>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Lưu</Button>
            <Button asChild variant="outline">
              <Link href="/website/testimonials">Huỷ</Link>
            </Button>
            {editing ? (
              <button
                type="submit"
                formAction={deleteTestimonial}
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
              <TH className="px-4 py-3">Tên</TH>
              <TH className="px-4 py-3">Vai trò (VI)</TH>
              <TH className="px-4 py-3">Đánh giá</TH>
              <TH className="px-4 py-3">Trạng thái</TH>
              <TH className="px-4 py-3" />
            </TR>
          </THead>
          <TBody>
            {testimonials.length === 0 ? (
              <TableEmptyRow colSpan={5}>Chưa có đánh giá nào.</TableEmptyRow>
            ) : (
              testimonials.map((item) => {
              const role = item.translations.find((t) => t.locale === "vi")?.authorRole ?? "—";
              return (
                <TR key={item.id}>
                  <TD className="px-4 py-3 font-medium">{item.authorName}</TD>
                  <TD className="px-4 py-3">{role}</TD>
                  <TD className="px-4 py-3">{item.rating}</TD>
                  <TD className="px-4 py-3">
                    {item.status === "PUBLISHED" ? "Công khai" : "Nháp"}
                  </TD>
                  <TD className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <Link
                        href={`/website/testimonials?edit=${item.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        Sửa
                      </Link>
                      <form action={deleteTestimonial} className="inline">
                        <input type="hidden" name="id" value={item.id} />
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
