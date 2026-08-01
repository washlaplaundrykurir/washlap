export const NOTA_VALIDATION_MESSAGE =
  "Nomor nota harus lebih dari 5 karakter, diawali dengan huruf, dan diakhiri dengan angka (Contoh: TJI260528201554390).";

export function isValidNomorNota(value: string): boolean {
  const nota = value.trim();

  return nota.length > 5 && /^[A-Za-z].*\d$/.test(nota);
}
