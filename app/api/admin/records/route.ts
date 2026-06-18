import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
    const records = await prisma.consultationRecord.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ records });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return NextResponse.json({ message: "관리자 기록 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
