import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { deleteObject } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const storageKey =
    body && typeof body.storageKey === "string" ? body.storageKey : null;

  if (!storageKey || !storageKey.startsWith(`avatars/${user.id}/`)) {
    return NextResponse.json({ error: "storageKey không hợp lệ" }, { status: 400 });
  }

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatarKey: true },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarKey: storageKey },
  });

  if (current?.avatarKey && current.avatarKey !== storageKey) {
    try {
      await deleteObject(current.avatarKey);
    } catch {
      // Best-effort cleanup of previous avatar object.
    }
  }

  return NextResponse.json({ success: true, avatarKey: storageKey });
}
