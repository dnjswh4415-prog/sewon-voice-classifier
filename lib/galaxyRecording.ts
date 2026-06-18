import { formatPhoneNumber } from "@/lib/phone";

export type GalaxyRecordingInfo = {
  phoneNumber: string;
  receivedAt: Date;
};

export function parseGalaxyRecordingFileName(fileName: string): GalaxyRecordingInfo | null {
  const baseName = fileName.replace(/\.[^.]+$/, "");
  const match = baseName.match(/^통화녹음_(\d{2,12})_(\d{6})_(\d{6})$/);

  if (!match) {
    return null;
  }

  const [, rawPhoneNumber, datePart, timePart] = match;
  const year = 2000 + Number(datePart.slice(0, 2));
  const month = Number(datePart.slice(2, 4));
  const day = Number(datePart.slice(4, 6));
  const hour = Number(timePart.slice(0, 2));
  const minute = Number(timePart.slice(2, 4));
  const second = Number(timePart.slice(4, 6));
  const receivedAt = new Date(year, month - 1, day, hour, minute, second);
  const phoneNumber = formatPhoneNumber(rawPhoneNumber);

  if (Number.isNaN(receivedAt.getTime()) || !phoneNumber) {
    return null;
  }

  return {
    phoneNumber,
    receivedAt
  };
}
