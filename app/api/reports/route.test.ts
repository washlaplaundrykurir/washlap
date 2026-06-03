import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const order = {
    id: "order-1",
    nomor_tiket: "A KIK 1234",
    nomor_nota: "SXA260525205126934",
    jenis_tugas: "ANTAR",
    waktu_order: "2026-05-25T12:00:00.000Z",
    waktu_penjemputan: null,
    waktu_assigned: null,
    waktu_kurir_selesai: "2026-05-25T13:00:00.000Z",
    waktu_selesai: "2026-06-01T01:00:00.000Z",
    waktu_input_nota: null,
    sla_tiket_menit: null,
    sla_tiket_status: null,
    sla_kurir_menit: null,
    sla_kurir_status: null,
    sla_nota_menit: null,
    sla_nota_status: null,
    customers: { nomor_hp: "0813-2004-1683", nama_terakhir: "Kiki" },
    created_by_user: { full_name: "Admin" },
  };

  class Builder {
    _table: string;

    constructor(table: string) {
      this._table = table;
    }

    select() {
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
    in() {
      return this;
    }
    then(onFulfilled?: any, onRejected?: any) {
      return Promise.resolve(this._resolve()).then(onFulfilled, onRejected);
    }

    _resolve() {
      if (this._table === "permintaan") {
        return { data: [order], error: null };
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
          ],
          error: null,
        };
      }

      return { data: [], error: null };
    }
  }

  return {
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
});
