import { WebsiteCmsNav } from "@/components/website-cms/website-cms-nav";
import { requireRole } from "@/lib/session";

export default async function WebsiteCmsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireRole(["ADMIN", "MANAGER"]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <WebsiteCmsNav />
      {children}
    </div>
  );
}
