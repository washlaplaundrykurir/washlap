/**
 * Property-based tests for the pure duplicate-check predicates in
 * `lib/duplicate-checks.ts`.
 *
 * Feature: admin-ticket-wa-and-duplicate-warnings.
 *
 * Covers design Correctness Properties 7, 8, and 9. Each property is a single
 * fast-check property run at least 100 times, per the design Testing Strategy.
 */

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  isOpenTicket,
  notaMatches,
  shouldCheckNota,
  type JenisTugas,
} from "./duplicate-checks";

// ---------------------------------------------------------------------------
// Reusable arbitraries
// ---------------------------------------------------------------------------

/**
 * Whitespace / blank generator: a mix of "", spaces, tabs, newlines and other
 * ASCII whitespace. The empty array maps to "", so this also covers the empty
 * string. Used by the "false"/blank branches of Properties 7 and 8.
 */
const whitespaceArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(" ", "\t", "\n", "\r", "\f", "\v"), { maxLength: 6 })
  .map((parts) => parts.join(""));

/** Activity-type generator (Req 2.5 / 3.8). */
const jenisArb: fc.Arbitrary<JenisTugas> = fc.constantFrom<JenisTugas>(
  "ANTAR",
  "JEMPUT",
);

/**
 * status_id generator that guarantees the completed/cancelled values 6 and 7
 * are sampled, while still exploring the full integer space (Property 9).
 */
const statusIdArb: fc.Arbitrary<number> = fc.oneof(
  fc.integer(),
  fc.constantFrom(6, 7),
);

/**
 * A pair of nota strings (a, b) that are guaranteed to share trimmed,
 * case-folded equality: b is derived from a by re-casing each code point of
 * `a.trim()` and wrapping the result in arbitrary surrounding whitespace.
 * This drives the "match" branch of Property 7.
 */
const matchingNotaPairArb: fc.Arbitrary<{ a: string; b: string }> = fc
  .string({ maxLength: 30 })
  .chain((a) => {
    const chars = Array.from(a.trim());
    return fc
      .record({
        leading: whitespaceArb,
        trailing: whitespaceArb,
        flips: fc.array(fc.boolean(), {
          minLength: chars.length,
          maxLength: chars.length,
        }),
      })
      .map(({ leading, trailing, flips }) => {
        const recased = chars
          .map((ch, i) => (flips[i] ? ch.toUpperCase() : ch.toLowerCase()))
          .join("");
        return { a, b: `${leading}${recased}${trailing}` };
      });
  });

/**
 * A pair of fully independent nota strings — most of the time these will NOT
 * share trimmed/case-folded equality, exercising the "no match" branch.
 */
const independentNotaPairArb: fc.Arbitrary<{ a: string; b: string }> = fc.record(
  {
    a: fc.string(),
    b: fc.string(),
  },
);

/** Union of derived-equal and independent nota pairs for Property 7. */
const notaPairArb: fc.Arbitrary<{ a: string; b: string }> = fc.oneof(
  matchingNotaPairArb,
  independentNotaPairArb,
);

/**
 * A string guaranteed to contain at least one non-whitespace character, with
 * arbitrary surrounding whitespace and content. Drives the "true" branch of
 * Property 8.
 */
const nonBlankArb: fc.Arbitrary<string> = fc
  .tuple(
    whitespaceArb,
    fc.constantFrom("a", "Z", "9", "-", "#", "é", "あ"),
    fc.string(),
    whitespaceArb,
  )
  .map(([leading, core, rest, trailing]) => `${leading}${core}${rest}${trailing}`);

// ---------------------------------------------------------------------------
// Property 7 (task 3.2) — Validates Requirements 2.3, 2.5
// ---------------------------------------------------------------------------

describe("notaMatches (Property 7)", () => {
  // Feature: admin-ticket-wa-and-duplicate-warnings, Property 7: Nota comparator matches only on equal text (trimmed, case-insensitive) and equal Activity_Type
  it("is true iff trimmed/case-folded nota text is equal AND Activity_Type is equal", () => {
    fc.assert(
      fc.property(
        notaPairArb,
        jenisArb,
        jenisArb,
        ({ a, b }, tA, tB) => {
          const sameNota = a.trim().toLowerCase() === b.trim().toLowerCase();
          const sameJenis = tA === tB;
          const expected = sameNota && sameJenis;

          expect(
            notaMatches({ nota: a, jenis: tA }, { nota: b, jenis: tB }),
          ).toBe(expected);

          // Equal nota text with different types must never match (Req 2.5).
          if (sameNota && tA !== tB) {
            expect(
              notaMatches({ nota: a, jenis: tA }, { nota: b, jenis: tB }),
            ).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8 (task 3.3) — Validates Requirements 2.4
// ---------------------------------------------------------------------------

describe("shouldCheckNota (Property 8)", () => {
  // Feature: admin-ticket-wa-and-duplicate-warnings, Property 8: Empty nota skips the duplicate check
  it("is false for empty/whitespace-only/null/undefined and true for non-whitespace content", () => {
    const valueArb: fc.Arbitrary<string | null | undefined> = fc.oneof(
      whitespaceArb, // empty + whitespace-only -> expected false
      fc.constant(null), // -> expected false
      fc.constant(undefined), // -> expected false
      nonBlankArb, // has non-whitespace content -> expected true
    );

    fc.assert(
      fc.property(valueArb, (value) => {
        const expected = value != null && value.trim().length > 0;
        expect(shouldCheckNota(value)).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9 (task 3.4) — Validates Requirements 3.8
// ---------------------------------------------------------------------------

describe("isOpenTicket (Property 9)", () => {
  // Feature: admin-ticket-wa-and-duplicate-warnings, Property 9: Open-ticket predicate excludes only completed/cancelled statuses
  it("is false iff status_id is 6 or 7, and true for every other value", () => {
    fc.assert(
      fc.property(statusIdArb, (statusId) => {
        const expected = statusId !== 6 && statusId !== 7;
        expect(isOpenTicket(statusId)).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});
