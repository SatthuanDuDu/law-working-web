import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { SettingsPageClient } from "@/components/settings/settings-page";
import { requireAuth } from "@/lib/session";

export default async function SettingsPage() {
  const user = await requireAuth();

  return (
    <>
      <PageHeaderSlot
        title="Cài đặt"
        description="Quản lý tài khoản cá nhân"
      />
      <SettingsPageClient user={user} />
    </>
  );
}
