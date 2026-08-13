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
import { Field, Input, Textarea } from "@/components/ui/field";
import { LocalePair } from "@/components/website-cms/locale-pair";
import { slugify } from "@/lib/utils";
import { cmsDb } from "@/lib/cms-db";
import { revalidatePublicSite } from "@/lib/cms-revalidate";
import { requireRole } from "@/lib/session";
import { WEBSITE_CMS_FORM_ID } from "@/lib/website-cms";

async function saveOffice(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);

  const id = String(formData.get("id") ?? "") || null;
  const nameVi = String(formData.get("nameVi") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim() || slugify(nameVi);
  const phone = String(formData.get("phone") ?? "") || null;
  const email = String(formData.get("email") ?? "") || null;
  const mapUrl = String(formData.get("mapUrl") ?? "") || null;
  const isPrimary = formData.get("isPrimary") === "on";
  const order = Number(formData.get("order") ?? 0) || 0;

  const vi = {
    name: nameVi,
    addressLine: String(formData.get("addressLineVi") ?? "").trim(),
    workingHours: String(formData.get("workingHoursVi") ?? "").trim(),
  };
  const en = {
    name: String(formData.get("nameEn") ?? "").trim(),
    addressLine: String(formData.get("addressLineEn") ?? "").trim(),
    workingHours: String(formData.get("workingHoursEn") ?? "").trim(),
  };

  if (isPrimary) {
    await cmsDb.office.updateMany({ data: { isPrimary: false } });
  }

  const office = id
    ? await cmsDb.office.update({ where: { id }, data: { key, phone, email, mapUrl, isPrimary, order } })
    : await cmsDb.office.create({ data: { key, phone, email, mapUrl, isPrimary, order } });

  for (const [locale, text] of [
    ["vi", vi],
    ["en", en],
  ] as const) {
    await cmsDb.officeTranslation.upsert({
      where: { officeId_locale: { officeId: office.id, locale } },
      update: text,
      create: { officeId: office.id, locale, ...text },
    });
  }

  await revalidatePublicSite();
  redirect("/website/offices");
}

async function deleteOffice(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await cmsDb.office.delete({ where: { id } });
  await revalidatePublicSite();
  redirect("/website/offices");
}

export default async function WebsiteOfficesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { edit, new: isNew } = await searchParams;
  const offices = await cmsDb.office.findMany({
    orderBy: { order: "asc" },
    include: { translations: true },
  });

  const editing =
    isNew === "1" ? null : edit ? (offices.find((o) => o.id === edit) ?? null) : null;
  const showForm = isNew === "1" || Boolean(editing);
  const vi = editing?.translations.find((t) => t.locale === "vi");
  const en = editing?.translations.find((t) => t.locale === "en");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Văn phòng</h1>
          <p className="mt-2 text-sm text-muted-foreground">Địa chỉ và thông tin liên hệ các văn phòng.</p>
        </div>
        <Button asChild>
          <Link href="/website/offices?new=1">Thêm văn phòng</Link>
        </Button>
      </div>

      {showForm ? (
        <form
          id={WEBSITE_CMS_FORM_ID}
          action={saveOffice}
          className="space-y-4 rounded-md border border-border bg-surface p-6"
        >
          {editing ? (
            <>
              <input type="hidden" name="id" value={editing.id} />
              <input type="hidden" name="key" value={editing.key} />
            </>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Thứ tự" htmlFor="order">
              <Input id="order" name="order" type="number" defaultValue={editing?.order ?? offices.length} />
            </Field>
            <Field label="Điện thoại" htmlFor="phone">
              <Input id="phone" name="phone" defaultValue={editing?.phone ?? ""} />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} />
            </Field>
            <Field label="Map URL" htmlFor="mapUrl">
              <Input id="mapUrl" name="mapUrl" defaultValue={editing?.mapUrl ?? ""} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="isPrimary"
              defaultChecked={editing?.isPrimary ?? false}
              className="size-4 accent-primary"
            />
            Văn phòng chính
          </label>
          <LocalePair>
            <Field label="Tên (VI)" htmlFor="nameVi" required>
              <Input id="nameVi" name="nameVi" defaultValue={vi?.name} required />
            </Field>
            <Field label="Name (EN)" htmlFor="nameEn" required>
              <Input id="nameEn" name="nameEn" defaultValue={en?.name} required />
            </Field>
            <Field label="Địa chỉ (VI)" htmlFor="addressLineVi" required>
              <Textarea id="addressLineVi" name="addressLineVi" defaultValue={vi?.addressLine} required />
            </Field>
            <Field label="Address (EN)" htmlFor="addressLineEn" required>
              <Textarea id="addressLineEn" name="addressLineEn" defaultValue={en?.addressLine} required />
            </Field>
            <Field label="Giờ làm việc (VI)" htmlFor="workingHoursVi" required>
              <Input id="workingHoursVi" name="workingHoursVi" defaultValue={vi?.workingHours} required />
            </Field>
            <Field label="Working hours (EN)" htmlFor="workingHoursEn" required>
              <Input id="workingHoursEn" name="workingHoursEn" defaultValue={en?.workingHours} required />
            </Field>
          </LocalePair>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Lưu</Button>
            <Button asChild variant="outline">
              <Link href="/website/offices">Huỷ</Link>
            </Button>
            {editing ? (
              <button
                type="submit"
                formAction={deleteOffice}
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
              <TH className="px-4 py-3">Tên (VI)</TH>
              <TH className="px-4 py-3">Điện thoại</TH>
              <TH className="px-4 py-3">Chính</TH>
              <TH className="px-4 py-3">Thứ tự</TH>
              <TH className="px-4 py-3" />
            </TR>
          </THead>
          <TBody>
            {offices.length === 0 ? (
              <TableEmptyRow colSpan={5}>Chưa có văn phòng nào.</TableEmptyRow>
            ) : (
              offices.map((office) => {
              const name = office.translations.find((t) => t.locale === "vi")?.name ?? "—";
              return (
                <TR key={office.id}>
                  <TD className="px-4 py-3 font-medium">{name}</TD>
                  <TD className="px-4 py-3">{office.phone ?? "—"}</TD>
                  <TD className="px-4 py-3">{office.isPrimary ? "Có" : "—"}</TD>
                  <TD className="px-4 py-3">{office.order}</TD>
                  <TD className="px-4 py-3 text-right">
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <Link
                        href={`/website/offices?edit=${office.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        Sửa
                      </Link>
                      <form action={deleteOffice} className="inline">
                        <input type="hidden" name="id" value={office.id} />
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
