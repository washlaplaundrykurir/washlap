import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/api-auth";
import { parseImportedNotaWorkbook } from "@/lib/nota-import";
import { createSupabaseAdmin } from "@/utils/supabase/server";

const XLSX_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/octet-stream",
  "",
]);

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "File Excel wajib diunggah." },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      return NextResponse.json(
        { error: "File harus berformat .xlsx." },
        { status: 400 },
      );
    }

    if (!XLSX_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Tipe file tidak didukung. Gunakan file .xlsx." },
        { status: 400 },
      );
    }

    const parsed = parseImportedNotaWorkbook(await file.arrayBuffer());

    if (parsed.records.length === 0) {
      return NextResponse.json(
        {
          error: "Tidak ada data nota valid yang dapat diimport.",
          totalRows: parsed.totalRows,
          errors: parsed.errors,
        },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdmin();
    const nomorNotas = parsed.records.map((record) => record.nomor_nota);
    const { data: existingRows, error: existingError } = await supabase
      .from("imported_nota_transactions")
      .select("nomor_nota")
      .in("nomor_nota", nomorNotas);

    if (existingError) {
      return NextResponse.json(
        { error: existingError.message },
        { status: 500 },
      );
    }

    const existingSet = new Set(
      (existingRows || []).map((row: any) => String(row.nomor_nota)),
    );
    const payload = parsed.records.map((record) => ({
      ...record,
      imported_by: user?.id || null,
      imported_at: new Date().toISOString(),
    }));
    const { error: upsertError } = await supabase
      .from("imported_nota_transactions")
      .upsert(payload, { onConflict: "nomor_nota" })
      .select("nomor_nota");

    if (upsertError) {
      return NextResponse.json(
        { error: upsertError.message },
        { status: 500 },
      );
    }

    const updated = parsed.records.filter((record) =>
      existingSet.has(record.nomor_nota),
    ).length;
    const inserted = parsed.records.length - updated;

    return NextResponse.json({
      success: true,
      totalRows: parsed.totalRows,
      uniqueNotas: parsed.records.length,
      inserted,
      updated,
      skipped: parsed.errors.length,
      errors: parsed.errors,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat import nota.",
      },
      { status: 500 },
    );
  }
}
