import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { DEFAULT_STATUS, UNKNOWN } from "@/lib/consultation";
import { parseGalaxyRecordingFileName } from "@/lib/galaxyRecording";
import { processConsultationRecord } from "@/lib/processRecord";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/m4a",
  "audio/x-m4a",
  "audio/aac",
  "audio/webm",
  "video/mp4",
  "video/webm"
]);

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9가-힣._-]/g, "_");
}

function wantsJson(request: NextRequest) {
  return (request.headers.get("accept") ?? "").includes("application/json");
}

function redirectTo(request: NextRequest, pathName: string) {
  return NextResponse.redirect(new URL(pathName, request.url));
}

export async function POST(request: NextRequest) {
  const jsonResponse = wantsJson(request);

  try {
    const user = await requireUser();
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      return jsonResponse
        ? NextResponse.json({ message: "audio 파일이 필요합니다." }, { status: 400 })
        : redirectTo(request, "/dashboard?error=upload_failed");
    }

    if (audio.size > MAX_FILE_SIZE) {
      return jsonResponse
        ? NextResponse.json({ message: "파일은 최대 50MB까지 업로드할 수 있습니다." }, { status: 413 })
        : redirectTo(request, "/dashboard?error=upload_failed");
    }

    if (!ALLOWED_MIME_TYPES.has(audio.type)) {
      return jsonResponse
        ? NextResponse.json({ message: "지원하지 않는 오디오 형식입니다." }, { status: 400 })
        : redirectTo(request, "/dashboard?error=upload_failed");
    }

    const recordingInfo = parseGalaxyRecordingFileName(audio.name);
    const uploadDir = path.join(process.cwd(), "uploads", "audio");
    await mkdir(uploadDir, { recursive: true });

    const storedFileName = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(audio.name)}`;
    const absoluteFilePath = path.join(uploadDir, storedFileName);
    const relativeFilePath = path.join("uploads", "audio", storedFileName);
    const bytes = Buffer.from(await audio.arrayBuffer());
    await writeFile(absoluteFilePath, bytes);

    const record = await prisma.consultationRecord.create({
      data: {
        userId: user.id,
        audioFileName: audio.name,
        audioFilePath: relativeFilePath,
        audioMimeType: audio.type,
        audioFileSize: audio.size,
        analysisStatus: "PENDING",
        transcriptText: null,
        callType: "인바운드",
        registrationNo: "인바운드",
        receivedAt: recordingInfo?.receivedAt ?? new Date(),
        channel: "유선",
        questionerType: UNKNOWN,
        institutionName: UNKNOWN,
        questionerName: UNKNOWN,
        phoneNumber: recordingInfo?.phoneNumber ?? UNKNOWN,
        mainCategory: UNKNOWN,
        subCategory: UNKNOWN,
        inquirySummary: UNKNOWN,
        answerSummary: UNKNOWN,
        manager: UNKNOWN,
        status: DEFAULT_STATUS,
        priority: UNKNOWN
      }
    });

    const processedRecord = await processConsultationRecord(record.id);

    return jsonResponse
      ? NextResponse.json({ record: processedRecord }, { status: 201 })
      : redirectTo(request, "/dashboard");
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }

    console.error(error);
    return jsonResponse
      ? NextResponse.json({ message: "업로드 중 오류가 발생했습니다." }, { status: 500 })
      : redirectTo(request, "/dashboard?error=upload_failed");
  }
}
