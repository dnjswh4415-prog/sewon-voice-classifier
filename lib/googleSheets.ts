import type { ConsultationRecord } from "@prisma/client";
import { google } from "googleapis";
import { UNKNOWN } from "@/lib/consultation";

type GoogleSheetsConfig = {
  spreadsheetId: string;
  sheetName: string;
  clientEmail: string;
  privateKey: string;
};

export type GoogleSheetDashboardRecord = {
  callType: string;
  receivedAt: string;
  questionerType: string;
  mainCategory: string;
  status: string;
  analysisStatus: string;
};

const DEFAULT_TEMPLATE_COLUMNS: Record<string, number> = {
  구분: 0,
  등록번호: 1,
  접수일시: 2,
  채널: 3,
  문의자구분: 4,
  기관명: 5,
  문의자명: 6,
  연락처: 7,
  대분류: 8,
  소분류: 9,
  문의내용: 10,
  담당자: 11,
  상태: 12,
  우선순위: 13,
  처리완료일시: 14,
  답변내용: 15,
  처리시간: 16,
  음성파일명: 17,
  분석상태: 18,
  오류메시지: 19
};

function normalizeHeader(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function createSheetsClient(config: GoogleSheetsConfig) {
  const auth = new google.auth.JWT({
    email: config.clientEmail,
    key: config.privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  return google.sheets({ version: "v4", auth });
}

function normalizePrivateKey(rawKey: string) {
  let key = rawKey.trim();

  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }

  key = key.replace(/\\n/g, "\n");

  if (!key.includes("-----BEGIN PRIVATE KEY-----") || !key.includes("-----END PRIVATE KEY-----")) {
    throw new Error("GOOGLE_PRIVATE_KEY 형식이 올바르지 않습니다. 서비스 계정 JSON의 private_key 값을 그대로 넣어주세요.");
  }

  return key;
}

function parseServiceAccountJson() {
  const rawJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!rawJson) {
    return null;
  }

  const trimmed = rawJson.trim();
  const jsonText = trimmed.startsWith("{") ? trimmed : Buffer.from(trimmed, "base64").toString("utf8");
  const parsed = JSON.parse(jsonText) as {
    client_email?: string;
    private_key?: string;
  };

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON 안에 client_email 또는 private_key가 없습니다.");
  }

  return {
    clientEmail: parsed.client_email,
    privateKey: normalizePrivateKey(parsed.private_key)
  };
}

function getGoogleSheetsConfig(): GoogleSheetsConfig | null {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const sheetName = process.env.GOOGLE_SHEETS_SHEET_NAME || "통합데이터";
  const serviceAccount = parseServiceAccountJson();
  const clientEmail = serviceAccount?.clientEmail ?? process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawPrivateKey = serviceAccount?.privateKey ?? process.env.GOOGLE_PRIVATE_KEY;

  if (!spreadsheetId || !clientEmail || !rawPrivateKey) {
    return null;
  }

  return {
    spreadsheetId,
    sheetName,
    clientEmail,
    privateKey: serviceAccount?.privateKey ?? normalizePrivateKey(rawPrivateKey)
  };
}

function formatDate(date: Date | null) {
  return date ? date.toLocaleString("ko-KR") : UNKNOWN;
}

function recordValues(record: ConsultationRecord): Record<string, string> {
  return {
    구분: record.callType,
    등록번호: record.registrationNo,
    접수일시: formatDate(record.receivedAt),
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
    처리완료일시: formatDate(record.completedAt),
    답변내용: record.answerSummary,
    처리시간: record.processingTime ? `${record.processingTime}초` : UNKNOWN,
    음성파일명: record.audioFileName,
    분석상태: record.analysisStatus,
    오류메시지: record.errorMessage ?? ""
  };
}

