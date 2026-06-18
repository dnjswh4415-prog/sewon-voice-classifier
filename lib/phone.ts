export function formatPhoneNumber(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  let digits = value.replace(/\D/g, "");

  if (digits.startsWith("82") && (digits.length === 11 || digits.length === 12)) {
    digits = `0${digits.slice(2)}`;
  }

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    if (digits.startsWith("02")) {
      return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
    }

    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  if (digits.length === 9 && digits.startsWith("02")) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
  }

  return null;
}
