/**
 * Shared date/time formatting helpers for the WashLap UI.
 *
 * All timestamps in the database are stored as real UTC (`timestamptz`, written
 * via `toISOString()`). To display them to Indonesian users they MUST be
 * rendered in the `Asia/Jakarta` (WIB, UTC+7) time zone. Formatting without an
 * explicit `timeZone` falls back to the runtime zone (wrong under SSR / a UTC
 * host), and using `timeZone: "UTC"` shows the time 7 hours behind WIB — both
 * bugs this module exists to prevent.
 *
 * These functions are pure and deterministic across environments because the
 * time zone is pinned. They never throw: blank/invalid input renders as "-".
 */

/** Indonesian Western time zone (WIB, UTC+7). */
export const WIB_TIME_ZONE = "Asia/Jakarta";

/** Locale used for all human-facing date/time strings. */
const ID_LOCALE = "id-ID";

/** Parse to a valid Date, or return null for null/blank/unparseable input. */
function toValidDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Format a timestamp as a WIB date with time, e.g. "31 Mei 2026, 20.09".
 * Returns "-" for missing/invalid input.
 */
export function formatDateTimeWIB(
  value: string | number | Date | null | undefined,
): string {
  const date = toValidDate(value);

  if (!date) return "-";

  return new Intl.DateTimeFormat(ID_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: WIB_TIME_ZONE,
  }).format(date);
}

/**
 * Format a timestamp as a WIB date only (no time), e.g. "31 Mei 2026".
 * Returns "-" for missing/invalid input.
 */
export function formatDateWIB(
  value: string | number | Date | null | undefined,
): string {
  const date = toValidDate(value);

  if (!date) return "-";

  return new Intl.DateTimeFormat(ID_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: WIB_TIME_ZONE,
  }).format(date);
}

/**
 * Format a timestamp as a WIB time only (no date), e.g. "20.09".
 * Returns "-" for missing/invalid input.
 */
export function formatTimeWIB(
  value: string | number | Date | null | undefined,
): string {
  const date = toValidDate(value);

  if (!date) return "-";

  return new Intl.DateTimeFormat(ID_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: WIB_TIME_ZONE,
  }).format(date);
}

/**
 * Relative "time ago" label in Indonesian (e.g. "Baru saja", "5m lalu",
 * "3j lalu", "2h lalu"), computed from the absolute instant. Because both the
 * stored timestamp and `Date.now()` are absolute instants, no time-zone offset
 * hack is needed. Returns "-" for missing/invalid input.
 */
export function formatTimeAgoWIB(
  value: string | number | Date | null | undefined,
  now: Date = new Date(),
): string {
  const date = toValidDate(value);

  if (!date) return "-";

  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

  if (diffInMinutes < 1) return "Baru saja";
  if (diffInMinutes < 60) return `${diffInMinutes}m lalu`;
  if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}j lalu`;

  return `${Math.floor(diffInMinutes / 1440)}h lalu`;
}
