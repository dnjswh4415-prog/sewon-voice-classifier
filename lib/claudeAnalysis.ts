import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import {
  DEFAULT_STATUS,
  UNKNOWN,
  type ConsultationAnalysis,
  detectPriority,
  numberedSummary,
  normalizeText,
  sanitizeInstitutionName
} from "@/lib/consultation";
import { formatPhoneNumber } from "@/lib/phone";

const claudeSchema = z.object({
  questionerType: z.string().optional(),
  institutionName: z.string().optional(),
  questionerName: z.string().optional(),
  phoneNumber: z.string().optional(),
  mainCategory: z.string().optional(),
  subCategory: z.string().optional(),
  inquirySummary: z.array(z.string()).optional(),
  answerSummary: z.array(z.string()).optional(),
  priority: z.string().optional()
});

function cleanValue(value: unknown) {
  if (typeof value !== "string") return UNKNOWN;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : UNKNOWN;
}

function cleanPhoneNumber(value: unknown) {
  if (typeof value !== "string") return UNKNOWN;
  return formatPhoneNumber(value) ?? UNKNOWN;
}

function cleanList(values: string[] | undefined, fallbackText: string, audioDuration?: number | null) {
  const cleaned = values?.map((value) => normalizeText(value)).filter(Boolean) ?? [];
  return numberedSummary(cleaned, fallbackText, audioDuration);
}

function extractJson(text: string) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.match(/\{[\s\S]*\}/)?.[0] ?? text;
  return JSON.parse(candidate);
}

export async function analyzeTranscriptWithClaude(
  transcriptText: string,
  audioDuration?: number | null
): Promise<ConsultationAnalysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
  const normalized = normalizeText(transcriptText);

  if (!apiKey || !normalized) {
    return null;
  }

  const client = new Anthropic({ apiKey });
  const itemCount = Math.min(Math.max(audioDuration ? Math.ceil(audioDuration / 60) + 1 : Math.ceil(normalized.length / 220), 2), 6);

  const message = await client.messages.create({
    model,
    max_tokens: 1600,
    temperature: 0,
    system:
      "너는 한국어 상담 녹취를 상담 접수 기록으로 구조화하는 도구다. 녹취에 있는 내용만 사용하고, 없는 정보는 반드시 '파악불가'로 작성한다. 답변을 새로 만들거나 추측하지 않는다. '디지털새싹 운영사무국'은 상담을 받은 내부 조직이므로 기관명에 절대 넣지 않는다.",
    messages: [
      {
        role: "user",
        content: `아래 상담 녹취를 JSON 하나로만 정리해줘.

규칙:
- 문의내용과 답변내용은 각각 ${itemCount}개 이내의 짧은 항목 배열로 작성한다.
- 문의내용은 문의자가 실제로 물어본 내용만 정리한다.
- 답변내용은 답변자가 실제로 말한 안내/답변만 정리한다. 녹취에 답변이 없으면 ["파악불가"].
- 대분류는 운영, LMS, 교구재, 파악불가 중 하나.
- 우선순위는 긴급, 민원, 일반, 파악불가 중 하나.
- 녹취에 '빨리', '급하다', '가능하면 빠른 시일 내에', '급히', '시급히'처럼 신속한 처리를 요청하는 표현이 있으면 우선순위는 "긴급".
- 기관명에 '디지털새싹 운영사무국', '디지털새싹운영사무국', '운영사무국'은 넣지 않는다.
- 모든 필드는 녹취 근거가 없으면 "파악불가".
- JSON 외의 설명은 절대 쓰지 않는다.

JSON 형식:
{
  "questionerType": "운영기관|교사|학부모|학생|기타|파악불가",
  "institutionName": "string",
  "questionerName": "string",
  "phoneNumber": "string",
  "mainCategory": "운영|LMS|교구재|파악불가",
  "subCategory": "string",
  "inquirySummary": ["string"],
  "answerSummary": ["string"],
  "priority": "긴급|민원|일반|파악불가"
}

녹취:
${transcriptText}`
      }
    ]
  });

  const text = message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  const parsed = claudeSchema.parse(extractJson(text));

  return {
    transcriptText,
    callType: "인바운드",
    registrationNo: "인바운드",
    channel: UNKNOWN,
    questionerType: cleanValue(parsed.questionerType),
    institutionName: sanitizeInstitutionName(parsed.institutionName),
    questionerName: cleanValue(parsed.questionerName),
    phoneNumber: cleanPhoneNumber(parsed.phoneNumber),
    mainCategory: cleanValue(parsed.mainCategory),
    subCategory: cleanValue(parsed.subCategory),
    inquirySummary: cleanList(parsed.inquirySummary, normalized, audioDuration),
    answerSummary: cleanList(parsed.answerSummary, normalized, audioDuration),
    manager: UNKNOWN,
    status: DEFAULT_STATUS,
    priority: detectPriority(normalized) === "긴급" ? "긴급" : cleanValue(parsed.priority),
    processingTime: audioDuration ?? null
  };
}
