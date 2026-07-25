import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { resolveServerPageMeta } from "@/lib/page-meta";
import { requireAuth } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  const pathname = (await headers()).get("x-pathname") ?? "/dashboard";
  const tPages = await getTranslations("pages");
  const serverMeta = await resolveServerPageMeta(pathname, tPages);

  return (
    <DashboardShell user={user} serverMeta={serverMeta}>
      {children}
    </DashboardShell>
  );
}
