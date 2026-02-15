/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";

// GET - Get orders by jenis_tugas (JEMPUT or ANTAR)
export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // JEMPUT or ANTAR

    if (!type || !["JEMPUT", "ANTAR"].includes(type)) {
      return NextResponse.json(
        { error: "Type harus JEMPUT atau ANTAR" },
        { status: 400 },
      );
    }

    // Fetch orders that contain the specified type in jenis_tugas jsonb array
    const { data: orders, error } = await supabase
      .from("permintaan")
      .select(
        `
        id,
        nomor_tiket,
        jenis_tugas,
        alamat_jalan,
        google_maps_link,
        waktu_order,
        status_id,
        catatan_khusus,
        courier_id,
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
        )
      `,
      )
      .eq("jenis_tugas", type) // Now using ENUM equality instead of JSONB containment
      .not("courier_id", "is", null)
      .order("waktu_order", { ascending: false });

    if (error) {
      console.error("Fetch tasks error:", error);

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: orders });
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
    if (status_id === 6) updateData.waktu_selesai = new Date().toISOString();

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
