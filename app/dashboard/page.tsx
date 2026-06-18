import Link from "next/link";
import { redirect } from "next/navigation";
import { BackButton } from "@/components/BackButton";
import { UploadForm } from "@/components/UploadForm";
import { getCurrentUser } from "@/lib/auth";
import { getGoogleSheetDashboardRecords } from "@/lib/googleSheets";
import { prisma } from "@/lib/prisma";

const KOREA_TIME_ZONE = "Asia/Seoul";

type CountItem = {
  label: string;
  count: number;
};

function statusClass(status: string) {
  if (status === "COMPLETED") return "badge done";
  if (status === "FAILED") return "badge failed";
  return "badge";
}

function statusLabel(status: string) {
  if (status === "COMPLETED") return "완료";
  if (status === "FAILED") return "실패";
  if (status === "PROCESSING") return "분석중";
  return "대기";
}

function renderSummary(text: string) {
  return text.split("\n").map((line) => (
    <div key={line}>
      {line}
    </div>
  ));
}

function koreaDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function recentDateKeys(days: number) {
  const now = new Date();
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(now);
    date.setUTCDate(date.getUTCDate() - (days - index - 1));
    return koreaDateKey(date);
  });
}

function sheetDateKey(value: string) {
  const match = value.match(/(\d{4})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})/);

  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function countBy(values: string[], preferredOrder: string[] = []): CountItem[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    const label = value.trim() || "파악불가";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => {
      const aOrder = preferredOrder.indexOf(a.label);
      const bOrder = preferredOrder.indexOf(b.label);
      if (aOrder !== -1 || bOrder !== -1) {
        if (aOrder === -1) return 1;
        if (bOrder === -1) return -1;
        return aOrder - bOrder;
      }
      return b.count - a.count || a.label.localeCompare(b.label, "ko");
    });
}

