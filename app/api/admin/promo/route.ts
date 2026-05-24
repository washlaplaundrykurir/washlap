import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

// GET — publik (dipakai di halaman customer untuk tampilkan promo)
export async function GET() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("promo_settings")
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// PUT — hanya admin
export async function PUT(request: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const supabase = createSupabaseAdmin();
  const body = await request.json();
  const { promo_text, promo_image_url, is_active } = body;

  const { data, error } = await supabase
    .from("promo_settings")
    .update({
      promo_text,
      promo_image_url,
      is_active,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
