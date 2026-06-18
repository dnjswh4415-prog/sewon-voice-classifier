import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const wantsJson = (request.headers.get("content-type") ?? "").includes("application/json");
  const response = wantsJson
    ? NextResponse.json({ message: "로그아웃되었습니다." })
    : NextResponse.redirect(new URL("/login", request.url));

  response.cookies.set("accessToken", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });

  return response;
}