import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { NoticeAlert } from "@/components/NoticeAlert";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <main className="page stack">
      <NoticeAlert code={params.error} />
      <div className="pageHeader">
        <BackButton />
      </div>
      <section className="panel stack">
        <div>
          <h1>회원가입</h1>
          <p className="muted">상담 녹음 업로드용 계정을 만듭니다.</p>
        </div>
        <form className="stack" action="/api/auth/register" method="post">
          <label className="field">
            이름
            <input name="name" required />
          </label>
          <label className="field">
            이메일
            <input name="email" type="email" required />
          </label>
          <label className="field">
            비밀번호
            <input name="password" type="password" minLength={8} required />
          </label>
          <button className="button" type="submit">
            회원가입
          </button>
        </form>
        <Link className="muted" href="/login">
          이미 계정이 있습니다
        </Link>
      </section>
    </main>
  );
}