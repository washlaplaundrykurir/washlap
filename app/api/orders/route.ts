/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseAdmin();
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
    } = body;

    // 1. Upsert customer (based on nomor_hp)
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .upsert(
        {
          nomor_hp: nomorHP,
          nama_terakhir: nama,
          alamat_terakhir: alamat,
          google_maps_terakhir: googleMapsLink,
        },
        {
          onConflict: "nomor_hp",
        },
      )
      .select("id")
      .single();

    if (customerError) {
      console.error("Customer error:", customerError);

      return NextResponse.json(
        {
          error: "Gagal menyimpan data pelanggan",
          details: customerError.message,
        },
        { status: 500 },
      );
    }

    // 2. Insert permintaan (order) - one row per jenis_tugas type
    // Convert permintaan array to uppercase
    const jenisTugasArray = permintaan.map((p: string) => p.toUpperCase());

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
    const insertedOrders: {
      id: string;
      nomor_tiket: string;
      jenis_tugas: string;
    }[] = [];

    // Insert one row per jenis_tugas type
    for (const type of jenisTugasArray) {
      const nomorTiket = generateTicket(type, nama);

      let catatanKhusus = `Produk: ${produkLayanan === "lainnya" ? produkLayananManual : produkLayanan}, Jenis: ${jenisLayanan}, Parfum: ${parfum}`;

      if (catatan && catatan.trim() !== "") {
        catatanKhusus += ` | Catatan: ${catatan}`;
      }

      const { data: permintaanData, error: permintaanError } = await supabase
        .from("permintaan")
        .insert({
          customer_id: customer.id,
          status_id: 1, // "Baru"
          nomor_tiket: nomorTiket,
          jenis_tugas: type, // Now a single ENUM value, not an array
          alamat_jalan: alamat,
          google_maps_link: googleMapsLink,
          waktu_order: now.toISOString(),
          waktu_penjemputan: waktuPenjemputan
            ? new Date(waktuPenjemputan).toISOString()
            : null,
          catatan_khusus: catatanKhusus,
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
    }

    return NextResponse.json({
      success: true,
      message: "Pesanan berhasil disimpan!",
      orders: insertedOrders,
    });
  } catch (error) {
    console.error("Server error:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan server" },
      { status: 500 },
    );
  }
}
