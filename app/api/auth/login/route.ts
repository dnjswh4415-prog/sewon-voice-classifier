import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

function isJsonRequest(request: NextRequest) {
  return (request.headers.get("content-type") ?? "").includes("application/json");
}

async function readBody(request: NextRequest) {
  if (isJsonRequest(request)) {
    return request.json();
  }

  const formData = await request.formData();
  return Object.fromEntries(formData.entries());
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url));
}

export async function POST(request: NextRequest) {
  const wantsJson = isJsonRequest(request);
  const parsed = loginSchema.safeParse(await readBody(request));

  if (!parsed.success) {
    return wantsJson
      ? NextResponse.json({ message: "이메일과 비밀번호를 확인해주세요." }, { status: 400 })
      : redirectTo(request, "/login?error=login_failed");
  }

  const userWithPassword = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() }
  });

  if (!userWithPassword) {
    return wantsJson
      ? NextResponse.json({ message: "로그인 정보가 올바르지 않습니다." }, { status: 401 })
      : redirectTo(request, "/login?error=login_failed");
  }

  const isValid = await bcrypt.compare(parsed.data.password, userWithPassword.password);

  if (!isValid) {
    return wantsJson
      ? NextResponse.json({ message: "로그인 정보가 올바르지 않습니다." }, { status: 401 })
      : redirectTo(request, "/login?error=login_failed");
  }

  const user = {
    id: userWithPassword.id,
    email: userWithPassword.email,
    name: userWithPassword.name,
    role: userWithPassword.role
  };
  const token = signToken(user);
  const response = wantsJson ? NextResponse.json({ user }) : redirectTo(request, "/dashboard");
  response.cookies.set("accessToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return response;
}