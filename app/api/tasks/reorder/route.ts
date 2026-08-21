/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

// PUT - Update display order (urutan_kurir) for assigned tasks
export async function PUT(request: NextRequest) {
  const { error: authError } = await requireAdmin();

  if (authError) return authError;

  try {
    const supabase = createSupabaseAdmin();
    const body = await request.json();
    const { courier_id, task_ids } = body;

    if (!Array.isArray(task_ids) || task_ids.length === 0) {
      return NextResponse.json(
        {
          error:
            "Daftar ID tugas (task_ids) harus berupa array dan tidak boleh kosong",
        },
        { status: 400 },
      );
    }

    // Optional courier validation if courier_id provided
    if (courier_id) {
      const { data: courier, error: courierError } = await supabase
        .from("auth_users")
        .select("id, role, is_active")
        .eq("id", courier_id)
        .maybeSingle();

      if (courierError) {
        return NextResponse.json(
          { error: courierError.message },
          { status: 500 },
        );
      }

      if (!courier || courier.role !== "kurir") {
        return NextResponse.json(
          { error: "Kurir tidak ditemukan" },
          { status: 400 },
        );
      }
    }

    // Update urutan_kurir sequentially (1-based index)
    const updatePromises = task_ids.map((id: string, index: number) => {
      let query = supabase
        .from("permintaan")
        .update({ urutan_kurir: index + 1 })
        .eq("id", id);

      if (courier_id) {
        query = query.eq("courier_id", courier_id);
      }

      return query;
    });

    const results = await Promise.all(updatePromises);
    const hasError = results.find((r) => r.error);

    if (hasError && hasError.error) {
      console.error("Reorder tasks error:", hasError.error);

      return NextResponse.json(
        { error: hasError.error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "Urutan pengantaran berhasil diperbarui",
      count: task_ids.length,
    });
  } catch (error) {
    console.error("Reorder tasks server error:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
