import { AppShell } from "@/components/layout/app-shell";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { formatDateTime } from "@/lib/utils";

const ACTION_LABELS = {
  CREATE: "Tạo",
  UPDATE: "Cập nhật",
  DELETE: "Xóa",
  LOGIN: "Đăng nhập",
  LOGOUT: "Đăng xuất",
} as const;

export default async function AdminAuditLogsPage() {
  const user = await requireRole(["ADMIN"]);
  const logs = await prisma.auditLog.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <AppShell
      user={user}
      title="Nhật ký hệ thống"
      description="Theo dõi thao tác quan trọng trong hệ thống"
    >
      <Card>
        <CardHeader>
          <CardTitle>100 bản ghi gần nhất</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="px-3 py-2">Thời gian</th>
                  <th className="px-3 py-2">Người dùng</th>
                  <th className="px-3 py-2">Hành động</th>
                  <th className="px-3 py-2">Đối tượng</th>
                  <th className="px-3 py-2">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b">
                    <td className="px-3 py-3">{formatDateTime(log.createdAt)}</td>
                    <td className="px-3 py-3">{log.user?.name ?? "Hệ thống"}</td>
                    <td className="px-3 py-3">
                      <Badge variant="info">{ACTION_LABELS[log.action]}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      {log.entityType}
                      {log.entityId ? ` (#${log.entityId.slice(0, 8)})` : ""}
                    </td>
                    <td className="px-3 py-3">{log.details ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
