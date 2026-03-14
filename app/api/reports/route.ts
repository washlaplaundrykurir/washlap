/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "tickets";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let query = supabase.from("permintaan").select(`
                id,
                nomor_tiket,
                nomor_nota,
                jenis_tugas,
                alamat_jalan,
                waktu_order,
                waktu_penjemputan,
                waktu_assigned,
                waktu_kurir_selesai,
                waktu_selesai,
                status_id,
                catatan_khusus,
                courier_id,
                sla_tiket_menit,
                sla_tiket_status,
                sla_kurir_menit,
                sla_kurir_status,
                sla_nota_menit,
                sla_nota_status,
                customers:customer_id (
                    nama_terakhir,
                    nomor_hp
                ),
                auth_users:courier_id (
                    full_name,
                    email
                ),
                created_by_user:created_by (
                    full_name
                ),
                status_ref:status_id (
                    nama_status
                ),
                order_items (
                    produk_layanan,
                    jenis_layanan,
                    parfum
                )
            `);

    // Date Filter
    if (startDate && endDate) {
      // Adjust endDate to end of day
      const end = new Date(endDate);

      end.setHours(23, 59, 59, 999);
      query = query
        .gte("waktu_order", new Date(startDate).toISOString())
        .lte("waktu_order", end.toISOString());
    }

    const { data: orders, error } = await query.order("waktu_order", {
      ascending: false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Process data based on report type
    if (type === "rekap") {
      const rekap: Record<
        string,
        {
          name: string;
          antar: number;
          jemput: number;
          total: number;
          meet_pct: string;
          failed_pct: string;
        }
      > = {};

      orders?.forEach((orderItem) => {
        const order = orderItem as any;
        const courierName =
          order.auth_users?.full_name ||
          order.auth_users?.email ||
          (Array.isArray(order.auth_users) && order.auth_users[0]?.full_name) ||
          "Belum Ditugaskan";

        if (!rekap[courierName]) {
          rekap[courierName] = {
            name: courierName,
            antar: 0,
            jemput: 0,
            total: 0,
            meet_pct: "0%",
            failed_pct: "0%",
          };
        }

        // Counter untuk internal calculation
        if (!(rekap[courierName] as any)._meet)
          (rekap[courierName] as any)._meet = 0;
        if (!(rekap[courierName] as any)._failed)
          (rekap[courierName] as any)._failed = 0;

        if (order.status_id >= 3 && order.status_id !== 7) {
          if (
            order.jenis_tugas === "ANTAR" ||
            order.jenis_tugas?.toUpperCase() === "ANTAR"
          ) {
            rekap[courierName].antar++;
          } else if (
            order.jenis_tugas === "JEMPUT" ||
            order.jenis_tugas?.toUpperCase() === "JEMPUT"
          ) {
            rekap[courierName].jemput++;
          }

          rekap[courierName].total =
            rekap[courierName].antar + rekap[courierName].jemput;

          if (order.sla_tiket_status === "MEET") {
            (rekap[courierName] as any)._meet++;
          } else if (order.sla_tiket_status === "FAILED") {
            (rekap[courierName] as any)._failed++;
          }

          const slaTotal =
            (rekap[courierName] as any)._meet +
            (rekap[courierName] as any)._failed;
          if (slaTotal > 0) {
            rekap[courierName].meet_pct =
              Math.round(((rekap[courierName] as any)._meet / slaTotal) * 100) +
              "%";
            rekap[courierName].failed_pct =
              Math.round(
                ((rekap[courierName] as any)._failed / slaTotal) * 100,
              ) + "%";
          }
        }
      });

      return NextResponse.json({ data: Object.values(rekap) });
    } else if (type === "sla") {
      const slaData = orders?.map((order) => {
        // Formatting helper
        const formatDuration = (mins: number | null) => {
          if (mins === null || mins === undefined) return "-";
          const h = Math.floor(mins / 60);
          const m = mins % 60;

          return `${h}j ${m}m`;
        };

        return {
          nomor_tiket: order.nomor_tiket,
          tanggal_tiket: order.waktu_order,
          waktu_penjemputan: order.waktu_penjemputan || "-",
          nomor_nota: order.nomor_nota || "-",
          tanggal_assign: order.waktu_assigned || "-",
          tanggal_diselesaikan_kurir: order.waktu_kurir_selesai || "-",
          tanggal_input_nota: order.waktu_selesai || "-",

          // Pre-calculated SLA Data from DB
          sla_tiket_durasi: formatDuration(order.sla_tiket_menit),
          sla_tiket_status: order.sla_tiket_status || "-",
          sla_kurir_durasi: formatDuration(order.sla_kurir_menit),
          sla_kurir_status: order.sla_kurir_status || "-",
          sla_nota_durasi: formatDuration(order.sla_nota_menit),
          sla_nota_status: order.sla_nota_status || "-",

          // Sorting helper fields
          raw_sla_tiket: order.sla_tiket_menit ?? 0,
          raw_sla_kurir: order.sla_kurir_menit ?? 0,
          raw_sla_nota: order.sla_nota_menit ?? 0,

          dibuat_oleh: (order as any).created_by_user?.full_name || "Customer",
        };
      });

      return NextResponse.json({ data: slaData });
    }

    // Default: Tickets (Raw Data)
    return NextResponse.json({ data: orders });
  } catch (error) {
    console.error("Report API Error:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
