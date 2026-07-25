import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { isWebPushConfigured, notifyUsersPush } from "@/lib/web-push";

/** Send a one-off OS push to the current user's devices (local/prod smoke test). */
export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isWebPushConfigured()) {
    return NextResponse.json(
      { error: "Web Push chưa được cấu hình trên server." },
      { status: 503 },
    );
  }

  const title = "NSLAW — thử popup hệ thống";
  const body = `Push lúc ${new Date().toLocaleTimeString("vi-VN")}`;

  await prisma.notification.create({
    data: {
      userId: user.id,
      type: "GENERAL",
      title,
      message: body,
      link: "/settings",
    },
  });

  const subCount = await prisma.pushSubscription.count({
    where: { userId: user.id },
  });
  if (subCount === 0) {
    return NextResponse.json(
      {
        error:
          "Chưa có thiết bị đăng ký push. Hãy bấm \"Bật thông báo đẩy\" trước.",
      },
      { status: 400 },
    );
  }

  await notifyUsersPush(user.id, {
    title,
    body,
    url: "/settings",
    tag: "nslaw-push-test",
  });

  return NextResponse.json({ ok: true, devices: subCount });
}
