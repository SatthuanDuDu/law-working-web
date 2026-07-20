import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { AttachmentLabelForm } from "@/components/admin/attachment-label-form";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function AdminAttachmentLabelsPage() {
  await requireRole(["ADMIN"]);
  const tPages = await getTranslations("pages.attachmentLabels");
  const t = await getTranslations("admin.attachmentLabels");
  const tAdmin = await getTranslations("admin");

  const labels = await prisma.attachmentLabel.findMany({
    include: { _count: { select: { attachments: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeaderSlot
        title={tPages("title")}
        description={tPages("description")}
      />
      <div className="grid gap-8 xl:grid-cols-[360px_1fr]">
        <Card className="rounded-[5px]">
          <CardHeader>
            <CardTitle>{t("addTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <AttachmentLabelForm />
          </CardContent>
        </Card>

        <Card className="rounded-[5px]">
          <CardHeader>
            <CardTitle>{tAdmin("list")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {labels.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            ) : (
              labels.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface/80 p-4"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("fileUsage", { count: item._count.attachments })}
                    </p>
                  </div>
                  <Badge variant={item.isActive ? "success" : "danger"}>
                    {item.isActive ? tAdmin("inUse") : tAdmin("inactiveShort")}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
