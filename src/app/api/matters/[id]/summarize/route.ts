import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getAccessibleMatterIds } from "@/lib/access";
import {
  MATTER_STATUS_LABELS,
  MATTER_PLAN_STEP_STATUS_LABELS,
  TASK_STATUS_LABELS,
} from "@/lib/constants";

const USER_PROMPT =
  "Vụ việc này là gì, diễn biến và kết quả cuối cùng.";

function formatDate(value: Date | null | undefined) {
  if (!value) return "—";
  return value.toLocaleString("vi-VN");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const matterIds = await getAccessibleMatterIds(user.id, user.role);
  if (matterIds && !matterIds.includes(id)) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Chưa cấu hình OPENAI_API_KEY" },
      { status: 503 },
    );
  }

  const matter = await prisma.matter.findUnique({
    where: { id },
    include: {
      client: { select: { name: true, notes: true } },
      leadLawyer: { select: { name: true } },
      members: { include: { user: { select: { name: true } } } },
      planSteps: {
        orderBy: { sortOrder: "asc" },
        select: {
          title: true,
          status: true,
          startedAt: true,
          dueAt: true,
          workType: { select: { name: true } },
        },
      },
      tasks: {
        orderBy: { dueDate: "asc" },
        take: 30,
        select: {
          title: true,
          status: true,
          priority: true,
          dueDate: true,
          assignee: { select: { name: true } },
        },
      },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          body: true,
          createdAt: true,
          author: { select: { name: true } },
          matterPlanStep: { select: { title: true } },
        },
      },
    },
  });

  if (!matter) {
    return NextResponse.json({ error: "Không tìm thấy vụ việc" }, { status: 404 });
  }

  const contextLines = [
    `Mã: ${matter.code}`,
    `Tiêu đề: ${matter.title}`,
    `Trạng thái: ${MATTER_STATUS_LABELS[matter.status] ?? matter.status}`,
    `Mô tả: ${matter.description?.trim() || "(không có)"}`,
    `Khách hàng: ${matter.client.name}`,
    matter.client.notes ? `Ghi chú KH: ${matter.client.notes}` : null,
    `Luật sư chính: ${matter.leadLawyer.name}`,
    `Thành viên: ${
      matter.members.map((m) => m.user.name).join(", ") || "(không có)"
    }`,
    "",
    "Kế hoạch:",
    ...(matter.planSteps.length === 0
      ? ["(chưa có bước)"]
      : matter.planSteps.map(
          (step, index) =>
            `${index + 1}. ${step.title} | ${MATTER_PLAN_STEP_STATUS_LABELS[step.status] ?? step.status}` +
            (step.workType ? ` | ${step.workType.name}` : "") +
            ` | bắt đầu ${formatDate(step.startedAt)} | hạn ${formatDate(step.dueAt)}`,
        )),
    "",
    "Công việc:",
    ...(matter.tasks.length === 0
      ? ["(không có)"]
      : matter.tasks.map(
          (task) =>
            `- ${task.title} | ${TASK_STATUS_LABELS[task.status] ?? task.status}` +
            ` | ${task.assignee.name}` +
            ` | hạn ${formatDate(task.dueDate)}`,
        )),
    "",
    "Bình luận gần đây (mới nhất trước):",
    ...(matter.comments.length === 0
      ? ["(không có)"]
      : matter.comments.map((comment) => {
          const step = comment.matterPlanStep?.title
            ? ` [bước: ${comment.matterPlanStep.title}]`
            : "";
          return `- ${formatDate(comment.createdAt)} | ${comment.author.name}${step}: ${comment.body}`;
        })),
  ].filter((line): line is string => line !== null);

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "Bạn là trợ lý pháp lý nội bộ của văn phòng luật. Trả lời tiếng Việt, ngắn gọn, rõ ràng, dựa strictly trên dữ liệu được cung cấp. Không bịa thông tin. Cấu trúc: (1) Vụ việc là gì, (2) Diễn biến, (3) Kết quả/trạng thái hiện tại.",
          },
          {
            role: "user",
            content: `${USER_PROMPT}\n\n--- Dữ liệu vụ việc ---\n${contextLines.join("\n")}`,
          },
        ],
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message =
        typeof payload?.error?.message === "string"
          ? payload.error.message
          : "OpenAI trả lỗi";
      return NextResponse.json({ error: message }, { status: 502 });
    }

    const summary =
      payload?.choices?.[0]?.message?.content?.trim?.() ||
      "Không nhận được nội dung tóm tắt.";

    return NextResponse.json({ summary });
  } catch (error) {
    console.error("matter summarize failed:", error);
    return NextResponse.json(
      { error: "Không gọi được OpenAI" },
      { status: 502 },
    );
  }
}
