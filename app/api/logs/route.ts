import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
    try {
        const supabase = createSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const orderId = searchParams.get("orderId");

        if (!orderId) {
            return NextResponse.json(
                { error: "Order ID (orderId) query parameter is required" },
                { status: 400 },
            );
        }

        console.log("Fetching logs for OrderID:", orderId);

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
            console.error("Database error fetching logs:", error);
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
