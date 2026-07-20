import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { createPreviewUrl } from "@/lib/storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const target = await prisma.user.findUnique({
    where: { id },
    select: { avatarKey: true },
  });

  if (!target?.avatarKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fileName = target.avatarKey.split("/").pop() || "avatar.jpg";
  const mimeType = fileName.endsWith(".png")
    ? "image/png"
    : fileName.endsWith(".webp")
      ? "image/webp"
      : fileName.endsWith(".gif")
        ? "image/gif"
        : "image/jpeg";

  const url = await createPreviewUrl(target.avatarKey, fileName, mimeType);
  return NextResponse.redirect(url);
}
