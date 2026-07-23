import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { getObjectStream } from "@/lib/storage";

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

  try {
    const object = await getObjectStream(target.avatarKey);
    const headers = new Headers({
      "Content-Type": mimeType || object.contentType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    });
    if (typeof object.contentLength === "number") {
      headers.set("Content-Length", String(object.contentLength));
    }
    return new NextResponse(object.body, { status: 200, headers });
  } catch (error) {
    console.error("avatar proxy failed:", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
