import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { LocalePair } from "@/components/website-cms/locale-pair";
import { MediaUploadField } from "@/components/website-cms/media-upload-field";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import {
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  TableEmptyRow,
} from "@/components/ui/table";
import { slugify } from "@/lib/utils";
import { cmsDb } from "@/lib/cms-db";
import { revalidatePublicSite } from "@/lib/cms-revalidate";
import { requireRole } from "@/lib/session";
import { WEBSITE_CMS_FORM_ID } from "@/lib/website-cms";

async function savePost(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);

  const id = String(formData.get("id") ?? "") || null;
  const titleVi = String(formData.get("titleVi") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim() || slugify(titleVi);
  const coverKey = String(formData.get("coverKey") ?? "") || null;
  const categoryId = String(formData.get("categoryId") ?? "") || null;
  const authorId = String(formData.get("authorId") ?? "") || null;
  const featured = formData.get("featured") === "on";
  const status = formData.get("status") === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
  const publishedAtRaw = String(formData.get("publishedAt") ?? "");
  const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : new Date();

  const vi = {
    slug: String(formData.get("slugVi") ?? "").trim() || slugify(titleVi),
    title: titleVi,
    excerpt: String(formData.get("excerptVi") ?? "").trim(),
    body: String(formData.get("bodyVi") ?? "").trim(),
  };
  const en = {
    slug:
      String(formData.get("slugEn") ?? "").trim() ||
      slugify(String(formData.get("titleEn") ?? "")),
    title: String(formData.get("titleEn") ?? "").trim(),
    excerpt: String(formData.get("excerptEn") ?? "").trim(),
    body: String(formData.get("bodyEn") ?? "").trim(),
  };

  const post = id
    ? await cmsDb.post.update({
        where: { id },
        data: { key, coverKey, categoryId, authorId, featured, status, publishedAt },
      })
    : await cmsDb.post.create({
        data: { key, coverKey, categoryId, authorId, featured, status, publishedAt },
      });

  for (const [locale, text] of [
    ["vi", vi],
    ["en", en],
  ] as const) {
    await cmsDb.postTranslation.upsert({
      where: { postId_locale: { postId: post.id, locale } },
      update: text,
      create: { postId: post.id, locale, ...text },
    });
  }

  await revalidatePublicSite();
  redirect("/website/posts");
}

async function deletePost(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await cmsDb.post.delete({ where: { id } });
  await revalidatePublicSite();
  redirect("/website/posts");
}

export default async function WebsitePostsPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; new?: string }>;
}) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { edit, new: isNew } = await searchParams;
  const [posts, categories, lawyers] = await Promise.all([
    cmsDb.post.findMany({
      orderBy: { publishedAt: "desc" },
      include: {
        translations: true,
        category: { include: { translations: { where: { locale: "vi" } } } },
      },
    }),
    cmsDb.postCategory.findMany({
      include: { translations: { where: { locale: "vi" } } },
      orderBy: { order: "asc" },
    }),
    cmsDb.lawyer.findMany({ orderBy: { order: "asc" } }),
  ]);

  const editing =
    isNew === "1" ? null : edit ? (posts.find((p) => p.id === edit) ?? null) : null;
  const showForm = isNew === "1" || Boolean(editing);
  const vi = editing?.translations.find((t) => t.locale === "vi");
  const en = editing?.translations.find((t) => t.locale === "en");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tin tức pháp lý</h1>
          <p className="mt-2 text-sm text-muted-foreground">Bài viết song ngữ trên website.</p>
        </div>
        <Button asChild>
          <Link href="/website/posts?new=1">Viết bài mới</Link>
        </Button>
      </div>

      {showForm ? (
        <form
          id={WEBSITE_CMS_FORM_ID}
          action={savePost}
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
            <Field label="Ngày đăng" htmlFor="publishedAt">
              <Input
                id="publishedAt"
                name="publishedAt"
                type="date"
                defaultValue={(editing?.publishedAt ?? new Date()).toISOString().slice(0, 10)}
              />
            </Field>
            <Field label="Chuyên mục" htmlFor="categoryId">
              <Select id="categoryId" name="categoryId" defaultValue={editing?.categoryId ?? ""}>
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.translations[0]?.name ?? "—"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tác giả" htmlFor="authorId">
              <Select id="authorId" name="authorId" defaultValue={editing?.authorId ?? ""}>
                <option value="">—</option>
                {lawyers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
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
              defaultChecked={editing?.featured ?? false}
              className="size-4 accent-primary"
            />
            Nổi bật
          </label>
          <MediaUploadField name="coverKey" label="Ảnh cover" defaultValue={editing?.coverKey} />

          <LocalePair>
            <Field label="Tiêu đề (VI)" htmlFor="titleVi" required>
              <Input id="titleVi" name="titleVi" defaultValue={vi?.title} required />
            </Field>
            <Field label="Title (EN)" htmlFor="titleEn" required>
              <Input id="titleEn" name="titleEn" defaultValue={en?.title} required />
            </Field>
            <Field label="Tóm tắt (VI)" htmlFor="excerptVi" required>
              <Textarea id="excerptVi" name="excerptVi" defaultValue={vi?.excerpt} required />
            </Field>
            <Field label="Excerpt (EN)" htmlFor="excerptEn" required>
              <Textarea id="excerptEn" name="excerptEn" defaultValue={en?.excerpt} required />
            </Field>
            <Field label="Nội dung (VI)" htmlFor="bodyVi" required>
              <Textarea id="bodyVi" name="bodyVi" className="min-h-48" defaultValue={vi?.body} required />
            </Field>
            <Field label="Body (EN)" htmlFor="bodyEn" required>
              <Textarea id="bodyEn" name="bodyEn" className="min-h-48" defaultValue={en?.body} required />
            </Field>
          </LocalePair>

          <div className="flex flex-wrap gap-3">
            <Button type="submit">Lưu bài viết</Button>
            <Button asChild variant="outline">
              <Link href="/website/posts">Huỷ</Link>
            </Button>
            {editing ? (
              <button
                type="submit"
                formAction={deletePost}
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
              <TH className="px-4 py-3">Tiêu đề</TH>
              <TH className="px-4 py-3">Chuyên mục</TH>
              <TH className="px-4 py-3">Ngày</TH>
              <TH className="px-4 py-3" />
            </TR>
          </THead>
          <TBody>
            {posts.length === 0 ? (
              <TableEmptyRow colSpan={4}>Chưa có bài viết nào.</TableEmptyRow>
            ) : (
              posts.map((post) => {
                const title =
                  post.translations.find((t) => t.locale === "vi")?.title ?? "—";
                return (
                  <TR key={post.id}>
                    <TD className="px-4 py-3 font-medium">{title}</TD>
                    <TD className="px-4 py-3">
                      {post.category?.translations[0]?.name ?? "—"}
                    </TD>
                    <TD className="px-4 py-3">
                      {post.publishedAt.toLocaleDateString("vi-VN")}
                    </TD>
                    <TD className="px-4 py-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-3">
                        <Link
                          href={`/website/posts?edit=${post.id}`}
                          className="font-semibold text-primary hover:underline"
                        >
                          Sửa
                        </Link>
                        <form action={deletePost} className="inline">
                          <input type="hidden" name="id" value={post.id} />
                          <button
                            type="submit"
                            className="font-semibold text-red-700 hover:underline"
                          >
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
