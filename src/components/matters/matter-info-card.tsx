import type { ReactNode } from "react";
import { MatterStatusControl } from "@/components/matters/matter-status-control";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMatterTypeDisplay } from "@/lib/matter-code";
import { cn, formatDateTime } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import type { MatterStatus, MatterType } from "@prisma/client";

function MetaItem({
  label,
  children,
  emphasize = false,
}: {
  label: string;
  children: ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 break-words text-sm text-foreground",
          emphasize ? "font-semibold" : "font-medium",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

export async function MatterInfoCard({
  matter,
  canEditStatus,
  isAdmin = false,
  stickyHeader = false,
  className,
}: {
  matter: {
    id: string;
    code: string;
    title: string;
    description: string | null;
    type: MatterType;
    customTypeLabel: string | null;
    status: MatterStatus;
    createdAt: Date;
    client: {
      name: string;
      phone: string | null;
      address: string | null;
      city: string | null;
    };
    leadLawyer: { name: string };
    members: { user: { name: string } }[];
  };
  canEditStatus: boolean;
  isAdmin?: boolean;
  stickyHeader?: boolean;
  className?: string;
}) {
  const t = await getTranslations("matters");
  const tClients = await getTranslations("clients");
  const address = [matter.client.address, matter.client.city]
    .filter(Boolean)
    .join(", ");
  const memberNames =
    matter.members.map((member) => member.user.name).join(", ") || "—";

  return (
    <Card className={cn("rounded-[5px]", className)}>
      <CardHeader
        className={cn(
          "flex flex-col items-start gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between",
          stickyHeader &&
            "xl:sticky xl:top-32 xl:z-10 xl:rounded-t-[5px] xl:border-b xl:border-border xl:bg-surface/95 xl:backdrop-blur-sm",
        )}
      >
        <CardTitle className="pr-2 text-base">{t("info")}</CardTitle>
        <MatterStatusControl
          matterId={matter.id}
          status={matter.status}
          canEdit={canEditStatus}
          isAdmin={isAdmin}
          className="w-full justify-start sm:w-auto sm:shrink-0 sm:justify-end"
        />
      </CardHeader>

      <CardContent className="space-y-5 pt-3">
        <div className="space-y-2">
          <h3 className="break-words text-lg font-semibold leading-snug text-foreground">
            {matter.title}
          </h3>
          <p className="break-all font-mono text-xs font-medium tabular-nums tracking-tight text-primary">
            {matter.code}
          </p>
        </div>

        <dl className="grid min-w-0 gap-3 sm:grid-cols-2">
          <MetaItem label={t("fieldType")}>
            {getMatterTypeDisplay(matter.type, matter.customTypeLabel)}
          </MetaItem>
          <MetaItem label={t("fieldCreatedAt")}>
            {formatDateTime(matter.createdAt)}
          </MetaItem>
        </dl>

        <div className="space-y-3 border-t border-border/70 pt-4">
          <SectionLabel>{t("client")}</SectionLabel>
          <dl className="space-y-3">
            <dd className="break-words text-sm font-semibold text-foreground">
              {matter.client.name}
            </dd>
            {matter.client.phone ? (
              <MetaItem label={tClients("phone")}>
                <span className="tabular-nums">{matter.client.phone}</span>
              </MetaItem>
            ) : null}
            {address ? (
              <MetaItem label={tClients("address")}>{address}</MetaItem>
            ) : null}
          </dl>
        </div>

        <div className="space-y-3 border-t border-border/70 pt-4">
          <SectionLabel>{t("leadLawyer")}</SectionLabel>
          <dl className="space-y-3">
            <dd className="break-words text-sm font-semibold text-foreground">
              {matter.leadLawyer.name}
            </dd>
            <MetaItem label={t("members")}>{memberNames}</MetaItem>
          </dl>
        </div>

        {matter.description ? (
          <div className="space-y-2 border-t border-border/70 pt-4">
            <SectionLabel>{t("fieldDescription")}</SectionLabel>
            <p className="break-words whitespace-pre-wrap text-sm leading-relaxed text-foreground">
              {matter.description}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
