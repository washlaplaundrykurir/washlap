/**
 * Integration tests for the extended `POST /api/orders` handler.
 *
 * Feature: admin-ticket-wa-and-duplicate-warnings.
 *
 * Covers:
 *  - Task 6.2 — the open-ticket duplicate gate (Req 3.2, 3.6, 3.9, 4.4, 4.5).
 *  - Task 6.3 — the non-blocking nota warning + enriched response shape
 *               (Req 2.1, 2.3, 2.4, 2.5, 1.2, 1.5).
 *
 * The Supabase access layer (`@/utils/supabase/server`) is mocked with a
 * controllable, chainable query builder so each test can program the exact
 * sequence of DB results the handler will observe. `@/lib/duplicate-checks`
 * and `@/lib/whatsapp` are kept REAL so `notaMatches`, `isOpenTicket`,
 * `shouldCheckNota`, and `toLocal08` all run for real.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mock infrastructure
// ---------------------------------------------------------------------------
//
// `vi.hoisted` lets us share a mutable `controller` (programmed per test) and
// the fake client factories with the hoisted `vi.mock` factory below.
//
// The fake client exposes `.from(table)` returning a fresh chainable Builder.
// Chain methods (`select/eq/not/neq/ilike/order/insert/upsert/update`) record
// the call and return `this`. Terminal `.single()`/`.maybeSingle()` return a
// Promise of a canned result; awaiting the builder directly (thenable) returns
// a canned result for the chains the handler awaits without `.single()` (the
// open-rows query, the nota `ilike` query, and the order_items/status_logs
// inserts).
//
// The canned result is chosen by inspecting which methods were called on the
// builder and the table name (most robust against the many "permintaan" calls):
//   - customers + upsert        -> { data: { id: "cust-1" } }   (+count)
//   - customers + maybeSingle   -> gate customer lookup
//   - customers + single        -> blank-address fallback lookup
//   - permintaan + insert       -> { data: { id: "perm-<TYPE>" } } (+record)
//   - permintaan + ilike        -> programmed nota rows           (+record)
//   - permintaan (select only)  -> programmed open rows
//   - order_items + insert      -> { error } (+count)
//   - status_logs + insert      -> { error: null } (+count)
const h = vi.hoisted(() => {
  type Calls = {
    customerUpsert: number;
    permintaanInsert: any[];
    orderItemsInsert: number;
    statusLogsInsert: number;
    notaQuery: any[];
  };

  const controller: {
    gateCustomer: any;
    openRows: any[];
    openErr: any;
    notaRows: any[];
    notaErr: any;
    existingCustomer: any;
    customerUpsertError: any;
    permintaanInsertError: any;
    orderItemsError: any;
    calls: Calls;
    reset: () => void;
  } = {
    gateCustomer: null,
    openRows: [],
    openErr: null,
    notaRows: [],
    notaErr: null,
    existingCustomer: null,
    customerUpsertError: null,
    permintaanInsertError: null,
    orderItemsError: null,
    calls: {
      customerUpsert: 0,
      permintaanInsert: [],
      orderItemsInsert: 0,
      statusLogsInsert: 0,
      notaQuery: [],
    },
    reset() {
      this.gateCustomer = null;
      this.openRows = [];
      this.openErr = null;
      this.notaRows = [];
      this.notaErr = null;
      this.existingCustomer = null;
      this.customerUpsertError = null;
      this.permintaanInsertError = null;
      this.orderItemsError = null;
      this.calls = {
        customerUpsert: 0,
        permintaanInsert: [],
        orderItemsInsert: 0,
        statusLogsInsert: 0,
        notaQuery: [],
      };
    },
  };

  class Builder {
    _table: string;
    _methods: Set<string>;
    _insertPayload: any;
    _captured: any;
    _resolved: boolean;
    _resolvedValue: any;

    constructor(table: string) {
      this._table = table;
      this._methods = new Set();
      this._insertPayload = null;
      this._captured = {};
      this._resolved = false;
      this._resolvedValue = undefined;
    }

    _chain(name: string) {
      this._methods.add(name);
      return this;
    }

    select() {
      return this._chain("select");
    }
    eq() {
      return this._chain("eq");
    }
    neq() {
      return this._chain("neq");
    }
    not() {
      return this._chain("not");
    }
    order() {
      return this._chain("order");
    }
    ilike(...args: any[]) {
      this._captured.ilike = args;
      return this._chain("ilike");
    }
    insert(payload: any) {
      this._insertPayload = payload;
      return this._chain("insert");
    }
    upsert(payload: any) {
      this._insertPayload = payload;
      return this._chain("upsert");
    }
    update(payload: any) {
      this._insertPayload = payload;
      return this._chain("update");
    }

    single() {
      this._methods.add("single");
      return Promise.resolve(this._resolve());
    }
    maybeSingle() {
      this._methods.add("maybeSingle");
      return Promise.resolve(this._resolve());
    }

    // Thenable: supports `await supabase.from(...).select(...)....` chains that
    // the handler awaits without a terminal `.single()`/`.maybeSingle()`.
    then(onFulfilled?: any, onRejected?: any) {
      return Promise.resolve(this._resolve()).then(onFulfilled, onRejected);
    }

    _resolve() {
      if (this._resolved) return this._resolvedValue;
      const c = controller;
      const m = this._methods;
      let result: any;

      if (this._table === "customers") {
        if (m.has("upsert")) {
          c.calls.customerUpsert += 1;
          result = { data: { id: "cust-1" }, error: c.customerUpsertError };
        } else if (m.has("maybeSingle")) {
          result = { data: c.gateCustomer, error: null };
        } else {
          // blank-address fallback lookup (`.select(...).eq(...).single()`)
          result = { data: c.existingCustomer, error: null };
        }
      } else if (this._table === "permintaan") {
        if (m.has("insert")) {
          c.calls.permintaanInsert.push(this._insertPayload);
          const jt = this._insertPayload?.jenis_tugas ?? "UNKNOWN";
          result = {
            data: { id: `perm-${jt}` },
            error: c.permintaanInsertError,
          };
        } else if (m.has("ilike")) {
          c.calls.notaQuery.push(this._captured);
          result = { data: c.notaRows, error: c.notaErr };
        } else {
          // open-ticket gate query (`.select(...).eq(...).not(status_id in ...)`)
          result = { data: c.openRows, error: c.openErr };
        }
      } else if (this._table === "order_items") {
        c.calls.orderItemsInsert += 1;
        result = { error: c.orderItemsError };
      } else if (this._table === "status_logs") {
        c.calls.statusLogsInsert += 1;
        result = { error: null };
      } else {
        result = { data: null, error: null };
      }

      this._resolved = true;
      this._resolvedValue = result;
      return result;
    }
  }

  const makeAdminClient = () => ({
    from: (table: string) => new Builder(table),
  });
  const makeAuthClient = () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "admin-1" } } }),
    },
  });

  return { controller, makeAdminClient, makeAuthClient };
});

// Mock the Supabase server module: keep the duplicate-checks / whatsapp libs real.
vi.mock("@/utils/supabase/server", () => ({
  createSupabaseAdmin: () => h.makeAdminClient(),
  createClient: () => h.makeAuthClient(),
}));

// `cookies()` from next/headers must be awaitable and benign in node tests.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {} }),
}));

// Import AFTER mocks are registered (vi.mock is hoisted above imports).
import { POST } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A valid body. A non-blank `alamat` skips the blank-address fallback lookup. */
const baseBody = {
  nama: "Budi",
  nomorHP: "08123456789",
  alamat: "Jl. Merdeka 45",
  googleMapsLink: "https://maps.google.com/?q=1,2",
  permintaan: ["antar"],
  waktuPenjemputan: "2025-01-01T10:00",
  produkLayanan: "cuci-setrika",
  produkLayananManual: "",
  jenisLayanan: "reguler",
  parfum: "soft",
  catatan: "Antar sore",
  nomorNota: "INV-001",
};

