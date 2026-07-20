import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { UserForm } from "@/components/admin/user-form";
import { UsersList } from "@/components/admin/users-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function AdminUsersPage() {
  const user = await requireRole(["ADMIN"]);
  const t = await getTranslations("admin");
  const tPages = await getTranslations("pages.users");

  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      include: { department: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  const listItems = users.map((item) => ({
    id: item.id,
    name: item.name,
    username: item.username,
    email: item.email,
    phone: item.phone,
    dateOfBirth: item.dateOfBirth?.toISOString() ?? null,
    gender: item.gender,
    role: item.role,
    isActive: item.isActive,
    avatarKey: item.avatarKey,
    createdAt: item.createdAt.toISOString(),
    department: item.department
      ? { id: item.department.id, name: item.department.name }
      : null,
  }));

  return (
    <>
      <PageHeaderSlot
        title={tPages("title")}
        description={tPages("description")}
      />
      <div className="grid gap-8 xl:grid-cols-[360px_1fr]">
        <Card className="rounded-[5px]">
          <CardHeader>
            <CardTitle>{t("createUser")}</CardTitle>
          </CardHeader>
          <CardContent>
            <UserForm departments={departments} />
          </CardContent>
        </Card>

        <UsersList
          users={listItems}
          currentUserId={user.id}
          departments={departments.map((department) => ({
            id: department.id,
            name: department.name,
          }))}
        />
      </div>
    </>
  );
}