async function readPreparedSheet(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  sheetName: string
) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z10000`
  });
  const rows = response.data.values ?? [];
  const headerMap = new Map<string, number>();

  for (const row of rows.slice(0, 10)) {
    row.forEach((cell, index) => {
      const header = normalizeHeader(String(cell ?? ""));
      if (header && !headerMap.has(header)) {
        headerMap.set(header, index);
      }
    });
  }

  const lastNonEmptyIndex = rows.reduce((lastIndex, row, index) => {
    const hasValue = row.some((cell) => String(cell ?? "").trim().length > 0);
    return hasValue ? index : lastIndex;
  }, -1);

  return {
    headerMap,
    nextRowNumber: Math.max(lastNonEmptyIndex + 2, 2)
  };
}

function buildRow(record: ConsultationRecord, headerMap: Map<string, number>) {
  const values = recordValues(record);
  const columnMap = new Map<string, number>();

  for (const [key, fallbackIndex] of Object.entries(DEFAULT_TEMPLATE_COLUMNS)) {
    columnMap.set(key, headerMap.get(key) ?? fallbackIndex);
  }

  const width = Math.max(26, ...Array.from(columnMap.values()).map((index) => index + 1));
  const row = Array.from({ length: width }, () => "");

  for (const [key, value] of Object.entries(values)) {
    const columnIndex = columnMap.get(key);
    if (columnIndex !== undefined) {
      row[columnIndex] = value;
    }
  }

  return row;
}

function findHeaderRow(rows: unknown[][]) {
  const knownHeaders = new Set([
    ...Object.keys(DEFAULT_TEMPLATE_COLUMNS),
    "기관유형"
  ].map(normalizeHeader));
  let bestRowIndex = -1;
  let bestMatchCount = 0;

  rows.slice(0, 20).forEach((row, rowIndex) => {
    const matchCount = row.reduce<number>((count, cell) => {
      return count + (knownHeaders.has(normalizeHeader(String(cell ?? ""))) ? 1 : 0);
    }, 0);

    if (matchCount > bestMatchCount) {
      bestRowIndex = rowIndex;
      bestMatchCount = matchCount;
    }
  });

  return bestMatchCount >= 2 ? bestRowIndex : -1;
}

function cellValue(row: unknown[], headerMap: Map<string, number>, ...headers: string[]) {
  for (const header of headers) {
    const index = headerMap.get(normalizeHeader(header));
    if (index !== undefined) {
      return String(row[index] ?? "").trim();
    }
  }

  return "";
}

export async function getGoogleSheetDashboardRecords(): Promise<GoogleSheetDashboardRecord[] | null> {
  const config = getGoogleSheetsConfig();

  if (!config) {
    return null;
  }

  const sheets = createSheetsClient(config);
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: config.spreadsheetId,
    range: `${config.sheetName}!A1:Z10000`,
    valueRenderOption: "FORMATTED_VALUE",
    dateTimeRenderOption: "FORMATTED_STRING"
  });
  const rows = (response.data.values ?? []) as unknown[][];
  const headerRowIndex = findHeaderRow(rows);

  if (headerRowIndex === -1) {
    throw new Error("Google Sheet에서 상담 기록 헤더를 찾지 못했습니다.");
  }

  const headerMap = new Map<string, number>();
  rows[headerRowIndex].forEach((cell, index) => {
    const header = normalizeHeader(String(cell ?? ""));
    if (header && !headerMap.has(header)) {
      headerMap.set(header, index);
    }
  });

  return rows
    .slice(headerRowIndex + 1)
    .map((row) => ({
      callType: cellValue(row, headerMap, "구분") || UNKNOWN,
      receivedAt: cellValue(row, headerMap, "접수일시"),
      questionerType: cellValue(row, headerMap, "문의자구분", "기관유형") || UNKNOWN,
      mainCategory: cellValue(row, headerMap, "대분류") || UNKNOWN,
      status: cellValue(row, headerMap, "상태") || UNKNOWN,
      analysisStatus: cellValue(row, headerMap, "분석상태") || UNKNOWN
    }))
    .filter((record) =>
      [record.callType, record.receivedAt, record.questionerType, record.mainCategory, record.status].some(
        (value) => value && value !== UNKNOWN
      )
    );
}

export async function appendConsultationRecordToGoogleSheet(record: ConsultationRecord) {
  const config = getGoogleSheetsConfig();

  if (!config) {
    return { skipped: true };
  }

  const sheets = createSheetsClient(config);
  const preparedSheet = await readPreparedSheet(sheets, config.spreadsheetId, config.sheetName);

  await sheets.spreadsheets.values.update({
    spreadsheetId: config.spreadsheetId,
    range: `${config.sheetName}!A${preparedSheet.nextRowNumber}:Z${preparedSheet.nextRowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [buildRow(record, preparedSheet.headerMap)]
    }
  });

  return { skipped: false };
}
