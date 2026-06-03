/**
 * Pure WhatsApp helpers for the admin ticket-creation flow.
 *
 * All functions in this module are PURE: no DOM access, no network calls,
 * and deterministic given their inputs. Phone normalization is delegated to
 * `lib/phone.ts` (`normalizePhone`, `isValidPhone`) and never reimplemented.
 *
 * Feature: admin-ticket-wa-and-duplicate-warnings (Requirement 1).
 */

import { normalizePhone, isValidPhone } from "./phone";

/**
 * Minimal shape needed to render a ticket WA message. Sourced from the saved
 * record returned by `POST /api/orders` (OQ-4), never raw form input.
 */
export interface TicketWaData {
  nomor_tiket: string;
  jenis_tugas: "ANTAR" | "JEMPUT";
  alamat_jalan: string | null;
  waktu_penjemputan: string | null; // ISO timestamp or null
  nama: string | null;
  nomor_hp: string; // normalized 62xxx from the saved record
  catatan_khusus: string | null;
}

/**
 * "ANTAR" -> "antar", "JEMPUT" -> "jemput" (Req 1.4).
 */
export function activityWord(jenis: "ANTAR" | "JEMPUT"): "antar" | "jemput" {
  return jenis === "ANTAR" ? "antar" : "jemput";
}

/**
 * Render "-" for null/empty/whitespace-only, else the trimmed value (Req 1.8).
 */
export function dashIfEmpty(value: string | null | undefined): string {
  if (value == null) return "-";
  const trimmed = value.trim();
  return trimmed === "" ? "-" : trimmed;
}

/**
 * Format an ISO timestamp using the id-ID locale with both date (day, month,
 * year) and time (Req 1.7). Returns "-" when the value is missing/blank or
 * cannot be parsed into a valid date (Req 1.8).
 *
 * A fixed `Asia/Jakarta` time zone is used so the output is deterministic
 * across environments and appropriate for the Indonesian audience.
 */
export function formatWaktu(iso: string | null | undefined): string {
  if (iso == null || iso.trim() === "") return "-";

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";

  try {
    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jakarta",
    }).format(date);
  } catch {
    return "-";
  }
}

/**
 * Convert any phone input to international `62xxx` form (Req 1.5).
 * Delegates to `normalizePhone` from `lib/phone.ts`.
 */
export function to62(phone: string | null | undefined): string {
  return normalizePhone(phone);
}

/**
 * Convert any phone input to the local `08xxxxxxxx` display form (Req 3.10).
 *
 * The input is first normalized to `62xxx`; a leading `62` is then replaced
 * with `0`. Non-Indonesian numbers (no `62` prefix) are returned normalized
 * as-is so that `to62(toLocal08(x)) === to62(x)` round-trips stably.
 */
export function toLocal08(phone: string | null | undefined): string {
  const normalized = normalizePhone(phone);
  if (!normalized) return "";
  if (normalized.startsWith("62")) {
    return "0" + normalized.slice(2);
  }
  return normalized;
}

/**
 * Build the Indonesian confirmation message with all placeholders filled and
 * no literal placeholder braces remaining (Req 1.3, 1.4, 1.7, 1.8).
 *
 * The message is assembled via direct interpolation, so the template tokens
 * never exist as literal `{...}` strings that could leak into the output.
 */
export function buildTicketWaMessage(ticket: TicketWaData): string {
  const lines = [
    `Permintaan ${activityWord(ticket.jenis_tugas)} kaka sudah kami jadwalkan dengan nomor tiket ${ticket.nomor_tiket}`,
    `alamat: ${dashIfEmpty(ticket.alamat_jalan)}`,
    `waktu: ${formatWaktu(ticket.waktu_penjemputan)}`,
    `Nama: ${dashIfEmpty(ticket.nama)}`,
    `Nomor HP: ${ticket.nomor_hp}`,
    `catatan: ${dashIfEmpty(ticket.catatan_khusus)}`,
    `Silahkan diinformasikan kembali jika ada informasi yang kurang tepat.`,
    ``,
    `Kami informasikan juga, untuk kedepannya kaka bisa mempercepat proses antrian antar/jemput kaka dengan menginput sendiri permintaan antar/jemput ke http://mauantarjemput.washlaplaundry.com`,
    ``,
    `Sesuai dengan ketentuan antar jemput kami, kami sampaikan kembali, kami akan mengusahakan semaksimal mungkin untuk antar/jemput sesuai dengan waktu yang kaka harapkan. Namun kami sampaikan mohon maaf sebelumnya jika terkadang kondisi lapangan tidak memungkinkan untuk antar/jemput sesuai waktu yang diharapkan`,
  ];
  return lines.join("\n");
}

/**
 * Build the `wa.me` URL with URL-encoded text (Req 1.5, 1.6).
 *
 * Returns `null` when `nomorHp` cannot be normalized to a valid `62xxx`
 * number, so the caller can suppress the WhatsApp action (Req 1.11).
 */
export function buildWaUrl(nomorHp: string, message: string): string | null {
  const target = to62(nomorHp);
  if (!isValidPhone(target)) return null;
  return `https://wa.me/${target}?text=${encodeURIComponent(message)}`;
}
