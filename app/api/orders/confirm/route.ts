/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { calculateSLANota } from "@/lib/sla-helper";

// PUT - Confirm order with nota number
export async function PUT(request: NextRequest) {
  const { user, error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = createSupabaseAdmin();
    const { id, nomor_nota } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Order ID diperlukan" },
        { status: 400 },
      );
    }

    const { data: order } = await supabase
      .from("permintaan")
      .select("waktu_kurir_selesai")
      .eq("id", id)
      .single();

    const waktuSelesai = new Date().toISOString();

    const updateData: Record<string, unknown> = {
      status_id: 6,
      waktu_selesai: waktuSelesai,
    };

    if (nomor_nota) {
      updateData.nomor_nota = nomor_nota;
    }

    if (order?.waktu_kurir_selesai) {
      const slaNota = calculateSLANota(order.waktu_kurir_selesai, waktuSelesai);
      if (slaNota) {
        updateData.sla_nota_menit = slaNota.minutes;
        updateData.sla_nota_status = slaNota.status;
      }
    }

    const { error: updateError } = await supabase
      .from("permintaan")
      .update(updateData)
      .eq("id", id)
      .in("status_id", [3, 5]);

    if (updateError) {
      console.error("Confirm order error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Cek apakah update benar-benar mengubah baris (bisa 0 jika status sudah berubah — race condition)
    // Supabase tidak return rowCount langsung, tapi kita bisa cek status terkini
    const { data: updatedOrder } = await supabase
      .from("permintaan")
      .select("status_id")
      .eq("id", id)
      .single();

    if (!updatedOrder || updatedOrder.status_id !== 6) {
      return NextResponse.json(
        { error: "Order sudah dikonfirmasi atau statusnya tidak valid" },
        { status: 409 },
      );
    }

    const { error: logError } = await supabase.from("status_logs").insert({
      permintaan_id: id,
      status_id_baru: 6,
      changed_by: user!.id,
    });
    if (logError) {
      console.error("Failed to insert status log for confirm:", logError);
    }

    return NextResponse.json({
      success: true,
      message: "Order berhasil dikonfirmasi",
    });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
