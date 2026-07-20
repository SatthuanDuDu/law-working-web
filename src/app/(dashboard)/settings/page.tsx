import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { SettingsPageClient } from "@/components/settings/settings-page";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function SettingsPage() {
  const sessionUser = await requireAuth();
  const tPages = await getTranslations("pages.settings");

  const profile = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      avatarKey: true,
    },
  });

  const user = {
    id: sessionUser.id,
    email: profile?.email ?? sessionUser.email,
    name: profile?.name ?? sessionUser.name,
    role: profile?.role ?? sessionUser.role,
    avatarKey: profile?.avatarKey ?? null,
  };

  return (
    <>
      <PageHeaderSlot
        title={tPages("title")}
        description={tPages("description")}
      />
      <SettingsPageClient user={user} />
    </>
  );
}
