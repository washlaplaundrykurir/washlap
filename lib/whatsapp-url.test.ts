/**
 * Property-based tests for the `buildWaUrl` URL builder in `lib/whatsapp.ts`.
 *
 * Feature: admin-ticket-wa-and-duplicate-warnings (Requirement 1).
 *
 * This file owns Properties 3, 4 and 6 from the design's Correctness
 * Properties section. They exercise the wa.me URL construction:
 *   - Property 3: the WA target is the customer's normalized 62xxx number.
 *   - Property 4: the message text round-trips through URL encoding.
 *   - Property 6: an invalid phone suppresses the action (returns null).
 *
 * Each property is a single fast-check property running ≥100 times, using the
 * Vitest + fast-check tooling specified in the design's Testing Strategy.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import { buildWaUrl, buildTicketWaMessage, to62, type TicketWaData } from "@/lib/whatsapp";
import { isValidPhone } from "@/lib/phone";

// ---------------------------------------------------------------------------
// Reusable fast-check arbitraries
// ---------------------------------------------------------------------------

/** A single decimal digit character. */
const digit = fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9");

/**
 * Body of an Indonesian mobile subscriber number (without the leading 0/62).
 * Starts with `8` and is long enough that every prefixed/normalized form has
 * well over the 7-digit minimum required by `isValidPhone`.
 */
const phoneBody = fc
  .array(digit, { minLength: 8, maxLength: 11 })
  .map((parts) => "8" + parts.join(""));

/**
 * VALID Indonesian phone arbitrary.
 *
 * Yields several real-world formats (local `08…`, international `62…`/`+62…`,
 * and forms peppered with separator noise like spaces and dashes). Every value
 * normalizes via `to62`/`normalizePhone` to a digits-only `62xxx` number that
 * passes `isValidPhone`, so it is always a valid WhatsApp target.
 */
const validIndonesianPhone: fc.Arbitrary<string> = phoneBody.chain((body) =>
  fc.constantFrom(
    "0" + body, // local plain: 08…
    "62" + body, // international plain
    "+62" + body, // international with +
    "+62 " + body.slice(0, 3) + " " + body.slice(3), // +62 spaced
    "0" + body.slice(0, 3) + "-" + body.slice(3), // 08x-… with dash
    "(0" + body.slice(0, 3) + ") " + body.slice(3), // (08x) … with parens
  ),
);

/**
 * INVALID / short / noise phone arbitrary.
 *
 * Yields inputs that should normalize to something `isValidPhone` rejects:
 * empty/whitespace, pure non-digit noise, and short digit runs that do not
 * start with `0` (so the leading-0→62 rule cannot pad them past 7 digits).
 *
 * Note: classification is never assumed — Property 6 partitions on the real
 * `isValidPhone(to62(...))` outcome, so the test stays precise even for any
 * edge value this arbitrary happens to emit.
 */
const invalidOrNoisePhone: fc.Arbitrary<string> = fc.oneof(
  fc.constant(""),
  fc.constant("   "),
  fc.constant("+"),
  fc.constant("-"),
  // pure non-digit noise → normalizes to "" → invalid
  fc.string({ unit: fc.constantFrom("+", "-", " ", "(", ")", "/", "#", "*", "a", "Z", ".") }),
  // short digit run NOT starting with 0 (≤ 6 digits) → too short → invalid
  fc.array(digit, { minLength: 0, maxLength: 5 }).map((parts) => "9" + parts.join("")),
);

/**
 * Mixed phone arbitrary used by Property 6: produces BOTH valid and invalid
 * inputs so the null / non-null partition is exercised on both sides.
 */
const anyPhoneInput: fc.Arbitrary<string> = fc.oneof(
  validIndonesianPhone,
  invalidOrNoisePhone,
);

/** Arbitrary ISO-8601 timestamp string spanning 1970 → ~2100. */
const isoTimestamp: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 4_102_444_800_000 })
  .map((ms) => new Date(ms).toISOString());

