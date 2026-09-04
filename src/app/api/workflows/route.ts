import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { listActiveWorkflowTemplatesAction } from "@/lib/workflow-actions";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const templates = await listActiveWorkflowTemplatesAction();
  return NextResponse.json({ templates });
}
