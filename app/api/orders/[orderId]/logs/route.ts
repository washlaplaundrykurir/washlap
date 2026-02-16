import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const supabase = createSupabaseAdmin();
    const { orderId } = await params;
    console.log("API orders/logs hit. OrderID:", orderId);

    const { data, error } = await supabase
      .from("status_logs")
      .select(
        `
        id,
        status_id_baru,
        created_at,
        changed_by,
        auth_users:changed_by (
          full_name,
          email
        ),
        status_ref:status_id_baru (
          nama_status
        )
      `,
      )
      .eq("permintaan_id", orderId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error fetching logs:", err);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
