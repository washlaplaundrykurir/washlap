import { describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const order = {
    id: "order-1",
    nomor_tiket: "A KIK 1234",
    nomor_nota: "SXA260525205126934",
    jenis_tugas: "ANTAR",
    waktu_order: "2026-05-25T12:00:00.000Z",
    waktu_assigned: "2026-05-25T12:10:00.000Z",
    waktu_kurir_selesai: "2026-05-25T13:00:00.000Z",
    waktu_selesai: "2026-06-01T01:00:00.000Z",
    waktu_input_nota: "2026-05-25T13:45:00.000Z",
    customers: { nomor_hp: "0813-2004-1683" },
  };

  class Builder {
    _table: string;

    constructor(table: string) {
      this._table = table;
    }

    select() {
      return this;
    }

    eq() {
      return this;
    }

    order() {
      return this;
    }

    limit() {
      return this;
    }

    maybeSingle() {
      return Promise.resolve(this._resolveSingle());
    }

    then(onFulfilled?: any, onRejected?: any) {
      return Promise.resolve(this._resolve()).then(onFulfilled, onRejected);
    }

    _resolveSingle() {
      if (this._table === "permintaan") {
        return { data: order, error: null };
      }

      if (this._table === "imported_nota_transactions") {
        return {
          data: {
            nomor_nota: "SXA260525205126934",
            nomor_hp: "6281320041683",
            nama_pelanggan: "Kiki / Rizkiani",
            tanggal_terima: "2026-05-25T13:51:00.000Z",
            tanggal_selesai: "2026-05-29T13:52:00.000Z",
          },
          error: null,
        };
      }

      return { data: null, error: null };
    }

    _resolve() {
      if (this._table === "status_logs") {
        return {
          data: [
            {
              id: "log-1",
              permintaan_id: "order-1",
              status_id_baru: 2,
              created_at: "2026-05-25T12:10:01.000Z",
              changed_by: "admin-1",
              auth_users: {
                full_name: "Admin A",
                email: "admin@example.com",
                role: "admin",
              },
              status_ref: { nama_status: "Ditugaskan" },
            },
            {
              id: "log-2",
              permintaan_id: "order-1",
              status_id_baru: 2,
              created_at: "2026-05-25T12:20:01.000Z",
              changed_by: "admin-1",
              auth_users: {
                full_name: "Admin A",
                email: "admin@example.com",
                role: "admin",
              },
              status_ref: { nama_status: "Ditugaskan" },
            },
            {
              id: "log-3",
              permintaan_id: "order-1",
              status_id_baru: 5,
              created_at: "2026-05-25T13:00:01.000Z",
              changed_by: "kurir-1",
              auth_users: {
                full_name: "Kurir A",
                email: "kurir@example.com",
                role: "kurir",
              },
              status_ref: { nama_status: "Proses Antar" },
            },
            {
              id: "log-4",
              permintaan_id: "order-1",
              status_id_baru: 6,
              created_at: "2026-06-01T01:00:01.000Z",
              changed_by: "admin-1",
              auth_users: {
                full_name: "Admin A",
                email: "admin@example.com",
                role: "admin",
              },
              status_ref: { nama_status: "Selesai" },
            },
          ],
          error: null,
        };
      }

      return { data: [], error: null };
    }
  }

  return {
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

describe("GET /api/logs", () => {
  it("returns enriched timeline events for the riwayat timeline modal", async () => {
    const response = await GET(
      new Request("http://localhost/api/logs?orderId=order-1") as any,
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "transaksi_created",
          title: "Create transaksi",
          created_at: "2026-05-25T13:51:00.000Z",
        }),
        expect.objectContaining({
          type: "admin_nota_input",
          title: "Isi nomor nota oleh admin",
          created_at: "2026-05-25T13:45:00.000Z",
        }),
        expect.objectContaining({
          type: "ticket_created",
          title: "Create tiket",
          created_at: "2026-05-25T12:00:00.000Z",
        }),
        expect.objectContaining({
          type: "ticket_assigned",
          title: "Tiket ditugaskan ke kurir",
          created_at: "2026-05-25T12:10:01.000Z",
        }),
        expect.objectContaining({
          type: "ticket_reassigned",
          title: "Tiket dipindah ke kurir lain",
          created_at: "2026-05-25T12:20:01.000Z",
        }),
        expect.objectContaining({
          type: "courier_completed",
          title: "Selesai oleh kurir",
          created_at: "2026-05-25T13:00:01.000Z",
        }),
        expect.objectContaining({
          type: "imported_nota_created",
          title: "Create nota dari import",
          created_at: "2026-05-25T13:51:00.000Z",
        }),
        expect.objectContaining({
          type: "antar_ticket_completed",
          title: "Selesai tiket antar",
          created_at: "2026-06-01T01:00:01.000Z",
        }),
      ]),
    );
  });
});
