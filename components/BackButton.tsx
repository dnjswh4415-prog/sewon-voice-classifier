"use client";

import { useRouter } from "next/navigation";

export function BackButton() {
  const router = useRouter();

  return (
    <button className="iconButton" type="button" onClick={() => router.back()} aria-label="뒤로가기">
      ←
    </button>
  );
}