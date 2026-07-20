import { DashboardShell } from "@/components/layout/dashboard-shell";
import { requireAuth } from "@/lib/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();

  return <DashboardShell user={user}>{children}</DashboardShell>;
}
