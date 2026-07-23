import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { UsersList } from "@/components/admin/users-list";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export default async function AdminUsersPage() {
  const user = await requireRole(["ADMIN"]);
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
      <UsersList
        users={listItems}
        currentUserId={user.id}
        departments={departments.map((department) => ({
          id: department.id,
          name: department.name,
        }))}
      />
    </>
  );
}
