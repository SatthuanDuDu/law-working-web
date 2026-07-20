import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { buildAvatarStorageKey, createUploadUrl } from "@/lib/storage";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Payload không hợp lệ" }, { status: 400 });
  }

  const { fileName, mimeType, sizeBytes } = body as {
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
  };

  if (!fileName || !mimeType || typeof sizeBytes !== "number") {
    return NextResponse.json({ error: "Thiếu thông tin file" }, { status: 400 });
  }

  if (!ALLOWED_MIME.has(mimeType)) {
    return NextResponse.json(
      { error: "Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc GIF" },
      { status: 400 },
    );
  }

  if (sizeBytes <= 0 || sizeBytes > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Ảnh không được vượt quá 2MB" },
      { status: 400 },
    );
  }

  const storageKey = buildAvatarStorageKey(user.id, fileName);
  const uploadUrl = await createUploadUrl(storageKey, mimeType);

  return NextResponse.json({ uploadUrl, storageKey });
}

export async function DELETE() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const current = await prisma.user.findUnique({
    where: { id: user.id },
    select: { avatarKey: true },
  });

  if (!current?.avatarKey) {
    return NextResponse.json({ success: true });
  }

  const { deleteObject } = await import("@/lib/storage");
  try {
    await deleteObject(current.avatarKey);
  } catch {
    // Object may already be gone; still clear DB key.
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarKey: null },
  });

  return NextResponse.json({ success: true });
}
