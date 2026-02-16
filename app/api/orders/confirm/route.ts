/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSupabaseAdmin } from "@/utils/supabase/server";

// PUT - Confirm order with nota number
export async function PUT(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const { id, nomor_nota } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Order ID diperlukan" },
        { status: 400 },
      );
    }

    // Build update data - only include nomor_nota if provided (for JEMPUT orders)
    const updateData: Record<string, unknown> = {
      status_id: 6,
      waktu_selesai: new Date().toISOString(),
    };

    if (nomor_nota) {
      updateData.nomor_nota = nomor_nota;
    }

    // Update order: change status to 6 (Selesai)
    // Only confirm orders that are in "Sudah Jemput" (3) or "Sudah Antar" (5) status
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;

    // Get logged in user
    const {
      data: { user },
    } = await supabase.auth.getUser(accessToken);
    const userId = user?.id;

    if (!userId) {
      console.warn("Confirming order without user ID");
    }

    // Update order: change status to 6 (Selesai)
    // Only confirm orders that are in "Sudah Jemput" (3) or "Sudah Antar" (5) status
    const { error: updateError } = await supabase
      .from("permintaan")
      .update(updateData)
      .eq("id", id)
      .in("status_id", [3, 5]); // Only confirm orders that are waiting

    if (updateError) {
      console.error("Confirm order error:", updateError);

      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log status change
    if (userId) {
      console.log("Confirm Route: Inserting Log", { id, userId });
      await supabase.from("status_logs").insert({
        permintaan_id: id,
        status_id_baru: 6,
        changed_by: userId,
      });
    } else {
      console.warn("Confirm Route: No UserId, skipping log");
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
