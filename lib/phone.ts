/**
 * Utilities untuk normalisasi dan validasi nomor HP Indonesia.
 * Format standar: 08xxxxxxxxxx (10-13 digit, mulai dengan 08).
 */

/**
 * Normalisasi nomor HP ke format 08xxx.
 * - Strip semua karakter non-digit
 * - `62...` → `0...`
 * - `+62...` → `0...` (setelah strip jadi `62...`)
 *
 * Tidak melakukan validasi — hanya transformasi.
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digitsOnly = phone.replace(/[^0-9]/g, "");
  if (digitsOnly.startsWith("62")) {
    return "0" + digitsOnly.slice(2);
  }
  return digitsOnly;
}

/**
 * Cek apakah nomor (yang sudah dinormalisasi) sesuai format Indonesia yang valid.
 * Format: 08 + 8-11 digit = total 10-13 karakter.
 */
export function isValidPhone(normalizedPhone: string): boolean {
  return /^08[0-9]{8,11}$/.test(normalizedPhone);
}

/**
 * Normalisasi + validasi sekaligus.
 * Return null jika tidak valid.
 */
export function normalizeAndValidatePhone(
  phone: string | null | undefined,
): string | null {
  const normalized = normalizePhone(phone);
  return isValidPhone(normalized) ? normalized : null;
}
