import Link from "next/link";
import { BackButton } from "@/components/BackButton";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function statusClass(status: string) {
  if (status === "COMPLETED") return "badge done";
  if (status === "FAILED") return "badge failed";
  return "badge";
}

export default async function AdminPage() {
  await requireAdmin();

  const records = await prisma.consultationRecord.findMany({
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return (
    <main className="page stack">
      <div className="pageHeader">
        <div className="row">
          <BackButton />
          <div>
            <h1>관리자 기록</h1>
            <p className="muted">전체 사용자의 상담 접수 기록을 확인합니다.</p>
          </div>
        </div>
        <div className="row">
          <Link className="button secondary" href="/api/records/export?format=csv&scope=all">
            CSV 다운로드
          </Link>
          <Link className="button secondary" href="/api/records/export?format=xlsx&scope=all">
            Excel 다운로드
          </Link>
        </div>
      </div>
      <section className="panel stack">
        {records.length === 0 ? (
          <div className="empty">등록된 기록이 없습니다.</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>상태</th>
                  <th>업로드 사용자</th>
                  <th>파일명</th>
                  <th>대분류</th>
                  <th>문의 내용</th>
                  <th>접수일시</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>{record.id}</td>
                    <td>
                      <span className={statusClass(record.analysisStatus)}>{record.analysisStatus}</span>
                    </td>
                    <td>{record.user.name}</td>
                    <td>{record.audioFileName}</td>
                    <td>{record.mainCategory}</td>
                    <td>{record.inquirySummary}</td>
                    <td>{record.createdAt.toLocaleString("ko-KR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}