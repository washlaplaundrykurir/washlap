import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { DEFAULT_TICKET_MESSAGE_TEMPLATE } from "@/lib/whatsapp";
import { createSupabaseAdmin } from "@/utils/supabase/server";

const TEMPLATE_CODE = "ticket_copy";
const MAX_TEMPLATE_LENGTH = 10000;

export async function GET() {
  const { error: authError } = await requireAdmin();

  if (authError) return authError;

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("message_templates")
    .select("content, updated_at")
    .eq("code", TEMPLATE_CODE)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    template: data?.content || DEFAULT_TICKET_MESSAGE_TEMPLATE,
    updated_at: data?.updated_at || null,
  });
}

export async function PUT(request: NextRequest) {
  const { error: authError } = await requireAdmin();

  if (authError) return authError;

  const body = await request.json();
  const template = typeof body.template === "string" ? body.template : "";

  if (!template.trim()) {
    return NextResponse.json(
      { error: "Template pesan tidak boleh kosong" },
      { status: 400 },
    );
  }

  if (template.length > MAX_TEMPLATE_LENGTH) {
    return NextResponse.json(
      { error: `Template pesan maksimal ${MAX_TEMPLATE_LENGTH} karakter` },
      { status: 400 },
    );
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("message_templates")
    .upsert(
      {
        code: TEMPLATE_CODE,
        content: template,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "code" },
    )
    .select("content, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    template: data.content,
    updated_at: data.updated_at,
  });
}
