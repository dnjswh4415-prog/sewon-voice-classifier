"use client";

import { useEffect } from "react";

const messages: Record<string, string> = {
  login_required: "로그인 후 이용 부탁드립니다.",
  login_failed: "이메일 또는 비밀번호를 확인해주세요.",
  register_failed: "회원가입 정보를 확인해주세요.",
  duplicate_email: "이미 가입된 이메일입니다.",
  upload_failed: "파일 업로드 또는 분석 중 오류가 발생했습니다."
};

export function NoticeAlert({ code }: { code?: string }) {
  useEffect(() => {
    if (code && messages[code]) {
      alert(messages[code]);
    }
  }, [code]);

  return null;
}
