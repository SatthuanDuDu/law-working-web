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

async function saveProcessStep(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);

  const id = String(formData.get("id") ?? "") || null;
  const titleVi = String(formData.get("titleVi") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim() || slugify(titleVi);
  const order = Number(formData.get("order") ?? 0) || 0;

  const vi = {
    title: titleVi,
    description: String(formData.get("descriptionVi") ?? "").trim(),
  };
  const en = {
    title: String(formData.get("titleEn") ?? "").trim(),
    description: String(formData.get("descriptionEn") ?? "").trim(),
  };

  const step = id
    ? await cmsDb.processStep.update({ where: { id }, data: { key, order } })
    : await cmsDb.processStep.create({ data: { key, order } });

  for (const [locale, text] of [
    ["vi", vi],
    ["en", en],
  ] as const) {
    await cmsDb.processStepTranslation.upsert({
      where: { stepId_locale: { stepId: step.id, locale } },
      update: text,
      create: { stepId: step.id, locale, ...text },
    });
  }

  await revalidatePublicSite();
  redirect("/website/process-steps");
}

async function deleteProcessStep(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await cmsDb.processStep.delete({ where: { id } });
  await revalidatePublicSite();
  redirect("/website/process-steps");
}

async function moveProcessStep(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);

  const id = String(formData.get("id") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) return;

  const steps = await cmsDb.processStep.findMany({ orderBy: { order: "asc" } });
  const index = steps.findIndex((s) => s.id === id);
  if (index < 0) return;

  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= steps.length) return;

  const current = steps[index];
  const neighbor = steps[swapIndex];
  await cmsDb.$transaction([
    cmsDb.processStep.update({ where: { id: current.id }, data: { order: neighbor.order } }),
    cmsDb.processStep.update({ where: { id: neighbor.id }, data: { order: current.order } }),
  ]);

  await revalidatePublicSite();
  redirect("/website/process-steps");
}

export default async function WebsiteProcessStepsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { edit, new: isNew } = await searchParams;
  const steps = await cmsDb.processStep.findMany({
    orderBy: { order: "asc" },
    include: { translations: true },
  });

  const editing =
    isNew === "1" ? null : edit ? (steps.find((s) => s.id === edit) ?? null) : null;
  const showForm = isNew === "1" || Boolean(editing);
  const vi = editing?.translations.find((t) => t.locale === "vi");
  const en = editing?.translations.find((t) => t.locale === "en");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Quy trình làm việc</h1>
          <p className="mt-2 text-sm text-muted-foreground">Các bước hiển thị trên trang chủ.</p>
        </div>
        <Button asChild>
          <Link href="/website/process-steps?new=1">Thêm bước</Link>
        </Button>
      </div>

      {showForm ? (
        <form
          id={WEBSITE_CMS_FORM_ID}
          action={saveProcessStep}
          className="space-y-4 rounded-md border border-border bg-surface p-6"
        >
          {editing ? (
            <>
              <input type="hidden" name="id" value={editing.id} />
              <input type="hidden" name="key" value={editing.key} />
            </>
          ) : null}
          <Field label="Thứ tự" htmlFor="order">
            <Input id="order" name="order" type="number" defaultValue={editing?.order ?? steps.length} />
          </Field>
          <LocalePair>
            <Field label="Tiêu đề (VI)" htmlFor="titleVi" required>
              <Input id="titleVi" name="titleVi" defaultValue={vi?.title} required />
            </Field>
            <Field label="Title (EN)" htmlFor="titleEn" required>
              <Input id="titleEn" name="titleEn" defaultValue={en?.title} required />
            </Field>
            <Field label="Mô tả (VI)" htmlFor="descriptionVi" required>
              <Textarea id="descriptionVi" name="descriptionVi" defaultValue={vi?.description} required />
            </Field>
            <Field label="Description (EN)" htmlFor="descriptionEn" required>
              <Textarea id="descriptionEn" name="descriptionEn" defaultValue={en?.description} required />
            </Field>
          </LocalePair>
          <div className="flex flex-wrap gap-3">
            <Button type="submit">Lưu</Button>
            <Button asChild variant="outline">
              <Link href="/website/process-steps">Huỷ</Link>
            </Button>
            {editing ? (
              <button
                type="submit"
                formAction={deleteProcessStep}
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
              <TH className="px-4 py-3">Tiêu đề (VI)</TH>
              <TH className="px-4 py-3" />
            </TR>
          </THead>
          <TBody>
            {steps.length === 0 ? (
              <TableEmptyRow colSpan={3}>Chưa có bước nào.</TableEmptyRow>
            ) : (
              steps.map((step, index) => {
              const title = step.translations.find((t) => t.locale === "vi")?.title ?? "—";
              return (
                <TR key={step.id}>
                  <TD className="px-4 py-3">{step.order}</TD>
                  <TD className="px-4 py-3 font-medium">{title}</TD>
                  <TD className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <form action={moveProcessStep}>
                        <input type="hidden" name="id" value={step.id} />
                        <input type="hidden" name="direction" value="up" />
                        <button
                          type="submit"
                          disabled={index === 0}
                          className="text-xs font-semibold text-primary hover:underline disabled:opacity-40"
                        >
                          ↑
                        </button>
                      </form>
                      <form action={moveProcessStep}>
                        <input type="hidden" name="id" value={step.id} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          type="submit"
                          disabled={index === steps.length - 1}
                          className="text-xs font-semibold text-primary hover:underline disabled:opacity-40"
                        >
                          ↓
                        </button>
                      </form>
                      <Link
                        href={`/website/process-steps?edit=${step.id}`}
                        className="font-semibold text-primary hover:underline"
                      >
                        Sửa
                      </Link>
                      <form action={deleteProcessStep}>
                        <input type="hidden" name="id" value={step.id} />
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
