/**
 * Utilities untuk normalisasi nomor HP.
 *
 * Aturan normalisasi:
 * - Strip semua karakter non-digit (+, -, spasi, kurung, dll)
 * - Jika diawali 0 → ganti dengan 62 (kode negara Indonesia)
 * - Kode negara lain tetap dipertahankan
 *
 * Contoh:
 *   0812-3456-7890  → 6281234567890
 *   +62 812 3456 7890 → 6281234567890
 *   +1 818 853 6469  → 18188536469
 *   +44 7526 756866  → 447526756866
 */

/**
 * Normalisasi nomor HP:
 * - Strip semua karakter non-digit
 * - Jika diawali 0 → ganti dengan 62
 */
export function normalizePhone(phone: string | null | undefined): string {
  if (!phone) return "";

  // Strip semua karakter selain angka
  const digitsOnly = phone.replace(/[^0-9]/g, "");

  if (!digitsOnly) return "";

  // Jika diawali 0, ganti dengan kode negara 62
  if (digitsOnly.startsWith("0")) {
    return "62" + digitsOnly.slice(1);
  }

  return digitsOnly;
}

/**
 * Cek apakah nomor sudah cukup panjang untuk dianggap valid (minimal 7 digit).
 * Tidak membatasi kode negara — semua negara diterima.
 */
export function isValidPhone(normalizedPhone: string): boolean {
  return normalizedPhone.length >= 7;
}

/**
 * Normalisasi + validasi sekaligus.
 * Return null jika terlalu pendek atau kosong.
 */
export function normalizeAndValidatePhone(
  phone: string | null | undefined,
): string | null {
  const normalized = normalizePhone(phone);

  return isValidPhone(normalized) ? normalized : null;
}
