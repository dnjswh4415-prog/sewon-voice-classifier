import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth";
import { toExportRow } from "@/lib/consultation";
import { createCsv, createXlsx } from "@/lib/exportRecords";

function fileName(extension: "csv" | "xlsx") {
  const date = new Date().toISOString().slice(0, 10);
  return `consultation-records-${date}.${extension}`;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const format = searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const scope = searchParams.get("scope");
  const user = scope === "all" ? await requireAdmin() : await requireUser();

  const records = await prisma.consultationRecord.findMany({
    where: scope === "all" ? undefined : { userId: user.id },
    include: {
      user: {
        select: {
          name: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  const rows = records.map(toExportRow);

  if (format === "xlsx") {
    const workbook = createXlsx(rows);
    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName("xlsx")}"`
      }
    });
  }

  const csv = createCsv(rows);
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName("csv")}"`
    }
  });
}
