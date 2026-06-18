import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page stack">
      <section className="panel stack">
        <div className="stack">
          <span className="badge">AI 상담 접수 정리</span>
          <h1>세원 음성 상담 기록 자동 정리</h1>
          <p className="muted">
            전화 녹음 파일을 업로드하면 음성을 텍스트로 변환하고, 녹음에 있는 내용만 기준으로 상담 접수 항목을 정리합니다.
          </p>
        </div>
        <div className="row">
          <Link className="button" href="/login">
            로그인
          </Link>
          <Link className="button secondary" href="/register">
            회원가입
          </Link>
        </div>
      </section>
      <section className="grid">
        <div className="card stack">
          <h2>업로드</h2>
          <p className="muted">mp3, wav, m4a, mp4, webm 파일을 등록합니다.</p>
        </div>
        <div className="card stack">
          <h2>텍스트화</h2>
          <p className="muted">CLOVA Speech 설정값으로 한국어 음성을 텍스트로 변환합니다.</p>
        </div>
        <div className="card stack">
          <h2>엑셀 정리</h2>
          <p className="muted">구분, 등록번호, 문의자, 대분류, 문의내용, 답변내용을 CSV/XLSX로 내려받습니다.</p>
        </div>
      </section>
    </main>
  );
}