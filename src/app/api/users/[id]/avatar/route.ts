import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import {
  canBrowserReachStoragePublicEndpoint,
  createPreviewUrl,
  getObject,
} from "@/lib/storage";

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

  // Signed redirect only works when the public S3 host is browser-reachable.
  if (canBrowserReachStoragePublicEndpoint()) {
    const url = await createPreviewUrl(target.avatarKey, fileName, mimeType);
    return NextResponse.redirect(url);
  }

  try {
    const object = await getObject(target.avatarKey);
    if (!object.body) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const headers = new Headers();
    headers.set("Content-Type", object.contentType || mimeType);
    headers.set("Cache-Control", "private, max-age=300");
    if (typeof object.contentLength === "number") {
      headers.set("Content-Length", String(object.contentLength));
    }
    const body =
      typeof object.body.transformToWebStream === "function"
        ? object.body.transformToWebStream()
        : (object.body as ReadableStream);
    return new NextResponse(body, { status: 200, headers });
  } catch (error) {
    console.error("avatar stream failed:", error);
    return NextResponse.json({ error: "Không thể tải avatar" }, { status: 500 });
  }
}
