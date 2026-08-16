import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { MatterStatusControl } from "@/components/matters/matter-status-control";
import { MatterMembersEditor } from "@/components/matters/matter-members-editor";
import { RevisionHistory } from "@/components/history/revision-history";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMatterTypeDisplay } from "@/lib/matter-code";
import { cn, formatDateTime } from "@/lib/utils";
import { getTranslations } from "next-intl/server";
import type { MatterStatus, MatterType, Role } from "@prisma/client";

function MetaItem({
  label,
  children,
  emphasize = false,
  className,
}: {
  label: string;
  children: ReactNode;
  emphasize?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[11px]">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-0.5 break-words text-sm leading-snug text-foreground",
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
    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-[11px]">
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
  canEditMembers = false,
  staffOptions = [],
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
    leadLawyerId: string;
    client: {
      name: string;
      phone: string | null;
      address: string | null;
      city: string | null;
    };
    leadLawyer: { id: string; name: string };
    members: { userId: string; user: { id: string; name: string } }[];
  };
  canEditStatus: boolean;
  isAdmin?: boolean;
  stickyHeader?: boolean;
  className?: string;
  canEditMembers?: boolean;
  staffOptions?: { id: string; name: string; role: Role }[];
}) {
  const t = await getTranslations("matters");
  const tClients = await getTranslations("clients");
  const address = [matter.client.address, matter.client.city]
    .filter(Boolean)
    .join(", ");
  const memberIds = matter.members.map((m) => m.userId);
  const memberNames =
    matter.members
      .filter((m) => m.userId !== matter.leadLawyerId)
      .map((m) => m.user.name)
      .join(", ") || "—";

  const detailSections = (
    <>
      <div className="space-y-2">
        <SectionLabel>{t("client")}</SectionLabel>
        <p className="break-words text-sm font-semibold leading-snug text-foreground">
          {matter.client.name}
        </p>
        {(matter.client.phone || address) && (
          <dl
            className={cn(
              "grid min-w-0 gap-2",
              matter.client.phone && address
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1",
            )}
          >
            {matter.client.phone ? (
              <MetaItem label={tClients("phone")}>
                <span className="tabular-nums">{matter.client.phone}</span>
              </MetaItem>
            ) : null}
            {address ? (
              <MetaItem
                label={tClients("address")}
                className={matter.client.phone ? "sm:col-span-1" : undefined}
              >
                {address}
              </MetaItem>
            ) : null}
          </dl>
        )}
      </div>

      <div className="space-y-2 border-t border-border/60 pt-3">
        <SectionLabel>{t("leadLawyer")}</SectionLabel>
        <p className="break-words text-sm font-semibold leading-snug text-foreground">
          {matter.leadLawyer.name}
        </p>
        {canEditMembers ? (
          <MatterMembersEditor
            matterId={matter.id}
            leadLawyerId={matter.leadLawyerId}
            initialMemberIds={memberIds}
            knownMembers={matter.members.map((m) => ({
              id: m.userId,
              name: m.user.name,
            }))}
            staffOptions={staffOptions}
            canEdit
          />
        ) : (
          <dl>
            <MetaItem label={t("members")}>{memberNames}</MetaItem>
          </dl>
        )}
      </div>

      {matter.description ? (
        <div className="space-y-1.5 border-t border-border/60 pt-3">
          <SectionLabel>{t("fieldDescription")}</SectionLabel>
          <p className="break-words whitespace-pre-wrap text-sm leading-snug text-foreground">
            {matter.description}
          </p>
        </div>
      ) : null}
    </>
  );

  return (
    <Card className={cn("rounded-md", className)}>
      <CardHeader
        className={cn(
          "flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 p-3.5 pb-2 sm:p-4 sm:pb-2.5",
          stickyHeader &&
            "xl:sticky xl:top-3 xl:z-10 xl:rounded-t-md xl:border-b xl:border-border xl:bg-surface/95 xl:backdrop-blur-sm",
        )}
      >
        <CardTitle className="text-sm font-semibold sm:text-base">
          {t("info")}
        </CardTitle>
        <MatterStatusControl
          matterId={matter.id}
          status={matter.status}
          canEdit={canEditStatus}
          isAdmin={isAdmin}
          className="w-auto shrink-0 justify-end"
        />
      </CardHeader>

      <CardContent className="space-y-3 p-3.5 pt-2.5 sm:space-y-3.5 sm:p-4 sm:pt-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold leading-snug text-foreground sm:text-lg">
            {matter.title}
          </h3>
          <p className="mt-0.5 break-all font-mono text-[11px] font-medium tabular-nums tracking-tight text-primary sm:text-xs">
            {matter.code}
          </p>
          <RevisionHistory
            entityType="Matter"
            entityId={matter.id}
            className="mt-1"
          />
        </div>

        <dl className="grid min-w-0 grid-cols-2 gap-x-3 gap-y-2">
          <MetaItem label={t("fieldType")}>
            {getMatterTypeDisplay(matter.type, matter.customTypeLabel)}
          </MetaItem>
          <MetaItem label={t("fieldCreatedAt")}>
            {formatDateTime(matter.createdAt)}
          </MetaItem>
        </dl>

        {/* Mobile: collapse client / staff / description to free vertical space */}
        <details className="group border-t border-border/60 xl:hidden">
          <summary className="interactive-press flex cursor-pointer list-none items-center justify-between gap-2 py-2.5 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden hover:[filter:none] active:[filter:none]">
            <span className="min-w-0 truncate">{t("infoMore")}</span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="space-y-3 pb-0.5 pt-0.5">{detailSections}</div>
        </details>

        {/* Desktop / tablet landscape: always expanded */}
        <div className="hidden space-y-3 border-t border-border/60 pt-3 xl:block">
          {detailSections}
        </div>
      </CardContent>
    </Card>
  );
}
