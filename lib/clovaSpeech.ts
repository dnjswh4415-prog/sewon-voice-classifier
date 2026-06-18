import { readFile } from "fs/promises";

type ClovaSegment = {
  text?: string;
  speaker?: {
    label?: string;
    name?: string;
  };
  speakerLabel?: string;
  speakerName?: string;
  diarization?: {
    label?: string;
    name?: string;
  };
};

type ClovaResponse = {
  text?: string;
  segments?: ClovaSegment[];
  message?: string;
  code?: string;
};

export type ClovaTranscriptResult = {
  plainText: string;
  speakerText: string;
};

function getClovaSpeechUploadUrl(rawUrl: string) {
  const trimmed = rawUrl.trim().replace(/\/+$/, "");

  if (trimmed.endsWith("/recognizer/upload")) {
    return trimmed;
  }

  return `${trimmed}/recognizer/upload`;
}

function parseClovaResponse(resultText: string): ClovaResponse {
  try {
    return JSON.parse(resultText) as ClovaResponse;
  } catch {
    throw new Error(`CLOVA Speech 응답을 JSON으로 읽을 수 없습니다: ${resultText}`);
  }
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function getSpeakerKey(segment: ClovaSegment) {
  return (
    segment.speaker?.label ??
    segment.speaker?.name ??
    segment.speakerLabel ??
    segment.speakerName ??
    segment.diarization?.label ??
    segment.diarization?.name ??
    "speaker-1"
  );
}

function buildSpeakerTranscript(segments: ClovaSegment[]) {
  const speakerOrder: string[] = [];
  const groupedLines: Array<{ speakerKey: string; text: string }> = [];

  for (const segment of segments) {
    const text = normalizeText(segment.text ?? "");
    if (!text) continue;

    const speakerKey = getSpeakerKey(segment);
    if (!speakerOrder.includes(speakerKey)) {
      speakerOrder.push(speakerKey);
    }

    const lastLine = groupedLines[groupedLines.length - 1];
    if (lastLine?.speakerKey === speakerKey) {
      lastLine.text = normalizeText(`${lastLine.text} ${text}`);
    } else {
      groupedLines.push({ speakerKey, text });
    }
  }

  const speakerName = (speakerKey: string) => {
    const index = speakerOrder.indexOf(speakerKey);
    if (index === 0) return "문의자";
    if (index === 1) return "답변자";
    return `화자${index + 1}`;
  };

  return groupedLines.map((line) => `${speakerName(line.speakerKey)}: ${line.text}`).join("\n");
}

export async function transcribeWithClovaSpeech(filePath: string, mimeType: string): Promise<ClovaTranscriptResult> {
  const invokeUrl = process.env.CLOVA_SPEECH_URL;
  const secret = process.env.CLOVA_SPEECH_SECRET;

  if (!invokeUrl || !secret) {
    throw new Error("CLOVA_SPEECH_URL 또는 CLOVA_SPEECH_SECRET이 설정되지 않았습니다.");
  }

  const uploadUrl = getClovaSpeechUploadUrl(invokeUrl);
  const audio = await readFile(filePath);
  const formData = new FormData();

  formData.append(
    "params",
    JSON.stringify({
      language: "ko-KR",
      completion: "sync",
      wordAlignment: false,
      fullText: true,
      diarization: {
        enable: true
      }
    })
  );
  formData.append("media", new Blob([audio], { type: mimeType }), "audio-file");

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "X-CLOVASPEECH-API-KEY": secret
    },
    body: formData
  });

  const resultText = await response.text();
  const result = parseClovaResponse(resultText);

  if (!response.ok) {
    const message = result.message ?? resultText;
    throw new Error(`CLOVA Speech 요청 실패: ${response.status} ${message}`);
  }

  const segments = result.segments ?? [];
  const plainTextFromSegments = normalizeText(segments.map((segment) => segment.text ?? "").join(" "));
  const plainText = plainTextFromSegments || normalizeText(result.text ?? "");
  const speakerText = segments.length > 0 ? buildSpeakerTranscript(segments) : plainText;

  return {
    plainText,
    speakerText
  };
}
