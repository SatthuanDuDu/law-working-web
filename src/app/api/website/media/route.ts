import { NextResponse } from "next/server";

import { requireCmsApiUser } from "@/lib/cms-auth";
import { cmsDb } from "@/lib/cms-db";
import { buildCmsMediaKey, putCmsObject } from "@/lib/cms-storage";

export const runtime = "nodejs";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function GET(request: Request) {
  const user = await requireCmsApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Number(searchParams.get("pageSize") ?? "24") || 24),
  );

  const where = q
    ? { fileName: { contains: q, mode: "insensitive" as const } }
    : {};

  const [items, total] = await Promise.all([
    cmsDb.media.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    cmsDb.media.count({ where }),
  ]);

  return NextResponse.json({ items, total, page, pageSize });
}

export async function POST(request: Request) {
  const user = await requireCmsApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 8MB)" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const storageKey = buildCmsMediaKey(file.name);

  try {
    await putCmsObject(storageKey, bytes, file.type);
  } catch {
    return NextResponse.json({ error: "Upload to storage failed" }, { status: 502 });
  }

  const media = await cmsDb.media.create({
    data: {
      storageKey,
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      alt: String(form.get("alt") ?? "") || null,
      uploadedBy: user.id,
    },
  });

  return NextResponse.json({ media });
}
