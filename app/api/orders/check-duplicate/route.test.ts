/**
 * Integration tests for `GET /api/orders/check-duplicate`.
 *
 * Feature: admin-ticket-wa-and-duplicate-warnings (Requirement 3).
 *
 * These run in the default `node` Vitest environment (route handlers). They do
 * NOT hit a real database. Instead:
 *   - `@/lib/api-auth` is mocked so `requireAdmin()` returns an authorized admin
 *     (with one case returning a 401 NextResponse to assert the guard).
 *   - `@/utils/supabase/server` is mocked so `createSupabaseAdmin()` returns a
 *     fake client whose `.from()` yields a chainable, awaitable query builder
 *     resolving to a `{ data, error }` result we control per test.
 *
 * The pure helpers (`@/lib/phone`, `@/lib/whatsapp`, `@/lib/duplicate-checks`)
 * are intentionally NOT mocked, so the handler exercises the real
 * `normalizePhone` / `toLocal08` / `isOpenTicket` / `mostRecent` logic.
 *
 * Covers the design "GET /api/orders/check-duplicate" integration tests:
 * Req 3.1 (match on normalized phone + activity type among open tickets),
 * Req 3.5 (most-recent match selected), Req 3.8 (Open_Ticket = status NOT 6/7).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

import { toLocal08 } from "@/lib/whatsapp";

// ---------------------------------------------------------------------------
// Shared, hoisted mock state (vi.mock factories are hoisted above imports, so
// the mutable result they read must be created via vi.hoisted).
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  // What requireAdmin() resolves to (read fresh on every call).
  requireAdminResult: {
    user: { id: "admin-1", role: "admin" },
    error: null as unknown,
  },
  // What the awaited Supabase query builder resolves to (read at `.from()` time).
  queryResult: { data: [] as unknown[], error: null as unknown },
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () => mocks.requireAdminResult),
}));

vi.mock("@/utils/supabase/server", () => {
  // Chainable builder: every PostgREST method returns the same builder, and the
  // builder is thenable so `await builder` (after `.order(...)`) yields the
  // configured `{ data, error }` result.
  const makeQuery = (result: unknown) => {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;

    builder.select = vi.fn(chain);
    builder.eq = vi.fn(chain);
    builder.not = vi.fn(chain);
    builder.order = vi.fn(chain);
    builder.then = (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected);

    return builder;
  };

  return {
    createSupabaseAdmin: vi.fn(() => ({
      from: vi.fn(() => makeQuery(mocks.queryResult)),
    })),
  };
});

// Import AFTER the mocks are declared so the route binds to the mocked modules.
import { GET } from "./route";
import { createSupabaseAdmin } from "@/utils/supabase/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal NextRequest-like object (the handler only reads `request.url`). */
function makeRequest(query: string) {
  return {
    url: `http://localhost/api/orders/check-duplicate${query}`,
  } as never;
}

/** Convenience: a customer-embed row as returned by the `customers:customer_id` select. */
function row(
  status_id: number,
  waktu_order: string,
  customer: { nomor_hp: string | null; nama_terakhir: string | null },
  jenis_tugas: "ANTAR" | "JEMPUT" = "ANTAR",
) {
  return { status_id, jenis_tugas, waktu_order, customers: customer };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Restore defaults: authorized admin, empty result, no DB error.
  mocks.requireAdminResult = {
    user: { id: "admin-1", role: "admin" },
    error: null,
  };
  mocks.queryResult = { data: [], error: null };
});

// ---------------------------------------------------------------------------
// Req 3.1 / 3.8 — open ticket matches
// ---------------------------------------------------------------------------

