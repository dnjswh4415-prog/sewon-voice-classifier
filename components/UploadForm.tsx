"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function UploadForm() {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsUploading(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Accept: "application/json"
        },
        body: formData
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        alert(result?.message ?? "파일 업로드 또는 분석 중 오류가 발생했습니다.");
        return;
      }

      form.reset();
      router.push("/dashboard?uploaded=1");
      router.refresh();
    } catch {
      alert("파일 업로드 또는 분석 중 오류가 발생했습니다.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form className="stack" onSubmit={handleSubmit}>
      <label className="field">
        오디오 파일
        <input name="audio" type="file" accept="audio/*,video/mp4,video/webm" required />
      </label>
      <button className="button" type="submit" disabled={isUploading}>
        {isUploading ? "업로드 및 분석 중..." : "업로드 및 분석"}
      </button>
    </form>
  );
}
