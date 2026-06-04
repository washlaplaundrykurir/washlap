/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSupabaseAdmin, createClient } from "@/utils/supabase/server";
import { toLocal08 } from "@/lib/whatsapp";
import {
  shouldCheckNota,
  notaMatches,
  isOpenTicket,
} from "@/lib/duplicate-checks";

type JenisTugas = "ANTAR" | "JEMPUT";

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
    const cookieStore = await cookies();
    const supabaseAuth = createClient(cookieStore);

    // Get current user (if any)
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();

    const body = await request.json();

    const {
      nama,
      nomorHP,
      alamat,
      googleMapsLink,
      permintaan,
      waktuPenjemputan,
      produkLayanan,
      produkLayananManual,
      jenisLayanan,
      parfum,
      catatan,
      nomorNota,
      confirmDuplicate,
    } = body;

    // Sanitize input to prevent duplicates due to whitespace
    const cleanNama = nama?.trim();

    // Normalisasi nomor HP ke format internasional
    // - Strip semua karakter non-digit
    // - Jika diawali 0 → ganti dengan 62
    const normalizePhone = (p: string): string => {
      const digitsOnly = (p || "").replace(/[^0-9]/g, "");
      if (!digitsOnly) return "";
      if (digitsOnly.startsWith("0")) return "62" + digitsOnly.slice(1);
      return digitsOnly;
    };
    const cleanNomorHP = normalizePhone(nomorHP?.trim() || "");

    if (!cleanNomorHP) {
      return NextResponse.json(
        { error: "Nomor HP tidak boleh kosong." },
        { status: 400 },
      );
    }

    if (cleanNomorHP.length < 7) {
      return NextResponse.json(
        { error: "Nomor HP tidak valid (terlalu pendek). Pastikan format: 08xxx atau 628xxx." },
        { status: 400 },
      );
    }

    if (cleanNomorHP.length > 15) {
      return NextResponse.json(
        { error: "Nomor HP tidak valid (terlalu panjang). Pastikan format: 08xxx atau 628xxx." },
        { status: 400 },
      );
    }

    // Activity types being created (one permintaan row per type)
    const jenisTugasArray: string[] = permintaan.map((p: string) =>
      p.toUpperCase(),
    );

    // Resolve "is this activity type confirmed?" from `confirmDuplicate`,
    // which may be a plain boolean (applies to all types) OR a per-type object
    // like { ANTAR: true, JEMPUT: false } (preferred; OQ-1, Req 3.6).
    const isTypeConfirmed = (type: string): boolean => {
      if (confirmDuplicate === true) return true;
      if (
        confirmDuplicate &&
        typeof confirmDuplicate === "object" &&
        confirmDuplicate[type] === true
      ) {
        return true;
      }
      return false;
    };

    // --- Open-ticket gate (authoritative, Req 3.1/3.2) ---
    // Re-check open tickets per activity type BEFORE performing ANY writes, so
    // that a partially-confirmed multi-type submission never creates half the
    // tickets (atomic: fail before any inserts). For each type with a matching
    // Open_Ticket that is not confirmed, collect a match; if any exist, respond
    // 409 and insert nothing.
    const matches: {
      jenis_tugas: string;
      nama: string | null;
      nomor_hp_local: string;
    }[] = [];

    const { data: gateCustomer } = await supabase
      .from("customers")
      .select("id, nama_terakhir")
      .eq("nomor_hp", cleanNomorHP)
      .maybeSingle();

    if (gateCustomer) {
      const { data: openRows, error: openErr } = await supabase
        .from("permintaan")
        .select("id, jenis_tugas, status_id, waktu_order")
        .eq("customer_id", gateCustomer.id)
        .not("status_id", "in", "(6,7)");

      if (openErr) {
        // The gate is the authoritative duplicate guard; fail closed rather
        // than risk silently creating a duplicate open ticket.
        console.error("Open-ticket gate query error:", openErr);

        return NextResponse.json(
          {
            error: "Gagal memeriksa tiket duplikat",
            details: openErr.message,
          },
          { status: 500 },
        );
      }

      for (const type of jenisTugasArray) {
        if (isTypeConfirmed(type)) continue;

        const hasOpenMatch = (openRows || []).some(
          (r) => r.jenis_tugas === type && isOpenTicket(r.status_id),
        );

        if (hasOpenMatch) {
          // Display data (nama + phone) is customer-level, so it is identical
          // across all matching rows; the most-recent match (Req 3.5) is
          // surfaced by the dedicated GET /api/orders/check-duplicate endpoint.
          matches.push({
            jenis_tugas: type,
            nama: gateCustomer.nama_terakhir,
            nomor_hp_local: toLocal08(cleanNomorHP),
          });
        }
      }
    }

    if (matches.length > 0) {
      return NextResponse.json(
        { requiresConfirmation: true, matches },
        { status: 409 },
      );
    }

    // 1. Upsert customer (based on nomor_hp)
    // Jika alamat kosong atau hanya "-", ambil dari data customer sebelumnya
    const isAlamatKosong = !alamat || alamat.trim() === "" || alamat.trim() === "-";
    const isGmapsKosong = !googleMapsLink || googleMapsLink.trim() === "" || googleMapsLink.trim() === "-";

    let finalAlamat = alamat;
    let finalGoogleMapsLink = googleMapsLink;

    if (isAlamatKosong || isGmapsKosong) {
      // Cek apakah customer sudah pernah order sebelumnya
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("alamat_terakhir, google_maps_terakhir")
        .eq("nomor_hp", cleanNomorHP)
        .single();

      if (existingCustomer) {
        if (isAlamatKosong && existingCustomer.alamat_terakhir) {
          finalAlamat = existingCustomer.alamat_terakhir;
        }
        if (isGmapsKosong && existingCustomer.google_maps_terakhir) {
          finalGoogleMapsLink = existingCustomer.google_maps_terakhir;
        }
      }
    }

    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .upsert(
        {
          nomor_hp: cleanNomorHP,
          nama_terakhir: cleanNama,
          alamat_terakhir: finalAlamat || null,
          google_maps_terakhir: finalGoogleMapsLink || null,
        },
        {
          onConflict: "nomor_hp",
        },
      )
      .select("id")
      .single();

    if (customerError) {
      console.error("Customer upsert error:", {
        code: customerError.code,
        message: customerError.message,
        details: customerError.details,
        hint: customerError.hint,
        nomor_hp_length: cleanNomorHP.length,
      });

      return NextResponse.json(
        {
          error: "Gagal menyimpan data pelanggan",
          details: customerError.message,
        },
        { status: 500 },
      );
    }

    // 2. Insert permintaan (order) - one row per jenis_tugas type

    // Helper to generate ticket number: (A/J) XXX 1234
    const generateTicket = (type: string, customerName: string) => {
      const prefix = type === "ANTAR" ? "A" : "J";
      const namePrefix = (customerName || "XXX")
        .toUpperCase()
        .slice(0, 3)
        .padEnd(3, "X");
      const randomNum = Math.floor(1000 + Math.random() * 9000);

      return `${prefix} ${namePrefix} ${randomNum}`;
    };

    const now = new Date();

    // Shared field values for all created rows in this submission.
    const catatanKhusus =
      catatan && catatan.trim() !== "" ? catatan.trim() : "";
    const waktuPenjemputanISO = waktuPenjemputan
      ? new Date(waktuPenjemputan + "+07:00").toISOString()
      : null;
    const alamatJalan = finalAlamat || alamat;
    // Persist the trimmed nomor_nota (OQ-6); store null when empty/whitespace.
    const trimmedNota =
      typeof nomorNota === "string" ? nomorNota.trim() : "";

    const insertedOrders: {
      id: string;
      nomor_tiket: string;
      jenis_tugas: string;
      alamat_jalan: string | null;
      waktu_penjemputan: string | null;
      nama: string | null;
      nomor_hp: string;
      catatan_khusus: string | null;
    }[] = [];

    // Non-blocking duplicate-nomor-nota warnings (Req 2; informational, OQ-3).
    const warnings: {
      type: "duplicate_nota";
      jenis_tugas: string;
      nomor_nota: string;
    }[] = [];

    // Insert one row per jenis_tugas type
    for (const type of jenisTugasArray) {
      const nomorTiket = generateTicket(type, cleanNama);

      const { data: permintaanData, error: permintaanError } = await supabase
        .from("permintaan")
        .insert({
          customer_id: customer.id,
          status_id: 1, // "Baru"
          nomor_tiket: nomorTiket,
          jenis_tugas: type, // Now a single ENUM value, not an array
          nomor_nota: trimmedNota !== "" ? trimmedNota : null,
          alamat_jalan: finalAlamat || alamat,
          google_maps_link: finalGoogleMapsLink || googleMapsLink,
          waktu_order: now.toISOString(),
          waktu_penjemputan: waktuPenjemputanISO,
          catatan_khusus: catatanKhusus,
          created_by: user?.id || null, // Track who created the order
        })
        .select("id")
        .single();

      if (permintaanError) {
        console.error("Permintaan error:", permintaanError);

        return NextResponse.json(
          {
            error: "Gagal menyimpan permintaan",
            details: permintaanError.message,
          },
          { status: 500 },
        );
      }

      insertedOrders.push({
        id: permintaanData.id,
        nomor_tiket: nomorTiket,
        jenis_tugas: type,
        alamat_jalan: alamatJalan || null,
        waktu_penjemputan: waktuPenjemputanISO,
        nama: cleanNama || null,
        nomor_hp: cleanNomorHP,
        catatan_khusus: catatanKhusus !== "" ? catatanKhusus : null,
      });

      // 3. Insert order_items for each permintaan
      const produkFinal =
        produkLayanan === "lainnya" ? produkLayananManual : produkLayanan;

      const { error: itemError } = await supabase.from("order_items").insert({
        permintaan_id: permintaanData.id,
        produk_layanan: produkFinal,
        jenis_layanan: jenisLayanan,
        parfum: parfum,
      });

      if (itemError) {
        console.error("Order item error:", itemError);

        return NextResponse.json(
          {
            error: "Gagal menyimpan detail pesanan",
            details: itemError.message,
          },
          { status: 500 },
        );
      }

      // 4. Log initial status (Baru - 1)
      await supabase.from("status_logs").insert({
        permintaan_id: permintaanData.id,
        status_id_baru: 1, // Baru
        changed_by: user?.id || null, // Created by user or system
      });

      // 5. Duplicate nomor nota warning (Req 2) — non-blocking, best-effort.
      // Look up OTHER permintaan rows (any status_id, Req 2.1) for the same
      // activity type whose trimmed+case-insensitive nomor_nota matches. If the
      // query errors, log and omit the warning rather than failing the save.
      if (shouldCheckNota(trimmedNota)) {
        try {
          // Narrow candidates with a case-insensitive substring filter. Since
          // a real match (per `notaMatches`) requires the stored value to equal
          // the trimmed nota up to surrounding whitespace + case, the trimmed
          // nota is always a substring of any true match — so this `ilike`
          // never drops a real match. `notaMatches` below is the authoritative
          // trim + case-insensitive comparison. LIKE specials are escaped so
          // they are treated literally.
          const likeNeedle = trimmedNota.replace(/[\\%_]/g, (c) => `\\${c}`);

          const { data: notaRows, error: notaErr } = await supabase
            .from("permintaan")
            .select("id, nomor_nota, jenis_tugas")
            .eq("jenis_tugas", type)
            .neq("id", permintaanData.id)
            .not("nomor_nota", "is", null)
            .ilike("nomor_nota", `%${likeNeedle}%`);

          if (notaErr) {
            console.error("Nota duplicate check error:", notaErr);
          } else {
            const hasDuplicate = (notaRows || [])
              .filter((r) => r.id !== permintaanData.id)
              .some((r) =>
                notaMatches(
                  { nota: trimmedNota, jenis: type as JenisTugas },
                  {
                    nota: r.nomor_nota ?? "",
                    jenis: r.jenis_tugas as JenisTugas,
                  },
                ),
              );

            if (hasDuplicate) {
              warnings.push({
                type: "duplicate_nota",
                jenis_tugas: type,
                nomor_nota: trimmedNota,
              });
            }
          }
        } catch (notaCheckError) {
          // Best-effort only (Req 2 is informational, OQ-3): never fail the save.
          console.error("Nota duplicate check failed:", notaCheckError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Pesanan berhasil disimpan!",
      orders: insertedOrders,
      warnings,
    });
  } catch (error) {
    console.error("Server error:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