function makeBody(overrides: Record<string, any> = {}) {
  return { ...baseBody, ...overrides };
}

/** Build a minimal NextRequest-like object: the handler only calls `.json()`. */
function makeReq(body: any) {
  return { json: async () => body } as any;
}

async function callPost(body: any) {
  const res = await POST(makeReq(body));
  const json = await res.json();
  return { status: res.status, json };
}

const openRow = (jenis: "ANTAR" | "JEMPUT", status_id = 1, waktu_order = "2025-01-01T00:00:00.000Z") => ({
  id: `open-${jenis}`,
  jenis_tugas: jenis,
  status_id,
  waktu_order,
});

beforeEach(() => {
  h.controller.reset();
  vi.clearAllMocks();
});

// ===========================================================================
// Task 6.2 — Open-ticket duplicate gate (Req 3.2, 3.6, 3.9, 4.4, 4.5)
// ===========================================================================

describe("POST /api/orders — duplicate gate (task 6.2)", () => {
  it("A) unconfirmed duplicate → 409 requiresConfirmation with NO inserts", async () => {
    h.controller.gateCustomer = { id: "cust-1", nama_terakhir: "Budi" };
    h.controller.openRows = [openRow("ANTAR", 1)];

    const { status, json } = await callPost(
      makeBody({ permintaan: ["antar"] }), // no confirmDuplicate
    );

    expect(status).toBe(409);
    expect(json.requiresConfirmation).toBe(true);
    expect(json.matches).toEqual([
      { jenis_tugas: "ANTAR", nama: "Budi", nomor_hp_local: "08123456789" },
    ]);

    // Atomic gate: fail before ANY write.
    expect(h.controller.calls.customerUpsert).toBe(0);
    expect(h.controller.calls.permintaanInsert).toHaveLength(0);
    expect(h.controller.calls.orderItemsInsert).toBe(0);
    expect(h.controller.calls.statusLogsInsert).toBe(0);
  });

  it("B) confirmDuplicate[ANTAR]=true → 200 success, one ANTAR order, insert path invoked", async () => {
    h.controller.gateCustomer = { id: "cust-1", nama_terakhir: "Budi" };
    h.controller.openRows = [openRow("ANTAR", 1)];
    h.controller.notaRows = []; // no nota duplicate

    const { status, json } = await callPost(
      makeBody({ permintaan: ["antar"], confirmDuplicate: { ANTAR: true } }),
    );

    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.orders).toHaveLength(1);
    expect(json.orders[0].jenis_tugas).toBe("ANTAR");

    // Insert path WAS invoked.
    expect(h.controller.calls.customerUpsert).toBe(1);
    expect(h.controller.calls.permintaanInsert).toHaveLength(1);
    expect(h.controller.calls.permintaanInsert[0].jenis_tugas).toBe("ANTAR");
  });

  it("C) per-type independence: confirm ANTAR, JEMPUT still open → 409, JEMPUT match, NO inserts", async () => {
    h.controller.gateCustomer = { id: "cust-1", nama_terakhir: "Budi" };
    h.controller.openRows = [openRow("ANTAR", 1), openRow("JEMPUT", 2)];

    const { status, json } = await callPost(
      makeBody({
        permintaan: ["antar", "jemput"],
        confirmDuplicate: { ANTAR: true }, // JEMPUT not confirmed
      }),
    );

    expect(status).toBe(409);
    expect(json.requiresConfirmation).toBe(true);
    // ANTAR is confirmed → skipped; only the unconfirmed JEMPUT blocks.
    expect(json.matches).toHaveLength(1);
    expect(json.matches[0].jenis_tugas).toBe("JEMPUT");

    // Atomic: a partially-confirmed multi-type submission inserts nothing.
    expect(h.controller.calls.customerUpsert).toBe(0);
    expect(h.controller.calls.permintaanInsert).toHaveLength(0);
  });

  it("D) confirmDuplicate as plain boolean `true` confirms all types → 200", async () => {
    h.controller.gateCustomer = { id: "cust-1", nama_terakhir: "Budi" };
    h.controller.openRows = [openRow("ANTAR", 1)];
    h.controller.notaRows = [];

    const { status, json } = await callPost(
      makeBody({ permintaan: ["antar"], confirmDuplicate: true }),
    );

    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(h.controller.calls.permintaanInsert).toHaveLength(1);
  });
});

