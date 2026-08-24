/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { wibDayStartUtc, wibDayEndExclusiveUtc } from "@/lib/datetime";
import { calculateSLANota, calculateActiveMinutes } from "@/lib/sla-helper";
import {
  enrichWithNotaImports,
  type ImportedNotaRecord,
} from "@/lib/nota-import";

async function fetchImportedNotas(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  orders: Array<{ nomor_nota?: string | null }>,
): Promise<ImportedNotaRecord[]> {
  const nomorNotas = Array.from(
    new Set(
      orders
        .map((order) => order.nomor_nota?.trim())
        .filter((nota): nota is string => Boolean(nota)),
    ),
  );

  if (nomorNotas.length === 0) return [];

  const { data, error } = await supabase
    .from("imported_nota_transactions")
    .select(
      "nomor_nota, nomor_hp, nama_pelanggan, tanggal_terima, tanggal_selesai",
    )
    .in("nomor_nota", nomorNotas);

  if (error) {
    throw error;
  }

  return (data || []) as ImportedNotaRecord[];
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin();

  if (authError) return authError;

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
                waktu_input_nota,
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

    // Date Filter (WIB calendar day -> UTC instants for the timestamptz column).
    // All report tabs use the ticket/order date so their rows stay consistent
    // for the same selected range. Rekap still requires courier completion below.
    const dateField = "waktu_order";

    if (startDate && endDate) {
      const lower = wibDayStartUtc(startDate);
      const upper = wibDayEndExclusiveUtc(endDate);

      if (lower) query = query.gte(dateField, lower);
      if (upper) query = query.lt(dateField, upper);
    }

    if (type === "rekap") {
      query = query.not("waktu_kurir_selesai", "is", null);
    }

    const { data: orders, error } = await query.order(dateField, {
      ascending: false,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const notaImports = await fetchImportedNotas(supabase, orders || []);
    const enrichedOrders = enrichWithNotaImports(orders || [], notaImports);

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

      enrichedOrders.forEach((orderItem) => {
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
      const slaData = enrichedOrders.map((order) => {
        // Formatting helper
        const formatDuration = (mins: number | null) => {
          if (mins === null || mins === undefined) return "-";
          const h = Math.floor(mins / 60);
          const m = mins % 60;

          return `${h}j ${m}m`;
        };

        let slaNotaMenit = order.sla_nota_menit;
        let slaNotaStatus = order.sla_nota_status;

        if (
          (slaNotaMenit === null || slaNotaMenit === undefined) &&
          order.waktu_kurir_selesai
        ) {
          const tglSelesaiNota =
            order.nota_import?.tanggal_selesai || order.waktu_selesai;

          if (tglSelesaiNota) {
            const calculatedSlaNota = calculateSLANota(
              order.waktu_kurir_selesai,
              tglSelesaiNota,
            );

            if (calculatedSlaNota) {
              slaNotaMenit = calculatedSlaNota.minutes;
              slaNotaStatus = calculatedSlaNota.status;
            }
          }
        }

        const courierName =
          (order as any).auth_users?.full_name ||
          (order as any).auth_users?.email ||
          (Array.isArray((order as any).auth_users) &&
            (order as any).auth_users[0]?.full_name) ||
          "-";

        return {
          nomor_tiket: order.nomor_tiket,
          nama_kurir: courierName,
          tanggal_tiket: order.waktu_order,
          waktu_penjemputan: order.waktu_penjemputan || "-",
          nomor_nota: order.nomor_nota || "-",
          tanggal_assign: order.waktu_assigned || "-",
          tanggal_diselesaikan_kurir: order.waktu_kurir_selesai || "-",
          tanggal_input_nota:
            order.waktu_input_nota ||
            order.waktu_selesai ||
            "-",
          tanggal_selesai_nota: order.nota_import?.tanggal_selesai || "-",
          nota_import: order.nota_import,

          // Pre-calculated SLA Data from DB or fallback dynamic calculation
          sla_tiket_durasi: formatDuration(order.sla_tiket_menit),
          sla_tiket_status: order.sla_tiket_status || "-",
          sla_kurir_durasi: formatDuration(order.sla_kurir_menit),
          sla_kurir_status: order.sla_kurir_status || "-",
          sla_nota_durasi: formatDuration(slaNotaMenit),
          sla_nota_status: slaNotaStatus || "-",

          // Sorting helper fields
          raw_sla_tiket: order.sla_tiket_menit ?? 0,
          raw_sla_kurir: order.sla_kurir_menit ?? 0,
          raw_sla_nota: slaNotaMenit ?? 0,

          dibuat_oleh: (order as any).created_by_user?.full_name || "Customer",
        };
      });

      return NextResponse.json({ data: slaData });
    } else if (type === "sla_nota_jemput") {
      const jemputOrders = enrichedOrders.filter(
        (o) =>
          o.jenis_tugas?.toUpperCase() === "JEMPUT" &&
          o.status_id !== 7 &&
          Boolean(o.waktu_kurir_selesai),
      );

      const formatDuration = (mins: number | null) => {
        if (mins === null || mins === undefined) return "-";
        const sign = mins < 0 ? "-" : "";
        const absoluteMinutes = Math.abs(mins);
        const h = Math.floor(absoluteMinutes / 60);
        const m = absoluteMinutes % 60;

        return `${sign}${h}j ${m}m`;
      };

      const getWeekNumber = (dateStr: string | null) => {
        if (!dateStr || dateStr === "-") return "-";
        const date = new Date(dateStr);

        if (Number.isNaN(date.getTime())) return "-";

        const d = new Date(
          Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
        );
        const dayNum = d.getUTCDay() || 7;

        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNo = Math.ceil(
          ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
        );

        return `W${weekNo}`;
      };

      let countNoNota = 0;
      let countMeet = 0;
      let countFailed = 0;

      const detailData = jemputOrders.map((order) => {
        const hasNota = Boolean(order.nomor_nota);
        const tglInputNota =
          order.waktu_input_nota ||
          order.waktu_selesai ||
          null;

        let selisihInputMenit: number | null = null;
        let slaInputStatus = "-";

        if (order.waktu_kurir_selesai && tglInputNota) {
          const kurirSelesaiAt = new Date(order.waktu_kurir_selesai).getTime();
          const inputNotaAt = new Date(tglInputNota).getTime();
          const isInputBeforeCourierCompletion = inputNotaAt < kurirSelesaiAt;

          selisihInputMenit = isInputBeforeCourierCompletion
            ? -calculateActiveMinutes(
                tglInputNota,
                order.waktu_kurir_selesai,
                11,
                21,
              )
            : calculateActiveMinutes(
                order.waktu_kurir_selesai,
                tglInputNota,
                11,
                21,
              );
          slaInputStatus =
            isInputBeforeCourierCompletion || selisihInputMenit > 120
              ? "FAILED"
              : "MEET";
        }

        if (!hasNota) {
          countNoNota++;
        } else if (slaInputStatus === "MEET") {
          countMeet++;
        } else if (slaInputStatus === "FAILED") {
          countFailed++;
        }

        const isNotaMatched = Boolean(
          order.nomor_nota && order.nota_import?.matched,
        );
        const tglUploadNota = isNotaMatched
          ? order.nota_import?.tanggal_terima || null
          : null;
        let selisihUploadMenit: number | null = null;

        if (order.waktu_kurir_selesai && tglUploadNota) {
          selisihUploadMenit = calculateActiveMinutes(
            order.waktu_kurir_selesai,
            tglUploadNota,
            11,
            21,
          );
        }

        const courierName =
          (order as any).auth_users?.full_name ||
          (order as any).auth_users?.email ||
          (Array.isArray((order as any).auth_users) &&
            (order as any).auth_users[0]?.full_name) ||
          "-";

        return {
          nomor_tiket: order.nomor_tiket,
          nama_kurir: courierName,
          nama_cust:
            (order as any).customers?.nama_terakhir ||
            (isNotaMatched ? order.nota_import?.nama_pelanggan : null) ||
            "-",
          nomor_hp:
            (order as any).customers?.nomor_hp ||
            (isNotaMatched ? order.nota_import?.nomor_hp : null) ||
            "-",
          tanggal_tiket: order.waktu_order,
          week: getWeekNumber(order.waktu_order),
          waktu_kurir_selesai: order.waktu_kurir_selesai || "-",
          nomor_nota: order.nomor_nota || "-",
          tanggal_input_nota: tglInputNota || "-",
          selisih_input_menit: selisihInputMenit,
          selisih_input_durasi: formatDuration(selisihInputMenit),
          sla_input_status: slaInputStatus,
          has_uploaded_nota: isNotaMatched ? "Ya" : "Tidak",
          tanggal_nota_upload: tglUploadNota || "-",
          selisih_upload_menit: selisihUploadMenit,
          selisih_upload_durasi: formatDuration(selisihUploadMenit),
          nota_import: order.nota_import,
        };
      });

      const totalJemput = jemputOrders.length;
      const totalSlaEvaluated = countMeet + countFailed;
      const meetPct =
        totalSlaEvaluated > 0
          ? `${Math.round((countMeet / totalSlaEvaluated) * 100)}%`
          : "0%";

      return NextResponse.json({
        summary: {
          totalJemput,
          countNoNota,
          countMeet,
          countFailed,
          meetPct,
        },
        data: detailData,
      });
    } else if (type === "logs") {
      const { data: logs, error: logsError } = await supabase
        .from("status_logs")
        .select(
          `
          id,
          created_at,
          permintaan:permintaan_id (
            nomor_tiket,
            nomor_nota
          ),
          status_ref:status_id_baru (
            nama_status
          ),
          auth_users:changed_by (
            full_name
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (logsError) {
        return NextResponse.json({ error: logsError.message }, { status: 500 });
      }

      const formattedLogs = logs?.map((log: any) => ({
        id: log.id,
        waktu: log.created_at,
        tiket: log.permintaan?.nomor_tiket || "-",
        nota: log.permintaan?.nomor_nota || "-",
        status: log.status_ref?.nama_status || "-",
        oleh: log.auth_users?.full_name || "System",
      }));

      return NextResponse.json({ data: formattedLogs });
    }

    // Default: Tickets (Raw Data)
    return NextResponse.json({ data: enrichedOrders });
  } catch (error) {
    console.error("Report API Error:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
