import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { canAccessAttachmentTarget } from "@/lib/access";
import { getObjectStream } from "@/lib/storage";
import { createAuditLog } from "@/lib/audit";

function contentDisposition(kind: "inline" | "attachment", fileName: string) {
  const encoded = encodeURIComponent(fileName);
  return `${kind}; filename="${encoded}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) {
    return NextResponse.json({ error: "Không tìm thấy file" }, { status: 404 });
  }

  const allowed = await canAccessAttachmentTarget(user.id, user.role, attachment);
  if (!allowed) {
    return NextResponse.json({ error: "Không có quyền tải file" }, { status: 403 });
  }

  const dispositionParam = new URL(request.url).searchParams.get("disposition");
  const disposition =
    dispositionParam === "attachment" ? "attachment" : "inline";

  try {
    const object = await getObjectStream(attachment.storageKey);
    const headers = new Headers({
      "Content-Type": attachment.mimeType || object.contentType,
      "Content-Disposition": contentDisposition(disposition, attachment.fileName),
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
    });
    if (typeof object.contentLength === "number") {
      headers.set("Content-Length", String(object.contentLength));
    }

    await createAuditLog({
      userId: user.id,
      action: "UPDATE",
      entityType: "Attachment",
      entityId: attachment.id,
      details: `${disposition === "attachment" ? "Tải xuống" : "Xem"}: ${attachment.fileName}`,
    });

    return new NextResponse(object.body, { status: 200, headers });
  } catch (error) {
    console.error("attachment content proxy failed:", error);
    return NextResponse.json(
      { error: "Không mở được file" },
      { status: 502 },
    );
  }
}
