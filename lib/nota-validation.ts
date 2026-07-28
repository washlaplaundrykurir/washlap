export const NOTA_VALIDATION_MESSAGE =
  "Nomor nota harus lebih dari 5 karakter, diawali huruf, dan diakhiri angka.";

export function isValidNomorNota(value: string): boolean {
  const nota = value.trim();

  return nota.length > 5 && /^[A-Za-z].*\d$/.test(nota);
}
