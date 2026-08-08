import { cmsDb } from "@/lib/cms-db";
import { requireRole } from "@/lib/session";

const STATUS_LABEL: Record<string, string> = {
  NEW: "Mới",
  IN_PROGRESS: "Đang xử lý",
  CONTACTED: "Đã liên hệ",
  CLOSED: "Đã đóng",
  SPAM: "Spam",
};

async function updateStatus(formData: FormData) {
  "use server";
  const user = await requireRole(["ADMIN", "MANAGER"]);

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["NEW", "IN_PROGRESS", "CONTACTED", "CLOSED", "SPAM"].includes(status)) {
    return;
  }

  await cmsDb.contactInquiry.update({
    where: { id },
    data: {
      status: status as "NEW" | "IN_PROGRESS" | "CONTACTED" | "CLOSED" | "SPAM",
      handledBy: user.id,
      handledAt: new Date(),
    },
  });
}

export default async function WebsiteInquiriesPage() {
  await requireRole(["ADMIN", "MANAGER"]);

  const inquiries = await cmsDb.contactInquiry.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      practiceArea: {
        include: { translations: { where: { locale: "vi" }, take: 1 } },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Yêu cầu tư vấn</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Form gửi từ trang Liên hệ trên website công khai.
        </p>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <ul className="divide-y divide-border">
          {inquiries.length === 0 ? (
            <li className="px-5 py-10 text-sm text-muted-foreground">Chưa có yêu cầu nào.</li>
          ) : (
            inquiries.map((item) => (
              <li key={item.id} className="px-5 py-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">
                      {item.fullName}
                      <span className="ml-2 rounded-full bg-primary-muted px-2 py-0.5 text-xs font-semibold text-primary">
                        {STATUS_LABEL[item.status] ?? item.status}
                      </span>
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <a href={`mailto:${item.email}`} className="hover:underline">
                        {item.email}
                      </a>
                      {" · "}
                      <a href={`tel:${item.phone.replace(/\s/g, "")}`} className="hover:underline">
                        {item.phone}
                      </a>
                      {item.practiceArea?.translations[0]
                        ? ` · ${item.practiceArea.translations[0].name}`
                        : ""}
                    </p>
                    {item.subject ? (
                      <p className="mt-1 text-sm font-medium">{item.subject}</p>
                    ) : null}
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{item.message}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {item.createdAt.toLocaleString("vi-VN")} · locale {item.locale}
                    </p>
                  </div>
                  <form action={updateStatus} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={item.id} />
                    <select
                      name="status"
                      defaultValue={item.status}
                      className="h-9 rounded-md border border-border bg-surface px-2 text-sm"
                    >
                      {Object.entries(STATUS_LABEL).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="interactive-press h-9 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
                    >
                      Lưu
                    </button>
                  </form>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
