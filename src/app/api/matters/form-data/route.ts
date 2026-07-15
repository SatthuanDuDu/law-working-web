import { NextResponse } from "next/server";
import { getMatterFormData } from "@/lib/matter-form-data";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getMatterFormData(user);
    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/matters/form-data failed:", error);
    return NextResponse.json(
      {
        error:
          "Không tải được dữ liệu form. Chạy `npx prisma db push` để cập nhật database.",
      },
      { status: 500 },
    );
  }
}