// ===========================================================================
// Task 6.3 — Nota warning + response shape (Req 2.1, 2.3, 2.4, 2.5, 1.2, 1.5)
// ===========================================================================

describe("POST /api/orders — nota warning & response shape (task 6.3)", () => {
  it("E) matching nota (same type, trimmed + case-insensitive) → 200 with duplicate_nota warning", async () => {
    // No open duplicate so the gate passes straight through.
    h.controller.gateCustomer = null;
    // Stored row differs by case + the submitted value has surrounding spaces,
    // so the REAL `notaMatches` exercises trim + case-insensitive (Req 2.5).
    h.controller.notaRows = [
      { id: "other-perm", nomor_nota: "INV-001", jenis_tugas: "ANTAR" },
    ];

    const { status, json } = await callPost(
      makeBody({ permintaan: ["antar"], nomorNota: "  inv-001  " }),
    );

    expect(status).toBe(200);
    expect(json.success).toBe(true);
    // The nota query WAS issued and a warning produced for the trimmed value.
    expect(h.controller.calls.notaQuery).toHaveLength(1);
    expect(json.warnings).toEqual([
      { type: "duplicate_nota", jenis_tugas: "ANTAR", nomor_nota: "inv-001" },
    ]);
  });

  it("F) nota exists only for a DIFFERENT type → no warning", async () => {
    h.controller.gateCustomer = null;
    // The route filters candidates with `.eq("jenis_tugas", type)`, so the DB
    // only returns same-type rows. A different-type-only nota therefore yields
    // an empty result set for the queried type → no warning.
    h.controller.notaRows = [];

    const { status, json } = await callPost(
      makeBody({ permintaan: ["antar"], nomorNota: "INV-777" }),
    );

    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(h.controller.calls.notaQuery).toHaveLength(1);
    expect(json.warnings).toEqual([]);
  });

  it("G) empty/whitespace nota → nota check skipped, no warning", async () => {
    h.controller.gateCustomer = null;
    h.controller.notaRows = [
      { id: "other-perm", nomor_nota: "INV-001", jenis_tugas: "ANTAR" },
    ];

    const { status, json } = await callPost(
      makeBody({ permintaan: ["antar"], nomorNota: "   " }),
    );

    expect(status).toBe(200);
    expect(json.success).toBe(true);
    // shouldCheckNota("") is false → the `.ilike` nota query is never issued.
    expect(h.controller.calls.notaQuery).toHaveLength(0);
    expect(json.warnings).toEqual([]);
  });

  it("does not warn when the only matching nota row is the order just inserted", async () => {
    h.controller.gateCustomer = null;
    h.controller.notaRows = [
      { id: "perm-ANTAR", nomor_nota: "INV-001", jenis_tugas: "ANTAR" },
    ];

    const { status, json } = await callPost(
      makeBody({ permintaan: ["antar"], nomorNota: "INV-001" }),
    );

    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(h.controller.calls.notaQuery).toHaveLength(1);
    expect(json.warnings).toEqual([]);
  });

  it("H) response shape: orders[] keys + normalized 62xxx nomor_hp (OQ-4)", async () => {
    h.controller.gateCustomer = null;
    h.controller.notaRows = [];

    const { status, json } = await callPost(
      makeBody({ permintaan: ["antar"], nomorHP: "08123456789" }),
    );

    expect(status).toBe(200);
    expect(json.orders).toHaveLength(1);

    const order = json.orders[0];
    expect(Object.keys(order).sort()).toEqual(
      [
        "alamat_jalan",
        "catatan_khusus",
        "id",
        "jenis_tugas",
        "nama",
        "nomor_hp",
        "nomor_tiket",
        "waktu_penjemputan",
      ].sort(),
    );

    // nomor_hp is the normalized 62xxx form of the submitted phone (Req 1.2/1.5).
    expect(order.nomor_hp).toBe("628123456789");
  });
});
