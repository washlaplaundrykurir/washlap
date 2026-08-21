import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const controller: {
    courier: any;
    permintaanUpdates: any[];
    permintaanUpdateError: any;
    reset: () => void;
  } = {
    courier: null,
    permintaanUpdates: [],
    permintaanUpdateError: null,
    reset() {
      this.courier = null;
      this.permintaanUpdates = [];
      this.permintaanUpdateError = null;
    },
  };

  class Builder {
    _table: string;
    _methods: Set<string>;
    _payload: any;
    _filters: Record<string, any>;

    constructor(table: string) {
      this._table = table;
      this._methods = new Set();
      this._payload = null;
      this._filters = {};
    }

    _chain(name: string) {
      this._methods.add(name);

      return this;
    }

    select() {
      return this._chain("select");
    }
    eq(col: string, val: any) {
      this._filters[col] = val;

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
        return { data: c.courier, error: null };
      }
      if (this._table === "permintaan") {
        if (this._methods.has("update")) {
          c.permintaanUpdates.push({
            payload: this._payload,
            filters: this._filters,
          });

          return { error: c.permintaanUpdateError };
        }

        return { data: null, error: null };
      }

      return { data: null, error: null };
    }
  }

  const makeAdminClient = () => ({
    from: (table: string) => new Builder(table),
  });

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

// Import AFTER mocks are registered
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

describe("PUT /api/tasks/reorder", () => {
  it("rejects empty or non-array task_ids with 400", async () => {
    const { status, json } = await callPut({ task_ids: [] });

    expect(status).toBe(400);
    expect(json.error).toMatch(/array/i);
    expect(h.controller.permintaanUpdates).toHaveLength(0);
  });

  it("rejects when courier does not exist", async () => {
    h.controller.courier = null;

    const { status, json } = await callPut({
      courier_id: "non-existent",
      task_ids: ["order-1", "order-2"],
    });

    expect(status).toBe(400);
    expect(json.error).toMatch(/tidak ditemukan/i);
    expect(h.controller.permintaanUpdates).toHaveLength(0);
  });

  it("successfully updates urutan_kurir sequentially", async () => {
    h.controller.courier = { id: "kurir-1", role: "kurir", is_active: true };

    const { status, json } = await callPut({
      courier_id: "kurir-1",
      task_ids: ["order-2", "order-1", "order-3"],
    });

    expect(status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.count).toBe(3);

    expect(h.controller.permintaanUpdates).toHaveLength(3);
    expect(h.controller.permintaanUpdates[0]).toEqual({
      payload: { urutan_kurir: 1 },
      filters: { id: "order-2", courier_id: "kurir-1" },
    });
    expect(h.controller.permintaanUpdates[1]).toEqual({
      payload: { urutan_kurir: 2 },
      filters: { id: "order-1", courier_id: "kurir-1" },
    });
    expect(h.controller.permintaanUpdates[2]).toEqual({
      payload: { urutan_kurir: 3 },
      filters: { id: "order-3", courier_id: "kurir-1" },
    });
  });
});
