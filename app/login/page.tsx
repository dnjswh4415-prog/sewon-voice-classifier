import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { NoticeAlert } from "@/components/NoticeAlert";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="page stack">
      <NoticeAlert code={params.message ?? params.error} />
      <div className="pageHeader">
        <BackButton />
      </div>
      <section className="panel stack">
        <div>
          <h1>로그인</h1>
          <p className="muted">로그인 후 녹음 파일 업로드와 기록 다운로드를 이용할 수 있습니다.</p>
        </div>
        <form className="stack" action="/api/auth/login" method="post">
          <label className="field">
            이메일
            <input name="email" type="email" required />
          </label>
          <label className="field">
            비밀번호
            <input name="password" type="password" required />
          </label>
          <button className="button" type="submit">
            로그인
          </button>
        </form>
        <Link className="muted" href="/register">
          계정 만들기
        </Link>
      </section>
    </main>
  );
}