import * as XLSX from "xlsx";
import type { ConsultationExportRow } from "@/lib/consultation";

const csvHeaders: Array<keyof ConsultationExportRow> = [
  "구분",
  "등록번호",
  "접수일시",
  "채널",
  "문의자구분",
  "기관명",
  "문의자명",
  "연락처",
  "대분류",
  "소분류",
  "문의내용",
  "담당자",
  "상태",
  "우선순위",
  "처리완료일시",
  "답변내용",
  "처리시간",
  "음성파일명",
  "분석상태",
  "업로드사용자"
];

const templateHeaders = [
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "대분류",
  "소분류",
  "문의 내용",
  "",
  "",
  "",
  "",
  "답변 내용",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  ""
];

const templateColumnWidths = [
  14.29,
  8.57,
  9.86,
  9.29,
  12.43,
  14.71,
  8,
  12.29,
  11.14,
  16.43,
  157.57,
  10.86,
  9.29,
  9.71,
  11,
  201.29,
  7.57,
  7.71,
  7.57,
  7.57,
  8,
  8,
  8,
  8
];

function escapeCsvValue(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

export function createCsv(rows: ConsultationExportRow[]) {
  const lines = [
    csvHeaders.map(escapeCsvValue).join(","),
    ...rows.map((row) => csvHeaders.map((header) => escapeCsvValue(row[header])).join(","))
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

function toTemplateRow(row: ConsultationExportRow) {
  return [
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    row.대분류,
    row.소분류,
    row.문의내용,
    "",
    "",
    "",
    "",
    row.답변내용,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    ""
  ];
}

export function createXlsx(rows: ConsultationExportRow[]) {
  const data = [templateHeaders, ...rows.map(toTemplateRow)];
  const worksheet = XLSX.utils.aoa_to_sheet(data);

  worksheet["!cols"] = templateColumnWidths.map((width) => ({ wch: width }));
  worksheet["!rows"] = data.map((_, index) => ({ hpt: index === 0 ? 22 : 42 }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "통합데이터");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
