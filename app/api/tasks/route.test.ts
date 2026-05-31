/**
 * Integration tests for the courier-assignment guard in `PUT /api/tasks`.
 *
 * Feature: prevent assigning a disabled courier.
 *
 * A disabled courier (auth_users.is_active = false) must NOT be assignable,
 * even via a stale client cache or a direct API call. The handler is the
 * authoritative gate: it looks up the target courier and rejects the update
 * when the account is missing, not a `kurir`, or inactive. Unassigning
 * (courier_id = null) is always allowed.
 *
 * Node environment. `@/utils/supabase/server` and `@/lib/api-auth` are mocked;
 * `@/lib/sla-helper` is left real (not exercised by these assignment cases).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const controller: {
    courier: any; // row returned by the auth_users courier lookup
    permintaanUpdateError: any;
    calls: { permintaanUpdate: any[]; courierLookups: number };
    reset: () => void;
  } = {
    courier: null,
    permintaanUpdateError: null,
    calls: { permintaanUpdate: [], courierLookups: 0 },
    reset() {
      this.courier = null;
      this.permintaanUpdateError = null;
      this.calls = { permintaanUpdate: [], courierLookups: 0 };
    },
  };

  // Chainable, thenable query builder. Canned results are chosen by table +
  // which methods were called:
  //   auth_users + maybeSingle  -> the programmed courier row
  //   permintaan + update       -> records the payload, returns { error }
  //   permintaan + select/single-> benign order row (the SLA branch lookup)
  class Builder {
    _table: string;
    _methods: Set<string>;
    _payload: any;

    constructor(table: string) {
      this._table = table;
      this._methods = new Set();
      this._payload = null;
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
    update(payload: any) {
      this._payload = payload;
      return this._chain("update");
    }

    maybeSingle() {
      this._methods.add("maybeSingle");
      return Promise.resolve(this._resolve());
    }
    single() {
      this._methods.add("single");
      return Promise.resolve(this._resolve());
    }
    then(onFulfilled?: any, onRejected?: any) {
      return Promise.resolve(this._resolve()).then(onFulfilled, onRejected);
    }

    _resolve() {
      const c = controller;

      if (this._table === "auth_users") {
        c.calls.courierLookups += 1;
        return { data: c.courier, error: null };
      }
      if (this._table === "permintaan") {
        if (this._methods.has("update")) {
          c.calls.permintaanUpdate.push(this._payload);
          return { error: c.permintaanUpdateError };
        }
        // SLA-branch order lookup (not hit by assignment-only tests).
        return { data: null, error: null };
      }
      return { data: null, error: null };
    }
  }

  const makeAdminClient = () => ({ from: (table: string) => new Builder(table) });

  return { controller, makeAdminClient };
});

vi.mock("@/utils/supabase/server", () => ({
  createSupabaseAdmin: () => h.makeAdminClient(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () => ({
    user: { id: "admin-1", role: "admin" },
    error: null,
  })),
}));

// Import AFTER mocks are registered.
import { PUT } from "./route";

function makeReq(body: any) {
  return { json: async () => body } as any;
}

async function callPut(body: any) {
  const res = await PUT(makeReq(body));
  const json = await res.json();
  return { status: res.status, json };
}

beforeEach(() => {
  h.controller.reset();
  vi.clearAllMocks();
});

describe("PUT /api/tasks — disabled-courier assignment guard", () => {
  it("rejects assigning a disabled (is_active=false) courier with 400 and no update", async () => {
    h.controller.courier = { id: "kurir-1", role: "kurir", is_active: false };

    const { status, json } = await callPut({
      id: "order-1",
      status_id: 2,
      courier_id: "kurir-1",
    });

    expect(status).toBe(400);
    expect(json.error).toMatch(/dinonaktifkan/i);
    // No write should have happened.
    expect(h.controller.calls.permintaanUpdate).toHaveLength(0);
  });

  it("rejects a courier_id that does not exist with 400 and no update", async () => {
    h.controller.courier = null;

    const { status, json } = await callPut({
      id: "order-1",
      status_id: 2,
      courier_id: "ghost",
    });

    expect(status).toBe(400);
    expect(json.error).toMatch(/tidak ditemukan/i);
    expect(h.controller.calls.permintaanUpdate).toHaveLength(0);
  });

  it("rejects assigning a non-kurir account with 400 and no update", async () => {
    h.controller.courier = { id: "admin-2", role: "admin", is_active: true };

    const { status, json } = await callPut({
      id: "order-1",
      status_id: 2,
      courier_id: "admin-2",
    });

    expect(status).toBe(400);
    expect(json.error).toMatch(/tidak ditemukan/i);
    expect(h.controller.calls.permintaanUpdate).toHaveLength(0);
  });

  it("allows assigning an active courier (200) and writes courier_id", async () => {
    h.controller.courier = { id: "kurir-1", role: "kurir", is_active: true };

    const { status, json } = await callPut({
      id: "order-1",
      status_id: 2,
      courier_id: "kurir-1",
    });

    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(h.controller.calls.permintaanUpdate).toHaveLength(1);
    expect(h.controller.calls.permintaanUpdate[0].courier_id).toBe("kurir-1");
  });

  it("allows unassigning (courier_id null) without a courier lookup", async () => {
    const { status } = await callPut({
      id: "order-1",
      courier_id: null,
    });

    expect(status).toBe(200);
    // Guard is skipped for a null courier_id.
    expect(h.controller.calls.courierLookups).toBe(0);
    expect(h.controller.calls.permintaanUpdate).toHaveLength(1);
    expect(h.controller.calls.permintaanUpdate[0].courier_id).toBeNull();
  });

  it("returns 400 when order id is missing", async () => {
    const { status } = await callPut({ courier_id: "kurir-1" });
    expect(status).toBe(400);
    expect(h.controller.calls.courierLookups).toBe(0);
  });
});
