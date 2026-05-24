import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/customers/lookup?phone=08xxx
 *
 * Lookup customer berdasarkan nomor HP yang sudah dinormalisasi.
 * Hanya return alamat dan google maps — tidak expose data sensitif lainnya.
 *
 * Rate limit: 15 request per menit per IP.
 */
export async function GET(request: NextRequest) {
  // Rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const { allowed, remaining } = rateLimit(ip, 15, 60_000);

  if (!allowed) {
    return NextResponse.json(
      { error: "Terlalu banyak permintaan. Coba lagi dalam 1 menit." },
      {
        status: 429,
        headers: { "X-RateLimit-Remaining": "0" },
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone")?.trim();

  if (!phone) {
    return NextResponse.json({ data: null }, { status: 200 });
  }

  // Normalisasi nomor HP sebelum query
  const normalizePhone = (p: string): string => {
    const digitsOnly = p.replace(/[^0-9]/g, "");
    return digitsOnly.startsWith("62") ? "0" + digitsOnly.slice(2) : digitsOnly;
  };

  const normalizedPhone = normalizePhone(phone);

  // Validasi format setelah normalisasi
  if (!/^08[0-9]{8,11}$/.test(normalizedPhone)) {
    return NextResponse.json({ data: null }, { status: 200 });
  }

  const supabase = createSupabaseAdmin();

  const { data, error } = await supabase
    .from("customers")
    .select("nama_terakhir, alamat_terakhir, google_maps_terakhir")
    .eq("nomor_hp", normalizedPhone)
    .single();

  if (error || !data) {
    return NextResponse.json(
      { data: null },
      {
        status: 200,
        headers: { "X-RateLimit-Remaining": String(remaining) },
      },
    );
  }

  // Hanya return jika setidaknya ada nama (alamat & gmaps boleh kosong)
  if (!data.nama_terakhir) {
    return NextResponse.json({ data: null }, { status: 200 });
  }

  return NextResponse.json(
    {
      data: {
        nama: data.nama_terakhir || null,
        alamat: data.alamat_terakhir || null,
        googleMapsLink: data.google_maps_terakhir || null,
      },
    },
    {
      status: 200,
      headers: { "X-RateLimit-Remaining": String(remaining) },
    },
  );
}
