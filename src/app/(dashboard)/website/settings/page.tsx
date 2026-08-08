import Link from "next/link";
import { redirect } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { LocalePair } from "@/components/website-cms/locale-pair";
import { MediaUploadField } from "@/components/website-cms/media-upload-field";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { cmsDb } from "@/lib/cms-db";
import { getSitePreviewHref } from "@/lib/cms-edit-targets";
import { revalidatePublicSite } from "@/lib/cms-revalidate";
import { requireRole } from "@/lib/session";
import { WEBSITE_CMS_FORM_ID } from "@/lib/website-cms";

const ANCHOR =
  "scroll-mt-24 space-y-4 border-t border-border pt-6 first:border-t-0 first:pt-0";

async function saveSettings(formData: FormData) {
  "use server";
  await requireRole(["ADMIN", "MANAGER"]);

  await cmsDb.siteSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  await cmsDb.siteSettings.update({
    where: { id: "default" },
    data: {
      phone: String(formData.get("phone") ?? "") || null,
      hotline: String(formData.get("hotline") ?? "") || null,
      email: String(formData.get("email") ?? "") || null,
      zaloNumber: String(formData.get("zaloNumber") ?? "") || null,
      facebookUrl: String(formData.get("facebookUrl") ?? "") || null,
      linkedinUrl: String(formData.get("linkedinUrl") ?? "") || null,
      youtubeUrl: String(formData.get("youtubeUrl") ?? "") || null,
      taxCode: String(formData.get("taxCode") ?? "") || null,
      licenseNumber: String(formData.get("licenseNumber") ?? "") || null,
      licenseIssuer: String(formData.get("licenseIssuer") ?? "") || null,
      logoKey: String(formData.get("logoKey") ?? "") || null,
      heroImageKey: String(formData.get("heroImageKey") ?? "") || null,
      aboutImageKey: String(formData.get("aboutImageKey") ?? "") || null,
      ctaImageKey: String(formData.get("ctaImageKey") ?? "") || null,
      ogImageKey: String(formData.get("ogImageKey") ?? "") || null,
      googleMapsEmbed: String(formData.get("googleMapsEmbed") ?? "") || null,
      clientCount: Number(formData.get("clientCount") ?? 0) || 0,
      reviewScore: String(formData.get("reviewScore") ?? "") || null,
      reviewCount: Number(formData.get("reviewCount") ?? 0) || 0,
    },
  });

  for (const locale of ["vi", "en"] as const) {
    const suffix = locale === "vi" ? "Vi" : "En";
    const data = {
      firmName: String(formData.get(`firmName${suffix}`) ?? "").trim(),
      firmShortName: String(formData.get(`firmShortName${suffix}`) ?? "").trim(),
      tagline: String(formData.get(`tagline${suffix}`) ?? "").trim(),
      heroEyebrow: String(formData.get(`heroEyebrow${suffix}`) ?? "").trim(),
      heroTitle: String(formData.get(`heroTitle${suffix}`) ?? "").trim(),
      heroSubtitle: String(formData.get(`heroSubtitle${suffix}`) ?? "").trim(),
      heroPrimaryCta: String(formData.get(`heroPrimaryCta${suffix}`) ?? "").trim(),
      heroSecondaryCta: String(formData.get(`heroSecondaryCta${suffix}`) ?? "").trim(),
      trustedLabel: String(formData.get(`trustedLabel${suffix}`) ?? "").trim(),
      aboutEyebrow: String(formData.get(`aboutEyebrow${suffix}`) ?? "").trim(),
      aboutTitle: String(formData.get(`aboutTitle${suffix}`) ?? "").trim(),
      aboutBody: String(formData.get(`aboutBody${suffix}`) ?? "").trim(),
      ctaEyebrow: String(formData.get(`ctaEyebrow${suffix}`) ?? "").trim(),
      ctaTitle: String(formData.get(`ctaTitle${suffix}`) ?? "").trim(),
      ctaBody: String(formData.get(`ctaBody${suffix}`) ?? "").trim(),
      ctaButton: String(formData.get(`ctaButton${suffix}`) ?? "").trim(),
      footerAbout: String(formData.get(`footerAbout${suffix}`) ?? "").trim(),
      seoTitle: String(formData.get(`seoTitle${suffix}`) ?? "").trim(),
      seoDescription: String(formData.get(`seoDescription${suffix}`) ?? "").trim(),
    };

    await cmsDb.siteSettingsTranslation.upsert({
      where: { settingsId_locale: { settingsId: "default", locale } },
      update: data,
      create: { settingsId: "default", locale, ...data },
    });
  }

  try {
    await revalidatePublicSite();
  } catch (err) {
    console.error("[cms] settings revalidate failed", err);
  }
  redirect("/website/settings?saved=1");
}