function MetricBreakdown({ title, items }: { title: string; items: CountItem[] }) {
  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="dashboardBreakdown">
      <h3>{title}</h3>
      <div className="breakdownList">
        {items.length === 0 ? (
          <span className="muted">집계할 기록이 없습니다.</span>
        ) : (
          items.map((item) => (
            <div className="breakdownItem" key={item.label}>
              <div className="breakdownLabel">
                <span>{item.label}</span>
                <strong>{item.count}</strong>
              </div>
              <div className="breakdownTrack" aria-hidden="true">
                <span style={{ width: `${Math.max((item.count / maxCount) * 100, 4)}%` }} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login?message=login_required");
  }

  const [records, databaseAnalyticsRecords, sheetResult] = await Promise.all([
    prisma.consultationRecord.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30
    }),
    prisma.consultationRecord.findMany({
      where: { userId: user.id },
      select: {
        analysisStatus: true,
        callType: true,
        questionerType: true,
        mainCategory: true,
        status: true,
        receivedAt: true
      }
    }),
    getGoogleSheetDashboardRecords()
      .then((records) => ({ records, error: null }))
      .catch((error) => {
        console.warn("Google Sheets dashboard read failed:", error);
        return {
          records: null,
          error: error instanceof Error ? error.message : "Google Sheet를 읽지 못했습니다."
        };
      })
  ]);

  const sheetRecords = sheetResult.records;
  const usesGoogleSheet = sheetRecords !== null;
  const analyticsRecords = sheetRecords
    ? sheetRecords.map((record) => ({
        ...record,
        receivedAtKey: sheetDateKey(record.receivedAt)
      }))
    : databaseAnalyticsRecords.map((record) => ({
        ...record,
        receivedAtKey: koreaDateKey(record.receivedAt)
      }));
  const completedCount = analyticsRecords.filter((record) => {
    const status = record.analysisStatus.replace(/\s/g, "").toUpperCase();
    return status === "COMPLETED" || status === "완료" || status === "분석완료";
  }).length;
  const dateKeys = recentDateKeys(14);
  const todayKey = dateKeys.at(-1) ?? koreaDateKey(new Date());
  const weeklyKeys = new Set(dateKeys.slice(-7));
  const dailyCount = analyticsRecords.filter((record) => record.receivedAtKey === todayKey).length;
  const weeklyCount = analyticsRecords.filter(
    (record) => record.receivedAtKey !== null && weeklyKeys.has(record.receivedAtKey)
  ).length;
  const callTypeCounts = countBy(
    analyticsRecords.map((record) => record.callType),
    ["인바운드", "아웃바운드", "파악불가"]
  );
  const inboundCount = callTypeCounts.find((item) => item.label === "인바운드")?.count ?? 0;
  const outboundCount = callTypeCounts.find((item) => item.label === "아웃바운드")?.count ?? 0;
  const categoryCounts = countBy(
    analyticsRecords.map((record) => record.mainCategory),
    ["운영", "LMS", "교구재", "파악불가"]
  );
  const institutionTypeCounts = countBy(
    analyticsRecords.map((record) => record.questionerType),
    ["운영기관", "교사", "학부모", "학생", "기타", "파악불가"]
  );
  const normalizedStatuses = analyticsRecords.map((record) => record.status.replace(/\s/g, ""));
  const handlingStatusCounts = [
    { label: "완료", count: normalizedStatuses.filter((status) => status === "완료" || status === "완료건").length },
    { label: "이관", count: normalizedStatuses.filter((status) => status.includes("이관")).length },
    { label: "콜백", count: normalizedStatuses.filter((status) => status.includes("콜백")).length }
  ];
  const trend = dateKeys.map((dateKey) => ({
    dateKey,
    count: analyticsRecords.filter((record) => record.receivedAtKey === dateKey).length
  }));
  const maxTrendCount = Math.max(...trend.map((item) => item.count), 1);

  return (
    <main className="page stack">
      <div className="pageHeader">
        <div className="row">
          <BackButton />
          <div>
            <h1>대시보드</h1>
            <p className="muted">{user.name}님, 녹음 파일을 업로드하고 상담 기록을 내려받을 수 있습니다.</p>
          </div>
        </div>
        <form action="/api/auth/logout" method="post">
          <button className="button secondary" type="submit">
            로그아웃
          </button>
        </form>
      </div>

      <section className="grid">
        <div className="card stat">
          <span className="muted">전체 기록</span>
          <strong>{analyticsRecords.length}</strong>
        </div>
        <div className="card stat">
          <span className="muted">분석 완료</span>
          <strong>{completedCount}</strong>
        </div>
        <div className="card stat">
          <span className="muted">계정 권한</span>
          <strong>{user.role}</strong>
        </div>
      </section>

      <section className="panel stack dashboardAnalytics">
        <div className="analyticsHeader">
          <div>
            <h2>문의 운영 현황</h2>
            <p className="muted">한국 시간 기준으로 접수량과 상담 유형을 집계합니다.</p>
          </div>
          <span className={`dataSourceBadge ${usesGoogleSheet ? "connected" : "fallback"}`}>
            {usesGoogleSheet ? "Google Sheet 기준" : "DB 대체 집계"}
          </span>
        </div>
        {!usesGoogleSheet ? (
          <p className="sheetWarning">
            Google Sheet 연결을 확인하지 못해 DB 데이터로 표시 중입니다.
            {sheetResult.error ? ` ${sheetResult.error}` : ""}
          </p>
        ) : null}

        <div className="dashboardMetricGrid">
          <div className="dashboardMetric">
            <span>일간 문의</span>
            <strong>{dailyCount}</strong>
            <small>오늘 접수</small>
          </div>
          <div className="dashboardMetric">
            <span>주간 집계</span>
            <strong>{weeklyCount}</strong>
            <small>최근 7일</small>
          </div>
          <div className="dashboardMetric">
            <span>인바운드</span>
            <strong>{inboundCount}</strong>
            <small>수신 상담</small>
          </div>
          <div className="dashboardMetric">
            <span>아웃바운드</span>
            <strong>{outboundCount}</strong>
            <small>발신 상담</small>
          </div>
        </div>

        <div className="trendPanel">
          <div>
            <h3>최근 14일 추이</h3>
            <p className="muted">날짜별 문의 접수 건수</p>
          </div>
          <div className="trendChart" aria-label="최근 14일 문의 추이">
            {trend.map((item) => (
              <div className="trendColumn" key={item.dateKey}>
                <strong>{item.count}</strong>
                <div className="trendTrack">
                  <span style={{ height: `${Math.max((item.count / maxTrendCount) * 100, item.count ? 8 : 0)}%` }} />
                </div>
                <small>{item.dateKey.slice(5).replace("-", "/")}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboardBreakdownGrid">
          <MetricBreakdown title="대분류" items={categoryCounts} />
          <MetricBreakdown title="기관유형" items={institutionTypeCounts} />
          <MetricBreakdown title="처리 상태" items={handlingStatusCounts} />
        </div>
      </section>

      <section className="panel stack">
        <div>
          <h2>녹음 파일 업로드</h2>
          <p className="muted">업로드 후 문의자와 답변자를 구분하고, 통화 길이에 따라 2~6개 항목으로 정리합니다.</p>
        </div>
        <UploadForm />
      </section>

      <section className="panel stack">
        <div className="pageHeader">
          <div>
            <h2>내 상담 기록</h2>
            <p className="muted">전체 원문 대신 문의/답변 요약 항목을 확인하고 CSV 또는 Excel로 다운로드합니다.</p>
          </div>
          <div className="row">
            <Link className="button secondary" href="/api/records/export?format=csv">
              CSV 다운로드
            </Link>
            <Link className="button secondary" href="/api/records/export?format=xlsx">
              Excel 다운로드
            </Link>
            {user.role === "ADMIN" ? (
              <Link className="button secondary" href="/admin">
                관리자
              </Link>
            ) : null}
          </div>
        </div>
        {records.length === 0 ? (
          <div className="empty">아직 업로드한 기록이 없습니다.</div>
        ) : (
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>상태</th>
                  <th>파일명</th>
                  <th>문의자</th>
                  <th>대분류</th>
                  <th>문의 내용</th>
                  <th>답변 내용</th>
                  <th>접수일시</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <span className={statusClass(record.analysisStatus)}>{statusLabel(record.analysisStatus)}</span>
                    </td>
                    <td>{record.audioFileName}</td>
                    <td>{record.questionerType}</td>
                    <td>{record.mainCategory}</td>
                    <td>{renderSummary(record.inquirySummary)}</td>
                    <td>{renderSummary(record.answerSummary)}</td>
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
