import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();
    const records = await prisma.consultationRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ records });
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    return NextResponse.json({ message: "기록 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
