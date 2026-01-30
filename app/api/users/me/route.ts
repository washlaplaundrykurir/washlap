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

// GET - Get current user's info including role
export async function GET(_request: NextRequest) {
  try {
    const cookieStore = await cookies();

    // Get access token from cookie (same pattern as middleware)
    const accessToken = cookieStore.get("sb-access-token")?.value;

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    let userId: string | null = null;

    try {
      // Decode JWT to get user info
      const decoded = jwtDecode<JWTPayload>(accessToken);

      // Check if token is expired
      if (decoded.exp * 1000 > Date.now()) {
        userId = decoded.sub;
      }
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }

    // Use admin client (from utils/supabase/server) to get user's role
    const supabase = createSupabaseAdmin();
    const { data: userData, error: userError } = await supabase
      .from("auth_users")
      .select("id, email, role, full_name")
      .eq("id", userId)
      .single();

    if (userError) {
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      user: userData,
    });
  } catch (error) {
    console.error("Get current user error:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