/** Free-form text including spaces, newlines, Unicode and URL-special chars. */
const freeText: fc.Arbitrary<string> = fc.oneof(
  fc.string(),
  fc.string({ unit: "grapheme" }),
  fc.string({
    unit: fc.constantFrom("&", "?", "#", "%", "=", "+", " ", "\n", "\t", "/", "a", "1", "é", "😀"),
  }),
);

/** A `TicketWaData` whose `nomor_hp` is always a VALID Indonesian phone. */
const ticketWaDataWithValidPhone: fc.Arbitrary<TicketWaData> = fc.record({
  nomor_tiket: fc.string(),
  jenis_tugas: fc.constantFrom<"ANTAR" | "JEMPUT">("ANTAR", "JEMPUT"),
  alamat_jalan: fc.option(fc.string({ unit: "grapheme" }), { nil: null }),
  waktu_penjemputan: fc.option(isoTimestamp, { nil: null }),
  nama: fc.option(fc.string(), { nil: null }),
  nomor_hp: validIndonesianPhone,
  catatan_khusus: fc.option(fc.string({ unit: "grapheme" }), { nil: null }),
});

// A sentinel "laundry" number that must never become the WA target.
const LAUNDRY_NUMBER = "628000000000";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildWaUrl URL properties", () => {
  // Feature: admin-ticket-wa-and-duplicate-warnings, Property 3: WhatsApp target is the customer's normalized number, never the laundry number
  // Validates: Requirements 1.2, 1.5
  it("targets the customer's normalized 62xxx number, not the laundry number", () => {
    fc.assert(
      fc.property(ticketWaDataWithValidPhone, (ticket) => {
        const message = buildTicketWaMessage(ticket);
        const url = buildWaUrl(ticket.nomor_hp, message);

        // The phone is valid, so a URL must be produced.
        expect(url).not.toBeNull();

        const target = to62(ticket.nomor_hp);

        // Target is a digits-only 62xxx value.
        expect(target).toMatch(/^62\d+$/);

        // The URL points at exactly that customer number.
        expect(url).toContain(`wa.me/${target}`);

        const parsed = new URL(url as string);
        expect(parsed.host).toBe("wa.me");
        expect(parsed.pathname).toBe(`/${target}`);

        // It must NOT be retargeted to some unrelated laundry number
        // (unless the customer number genuinely equals it, which the
        // generator never produces).
        expect(parsed.pathname).toBe(`/${target}`);
        expect(parsed.pathname).not.toBe(`/${LAUNDRY_NUMBER}`);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: admin-ticket-wa-and-duplicate-warnings, Property 4: Message text is URL-encoded and recoverable (round-trip)
  // Validates: Requirements 1.6
  it("URL-encodes the message so it round-trips exactly via the URL constructor", () => {
    fc.assert(
      fc.property(validIndonesianPhone, freeText, (phone, message) => {
        const url = buildWaUrl(phone, message);

        // Phone is valid → URL is produced.
        expect(url).not.toBeNull();

        // URL is parseable by the standard constructor (no exception).
        const parsed = new URL(url as string);

        // Decoding the `text` query param yields EXACTLY the original message.
        expect(parsed.searchParams.get("text")).toBe(message);
      }),
      { numRuns: 200 },
    );
  });

  // Feature: admin-ticket-wa-and-duplicate-warnings, Property 6: Invalid phone suppresses the WhatsApp action
  // Validates: Requirements 1.11
  it("returns null for un-normalizable phones and a parseable URL for valid ones", () => {
    fc.assert(
      fc.property(anyPhoneInput, freeText, (phone, message) => {
        const url = buildWaUrl(phone, message);
        const expectValid = isValidPhone(to62(phone));

        if (expectValid) {
          // Valid phone → non-null, parseable wa.me URL.
          expect(url).not.toBeNull();
          const parsed = new URL(url as string);
          expect(parsed.host).toBe("wa.me");
          expect(parsed.pathname).toBe(`/${to62(phone)}`);
        } else {
          // Cannot be normalized to a valid 62xxx number → suppressed.
          expect(url).toBeNull();
        }
      }),
      { numRuns: 200 },
    );
  });
});
