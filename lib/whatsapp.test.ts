/**
 * Property-based tests for the pure WhatsApp helpers in `lib/whatsapp.ts`.
 *
 * Feature: admin-ticket-wa-and-duplicate-warnings
 * These tests validate the design's Correctness Properties 1, 2, 5, and 12
 * against the already-implemented module. Each property is a SINGLE
 * fast-check property with at least 100 runs.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  buildTicketWaMessage,
  dashIfEmpty,
  formatWaktu,
  toLocal08,
  to62,
  type TicketWaData,
} from "./whatsapp";

// ---------------------------------------------------------------------------
// Reusable arbitraries
// ---------------------------------------------------------------------------

/** Single whitespace characters used to build blank/whitespace-only strings. */
const whitespaceChar = fc.constantFrom(" ", "\t", "\n", "\r");

/**
 * Whitespace/blank generator: a mix of "" plus runs of spaces, tabs, and
 * newlines (Properties 5/8 in the design's Testing Strategy).
 */
const blankArb: fc.Arbitrary<string> = fc
  .array(whitespaceChar, { minLength: 0, maxLength: 6 })
  .map((chars) => chars.join(""));

/** Blank string OR null/undefined — for the "blank value" branches. */
const blankOrNilArb: fc.Arbitrary<string | null | undefined> = fc.oneof(
  blankArb,
  fc.constant(null),
  fc.constant(undefined),
);

/**
 * A value guaranteed to contain non-whitespace content, optionally wrapped in
 * surrounding whitespace so the trimming behaviour is exercised.
 */
const nonBlankArb: fc.Arbitrary<string> = fc
  .tuple(
    blankArb,
    fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.trim().length > 0),
    blankArb,
  )
  .map(([left, core, right]) => left + core + right);

