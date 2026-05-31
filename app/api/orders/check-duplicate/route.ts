/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import { normalizePhone } from "@/lib/phone";
import { toLocal08 } from "@/lib/whatsapp";
import { isOpenTicket, mostRecent, type JenisTugas } from "@/lib/duplicate-checks";

/**
 * GET /api/orders/check-duplicate
 *
 * Authoritative pre-check used by the admin create form to drive the blocking
 * duplicate-ticket confirmation popup (Req 3.1, 3.2). Returns whether an
 * Open_Ticket already exists for a given normalized phone + activity type, and
 * the display data for the most-recent match.
 *
 * Query params:
 *   - phone: raw or normalized customer phone (normalized here via normalizePhone)
 *   - jenis: "ANTAR" | "JEMPUT"
 *
 * Open_Ticket = status_id NOT IN (6, 7) (Req 3.8 / OQ-5).
 * Match selection uses the most-recent waktu_order (Req 3.5).
 *
 * Feature: admin-ticket-wa-and-duplicate-warnings (Requirement 3).
 */
export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const phoneParam = searchParams.get("phone");
    const jenisParam = (searchParams.get("jenis") || "").toUpperCase();

    // Validate activity type (Req 3.1: match must be on a concrete Activity_Type)
    if (jenisParam !== "ANTAR" && jenisParam !== "JEMPUT") {
      return NextResponse.json(
        { error: "Parameter 'jenis' harus bernilai ANTAR atau JEMPUT" },
        { status: 400 },
      );
    }
    const jenis: JenisTugas = jenisParam;

    // Normalize the phone to 62xxx for comparison against customers.nomor_hp.
    const normalizedPhone = normalizePhone(phoneParam);
    if (!normalizedPhone) {
      // No usable phone → no ticket can match.
      return NextResponse.json({ exists: false });
    }

    const supabase = createSupabaseAdmin();

    // permintaan has no nomor_hp column; it references the customer via the
    // customer_id FK. Mirror the existing embed pattern (`customers:customer_id`)
    // and use an inner join so we can filter the parent rows by the customer's
    // normalized nomor_hp. Filter to the requested activity type and exclude
    // completed/cancelled tickets (status_id 6/7) at the DB level.
    const { data: rows, error } = await supabase
      .from("permintaan")
      .select(
        `
        status_id,
        jenis_tugas,
        waktu_order,
        customers:customer_id!inner (
          nomor_hp,
          nama_terakhir
        )
      `,
      )
      .eq("jenis_tugas", jenis)
      .eq("customers.nomor_hp", normalizedPhone)
      .not("status_id", "in", "(6,7)")
      .order("waktu_order", { ascending: false });

    if (error) {
      console.error("Check duplicate error:", error);

      return NextResponse.json(
        { error: "Gagal memeriksa tiket duplikat", details: error.message },
        { status: 500 },
      );
    }

    // Defensive: re-apply the Open_Ticket predicate on the result set (the DB
    // filter already excludes 6/7, but reusing isOpenTicket keeps the source of
    // truth in one place) and project to the shape mostRecent expects.
    const openMatches = (rows ?? [])
      .filter((row: any) => isOpenTicket(row.status_id))
      .map((row: any) => {
        const customer = (Array.isArray(row.customers)
          ? row.customers[0]
          : row.customers) as
          | { nomor_hp: string | null; nama_terakhir: string | null }
          | null;

        return {
          waktu_order: row.waktu_order as string,
          nama: customer?.nama_terakhir ?? null,
          nomor_hp: customer?.nomor_hp ?? normalizedPhone,
        };
      });

    if (openMatches.length === 0) {
      return NextResponse.json({ exists: false });
    }

    // Most recently created matching ticket drives the confirmation (Req 3.5).
    const match = mostRecent(openMatches);

    return NextResponse.json({
      exists: true,
      nama: match.nama,
      nomor_hp_local: toLocal08(match.nomor_hp), // local 08xxx form (Req 3.10)
      jenis,
    });
  } catch (error) {
    console.error("Server error:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
