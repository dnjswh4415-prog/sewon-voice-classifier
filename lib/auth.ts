import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyToken } from "@/lib/jwt";

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("accessToken")?.value;

  if (!token) {
    return null;
  }

  const payload = verifyToken(token);

  if (!payload) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true
    }
  });
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Response(JSON.stringify({ message: "로그인이 필요합니다." }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    throw new Response(JSON.stringify({ message: "관리자 권한이 필요합니다." }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  return user;
}
