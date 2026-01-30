/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";
import { cookies } from "next/headers";

import { createSupabaseAdmin } from "@/utils/supabase/server";

interface JWTPayload {
  sub: string;
  email: string;
  exp: number;
}

// GET - Get tasks assigned to the current courier
export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let userId: string | null = null;

    try {
      const decoded = jwtDecode<JWTPayload>(accessToken);

      if (decoded.exp * 1000 > Date.now()) {
        userId = decoded.sub;
      }
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // 'pending', 'completed', 'all'

    // Build query for orders assigned to this courier
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
                status_id,
                catatan_khusus,
                courier_id,
                customers:customer_id (
                    id,
                    nomor_hp,
                    nama_terakhir
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
      .eq("courier_id", userId);

    // Filter by status
    if (status === "pending") {
      query = query.eq("status_id", 2); // Status 2 = Ditugaskan (tugas aktif)
    } else if (status === "completed") {
      query = query.in("status_id", [3, 5, 6, 7]); // Sudah Jemput, Sudah Antar, Selesai, Batal
    }

    const { data: orders, error } = await query.order("waktu_order", {
      ascending: false,
    });

    if (error) {
      console.error("Fetch kurir tasks error:", error);

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate stats
    const todayStart = new Date();

    todayStart.setHours(0, 0, 0, 0);

    const todayTasks =
      orders?.filter((o) => new Date(o.waktu_order) >= todayStart).length || 0;
    const pendingTasks = orders?.filter((o) => o.status_id < 6).length || 0;
    const completedTasks = orders?.filter((o) => o.status_id >= 6).length || 0;

    return NextResponse.json({
      success: true,
      data: orders,
      stats: {
        todayTasks,
        pendingTasks,
        completedTasks,
        totalTasks: orders?.length || 0,
      },
    });
  } catch (error) {
    console.error("Server error:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT - Update order status (for courier)
export async function PUT(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let userId: string | null = null;

    try {
      const decoded = jwtDecode<JWTPayload>(accessToken);

      if (decoded.exp * 1000 > Date.now()) {
        userId = decoded.sub;
      }
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }

    const supabase = createSupabaseAdmin();
    const { id, status_id } = await request.json();

    if (!id || status_id === undefined) {
      return NextResponse.json(
        { error: "Order ID dan status diperlukan" },
        { status: 400 },
      );
    }

    // Verify this order belongs to the courier
    const { data: order, error: fetchError } = await supabase
      .from("permintaan")
      .select("courier_id")
      .eq("id", id)
      .single();

    if (fetchError || !order) {
      return NextResponse.json(
        { error: "Order tidak ditemukan" },
        { status: 404 },
      );
    }

    if (order.courier_id !== userId) {
      return NextResponse.json(
        { error: "Tidak memiliki akses ke order ini" },
        { status: 403 },
      );
    }

    // Update the order
    const updateData: Record<string, unknown> = { status_id };

    if (status_id === 6) updateData.waktu_selesai = new Date().toISOString();
    if (status_id === 3 || status_id === 5)
      updateData.waktu_kurir_selesai = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("permintaan")
      .update(updateData)
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Status berhasil diupdate",
    });
  } catch (error) {
    console.error("Update task error:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
