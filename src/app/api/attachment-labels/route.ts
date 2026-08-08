import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getCachedAttachmentLabels } from "@/lib/cached-lookups";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const labels = await getCachedAttachmentLabels();

  return NextResponse.json({ labels });
}
