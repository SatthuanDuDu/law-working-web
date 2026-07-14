import * as XLSX from "xlsx";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildDailyLogWhere } from "@/lib/access";
import { canViewReports } from "@/lib/permissions";
import type { Role } from "@prisma/client";
import { formatDate, formatMinutes } from "@/lib/utils";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role as Role;
  if (!canViewReports(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const userId = searchParams.get("userId");
  const matterId = searchParams.get("matterId");

  const now = new Date();
  const fromDate = from
    ? new Date(from)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const toDate = to ? new Date(to) : now;
  toDate.setHours(23, 59, 59, 999);

  const baseWhere = buildDailyLogWhere(session.user.id, role);
  const logs = await prisma.dailyLog.findMany({
    where: {
      ...baseWhere,
      date: { gte: fromDate, lte: toDate },
      ...(userId ? { userId } : {}),
      ...(matterId ? { matterId } : {}),
    },
    include: {
      user: true,
      matter: true,
      client: true,
      workType: true,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const rows = logs.map((log) => ({
    Ngày: formatDate(log.date),
    "Nhân viên": log.user.name,
    "Nội dung": log.description,
    "Vụ việc": log.matter?.code ?? "",
    "Khách hàng": log.client?.name ?? "",
    "Loại CV": log.workType?.name ?? "",
    "Thời gian": formatMinutes(log.minutes),
    Phút: log.minutes,
    "Tính phí": log.isBillable ? "Có" : "Không",
    "Trạng thái": log.status,
  }));

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "BaoCao");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bao-cao-gio-lam.xlsx"`,
    },
  });
}
