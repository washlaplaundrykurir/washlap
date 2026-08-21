import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const controller: {
    orders: any[];
    user: any;
    statusLogs: any[];
    permintaanUpdate: any[];
    reset: () => void;
  } = {
    orders: [],
    user: { full_name: "Budi Kurir" },
    statusLogs: [],
    permintaanUpdate: [],
    reset() {
      this.orders = [];
      this.user = { full_name: "Budi Kurir" };
      this.statusLogs = [];
      this.permintaanUpdate = [];
    },
  };

  class Builder {
    _table: string;
    _filters: Record<string, any>;
    _payload: any;

    constructor(table: string) {
      this._table = table;
      this._filters = {};
      this._payload = null;
    }

    select() {
      return this;
    }
    eq(col: string, val: any) {
      this._filters[col] = val;

      return this;
    }
    in(col: string, val: any) {
      this._filters[col] = val;

      return this;
    }
    gte() {
      return this;
    }
    lt() {
      return this;
    }
    order() {
      return this;
    }
    update(payload: any) {
      this._payload = payload;

      return this;
    }
    insert(payload: any) {
      if (this._table === "status_logs") {
        controller.statusLogs.push(payload);
      }

      return Promise.resolve({ error: null });
    }
    single() {
      return Promise.resolve(this._resolveSingle());
    }
    then(onFulfilled?: any, onRejected?: any) {
      return Promise.resolve(this._resolve()).then(onFulfilled, onRejected);
    }

    _resolveSingle() {
      if (this._table === "auth_users") {
        return { data: controller.user, error: null };
      }
      if (this._table === "permintaan") {
        const order = controller.orders.find((o) => o.id === this._filters.id);

        return { data: order || null, error: null };
      }

      return { data: null, error: null };
    }

    _resolve() {
      if (this._table === "permintaan") {
        if (this._payload) {
          controller.permintaanUpdate.push({
            payload: this._payload,
            filters: this._filters,
          });

          return { error: null };
        }

        return { data: controller.orders, error: null };
      }

      return { data: [], error: null };
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
  requireKurir: vi.fn(async () => ({
    user: { id: "kurir-user-1", role: "kurir" },
    error: null,
  })),
}));

import { GET } from "./route";

beforeEach(() => {
  h.controller.reset();
  vi.clearAllMocks();
});

describe("GET /api/kurir/tasks", () => {
  it("sorts pending tasks by urutan_kurir ascending (nulls last)", async () => {
    h.controller.orders = [
      {
        id: "order-c",
        nomor_tiket: "TK-003",
        status_id: 2,
        urutan_kurir: null,
        waktu_order: "2026-08-14T08:00:00Z",
      },
      {
        id: "order-a",
        nomor_tiket: "TK-001",
        status_id: 2,
        urutan_kurir: 2,
        waktu_order: "2026-08-14T07:00:00Z",
      },
      {
        id: "order-b",
        nomor_tiket: "TK-002",
        status_id: 2,
        urutan_kurir: 1,
        waktu_order: "2026-08-14T09:00:00Z",
      },
    ];

    const req = {
      url: "http://localhost:3000/api/kurir/tasks?status=pending",
    } as any;
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.data.map((o: any) => o.id)).toEqual([
      "order-b", // urutan 1
      "order-a", // urutan 2
      "order-c", // null (last)
    ]);
  });
});
