import { PageHeaderSlot } from "@/components/layout/page-header-slot";
import { UserForm } from "@/components/admin/user-form";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import { DeleteUserButton } from "@/components/admin/delete-user-button";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ROLE_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

export default async function AdminUsersPage() {
  const user = await requireRole(["ADMIN"]);

  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      include: { department: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeaderSlot
        title="Quản lý nhân viên"
        description="Tạo tài khoản và đặt lại mật khẩu khi nhân viên quên"
      />
      <div className="grid gap-8 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Thêm nhân viên</CardTitle>
          </CardHeader>
          <CardContent>
            <UserForm departments={departments} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danh sách nhân viên</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="px-3 py-2">Họ tên</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Vai trò</th>
                    <th className="px-3 py-2">Phòng ban</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2">Ngày tạo</th>
                    <th className="px-3 py-2">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((item) => (
                    <tr key={item.id} className="interactive-row border-b">
                      <td className="px-3 py-3 font-medium">{item.name}</td>
                      <td className="px-3 py-3">{item.email}</td>
                      <td className="px-3 py-3">{ROLE_LABELS[item.role]}</td>
                      <td className="px-3 py-3">{item.department?.name ?? "—"}</td>
                      <td className="px-3 py-3">
                        <Badge variant={item.isActive ? "success" : "danger"}>
                          {item.isActive ? "Hoạt động" : "Khóa"}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">{formatDate(item.createdAt)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1">
                          <ResetPasswordButton userId={item.id} userName={item.name} />
                          <DeleteUserButton
                            userId={item.id}
                            userName={item.name}
                            canDelete={item.id !== user.id}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
