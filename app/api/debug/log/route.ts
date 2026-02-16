
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const supabase = createSupabaseAdmin();
        const { orderId, statusId, userId } = await request.json();

        console.log("Debug Log Insert:", { orderId, statusId, userId });

        const { data, error } = await supabase.from("status_logs").insert({
            permintaan_id: orderId,
            status_id_baru: statusId,
            changed_by: userId || null,
        }).select();

        if (error) {
            console.error("Debug Insert Error:", error);
            return NextResponse.json({ success: false, error: error.message, details: error }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
