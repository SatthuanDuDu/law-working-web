import type { ReactNode } from "react";
import {
  Building2,
  Mail,
  MapPin,
  Phone,
  Users,
} from "lucide-react";
import { MatterMembersEditor } from "@/components/matters/matter-members-editor";
import { MatterStatusControl } from "@/components/matters/matter-status-control";
import { RevisionHistory } from "@/components/history/revision-history";
import { getMatterTypeDisplay } from "@/lib/matter-code";
import { cn, formatDateTime } from "@/lib/utils";
import { nexusInitials, nexusAvatarTone } from "@/lib/list-surface";
import { getTranslations } from "next-intl/server";
import type { MatterStatus, MatterType, Role } from "@prisma/client";

function SidebarCard({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-surface p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[15px] font-bold text-foreground">
          <span className="text-primary">{icon}</span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export async function MatterInfoCard({
  matter,
  canEditStatus = false,
  isAdmin = false,
  showTitleBar = false,
  canEditMembers = false,
  staffOptions = [],
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
    leadLawyerId: string;
    client: {
      name: string;
      code?: string | null;
      email?: string | null;
      phone: string | null;
      address: string | null;
      city: string | null;
      businessType?: string | null;
    };
    leadLawyer: { id: string; name: string };
    members: { userId: string; user: { id: string; name: string } }[];
  };
  canEditStatus?: boolean;
  isAdmin?: boolean;
  stickyHeader?: boolean;
  showTitleBar?: boolean;
  className?: string;
  canEditMembers?: boolean;
  staffOptions?: { id: string; name: string; role: Role }[];
}) {
  const t = await getTranslations("matters");
  const tClients = await getTranslations("clients");
  const tOverview = await getTranslations("matters.overview");
  const address = [matter.client.address, matter.client.city]
    .filter(Boolean)
    .join(", ");
  const memberIds = matter.members.map((m) => m.userId);
  const associates = matter.members.filter(
    (m) => m.userId !== matter.leadLawyerId,
  );

  return (
    <div className={cn("space-y-4", className)}>
      {showTitleBar ? (
        <section className="space-y-3 rounded-2xl border border-border/70 bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="break-words text-base font-bold leading-snug text-foreground sm:text-lg">
                {matter.title}
              </h3>
              <p className="mt-0.5 font-mono text-[11px] font-medium text-muted-foreground">
                {matter.code}
              </p>
              <RevisionHistory
                entityType="Matter"
                entityId={matter.id}
                className="mt-1"
              />
            </div>
            <MatterStatusControl
              matterId={matter.id}
              status={matter.status}
              canEdit={canEditStatus}
              isAdmin={isAdmin}
              className="w-auto shrink-0"
            />
          </div>
        </section>
      ) : null}

      <SidebarCard
        title={tOverview("clientCardTitle")}
        icon={<Building2 className="h-5 w-5" aria-hidden />}
      >
        <div className="flex items-start gap-3 rounded-xl bg-surface-container p-3">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-base font-bold shadow-sm",
              nexusAvatarTone(matter.id),
            )}
          >
            {nexusInitials(matter.client.name)}
          </div>
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold leading-tight text-foreground">
              {matter.client.name}
            </h3>
            {matter.client.code ? (
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {matter.client.code}
              </p>
            ) : null}
            <p className="mt-1 text-xs text-muted-foreground">
              {getMatterTypeDisplay(matter.type, matter.customTypeLabel)}
            </p>
          </div>
        </div>

        <div className="space-y-3 text-[13px]">
          {matter.client.phone ? (
            <div className="flex items-start gap-2.5">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">
                  {tClients("phone")}
                </p>
                <a
                  href={`tel:${matter.client.phone}`}
                  className="font-semibold tabular-nums text-foreground hover:text-primary"
                >
                  {matter.client.phone}
                </a>
              </div>
            </div>
          ) : null}
          {matter.client.email ? (
            <div className="flex items-start gap-2.5">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">
                  {tClients("email")}
                </p>
                <a
                  href={`mailto:${matter.client.email}`}
                  className="break-all font-semibold text-primary hover:underline"
                >
                  {matter.client.email}
                </a>
              </div>
            </div>
          ) : null}
          {address ? (
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">
                  {tClients("address")}
                </p>
                <p className="text-foreground">{address}</p>
              </div>
            </div>
          ) : null}
        </div>

        {(matter.client.phone || matter.client.email) && (
          <div className="flex gap-2 pt-1">
            {matter.client.phone ? (
              <a
                href={`tel:${matter.client.phone}`}
                className="interactive-press flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface-container py-2 text-xs font-medium text-foreground hover:bg-surface-container-high"
              >
                <Phone className="h-3.5 w-3.5" />
                {tClients("phone")}
              </a>
            ) : null}
            {matter.client.email ? (
              <a
                href={`mailto:${matter.client.email}`}
                className="interactive-press flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-surface-container py-2 text-xs font-medium text-foreground hover:bg-surface-container-high"
              >
                <Mail className="h-3.5 w-3.5" />
                {tClients("email")}
              </a>
            ) : null}
          </div>
        )}
      </SidebarCard>

      <SidebarCard
        title={tOverview("teamCardTitle")}
        icon={<Users className="h-5 w-5" aria-hidden />}
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-container p-2">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {nexusInitials(matter.leadLawyer.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-foreground">
                  {matter.leadLawyer.name}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("leadLawyer")}
                </p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-primary-muted px-2 py-0.5 text-[11px] font-bold text-primary">
              {tOverview("leadBadge")}
            </span>
          </div>

          {associates.map((member) => (
            <div
              key={member.userId}
              className="flex items-center justify-between gap-2 rounded-xl bg-surface-container p-2"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                  {nexusInitials(member.user.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-foreground">
                    {member.user.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {t("members")}
                  </p>
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-surface-container-high px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {tOverview("memberBadge")}
              </span>
            </div>
          ))}
        </div>

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
        ) : null}
      </SidebarCard>

      {matter.description ? (
        <SidebarCard
          title={t("fieldDescription")}
          icon={<Building2 className="h-5 w-5" aria-hidden />}
        >
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
            {matter.description}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {t("fieldCreatedAt")}: {formatDateTime(matter.createdAt)}
          </p>
        </SidebarCard>
      ) : null}
    </div>
  );
}
