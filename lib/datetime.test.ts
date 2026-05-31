/**
 * Tests for the shared WIB date/time formatters in `lib/datetime.ts`.
 *
 * The database stores real UTC timestamps, so these helpers must render in
 * Asia/Jakarta (UTC+7) regardless of the host's local time zone. The tests
 * pin behavior to that contract and guard against the two historical bugs:
 * formatting in UTC (7h behind) or in the runtime-default zone.
 */

import { describe, it, expect } from "vitest";

import {
  WIB_TIME_ZONE,
  formatDateTimeWIB,
  formatDateWIB,
  formatTimeWIB,
  formatTimeAgoWIB,
} from "./datetime";

// A UTC instant that crosses into the next WIB day: 2026-05-31T20:09Z is
// 2026-06-01 03:09 WIB. This catches both wrong-hour and wrong-day bugs.
const CROSS_DAY_UTC = "2026-05-31T20:09:00.000Z";
// 2026-05-31T13:09Z == 2026-05-31 20:09 WIB (the real "A RIR 6191" case).
const SAME_DAY_UTC = "2026-05-31T13:09:06.758Z";

describe("WIB_TIME_ZONE", () => {
  it("is Asia/Jakarta", () => {
    expect(WIB_TIME_ZONE).toBe("Asia/Jakarta");
  });
});

describe("formatTimeWIB", () => {
  it("renders the WIB wall-clock time (UTC+7), not UTC", () => {
    // 13:09 UTC -> 20:09 WIB. id-ID uses a dot separator.
    expect(formatTimeWIB(SAME_DAY_UTC)).toBe("20.09");
  });

  it("rolls over correctly across the day boundary", () => {
    // 20:09 UTC -> 03:09 WIB (next calendar day).
    expect(formatTimeWIB(CROSS_DAY_UTC)).toBe("03.09");
  });

  it("returns '-' for blank/invalid input", () => {
    expect(formatTimeWIB(null)).toBe("-");
    expect(formatTimeWIB(undefined)).toBe("-");
    expect(formatTimeWIB("")).toBe("-");
    expect(formatTimeWIB("   ")).toBe("-");
    expect(formatTimeWIB("not-a-date")).toBe("-");
  });
});

describe("formatDateWIB", () => {
  it("uses the WIB calendar date across the day boundary", () => {
    // 20:09 UTC is already 1 Jun in WIB.
    expect(formatDateWIB(CROSS_DAY_UTC)).toBe("1 Jun 2026");
    // 13:09 UTC is still 31 May in WIB.
    expect(formatDateWIB(SAME_DAY_UTC)).toBe("31 Mei 2026");
  });

  it("returns '-' for blank/invalid input", () => {
    expect(formatDateWIB(null)).toBe("-");
    expect(formatDateWIB("")).toBe("-");
    expect(formatDateWIB("nope")).toBe("-");
  });
});

describe("formatDateTimeWIB", () => {
  it("includes both the WIB date and the WIB time", () => {
    const out = formatDateTimeWIB(SAME_DAY_UTC);

    expect(out).toContain("31 Mei 2026");
    expect(out).toContain("20.09");
  });

  it("returns '-' for blank/invalid input", () => {
    expect(formatDateTimeWIB(null)).toBe("-");
    expect(formatDateTimeWIB("")).toBe("-");
    expect(formatDateTimeWIB("bogus")).toBe("-");
  });
});

describe("formatTimeAgoWIB", () => {
  const now = new Date("2026-05-31T13:30:00.000Z");

  it("uses absolute instants with no time-zone offset hack", () => {
    expect(formatTimeAgoWIB("2026-05-31T13:29:40.000Z", now)).toBe("Baru saja");
    expect(formatTimeAgoWIB("2026-05-31T13:25:00.000Z", now)).toBe("5m lalu");
    expect(formatTimeAgoWIB("2026-05-31T11:30:00.000Z", now)).toBe("2j lalu");
    expect(formatTimeAgoWIB("2026-05-29T13:30:00.000Z", now)).toBe("2h lalu");
  });

  it("returns '-' for blank/invalid input", () => {
    expect(formatTimeAgoWIB(null, now)).toBe("-");
    expect(formatTimeAgoWIB("", now)).toBe("-");
  });
});
