/**
 * Property-based tests for the duplicate-ticket confirmation helpers in
 * `lib/duplicate-checks.ts`:
 *   - `buildDuplicateConfirmText` (Property 10, Req 3.4 / 3.10)
 *   - `mostRecent`               (Property 11, Req 3.5)
 *
 * Feature: admin-ticket-wa-and-duplicate-warnings.
 *
 * Each property is a single fast-check property run at least 100 times.
 * These tests are read-only against the source modules — they never mutate
 * `lib/duplicate-checks.ts` or `lib/whatsapp.ts`.
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  buildDuplicateConfirmText,
  mostRecent,
  type DupMatch,
  type JenisTugas,
} from "./duplicate-checks";
import { toLocal08, activityWord, dashIfEmpty } from "./whatsapp";

// ---------------------------------------------------------------------------
// Reusable arbitraries
// ---------------------------------------------------------------------------

const digit = fc.integer({ min: 0, max: 9 }).map(String);

/**
 * Subscriber part of an Indonesian mobile number: starts with `8` (the usual
 * mobile prefix) followed by 8-10 more digits, giving 9-11 total digits.
 */
const subscriberArb: fc.Arbitrary<string> = fc
  .tuple(fc.constant("8"), fc.array(digit, { minLength: 8, maxLength: 10 }))
  .map(([first, rest]) => first + rest.join(""));

/**
 * Valid Indonesian phone arbitrary covering the local `08xxx` and the
 * international `62xxx` / `+62xxx` forms, with optional separator "noise"
 * (`-` or spaces) sprinkled between digit groups. Every value produced here
 * normalizes (via `normalizePhone`) to a valid `62xxx` number, so `toLocal08`
 * always yields a non-empty `08xxx` string.
 */
const indoPhoneArb: fc.Arbitrary<string> = fc
  .tuple(
    subscriberArb,
    fc.constantFrom<"local" | "intl" | "intlPlus">(
      "local",
      "intl",
      "intlPlus",
    ),
    fc.constantFrom("", "-", " "),
  )
  .map(([sub, form, sep]) => {
    const core =
      form === "local" ? "0" + sub : form === "intl" ? "62" + sub : "+62" + sub;
    // Insert the separator between groups of 4 digits to mimic real-world noise.
    return sep === "" ? core : core.replace(/(\d{4})(?=\d)/g, `$1${sep}`);
  });

/**
 * Name arbitrary that includes blank/whitespace-only and null cases (to
 * exercise the `dashIfEmpty` "-" branch) alongside general text. Brace
 * characters are stripped so user data can never be confused with leftover
 * template placeholders.
 */
const nameArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.constantFrom("", " ", "   ", "\t", "\n", "  \t \n "),
  fc.string().map((s) => s.replace(/[{}]/g, "")),
);

const jenisArb: fc.Arbitrary<JenisTugas> = fc.constantFrom("ANTAR", "JEMPUT");

const dupMatchArb: fc.Arbitrary<DupMatch> = fc.record({
  nomor_hp: indoPhoneArb,
  nama: nameArb,
  jenis_tugas: jenisArb,
});

/**
 * Non-empty match-list arbitrary with strictly DISTINCT `waktu_order`
 * timestamps, so the "most recent" element is unambiguous. Distinct integer
 * offsets are mapped to distinct ISO timestamps; an `id` marker is attached so
 * the chosen element can be identified.
 */
const BASE_EPOCH = Date.UTC(2024, 0, 1, 0, 0, 0);

interface MatchRow {
  id: number;
  waktu_order: string;
}

const distinctMatchListArb: fc.Arbitrary<MatchRow[]> = fc
  .uniqueArray(fc.integer({ min: 0, max: 5_000_000 }), {
    minLength: 1,
    maxLength: 30,
  })
  .map((offsets) =>
    offsets.map((n, i) => ({
      id: i,
      waktu_order: new Date(BASE_EPOCH + n * 1000).toISOString(),
    })),
  );

// ---------------------------------------------------------------------------
// Property 10 (task 3.5)
// ---------------------------------------------------------------------------

describe("buildDuplicateConfirmText", () => {
  // Feature: admin-ticket-wa-and-duplicate-warnings, Property 10: Duplicate-confirmation text is fully populated with no leftover placeholders
  it("contains the local 08xxx phone, the name (or '-' when blank), the matching activity word, and no leftover placeholder braces", () => {
    fc.assert(
      fc.property(dupMatchArb, (match) => {
        const text = buildDuplicateConfirmText(match);

        const expectedPhone = toLocal08(match.nomor_hp);
        const expectedNama = dashIfEmpty(match.nama);
        const expectedWord = activityWord(match.jenis_tugas);

        // Local 08xxx phone is present (and non-empty for valid input).
        expect(expectedPhone.startsWith("0")).toBe(true);
        expect(text).toContain(expectedPhone);

        // Customer name, or "-" when blank, is present.
        expect(text).toContain(expectedNama);

        // Correct activity word matching jenis_tugas is present.
        expect(text).toContain(`permintaan ${expectedWord}`);

        // No literal placeholder braces remain.
        expect(text).not.toContain("{");
        expect(text).not.toContain("}");
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11 (task 3.6)
// ---------------------------------------------------------------------------

describe("mostRecent", () => {
  // Feature: admin-ticket-wa-and-duplicate-warnings, Property 11: Most-recent match selection
  it("returns the element with the maximum waktu_order from a non-empty list", () => {
    fc.assert(
      fc.property(distinctMatchListArb, (list) => {
        const result = mostRecent(list);

        // Independently compute the element with the maximum parsed time.
        let expected = list[0];
        let bestTime = new Date(list[0].waktu_order).getTime();
        for (const row of list) {
          const t = new Date(row.waktu_order).getTime();
          if (t > bestTime) {
            bestTime = t;
            expected = row;
          }
        }

        // Distinct timestamps make the maximum unique, so identity must match.
        expect(result).toBe(expected);
        expect(new Date(result.waktu_order).getTime()).toBe(bestTime);
      }),
      { numRuns: 100 },
    );
  });
});
