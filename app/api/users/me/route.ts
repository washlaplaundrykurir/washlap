/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";
import { requireLogin } from "@/lib/api-auth";

// GET - Get current user's info including role
export async function GET(_request: NextRequest) {
  const { user, error: authError } = await requireLogin();
  if (authError) return authError;

  try {
    const supabase = createSupabaseAdmin();
    const { data: userData, error: userError } = await supabase
      .from("auth_users")
      .select("id, email, role, full_name")
      .eq("id", user!.id)
      .single();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, user: userData });
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
