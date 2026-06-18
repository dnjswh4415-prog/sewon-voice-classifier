import type { ConsultationRecord, User } from "@prisma/client";
import { formatPhoneNumber } from "@/lib/phone";

export const UNKNOWN = "파악불가";
export const DEFAULT_STATUS = "접수";

export type ConsultationAnalysis = {
  transcriptText: string | null;
  callType: string;
  registrationNo: string;
  channel: string;
  questionerType: string;
  institutionName: string;
  questionerName: string;
  phoneNumber: string;
  mainCategory: string;
  subCategory: string;
  inquirySummary: string;
  answerSummary: string;
  manager: string;
  status: string;
  priority: string;
  processingTime: number | null;
};

export type ConsultationExportRow = {
  구분: string;
  등록번호: string;
  접수일시: string;
  채널: string;
  문의자구분: string;
  기관명: string;
  문의자명: string;
  연락처: string;
  대분류: string;
  소분류: string;
  문의내용: string;
  담당자: string;
  상태: string;
  우선순위: string;
  처리완료일시: string;
  답변내용: string;
  처리시간: string;
  음성파일명: string;
  분석상태: string;
  업로드사용자: string;
};

const QUESTIONER_RULES = [
  { value: "운영기관", keywords: ["운영기관", "기관", "센터", "담당자", "원장"] },
  { value: "교사", keywords: ["교사", "선생님", "담임"] },
  { value: "학부모", keywords: ["학부모", "엄마", "아빠", "어머니", "아버지", "보호자"] },
  { value: "학생", keywords: ["학생", "수강생", "아이"] },
  { value: "기타", keywords: ["기타"] }
];

const CATEGORY_RULES = [
  { main: "운영", sub: "프로그램 신청문의", keywords: ["프로그램", "신청", "모집", "마감", "기간", "일정", "운영"] },
  { main: "운영", sub: "신청기간", keywords: ["신청기간", "운영기간", "언제", "시작"] },
  { main: "LMS", sub: "로그인 문제", keywords: ["로그인", "비밀번호", "계정", "아이디", "접속", "오류", "LMS", "엘엠에스"] },
  { main: "LMS", sub: "학습/수강", keywords: ["수강", "진도", "강의", "영상", "학습", "과제"] },
  { main: "교구재", sub: "교구재 배송", keywords: ["교구", "교재", "배송", "수령", "택배", "누락", "파손"] }
];

function includesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword));
}

export function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

export function sanitizeInstitutionName(value: string | null | undefined) {
  const normalized = normalizeText(value ?? "");

  if (!normalized || normalized === UNKNOWN) {
    return UNKNOWN;
  }

  const compact = normalized.replace(/\s+/g, "");
  if (compact.includes("디지털새싹운영사무국")) {
    return UNKNOWN;
  }

  return normalized;
}

function lineTextOnly(line: string) {
  return normalizeText(line.replace(/^(문의자|답변자|화자\d+):\s*/, ""));
}

function getSpeakerLines(text: string, speaker: "문의자" | "답변자") {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith(`${speaker}:`))
    .map(lineTextOnly)
    .filter(Boolean);
}

function splitSentences(text: string) {
  const normalized = normalizeText(text);
  const sentences = normalized
    .split(/(?<=[.!?。！？])\s+|[\n\r]+/)
    .map(lineTextOnly)
    .filter(Boolean);

  if (sentences.length > 1) {
    return sentences;
  }

  const chunks = normalized.match(/.{1,80}(?:\s|$)/g)?.map((chunk) => chunk.trim()).filter(Boolean) ?? [];
  return chunks.length > 0 ? chunks : normalized ? [normalized] : [];
}

export function summaryCount(text: string, audioDuration?: number | null) {
  if (audioDuration) {
    if (audioDuration <= 20) return 2;
    if (audioDuration <= 60) return 3;
    if (audioDuration <= 120) return 4;
    if (audioDuration <= 240) return 5;
    return 6;
  }

  const length = normalizeText(text).length;
  if (length <= 140) return 2;
  if (length <= 320) return 3;
  if (length <= 650) return 4;
  if (length <= 1000) return 5;
  return 6;
}

export function numberedSummary(lines: string[], text: string, audioDuration?: number | null) {
  const count = summaryCount(text, audioDuration);
  const source = lines.length > 0 ? lines : splitSentences(text);
  const picked = source.slice(0, count).map((line) => normalizeText(line)).filter(Boolean);

  if (picked.length === 0) {
    return UNKNOWN;
  }

  return picked.map((line, index) => `${index + 1}. ${line}`).join("\n");
}

