/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";
import {
  calculateSLAKurir,
  calculateSLATiket,
  calculateSLANota,
} from "@/lib/sla-helper";

// GET - Get orders by jenis_tugas (JEMPUT or ANTAR)
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // JEMPUT, ANTAR, or both if not provided
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const dateField = searchParams.get("dateField") || "waktu_order";
    const search = searchParams.get("search");
    const status = searchParams.get("status"); // pending or selesai
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    // Build query for permintaan with customer and courier info
    let query = supabase
      .from("permintaan")
      .select(
        `
        id,
        nomor_tiket,
        jenis_tugas,
        alamat_jalan,
        google_maps_link,
        waktu_order,
        waktu_penjemputan,
        waktu_kurir_selesai,
        status_id,
        catatan_khusus,
        courier_id,
        nomor_nota,
        customers:customer_id (
          id,
          nomor_hp,
          nama_terakhir
        ),
        auth_users:courier_id (
          id,
          full_name,
          email
        ),
        status_ref:status_id (
          id,
          nama_status
        ),
        order_items (
          id,
          produk_layanan,
          jenis_layanan,
          parfum
        ),
        created_by_user:created_by (
          id,
          full_name
        )
      `,
        { count: "exact" },
      )
      .not("courier_id", "is", null);

    // Type filtering (optional)
    if (type && ["JEMPUT", "ANTAR"].includes(type)) {
      query = query.eq("jenis_tugas", type);
    }

    // Status filtering
    if (status === "pending") {
      query = query.eq("status_id", 2);
    } else if (status === "selesai") {
      query = query.or("status_id.eq.3,status_id.eq.5");
    }

    // Date filtering
    if (startDate) {
      query = query.gte(dateField, startDate);
    }
    if (endDate) {
      // Add one day to include the end date fully
      const nextDay = new Date(endDate);
      nextDay.setDate(nextDay.getDate() + 1);
      query = query.lt(dateField, nextDay.toISOString().split("T")[0]);
    }

    // Search filtering
    if (search) {
      query = query.or(
        `nomor_tiket.ilike.%${search}%,nomor_nota.ilike.%${search}%`,
      );
    }

    // Metadata counts for Selesai page badges
    let totalNoNota = 0;
    let totalWithNota = 0;

    if (status === "selesai") {
      const getBaseCountQuery = () => {
        let q = supabase
          .from("permintaan")
          .select("*", { count: "exact", head: true })
          .or("status_id.eq.3,status_id.eq.5")
          .not("courier_id", "is", null);

        if (type && ["JEMPUT", "ANTAR"].includes(type)) {
          q = q.eq("jenis_tugas", type);
        }

        if (startDate) {
          q = q.gte(dateField, startDate);
        }
        if (endDate) {
          const nextDay = new Date(endDate);
          nextDay.setDate(nextDay.getDate() + 1);
          q = q.lt(dateField, nextDay.toISOString().split("T")[0]);
        }
        if (search) {
          q = q.or(
            `nomor_tiket.ilike.%${search}%,nomor_nota.ilike.%${search}%`,
          );
        }
        return q;
      };

      const [noNotaRes, withNotaRes] = await Promise.all([
        getBaseCountQuery().is("nomor_nota", null),
        getBaseCountQuery().not("nomor_nota", "is", null),
      ]);

      totalNoNota = noNotaRes.count || 0;
      totalWithNota = withNotaRes.count || 0;
    }

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const {
      data: orders,
      error,
      count,
    } = await query
      .order(dateField, {
        ascending: false,
      })
      .range(from, to);

    if (error) {
      console.error("Fetch tasks error:", error);

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: orders,
      total: count || 0,
      totalNoNota,
      totalWithNota,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Server error:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT - Update order status or assign courier
export async function PUT(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    const { id, status_id, courier_id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Order ID diperlukan" },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {};

    if (status_id !== undefined) updateData.status_id = status_id;
    if (courier_id !== undefined) updateData.courier_id = courier_id;
    if (status_id === 2) updateData.waktu_assigned = new Date().toISOString();

    // SLA Calculation
    if (status_id === 3 || status_id === 5 || status_id === 6) {
      const { data: order } = await supabase
        .from("permintaan")
        .select("waktu_penjemputan, waktu_assigned, waktu_kurir_selesai")
        .eq("id", id)
        .single();

      if (order) {
        const now = new Date().toISOString();

        if (status_id === 3 || status_id === 5) {
          updateData.waktu_kurir_selesai = now;

          const slaTiket = calculateSLATiket(order.waktu_penjemputan, now);
          const slaKurir = calculateSLAKurir(
            order.waktu_assigned,
            order.waktu_penjemputan,
            now,
          );

          if (slaTiket) {
            updateData.sla_tiket_menit = slaTiket.minutes;
            updateData.sla_tiket_status = slaTiket.status;
          }
          if (slaKurir) {
            updateData.sla_kurir_menit = slaKurir.minutes;
            updateData.sla_kurir_status = slaKurir.status;
          }
        } else if (status_id === 6) {
          updateData.waktu_selesai = now;

          if (order.waktu_kurir_selesai) {
            const slaNota = calculateSLANota(order.waktu_kurir_selesai, now);

            if (slaNota) {
              updateData.sla_nota_menit = slaNota.minutes;
              updateData.sla_nota_status = slaNota.status;
            }
          }
        }
      }
    }

    const { error } = await supabase
      .from("permintaan")
      .update(updateData)
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Order berhasil diupdate",
    });
  } catch (error) {
    console.error("Update task error:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
