import { describe, expect, it } from "vitest";

import { buildReportTimeline } from "./report-timeline";

describe("buildReportTimeline", () => {
  it("builds timeline timestamps from order fields, status logs, and imported nota data", () => {
    const timeline = buildReportTimeline(
      {
        id: "order-1",
        jenis_tugas: "JEMPUT",
        waktu_order: "2026-05-25T12:00:00.000Z",
        waktu_assigned: "2026-05-25T12:10:00.000Z",
        waktu_kurir_selesai: "2026-05-25T13:00:00.000Z",
        waktu_input_nota: "2026-05-25T13:45:00.000Z",
        waktu_selesai: "2026-05-25T14:00:00.000Z",
        nota_import: {
          matched: true,
          match_reason: "nota_phone_match",
          tanggal_terima: "2026-05-25T13:51:00.000Z",
        },
      },
      [
        {
          permintaan_id: "order-1",
          status_id_baru: 1,
          created_at: "2026-05-25T12:00:01.000Z",
          auth_users: { role: "admin" },
        },
        {
          permintaan_id: "order-1",
          status_id_baru: 2,
          created_at: "2026-05-25T12:10:01.000Z",
          auth_users: { role: "admin" },
        },
        {
          permintaan_id: "order-1",
          status_id_baru: 2,
          created_at: "2026-05-25T12:20:01.000Z",
          auth_users: { role: "admin" },
        },
        {
          permintaan_id: "order-1",
          status_id_baru: 3,
          created_at: "2026-05-25T13:00:01.000Z",
          auth_users: { role: "kurir" },
        },
        {
          permintaan_id: "order-1",
          status_id_baru: 6,
          created_at: "2026-05-25T14:00:01.000Z",
          auth_users: { role: "admin" },
        },
      ],
    );

    expect(timeline).toEqual({
      transaksi_created_at: "2026-05-25T13:51:00.000Z",
      admin_nota_input_at: "2026-05-25T13:45:00.000Z",
      tiket_created_at: "2026-05-25T12:00:00.000Z",
      tiket_assigned_at: "2026-05-25T12:10:01.000Z",
      tiket_reassigned_at: "2026-05-25T12:20:01.000Z",
      kurir_completed_at: "2026-05-25T13:00:01.000Z",
      kurir_cancelled_at: null,
      imported_nota_created_at: "2026-05-25T13:51:00.000Z",
      jemput_nota_input_at: "2026-05-25T14:00:01.000Z",
      antar_ticket_completed_at: null,
    });
  });

  it("captures courier cancellation and antar ticket completion", () => {
    const timeline = buildReportTimeline(
      {
        id: "order-2",
        jenis_tugas: "ANTAR",
        waktu_order: "2026-05-25T12:00:00.000Z",
        waktu_selesai: "2026-05-25T15:00:00.000Z",
      },
      [
        {
          permintaan_id: "order-2",
          status_id_baru: 7,
          created_at: "2026-05-25T13:30:00.000Z",
          auth_users: { role: "kurir" },
        },
        {
          permintaan_id: "order-2",
          status_id_baru: 6,
          created_at: "2026-05-25T15:00:01.000Z",
          auth_users: { role: "admin" },
        },
      ],
    );

    expect(timeline.kurir_cancelled_at).toBe("2026-05-25T13:30:00.000Z");
    expect(timeline.antar_ticket_completed_at).toBe("2026-05-25T15:00:01.000Z");
    expect(timeline.jemput_nota_input_at).toBeNull();
  });
});