export default async function WebsiteSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireRole(["ADMIN", "MANAGER"]);
  const { saved } = await searchParams;
  const settings = await cmsDb.siteSettings.findUnique({
    where: { id: "default" },
    include: { translations: true },
  });
  const vi = settings?.translations.find((t) => t.locale === "vi");
  const en = settings?.translations.find((t) => t.locale === "en");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Cài đặt site</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Thông tin liên hệ, hero, SEO của website công khai.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={getSitePreviewHref()} target="_blank">
            <ExternalLink className="size-3.5" aria-hidden />
            Xem trước
          </Link>
        </Button>
      </div>

      {saved ? (
        <p className="flex flex-wrap items-center gap-3 rounded-md bg-primary-muted px-4 py-3 text-sm text-primary">
          <span>Đã lưu cài đặt.</span>
          <Link
            href={getSitePreviewHref()}
            target="_blank"
            className="font-semibold underline underline-offset-2"
          >
            Xem trước trên site
          </Link>
        </p>
      ) : null}

      <form
        id={WEBSITE_CMS_FORM_ID}
        action={saveSettings}
        className="space-y-8 rounded-md border border-border bg-surface p-6"
      >
        <section id="contact" className={ANCHOR}>
          <h2 className="font-semibold text-foreground">Liên hệ &amp; đánh giá</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Hotline" htmlFor="hotline">
              <Input id="hotline" name="hotline" defaultValue={settings?.hotline ?? ""} />
            </Field>
            <Field label="Điện thoại" htmlFor="phone">
              <Input id="phone" name="phone" defaultValue={settings?.phone ?? ""} />
            </Field>
            <Field label="Email" htmlFor="email">
              <Input id="email" name="email" type="email" defaultValue={settings?.email ?? ""} />
            </Field>
            <Field label="Zalo" htmlFor="zaloNumber">
              <Input id="zaloNumber" name="zaloNumber" defaultValue={settings?.zaloNumber ?? ""} />
            </Field>
            <Field label="Facebook URL" htmlFor="facebookUrl">
              <Input id="facebookUrl" name="facebookUrl" defaultValue={settings?.facebookUrl ?? ""} />
            </Field>
            <Field label="LinkedIn URL" htmlFor="linkedinUrl">
              <Input id="linkedinUrl" name="linkedinUrl" defaultValue={settings?.linkedinUrl ?? ""} />
            </Field>
            <Field label="YouTube URL" htmlFor="youtubeUrl">
              <Input id="youtubeUrl" name="youtubeUrl" defaultValue={settings?.youtubeUrl ?? ""} />
            </Field>
            <Field label="Mã số thuế" htmlFor="taxCode">
              <Input id="taxCode" name="taxCode" defaultValue={settings?.taxCode ?? ""} />
            </Field>
            <Field label="Số giấy phép" htmlFor="licenseNumber">
              <Input id="licenseNumber" name="licenseNumber" defaultValue={settings?.licenseNumber ?? ""} />
            </Field>
            <Field label="Cơ quan cấp phép" htmlFor="licenseIssuer">
              <Input id="licenseIssuer" name="licenseIssuer" defaultValue={settings?.licenseIssuer ?? ""} />
            </Field>
            <Field label="Số khách hàng" htmlFor="clientCount">
              <Input id="clientCount" name="clientCount" type="number" defaultValue={settings?.clientCount ?? 0} />
            </Field>
            <Field label="Điểm đánh giá" htmlFor="reviewScore">
              <Input id="reviewScore" name="reviewScore" defaultValue={settings?.reviewScore ?? ""} />
            </Field>
            <Field label="Số đánh giá" htmlFor="reviewCount">
              <Input id="reviewCount" name="reviewCount" type="number" defaultValue={settings?.reviewCount ?? 0} />
            </Field>
          </div>
          <Field label="Google Maps embed URL" htmlFor="googleMapsEmbed">
            <Input id="googleMapsEmbed" name="googleMapsEmbed" defaultValue={settings?.googleMapsEmbed ?? ""} />
          </Field>
        </section>

        <section id="media" className={ANCHOR}>
          <h2 className="font-semibold text-foreground">Hình ảnh</h2>
          <div className="grid gap-4">
            <MediaUploadField name="logoKey" label="Logo" defaultValue={settings?.logoKey} />
            <MediaUploadField name="heroImageKey" label="Ảnh hero" defaultValue={settings?.heroImageKey} />
            <MediaUploadField name="aboutImageKey" label="Ảnh giới thiệu" defaultValue={settings?.aboutImageKey} />
            <MediaUploadField name="ctaImageKey" label="Ảnh CTA" defaultValue={settings?.ctaImageKey} />
            <MediaUploadField name="ogImageKey" label="Ảnh Open Graph" defaultValue={settings?.ogImageKey} />
          </div>
        </section>

        <section id="brand" className={ANCHOR}>
          <h2 className="font-semibold text-foreground">Thương hiệu</h2>
          <LocalePair>
            <Field label="Tên công ty (VI)" htmlFor="firmNameVi">
              <Input id="firmNameVi" name="firmNameVi" defaultValue={vi?.firmName ?? ""} />
            </Field>
            <Field label="Firm name (EN)" htmlFor="firmNameEn">
              <Input id="firmNameEn" name="firmNameEn" defaultValue={en?.firmName ?? ""} />
            </Field>
            <Field label="Tên ngắn (VI)" htmlFor="firmShortNameVi">
              <Input id="firmShortNameVi" name="firmShortNameVi" defaultValue={vi?.firmShortName ?? ""} />
            </Field>
            <Field label="Short name (EN)" htmlFor="firmShortNameEn">
              <Input id="firmShortNameEn" name="firmShortNameEn" defaultValue={en?.firmShortName ?? ""} />
            </Field>
            <Field label="Tagline (VI)" htmlFor="taglineVi">
              <Input id="taglineVi" name="taglineVi" defaultValue={vi?.tagline ?? ""} />
            </Field>
            <Field label="Tagline (EN)" htmlFor="taglineEn">
              <Input id="taglineEn" name="taglineEn" defaultValue={en?.tagline ?? ""} />
            </Field>
            <Field label="Nhãn số khách (VI)" htmlFor="trustedLabelVi">
              <Input id="trustedLabelVi" name="trustedLabelVi" defaultValue={vi?.trustedLabel ?? ""} />
            </Field>
            <Field label="Trusted label (EN)" htmlFor="trustedLabelEn">
              <Input id="trustedLabelEn" name="trustedLabelEn" defaultValue={en?.trustedLabel ?? ""} />
            </Field>
            <Field label="Footer about (VI)" htmlFor="footerAboutVi">
              <Textarea id="footerAboutVi" name="footerAboutVi" defaultValue={vi?.footerAbout ?? ""} />
            </Field>
            <Field label="Footer about (EN)" htmlFor="footerAboutEn">
              <Textarea id="footerAboutEn" name="footerAboutEn" defaultValue={en?.footerAbout ?? ""} />
            </Field>
          </LocalePair>
        </section>

        <section id="hero" className={ANCHOR}>
          <h2 className="font-semibold text-foreground">Hero</h2>
          <LocalePair>
            <Field label="Dòng nhỏ (VI)" htmlFor="heroEyebrowVi">
              <Input id="heroEyebrowVi" name="heroEyebrowVi" defaultValue={vi?.heroEyebrow ?? ""} />
            </Field>
            <Field label="Eyebrow (EN)" htmlFor="heroEyebrowEn">
              <Input id="heroEyebrowEn" name="heroEyebrowEn" defaultValue={en?.heroEyebrow ?? ""} />
            </Field>
            <Field label="Tiêu đề (VI)" htmlFor="heroTitleVi">
              <Input id="heroTitleVi" name="heroTitleVi" defaultValue={vi?.heroTitle ?? ""} />
            </Field>
            <Field label="Title (EN)" htmlFor="heroTitleEn">
              <Input id="heroTitleEn" name="heroTitleEn" defaultValue={en?.heroTitle ?? ""} />
            </Field>
            <Field label="Mô tả (VI)" htmlFor="heroSubtitleVi">
              <Textarea id="heroSubtitleVi" name="heroSubtitleVi" defaultValue={vi?.heroSubtitle ?? ""} />
            </Field>
            <Field label="Subtitle (EN)" htmlFor="heroSubtitleEn">
              <Textarea id="heroSubtitleEn" name="heroSubtitleEn" defaultValue={en?.heroSubtitle ?? ""} />
            </Field>
            <Field label="CTA chính (VI)" htmlFor="heroPrimaryCtaVi">
              <Input id="heroPrimaryCtaVi" name="heroPrimaryCtaVi" defaultValue={vi?.heroPrimaryCta ?? ""} />
            </Field>
            <Field label="Primary CTA (EN)" htmlFor="heroPrimaryCtaEn">
              <Input id="heroPrimaryCtaEn" name="heroPrimaryCtaEn" defaultValue={en?.heroPrimaryCta ?? ""} />
            </Field>
            <Field label="CTA phụ (VI)" htmlFor="heroSecondaryCtaVi">
              <Input id="heroSecondaryCtaVi" name="heroSecondaryCtaVi" defaultValue={vi?.heroSecondaryCta ?? ""} />
            </Field>
            <Field label="Secondary CTA (EN)" htmlFor="heroSecondaryCtaEn">
              <Input id="heroSecondaryCtaEn" name="heroSecondaryCtaEn" defaultValue={en?.heroSecondaryCta ?? ""} />
            </Field>
          </LocalePair>
        </section>

        <section id="about" className={ANCHOR}>
          <h2 className="font-semibold text-foreground">Giới thiệu</h2>
          <LocalePair>
            <Field label="Dòng nhỏ (VI)" htmlFor="aboutEyebrowVi">
              <Input id="aboutEyebrowVi" name="aboutEyebrowVi" defaultValue={vi?.aboutEyebrow ?? ""} />
            </Field>
            <Field label="Eyebrow (EN)" htmlFor="aboutEyebrowEn">
              <Input id="aboutEyebrowEn" name="aboutEyebrowEn" defaultValue={en?.aboutEyebrow ?? ""} />
            </Field>
            <Field label="Tiêu đề (VI)" htmlFor="aboutTitleVi">
              <Input id="aboutTitleVi" name="aboutTitleVi" defaultValue={vi?.aboutTitle ?? ""} />
            </Field>
            <Field label="Title (EN)" htmlFor="aboutTitleEn">
              <Input id="aboutTitleEn" name="aboutTitleEn" defaultValue={en?.aboutTitle ?? ""} />
            </Field>
            <Field label="Nội dung (VI)" htmlFor="aboutBodyVi">
              <Textarea id="aboutBodyVi" name="aboutBodyVi" className="min-h-32" defaultValue={vi?.aboutBody ?? ""} />
            </Field>
            <Field label="Body (EN)" htmlFor="aboutBodyEn">
              <Textarea id="aboutBodyEn" name="aboutBodyEn" className="min-h-32" defaultValue={en?.aboutBody ?? ""} />
            </Field>
          </LocalePair>
        </section>

        <section id="cta" className={ANCHOR}>
          <h2 className="font-semibold text-foreground">CTA</h2>
          <LocalePair>
            <Field label="Dòng nhỏ (VI)" htmlFor="ctaEyebrowVi">
              <Input id="ctaEyebrowVi" name="ctaEyebrowVi" defaultValue={vi?.ctaEyebrow ?? ""} />
            </Field>
            <Field label="Eyebrow (EN)" htmlFor="ctaEyebrowEn">
              <Input id="ctaEyebrowEn" name="ctaEyebrowEn" defaultValue={en?.ctaEyebrow ?? ""} />
            </Field>
            <Field label="Tiêu đề (VI)" htmlFor="ctaTitleVi">
              <Input id="ctaTitleVi" name="ctaTitleVi" defaultValue={vi?.ctaTitle ?? ""} />
            </Field>
            <Field label="Title (EN)" htmlFor="ctaTitleEn">
              <Input id="ctaTitleEn" name="ctaTitleEn" defaultValue={en?.ctaTitle ?? ""} />
            </Field>
            <Field label="Nút (VI)" htmlFor="ctaButtonVi">
              <Input id="ctaButtonVi" name="ctaButtonVi" defaultValue={vi?.ctaButton ?? ""} />
            </Field>
            <Field label="Button (EN)" htmlFor="ctaButtonEn">
              <Input id="ctaButtonEn" name="ctaButtonEn" defaultValue={en?.ctaButton ?? ""} />
            </Field>
            <Field label="Nội dung (VI)" htmlFor="ctaBodyVi">
              <Textarea id="ctaBodyVi" name="ctaBodyVi" defaultValue={vi?.ctaBody ?? ""} />
            </Field>
            <Field label="Body (EN)" htmlFor="ctaBodyEn">
              <Textarea id="ctaBodyEn" name="ctaBodyEn" defaultValue={en?.ctaBody ?? ""} />
            </Field>
          </LocalePair>
        </section>

        <section id="seo" className={ANCHOR}>
          <h2 className="font-semibold text-foreground">SEO</h2>
          <LocalePair>
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
        </section>

        <Button type="submit" size="lg">
          Lưu cài đặt
        </Button>
      </form>
    </div>
  );
}