describe("GET /api/orders/check-duplicate — open ticket match (Req 3.1, 3.8)", () => {
  it("returns exists:true with the customer's display data for an open ticket (status 1-5)", async () => {
    mocks.queryResult = {
      data: [
        row(1, "2024-01-02T00:00:00.000Z", {
          nomor_hp: "628123456789",
          nama_terakhir: "Budi",
        }),
      ],
      error: null,
    };

    const res = await GET(makeRequest("?phone=08123456789&jenis=ANTAR"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.exists).toBe(true);
    expect(body.jenis).toBe("ANTAR"); // echoes the query
    expect(body.nama).toBe("Budi");
    // nomor_hp_local computed with the real helper from the row's nomor_hp.
    expect(body.nomor_hp_local).toBe(toLocal08("628123456789"));
    expect(body.nomor_hp_local).toBe("08123456789");
  });

  it("matches each Open_Ticket status 1..5 returned by the DB filter", async () => {
    for (const status of [1, 2, 3, 4, 5]) {
      mocks.queryResult = {
        data: [
          row(status, "2024-05-05T10:00:00.000Z", {
            nomor_hp: "628999888777",
            nama_terakhir: "Sari",
          }),
        ],
        error: null,
      };

      const res = await GET(makeRequest("?phone=628999888777&jenis=ANTAR"));
      const body = await res.json();

      expect(body.exists).toBe(true);
      expect(body.nama).toBe("Sari");
      expect(body.nomor_hp_local).toBe(toLocal08("628999888777"));
      expect(body.nomor_hp_local).toBe("08999888777");
    }
  });

  it("unwraps an array-shaped embedded customer (PostgREST embed variability)", async () => {
    mocks.queryResult = {
      data: [
        {
          status_id: 2,
          jenis_tugas: "JEMPUT",
          waktu_order: "2024-02-02T00:00:00.000Z",
          // Embedded relation arriving as an array instead of an object.
          customers: [{ nomor_hp: "628123450000", nama_terakhir: "Andi" }],
        },
      ],
      error: null,
    };

    const res = await GET(makeRequest("?phone=08123450000&jenis=JEMPUT"));
    const body = await res.json();

    expect(body.exists).toBe(true);
    expect(body.jenis).toBe("JEMPUT");
    expect(body.nama).toBe("Andi");
    expect(body.nomor_hp_local).toBe("08123450000");
  });
});

// ---------------------------------------------------------------------------
// Req 3.8 — completed/cancelled do NOT match
// ---------------------------------------------------------------------------

describe("GET /api/orders/check-duplicate — completed/cancelled excluded (Req 3.8)", () => {
  it("returns exists:false when the authoritative DB filter yields no rows", async () => {
    // The route filters status 6/7 at the DB level, so completed/cancelled-only
    // customers come back as an empty set.
    mocks.queryResult = { data: [], error: null };

    const res = await GET(makeRequest("?phone=08123456789&jenis=ANTAR"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ exists: false });
  });

  it("defensively drops status 6/7 rows that slip through, still exists:false (belt-and-suspenders)", async () => {
    // Even if a completed (6) or cancelled (7) row appears in `data`, the
    // route's isOpenTicket re-filter must exclude it.
    mocks.queryResult = {
      data: [
        row(6, "2024-01-10T00:00:00.000Z", {
          nomor_hp: "628123456789",
          nama_terakhir: "Selesai",
        }),
        row(7, "2024-01-11T00:00:00.000Z", {
          nomor_hp: "628123456789",
          nama_terakhir: "Batal",
        }),
      ],
      error: null,
    };

    const res = await GET(makeRequest("?phone=08123456789&jenis=ANTAR"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ exists: false });
  });

  it("keeps the open row and drops the completed one when mixed", async () => {
    mocks.queryResult = {
      data: [
        row(6, "2024-03-01T00:00:00.000Z", {
          nomor_hp: "628123456789",
          nama_terakhir: "Selesai",
        }),
        row(3, "2024-02-01T00:00:00.000Z", {
          nomor_hp: "628123456789",
          nama_terakhir: "MasihAktif",
        }),
      ],
      error: null,
    };

    const res = await GET(makeRequest("?phone=08123456789&jenis=ANTAR"));
    const body = await res.json();

    expect(body.exists).toBe(true);
    // The completed row (later waktu_order) must NOT win — it's filtered out.
    expect(body.nama).toBe("MasihAktif");
  });
});

// ---------------------------------------------------------------------------
// Req 3.5 — most-recent match selected
// ---------------------------------------------------------------------------

describe("GET /api/orders/check-duplicate — most-recent selection (Req 3.5)", () => {
  it("returns the match with the maximum waktu_order when several open tickets match", async () => {
    // Deliberately unsorted so the test exercises the real `mostRecent`, not
    // just "first row".
    mocks.queryResult = {
      data: [
        row(2, "2024-01-01T08:00:00.000Z", {
          nomor_hp: "628111222333",
          nama_terakhir: "Budi",
        }),
        row(1, "2024-03-10T08:00:00.000Z", {
          nomor_hp: "628111222333",
          nama_terakhir: "Citra", // most recent
        }),
        row(3, "2024-02-15T08:00:00.000Z", {
          nomor_hp: "628111222333",
          nama_terakhir: "Dewi",
        }),
      ],
      error: null,
    };

    const res = await GET(makeRequest("?phone=08111222333&jenis=ANTAR"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.exists).toBe(true);
    expect(body.nama).toBe("Citra");
    expect(body.nomor_hp_local).toBe(toLocal08("628111222333"));
  });
});

// ---------------------------------------------------------------------------
// Req 3.1 — validation / early returns
// ---------------------------------------------------------------------------

describe("GET /api/orders/check-duplicate — validation (Req 3.1)", () => {
  it("returns 400 when jenis is missing", async () => {
    const res = await GET(makeRequest("?phone=08123456789"));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/ANTAR atau JEMPUT/);
    // No DB query should have been attempted.
    expect(createSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 400 when jenis is invalid", async () => {
    const res = await GET(makeRequest("?phone=08123456789&jenis=FOO"));

    expect(res.status).toBe(400);
    expect(createSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("accepts a lowercase jenis (handler upper-cases it)", async () => {
    mocks.queryResult = {
      data: [
        row(1, "2024-01-02T00:00:00.000Z", {
          nomor_hp: "628123456789",
          nama_terakhir: "Budi",
        }),
      ],
      error: null,
    };

    const res = await GET(makeRequest("?phone=08123456789&jenis=antar"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.exists).toBe(true);
    expect(body.jenis).toBe("ANTAR");
  });

  it("returns exists:false without querying when phone is missing", async () => {
    const res = await GET(makeRequest("?jenis=ANTAR"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ exists: false });
    expect(createSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns exists:false without querying when phone is unnormalizable (no digits)", async () => {
    const res = await GET(makeRequest("?phone=abc-xyz&jenis=ANTAR"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ exists: false });
    expect(createSupabaseAdmin).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Auth guard short-circuits (mirrors requireAdmin behavior)
// ---------------------------------------------------------------------------

describe("GET /api/orders/check-duplicate — auth guard", () => {
  it("returns the 401 response from requireAdmin without querying", async () => {
    mocks.requireAdminResult = {
      user: null as never,
      error: NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 }),
    };

    const res = await GET(makeRequest("?phone=08123456789&jenis=ANTAR"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Tidak terautentikasi");
    expect(createSupabaseAdmin).not.toHaveBeenCalled();
  });
});
