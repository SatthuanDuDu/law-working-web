import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAccessAttachmentTarget } from "@/lib/access";
import { buildStorageKey, createUploadUrl } from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";

const MAX_SIZE_BYTES = 25 * 1024 * 1024;

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const matterId = searchParams.get("matterId") || undefined;
  const taskId = searchParams.get("taskId") || undefined;
  const clientId = searchParams.get("clientId") || undefined;

  if (!matterId && !taskId && !clientId) {
    return NextResponse.json({ error: "Thiếu tham chiếu entity" }, { status: 400 });
  }

  const allowed = await canAccessAttachmentTarget(user.id, user.role, {
    matterId,
    taskId,
    clientId,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền truy cập" }, { status: 403 });
  }

  const attachments = await prisma.attachment.findMany({
    where: {
      ...(matterId ? { matterId } : {}),
      ...(taskId ? { taskId } : {}),
      ...(clientId ? { clientId } : {}),
    },
    include: { uploadedBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ attachments });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Payload không hợp lệ" }, { status: 400 });
  }

  const { fileName, mimeType, sizeBytes, matterId, taskId, clientId } = body as {
    fileName?: string;
    mimeType?: string;
    sizeBytes?: number;
    matterId?: string | null;
    taskId?: string | null;
    clientId?: string | null;
  };

  if (!fileName || !mimeType || typeof sizeBytes !== "number") {
    return NextResponse.json({ error: "Thiếu thông tin file" }, { status: 400 });
  }

  if (sizeBytes <= 0 || sizeBytes > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File phải nhỏ hơn 25MB" },
      { status: 400 },
    );
  }

  if (!matterId && !taskId && !clientId) {
    return NextResponse.json({ error: "Thiếu tham chiếu entity" }, { status: 400 });
  }

  const allowed = await canAccessAttachmentTarget(user.id, user.role, {
    matterId,
    taskId,
    clientId,
  });
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền upload" }, { status: 403 });
  }

  const storageKey = buildStorageKey(fileName);
  const uploadUrl = await createUploadUrl(storageKey, mimeType);

  const attachment = await prisma.attachment.create({
    data: {
      fileName,
      mimeType,
      sizeBytes,
      storageKey,
      matterId: matterId || null,
      taskId: taskId || null,
      clientId: clientId || null,
      uploadedById: user.id,
    },
  });

  await createAuditLog({
    userId: user.id,
    action: "CREATE",
    entityType: "Attachment",
    entityId: attachment.id,
    details: fileName,
  });

  return NextResponse.json({ attachment, uploadUrl });
}
