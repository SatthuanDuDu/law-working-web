import { AppShell } from "@/components/layout/app-shell";
import { SettingsPageClient } from "@/components/settings/settings-page";
import { requireAuth } from "@/lib/session";

export default async function SettingsPage() {
  const user = await requireAuth();

  return (
    <AppShell
      user={user}
      title="Cài đặt"
      description="Quản lý tài khoản cá nhân"
    >
      <SettingsPageClient user={user} />
    </AppShell>
  );
}
