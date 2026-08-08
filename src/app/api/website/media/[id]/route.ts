import { NextResponse } from "next/server";

import { requireCmsApiUser } from "@/lib/cms-auth";
import { cmsDb } from "@/lib/cms-db";
import { deleteCmsObject } from "@/lib/cms-storage";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const user = await requireCmsApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  let body: { alt?: string };
  try {
    body = (await request.json()) as { alt?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const media = await cmsDb.media.update({
      where: { id },
      data: {
        alt: typeof body.alt === "string" ? body.alt || null : undefined,
      },
    });
    return NextResponse.json({ media });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await requireCmsApiUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const media = await cmsDb.media.findUnique({ where: { id } });
  if (!media) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await deleteCmsObject(media.storageKey);
  } catch {
    // External URLs / missing S3 objects — still remove the DB row.
  }

  await cmsDb.media.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
