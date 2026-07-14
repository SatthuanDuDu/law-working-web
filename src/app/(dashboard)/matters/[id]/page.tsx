import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { AttachmentPanel } from "@/components/attachments/attachment-panel";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import { isManagerOrAbove } from "@/lib/permissions";
import {
  DAILY_LOG_STATUS_LABELS,
  MATTER_STATUS_LABELS,
  MATTER_TYPE_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/constants";
import { formatDate, formatDateTime, formatMinutes } from "@/lib/utils";

export default async function MatterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const matterIds = await getAccessibleMatterIds(user.id, user.role);

  if (matterIds && !matterIds.includes(id)) notFound();

  const matter = await prisma.matter.findUnique({
    where: { id },
    include: {
      client: true,
      leadLawyer: true,
      members: { include: { user: true } },
      dailyLogs: {
        include: { user: true, workType: true },
        orderBy: { date: "desc" },
        take: 20,
      },
      tasks: {
        include: { assignee: true },
        orderBy: { createdAt: "desc" },
      },
      attachments: {
        include: { uploadedBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!matter) notFound();

  const initialAttachments = matter.attachments.map((file) => ({
    id: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt.toISOString(),
    uploadedBy: file.uploadedBy,
  }));

  const timeline = [
    ...matter.dailyLogs.map((log) => ({
      id: log.id,
      type: "log" as const,
      date: log.createdAt,
      title: log.description,
      subtitle: `${log.user.name} • ${formatMinutes(log.minutes)}`,
    })),
    ...matter.tasks.map((task) => ({
      id: task.id,
      type: "task" as const,
      date: task.createdAt,
      title: task.title,
      subtitle: `${task.assignee.name} • ${TASK_STATUS_LABELS[task.status]}`,
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <AppShell
      user={user}
      title={matter.title}
      description={`${matter.code} • ${matter.client.name}`}
    >
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Thông tin vụ việc</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              <span className="font-medium">Mã:</span> {matter.code}
            </p>
            <p>
              <span className="font-medium">Loại:</span> {MATTER_TYPE_LABELS[matter.type]}
            </p>
            <p>
              <span className="font-medium">Trạng thái:</span>{" "}
              <Badge variant="info">{MATTER_STATUS_LABELS[matter.status]}</Badge>
            </p>
            <p>
              <span className="font-medium">Khách hàng:</span> {matter.client.name}
            </p>
            <p>
              <span className="font-medium">Luật sư phụ trách:</span>{" "}
              {matter.leadLawyer.name}
            </p>
            <p>
              <span className="font-medium">Thành viên:</span>{" "}
              {matter.members.map((m) => m.user.name).join(", ")}
            </p>
            {matter.description && (
              <p>
                <span className="font-medium">Mô tả:</span> {matter.description}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Timeline hoạt động</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {timeline.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có hoạt động nào.</p>
            ) : (
              timeline.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex gap-4 border-l-2 border-primary/40 pl-4"
                >
                  <div>
                    <p className="font-medium">{item.title}</p>
                    <p className="text-sm text-slate-500">{item.subtitle}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(item.date)}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <AttachmentPanel
          matterId={matter.id}
          currentUserId={user.id}
          canDeleteAll={isManagerOrAbove(user.role)}
          initialAttachments={initialAttachments}
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Công việc gần đây</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {matter.dailyLogs.map((log) => (
              <div key={log.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{log.description}</p>
                <p className="text-slate-500">
                  {formatDate(log.date)} • {log.user.name} • {formatMinutes(log.minutes)}
                </p>
                <Badge variant={log.status === "COMPLETED" ? "success" : "warning"}>
                  {DAILY_LOG_STATUS_LABELS[log.status]}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Task liên quan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {matter.tasks.map((task) => (
              <div key={task.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{task.title}</p>
                <p className="text-slate-500">
                  {task.assignee.name}
                  {task.dueDate ? ` • Hạn: ${formatDate(task.dueDate)}` : ""}
                </p>
                <Badge variant="info">{TASK_STATUS_LABELS[task.status]}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