function extractPhoneNumber(text: string) {
  const match = text.match(/(?<!\d)(?:(?:\+?82[-\s.]?)?0\d{1,2}[-\s.]?\d{3,4}[-\s.]?\d{4})(?!\d)/);
  return formatPhoneNumber(match?.[0]) ?? UNKNOWN;
}

function extractName(text: string) {
  const match = text.match(/(?:저는|이름은|문의자(?:는)?|학부모)\s*([가-힣]{2,4})(?:입니다|인데요|이고요|이에요|예요)?/);
  return match?.[1] ?? UNKNOWN;
}

function extractInstitution(text: string) {
  const match = text.match(/([가-힣A-Za-z0-9\s]{2,30}(?:학교|유치원|어린이집|센터|기관|학원|교육원|초등학교|중학교|고등학교))/);
  return sanitizeInstitutionName(match?.[1]);
}

function detectQuestionerType(text: string) {
  return QUESTIONER_RULES.find((rule) => includesAny(text, rule.keywords))?.value ?? UNKNOWN;
}

function detectCategory(text: string) {
  const rule = CATEGORY_RULES.find((item) => includesAny(text, item.keywords));
  return {
    mainCategory: rule?.main ?? UNKNOWN,
    subCategory: rule?.sub ?? UNKNOWN
  };
}

export function detectPriority(text: string) {
  if (
    includesAny(text, [
      "빨리",
      "급하다",
      "급합니다",
      "급한",
      "급하게",
      "가능하면 빠른 시일 내에",
      "가능하면 빠른 시일내에",
      "빠른 시일 내에",
      "빠른 시일내에",
      "급히",
      "시급히",
      "시급하다",
      "시급합니다"
    ])
  ) {
    return "긴급";
  }

  if (includesAny(text, ["민원", "불만", "항의", "환불", "신고", "화가", "문제 제기", "컴플레인"])) {
    return "민원";
  }

  if (text.trim().length > 0) {
    return "일반";
  }

  return UNKNOWN;
}

export function analyzeTranscript(transcriptText: string, audioDuration?: number | null): ConsultationAnalysis {
  const normalized = normalizeText(transcriptText);

  if (!normalized) {
    return {
      transcriptText: null,
      callType: "인바운드",
      registrationNo: "인바운드",
      channel: UNKNOWN,
      questionerType: UNKNOWN,
      institutionName: UNKNOWN,
      questionerName: UNKNOWN,
      phoneNumber: UNKNOWN,
      mainCategory: UNKNOWN,
      subCategory: UNKNOWN,
      inquirySummary: UNKNOWN,
      answerSummary: UNKNOWN,
      manager: UNKNOWN,
      status: UNKNOWN,
      priority: UNKNOWN,
      processingTime: audioDuration ?? null
    };
  }

  const category = detectCategory(normalized);
  const inquiryLines = getSpeakerLines(transcriptText, "문의자");
  const answerLines = getSpeakerLines(transcriptText, "답변자");

  return {
    transcriptText,
    callType: "인바운드",
    registrationNo: "인바운드",
    channel: UNKNOWN,
    questionerType: detectQuestionerType(normalized),
    institutionName: extractInstitution(normalized),
    questionerName: extractName(normalized),
    phoneNumber: extractPhoneNumber(normalized),
    mainCategory: category.mainCategory,
    subCategory: category.subCategory,
    inquirySummary: numberedSummary(inquiryLines, normalized, audioDuration),
    answerSummary: answerLines.length > 0 ? numberedSummary(answerLines, normalized, audioDuration) : UNKNOWN,
    manager: UNKNOWN,
    status: UNKNOWN,
    priority: detectPriority(normalized),
    processingTime: audioDuration ?? null
  };
}

export function toExportRow(record: ConsultationRecord & { user?: Pick<User, "name" | "email"> }): ConsultationExportRow {
  return {
    구분: record.callType,
    등록번호: record.registrationNo,
    접수일시: record.receivedAt ? record.receivedAt.toLocaleString("ko-KR") : UNKNOWN,
    채널: record.channel,
    문의자구분: record.questionerType,
    기관명: record.institutionName,
    문의자명: record.questionerName,
    연락처: record.phoneNumber,
    대분류: record.mainCategory,
    소분류: record.subCategory,
    문의내용: record.inquirySummary,
    담당자: record.manager,
    상태: record.status,
    우선순위: record.priority,
    처리완료일시: record.completedAt ? record.completedAt.toLocaleString("ko-KR") : UNKNOWN,
    답변내용: record.answerSummary,
    처리시간: record.processingTime ? `${record.processingTime}초` : UNKNOWN,
    음성파일명: record.audioFileName,
    분석상태: record.analysisStatus,
    업로드사용자: record.user ? `${record.user.name} (${record.user.email})` : UNKNOWN
  };
}
