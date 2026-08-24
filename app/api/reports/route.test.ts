import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const calls = {
    gte: [] as any[],
    lt: [] as any[],
    not: [] as any[],
    order: [] as any[],
  };
  const order = {
    id: "order-1",
    nomor_tiket: "A KIK 1234",
    nomor_nota: "SXA260525205126934",
    jenis_tugas: "JEMPUT",
    waktu_order: "2026-05-25T12:00:00.000Z",
    waktu_penjemputan: null,
    waktu_assigned: null,
    waktu_kurir_selesai: "2026-05-25T13:00:00.000Z",
    waktu_selesai: "2026-06-01T01:00:00.000Z",
    waktu_input_nota: "2026-05-25T13:51:00.000Z",
    status_id: 6,
    sla_tiket_menit: null,
    sla_tiket_status: null,
    sla_kurir_menit: null,
    sla_kurir_status: null,
    sla_nota_menit: null,
    sla_nota_status: null,
    customers: { nomor_hp: "0813-2004-1683", nama_terakhir: "Kiki" },
    created_by_user: { full_name: "Admin" },
  };
  const orders = [
    order,
    {
      ...order,
      id: "order-cancelled",
      nomor_tiket: "J CAN 0001",
      status_id: 7,
    },
    {
      ...order,
      id: "order-not-completed-by-courier",
      nomor_tiket: "J PENDING 0002",
      waktu_kurir_selesai: null,
    },
    {
      ...order,
      id: "order-negative-sla",
      nomor_tiket: "J NEG 0003",
      nomor_nota: "NEG260525200000001",
      waktu_kurir_selesai: "2026-05-25T13:00:00.000Z",
      waktu_input_nota: "2026-05-25T12:00:00.000Z",
      waktu_selesai: null,
    },
  ];

  class Builder {
    _table: string;

    constructor(table: string) {
      this._table = table;
    }

    select() {
      return this;
    }
    gte(...args: any[]) {
      calls.gte.push(args);

      return this;
    }
    lt(...args: any[]) {
      calls.lt.push(args);

      return this;
    }
    not(...args: any[]) {
      calls.not.push(args);

      return this;
    }
    order(...args: any[]) {
      calls.order.push(args);

      return this;
    }
    in() {
      return this;
    }
    then(onFulfilled?: any, onRejected?: any) {
      return Promise.resolve(this._resolve()).then(onFulfilled, onRejected);
    }

    _resolve() {
      if (this._table === "permintaan") {
        return { data: orders, error: null };
      }

      if (this._table === "imported_nota_transactions") {
        return {
          data: [
            {
              nomor_nota: "SXA260525205126934",
              nomor_hp: "6281320041683",
              nama_pelanggan: "Kiki / Rizkiani",
              tanggal_terima: "2026-05-25T13:51:00.000Z",
              tanggal_selesai: "2026-05-29T13:52:00.000Z",
            },
            {
              nomor_nota: "NEG260525200000001",
              nomor_hp: "6281320041683",
              nama_pelanggan: "Kiki / Rizkiani",
              tanggal_terima: "2026-05-25T12:00:00.000Z",
              tanggal_selesai: null,
            },
          ],
          error: null,
        };
      }

      return { data: [], error: null };
    }
  }

  return {
    calls,
    order,
    makeAdminClient: () => ({
      from: (table: string) => new Builder(table),
    }),
  };
});

vi.mock("@/utils/supabase/server", () => ({
  createSupabaseAdmin: () => h.makeAdminClient(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: vi.fn(async () => ({ user: { id: "admin-1" }, error: null })),
}));

import { GET } from "./route";

describe("GET /api/reports", () => {
  beforeEach(() => {
    h.calls.gte.length = 0;
    h.calls.lt.length = 0;
    h.calls.not.length = 0;
    h.calls.order.length = 0;
  });

  it("filters courier recap by ticket date while requiring courier completion", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/reports?type=rekap&startDate=2026-08-09&endDate=2026-08-15",
      ) as any,
    );

    expect(response.status).toBe(200);
    expect(h.calls.gte).toContainEqual([
      "waktu_order",
      "2026-08-08T17:00:00.000Z",
    ]);
    expect(h.calls.lt).toContainEqual([
      "waktu_order",
      "2026-08-15T17:00:00.000Z",
    ]);
    expect(h.calls.not).toContainEqual(["waktu_kurir_selesai", "is", null]);
    expect(h.calls.order).toContainEqual(["waktu_order", { ascending: false }]);
  });

  it("enriches SLA report rows with imported nota data without mutating permintaan rows", async () => {
    const response = await GET(
      new Request("http://localhost/api/reports?type=sla") as any,
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.data[0]).toMatchObject({
      nomor_nota: "SXA260525205126934",
      tanggal_input_nota: "2026-05-25T13:51:00.000Z",
      tanggal_selesai_nota: "2026-05-29T13:52:00.000Z",
      nota_import: {
        matched: true,
        match_reason: "nota_phone_match",
        nomor_hp: "6281320041683",
        nama_pelanggan: "Kiki / Rizkiani",
      },
    });
    expect(h.order).not.toHaveProperty("nota_import");
  });

  it("returns summary and detail data for sla_nota_jemput report type", async () => {
    const response = await GET(
      new Request("http://localhost/api/reports?type=sla_nota_jemput") as any,
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.summary).toMatchObject({
      totalJemput: 2,
      countNoNota: 0,
      countMeet: 1,
      countFailed: 1,
      meetPct: "50%",
    });
    expect(json.data).toHaveLength(2);
    expect(json.data[0].nomor_tiket).toBe("A KIK 1234");
    expect(json.data[1]).toMatchObject({
      nomor_tiket: "J NEG 0003",
      selisih_input_menit: -60,
      selisih_input_durasi: "-1j 0m",
      sla_input_status: "FAILED",
    });
  });
});
