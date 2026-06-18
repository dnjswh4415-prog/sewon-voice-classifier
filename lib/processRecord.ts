import path from "path";
import { prisma } from "@/lib/prisma";
import { UNKNOWN, analyzeTranscript } from "@/lib/consultation";
import { analyzeTranscriptWithClaude } from "@/lib/claudeAnalysis";
import { transcribeWithClovaSpeech } from "@/lib/clovaSpeech";
import { appendConsultationRecordToGoogleSheet } from "@/lib/googleSheets";

export async function processConsultationRecord(recordId: number) {
  const record = await prisma.consultationRecord.findUnique({
    where: { id: recordId }
  });

  if (!record) {
    throw new Error("상담 기록을 찾을 수 없습니다.");
  }

  await prisma.consultationRecord.update({
    where: { id: recordId },
    data: {
      analysisStatus: "PROCESSING",
      errorMessage: null
    }
  });

  try {
    const absolutePath = path.join(process.cwd(), record.audioFilePath);
    const transcript = await transcribeWithClovaSpeech(absolutePath, record.audioMimeType);
    const analysisSource = transcript.speakerText || transcript.plainText;
    const fallbackAnalysis = analyzeTranscript(analysisSource, record.audioDuration);
    const claudeAnalysis = await analyzeTranscriptWithClaude(analysisSource, record.audioDuration).catch((error) => {
      console.warn("Claude analysis failed, using rule-based fallback:", error);
      return null;
    });
    const analysis = claudeAnalysis ?? fallbackAnalysis;
    const phoneNumber =
      analysis.phoneNumber !== UNKNOWN
        ? analysis.phoneNumber
        : fallbackAnalysis.phoneNumber !== UNKNOWN
          ? fallbackAnalysis.phoneNumber
          : record.phoneNumber;

    const updatedRecord = await prisma.consultationRecord.update({
      where: { id: recordId },
      data: {
        ...analysis,
        phoneNumber,
        channel: analysis.channel !== UNKNOWN ? analysis.channel : record.channel,
        analysisStatus: "COMPLETED",
        aiConfidence: transcript.plainText.trim() ? (claudeAnalysis ? 0.9 : 0.7) : null,
        errorMessage: null
      }
    });

    await appendConsultationRecordToGoogleSheet(updatedRecord).catch((error) => {
      console.warn("Google Sheets append failed:", error);
    });

    return updatedRecord;
  } catch (error) {
    const message = error instanceof Error ? error.message : "분석 중 알 수 없는 오류가 발생했습니다.";

    return prisma.consultationRecord.update({
      where: { id: recordId },
      data: {
        analysisStatus: "FAILED",
        errorMessage: message
      }
    });
  }
}
