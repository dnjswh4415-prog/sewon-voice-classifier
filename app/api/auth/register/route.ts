import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/jwt";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100)
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
  const parsed = registerSchema.safeParse(await readBody(request));

  if (!parsed.success) {
    return wantsJson
      ? NextResponse.json({ message: "입력값을 확인해주세요." }, { status: 400 })
      : redirectTo(request, "/register?error=register_failed");
  }

  const email = parsed.data.email.toLowerCase();
  const exists = await prisma.user.findUnique({ where: { email } });

  if (exists) {
    return wantsJson
      ? NextResponse.json({ message: "이미 가입된 이메일입니다." }, { status: 409 })
      : redirectTo(request, "/register?error=duplicate_email");
  }

  const password = await bcrypt.hash(parsed.data.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      password,
      name: parsed.data.name
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  });

  const token = signToken(user);
  const response = wantsJson ? NextResponse.json({ user }, { status: 201 }) : redirectTo(request, "/dashboard");
  response.cookies.set("accessToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });

  return response;
}