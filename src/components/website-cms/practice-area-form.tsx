import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { practiceIconNames } from "@/components/ui/practice-icon";
import { LocalePair } from "@/components/website-cms/locale-pair";
import { MediaUploadField } from "@/components/website-cms/media-upload-field";
import { WEBSITE_CMS_FORM_ID } from "@/lib/website-cms";

type Initial = {
  id?: string;
  key: string;
  icon: string;
  order: number;
  featured: boolean;
  status: string;
  coverKey: string | null;
  nameVi: string;
  slugVi: string;
  summaryVi: string;
  bodyVi: string;
  highlightsVi: string;
  nameEn: string;
  slugEn: string;
  summaryEn: string;
  bodyEn: string;
  highlightsEn: string;
};

export function PracticeAreaForm({
  action,
  initial,
}: {
  action: (formData: FormData) => Promise<void>;
  initial?: Initial;
}) {
  return (
    <form
      id={WEBSITE_CMS_FORM_ID}
      action={action}
      className="space-y-6 rounded-md border border-border bg-surface p-6"
    >
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {initial?.key ? <input type="hidden" name="key" value={initial.key} /> : null}
      {initial?.slugVi ? <input type="hidden" name="slugVi" value={initial.slugVi} /> : null}
      {initial?.slugEn ? <input type="hidden" name="slugEn" value={initial.slugEn} /> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Icon" htmlFor="icon">
          <Select id="icon" name="icon" defaultValue={initial?.icon ?? "scale"}>
            {practiceIconNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Thứ tự" htmlFor="order">
          <Input
            id="order"
            name="order"
            type="number"
            defaultValue={initial?.order ?? 0}
          />
        </Field>
        <Field label="Trạng thái" htmlFor="status">
          <Select id="status" name="status" defaultValue={initial?.status ?? "PUBLISHED"}>
            <option value="PUBLISHED">Công khai</option>
            <option value="DRAFT">Nháp</option>
          </Select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="featured"
          defaultChecked={initial?.featured ?? true}
          className="size-4 accent-primary"
        />
        Hiển thị trên trang chủ
      </label>

      <MediaUploadField
        name="coverKey"
        label="Ảnh cover"
        defaultValue={initial?.coverKey}
      />

      <LocalePair>
        <Field label="Tên (VI)" htmlFor="nameVi" required>
          <Input id="nameVi" name="nameVi" defaultValue={initial?.nameVi} required />
        </Field>
        <Field label="Name (EN)" htmlFor="nameEn" required>
          <Input id="nameEn" name="nameEn" defaultValue={initial?.nameEn} required />
        </Field>
        <Field label="Tóm tắt (VI)" htmlFor="summaryVi" required>
          <Textarea id="summaryVi" name="summaryVi" defaultValue={initial?.summaryVi} required />
        </Field>
        <Field label="Summary (EN)" htmlFor="summaryEn" required>
          <Textarea id="summaryEn" name="summaryEn" defaultValue={initial?.summaryEn} required />
        </Field>
        <Field label="Nội dung (VI)" htmlFor="bodyVi" required>
          <Textarea id="bodyVi" name="bodyVi" className="min-h-48" defaultValue={initial?.bodyVi} required />
        </Field>
        <Field label="Body (EN)" htmlFor="bodyEn" required>
          <Textarea id="bodyEn" name="bodyEn" className="min-h-48" defaultValue={initial?.bodyEn} required />
        </Field>
        <Field label="Điểm nổi bật (VI)" htmlFor="highlightsVi">
          <Textarea id="highlightsVi" name="highlightsVi" defaultValue={initial?.highlightsVi} />
        </Field>
        <Field label="Highlights (EN)" htmlFor="highlightsEn">
          <Textarea id="highlightsEn" name="highlightsEn" defaultValue={initial?.highlightsEn} />
        </Field>
      </LocalePair>

      <Button type="submit" size="lg">
        Lưu lĩnh vực
      </Button>
    </form>
  );
}
