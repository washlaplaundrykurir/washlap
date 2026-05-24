/* eslint-disable no-console */
import { NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = createSupabaseAdmin();

    const { data: statuses, error } = await supabase
      .from("status_ref")
      .select("id, nama_status")
      .order("id", { ascending: true });

    if (error) {
      console.error("Fetch statuses error:", error);

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: statuses });
  } catch (error) {
    console.error("Server error:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
