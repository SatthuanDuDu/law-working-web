import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getVapidPublicKey, isWebPushConfigured } from "@/lib/web-push";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = isWebPushConfigured();
  if (!configured) {
    return NextResponse.json({
      configured: false,
      publicKey: null,
      subscribed: false,
    });
  }

  const count = await prisma.pushSubscription.count({
    where: { userId: user.id },
  });

  return NextResponse.json({
    configured: true,
    publicKey: getVapidPublicKey(),
    subscribed: count > 0,
  });
}

export async function POST(request: Request) {
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

  let body: {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const endpoint = body.endpoint?.trim();
  const p256dh = body.keys?.p256dh?.trim();
  const auth = body.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json(
      { error: "Thiếu endpoint hoặc keys." },
      { status: 400 },
    );
  }

  const userAgent = request.headers.get("user-agent")?.slice(0, 500) ?? null;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: user.id,
      endpoint,
      p256dh,
      auth,
      userAgent,
    },
    update: {
      userId: user.id,
      p256dh,
      auth,
      userAgent,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let endpoint: string | undefined;
  try {
    const body = await request.json();
    endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : undefined;
  } catch {
    endpoint = undefined;
  }

  if (endpoint) {
    await prisma.pushSubscription.deleteMany({
      where: { userId: user.id, endpoint },
    });
  } else {
    await prisma.pushSubscription.deleteMany({
      where: { userId: user.id },
    });
  }

  return NextResponse.json({ ok: true });
}