/** Valid ISO timestamps (always a real, parseable date). */
const validIsoArb: fc.Arbitrary<string> = fc
  .date({
    min: new Date(Date.UTC(2000, 0, 1)),
    max: new Date(Date.UTC(2099, 11, 31)),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString());

/**
 * Free-form text including special characters and Unicode, but with template
 * braces removed so they can never be confused with leftover placeholders.
 */
const braceFreeText: fc.Arbitrary<string> = fc
  .string({ unit: "grapheme", minLength: 0, maxLength: 12 })
  .map((s) => s.replace(/[{}]/g, ""));

/** Nullable variant of {@link braceFreeText}. */
const nullableBraceFree: fc.Arbitrary<string | null> = fc.option(braceFreeText, {
  nil: null,
});

/**
 * Indonesian phone generator: valid 08xxx and 62xxx numbers, optionally with
 * separator noise (spaces, dashes) and a leading "+". Every produced value
 * normalizes to a `62`-prefixed Indonesian number (Properties 3/6/12).
 */
const indoPhoneArb: fc.Arbitrary<string> = fc
  .record({
    prefix: fc.constantFrom("0", "62", "+62"),
    sub: fc
      .array(fc.integer({ min: 0, max: 9 }), { minLength: 7, maxLength: 11 })
      .map((digits) => "8" + digits.join("")),
    sep: fc.constantFrom("", " ", "-"),
    pad: fc.constantFrom("", " "),
  })
  .map(({ prefix, sub, sep, pad }) => {
    const grouped = sub.slice(0, 3) + sep + sub.slice(3, 6) + sep + sub.slice(6);
    return pad + prefix + sep + grouped + pad;
  });

/** Full TicketWaData generator (Properties 1-2). */
const ticketArb: fc.Arbitrary<TicketWaData> = fc.record({
  nomor_tiket: braceFreeText,
  jenis_tugas: fc.constantFrom<"ANTAR" | "JEMPUT">("ANTAR", "JEMPUT"),
  alamat_jalan: nullableBraceFree,
  waktu_penjemputan: fc.option(validIsoArb, { nil: null }),
  nama: nullableBraceFree,
  nomor_hp: indoPhoneArb.map((p) => to62(p)),
  catatan_khusus: nullableBraceFree,
});

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

describe("lib/whatsapp – buildTicketWaMessage", () => {
  // Feature: admin-ticket-wa-and-duplicate-warnings, Property 1: Message has no leftover placeholders and includes all template lines
  // Validates: Requirements 1.3
  it("has no leftover placeholder braces and includes every template line", () => {
    fc.assert(
      fc.property(ticketArb, (ticket) => {
        const msg = buildTicketWaMessage(ticket);

        // No literal placeholder braces remain.
        expect(msg.includes("{")).toBe(false);
        expect(msg.includes("}")).toBe(false);

        // Every template line label is present.
        expect(msg).toContain("alamat:");
        expect(msg).toContain("waktu:");
        expect(msg).toContain("Nama:");
        expect(msg).toContain("Nomor HP:");
        expect(msg).toContain("catatan:");

        // The closing sentence is present.
        expect(msg).toContain(
          "Silahkan diinformasikan kembali jika ada informasi yang kurang tepat.",
        );
      }),
      { numRuns: 200 },
    );
  });

  // Feature: admin-ticket-wa-and-duplicate-warnings, Property 2: Activity word matches the ticket's Activity_Type
  // Validates: Requirements 1.4
  it("begins with the activity word matching jenis_tugas and never the other", () => {
    fc.assert(
      fc.property(ticketArb, (ticket) => {
        const msg = buildTicketWaMessage(ticket);

        if (ticket.jenis_tugas === "ANTAR") {
          expect(msg.startsWith("Permintaan antar")).toBe(true);
          expect(msg.startsWith("Permintaan jemput")).toBe(false);
        } else {
          expect(msg.startsWith("Permintaan jemput")).toBe(true);
          expect(msg.startsWith("Permintaan antar")).toBe(false);
        }
      }),
      { numRuns: 200 },
    );
  });
});

describe("lib/whatsapp – dashIfEmpty & formatWaktu", () => {
  // Feature: admin-ticket-wa-and-duplicate-warnings, Property 5: Optional fields render "-" when blank and a formatted value when present
  // Validates: Requirements 1.7, 1.8
  it("renders '-' for blank values and a date+time string for valid timestamps", () => {
    fc.assert(
      fc.property(
        blankOrNilArb,
        nonBlankArb,
        validIsoArb,
        (blank, nonBlank, iso) => {
          // dashIfEmpty: blank -> exactly "-"
          expect(dashIfEmpty(blank)).toBe("-");
          // dashIfEmpty: non-blank -> trimmed value
          expect(dashIfEmpty(nonBlank)).toBe(nonBlank.trim());

          // formatWaktu: missing/blank -> "-"
          expect(formatWaktu(blank)).toBe("-");

          // formatWaktu: valid ISO -> non-"-" containing date + time components.
          const formatted = formatWaktu(iso);
          expect(formatted).not.toBe("-");
          // Contains a 4-digit year (date component), robust to id-ID month names.
          expect(/\d{4}/.test(formatted)).toBe(true);
          // Contains a time component HH:MM or HH.MM (id-ID uses a dot separator).
          expect(/\d{1,2}[.:]\d{2}/.test(formatted)).toBe(true);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("lib/whatsapp – toLocal08 / to62 round-trip", () => {
  // Feature: admin-ticket-wa-and-duplicate-warnings, Property 12: Phone local/international round-trip is stable
  // Validates: Requirements 3.10
  it("produces a local 0-prefixed number and preserves the underlying digits", () => {
    fc.assert(
      fc.property(indoPhoneArb, (phone) => {
        const local = toLocal08(phone);

        // For an Indonesian (62-prefixed) number, the local form begins with "0".
        expect(local.startsWith("0")).toBe(true);

        // Local <-> international conversion preserves the underlying digits.
        expect(to62(local)).toBe(to62(phone));
      }),
      { numRuns: 200 },
    );
  });
});
