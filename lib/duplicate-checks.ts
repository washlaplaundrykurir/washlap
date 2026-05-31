/**
 * Pure predicates and comparators for the admin ticket-creation duplicate
 * checks (Requirement 2: duplicate nomor nota warning; Requirement 3:
 * duplicate open-ticket confirmation).
 *
 * All functions in this module are PURE: no DOM access, no network calls, and
 * deterministic given their inputs. Activity-word and phone formatting are
 * delegated to `lib/whatsapp.ts` (`activityWord`, `toLocal08`, `dashIfEmpty`)
 * and never reimplemented here.
 *
 * Feature: admin-ticket-wa-and-duplicate-warnings.
 */

import { activityWord, dashIfEmpty, toLocal08 } from "./whatsapp";

/** Activity type stored on `permintaan.jenis_tugas`. */
export type JenisTugas = "ANTAR" | "JEMPUT";

/**
 * Minimal shape for comparing two tickets by nomor nota + activity type.
 * Used by the duplicate nomor nota warning (Req 2).
 */
export interface NotaComparable {
  nota: string;
  jenis: JenisTugas;
}

/**
 * Accepted representations of the `permintaan.waktu_order` timestamp column.
 * The DB column is a timestamp; rows come back as ISO strings, but numeric
 * epochs and `Date` instances are also accepted for flexibility/testing.
 */
export type WaktuOrder = string | number | Date;

/** Shape required by `mostRecent` (Req 3.5, Property 11). */
export interface HasWaktuOrder {
  waktu_order: WaktuOrder;
}

/**
 * Match data used to render the duplicate-ticket confirmation text (Req 3.4).
 */
export interface DupMatch {
  nomor_hp: string;
  nama: string | null;
  jenis_tugas: JenisTugas;
}

/**
 * True iff two tickets share the same nomor nota (compared trimmed and
 * case-insensitively) AND the same Activity_Type (Req 2.3, 2.5; Property 7).
 *
 * Equal nota text with different activity types does NOT match.
 */
export function notaMatches(a: NotaComparable, b: NotaComparable): boolean {
  const sameNota = a.nota.trim().toLowerCase() === b.nota.trim().toLowerCase();
  const sameJenis = a.jenis === b.jenis;
  return sameNota && sameJenis;
}

/**
 * Whether the nomor nota duplicate check should run for a given input
 * (Req 2.4; Property 8).
 *
 * Returns `false` when the value is null/undefined, empty, or whitespace-only;
 * returns `true` only when there is non-whitespace content.
 */
export function shouldCheckNota(value: string | null | undefined): boolean {
  if (value == null) return false;
  return value.trim() !== "";
}

/**
 * Whether a ticket is an Open_Ticket — i.e. not yet completed/cancelled by the
 * kurir (Req 3.8; Property 9).
 *
 * Returns `false` if and only if `status_id` is 6 (Selesai) or 7 (dibatalkan);
 * every other value is treated as open and returns `true`.
 */
export function isOpenTicket(status_id: number): boolean {
  return status_id !== 6 && status_id !== 7;
}

/**
 * Convert a `WaktuOrder` to a comparable epoch-millisecond number.
 *
 * Invalid/unparseable values collapse to `-Infinity` so they deterministically
 * sort below any real timestamp.
 */
function toTime(value: WaktuOrder): number {
  if (value instanceof Date) {
    const t = value.getTime();
    return Number.isNaN(t) ? -Infinity : t;
  }
  if (typeof value === "number") {
    return Number.isNaN(value) ? -Infinity : value;
  }
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? -Infinity : t;
}

/**
 * Return the element with the maximum `waktu_order` from a non-empty list
 * (Req 3.5; Property 11).
 *
 * Comparison is by parsed timestamp. On ties the earliest-encountered element
 * is kept, making the result deterministic.
 *
 * @throws {Error} when `matches` is empty.
 */
export function mostRecent<T extends HasWaktuOrder>(matches: T[]): T {
  if (matches.length === 0) {
    throw new Error("mostRecent: matches must be a non-empty list");
  }

  let best = matches[0];
  let bestTime = toTime(best.waktu_order);

  for (let i = 1; i < matches.length; i++) {
    const time = toTime(matches[i].waktu_order);
    if (time > bestTime) {
      best = matches[i];
      bestTime = time;
    }
  }

  return best;
}

/**
 * Build the Indonesian duplicate-ticket confirmation text (Req 3.4) with every
 * placeholder filled and no literal placeholder braces remaining (Property 10).
 *
 * - `{nomor_hp}` is rendered in local `08xxx` form via `toLocal08` (Req 3.10).
 * - `{nama}` renders `"-"` when blank (via `dashIfEmpty`).
 * - `{antar/jemput}` uses `activityWord` matching `jenis_tugas`.
 *
 * The text is assembled by direct interpolation, so the template tokens never
 * exist as literal `{...}` strings that could leak into the output.
 */
export function buildDuplicateConfirmText(match: DupMatch): string {
  const phone = toLocal08(match.nomor_hp);
  const nama = dashIfEmpty(match.nama);
  const word = activityWord(match.jenis_tugas);
  return `Sudah ada tiket dengan nomor HP ${phone}, atas nama ${nama} untuk permintaan ${word}. Apakah kamu yakin untuk membuat tiket yang sama?`;
}
