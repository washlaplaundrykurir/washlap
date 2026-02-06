/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { createSupabaseAdmin, createClient } from "@/utils/supabase/server";

export async function PUT(request: NextRequest) {
  try {
    const supabaseAdmin = createSupabaseAdmin();
    const cookieStore = await cookies();
    const supabaseAuth = createClient(cookieStore);

    const accessToken = cookieStore.get("sb-access-token")?.value;

    const {
      data: { user },
    } = await supabaseAuth.auth.getUser(accessToken);

    console.log("Update Order - Auth User:", user?.id, user?.email);

    const {
      orderId,
      customerId,
      nama,
      phone,
      alamat,
      mapsLink,
      produk,
      layanan,
      parfum,
      statusId,
      courierId,
      nomorNota,
      waktuPenjemputan,
    } = await request.json();

    if (!orderId || !customerId) {
      return NextResponse.json(
        { error: "Order ID dan Customer ID diperlukan" },
        { status: 400 },
      );
    }

    // 1. Update Customer
    const { error: customerError } = await supabaseAdmin
      .from("customers")
      .update({
        nama_terakhir: nama,
        nomor_hp: phone,
      })
      .eq("id", customerId);

    if (customerError) throw customerError;

    // 2. Update Permintaan (Order)
    const updatePermintaanData: Record<string, unknown> = {
      alamat_jalan: alamat,
      google_maps_link: mapsLink,
    };

    if (statusId !== undefined) {
      updatePermintaanData.status_id = statusId;
      if (statusId === 2)
        updatePermintaanData.waktu_assigned = new Date().toISOString();
      if (statusId === 6)
        updatePermintaanData.waktu_selesai = new Date().toISOString();

      // Log status change
      await supabaseAdmin.from("status_logs").insert({
        permintaan_id: orderId,
        status_id_baru: statusId,
        changed_by: user?.id || null, // Track who changed it
      });
    }

    if (courierId !== undefined) updatePermintaanData.courier_id = courierId;
    if (nomorNota !== undefined && nomorNota !== "")
      updatePermintaanData.nomor_nota = nomorNota;
    if (waktuPenjemputan !== undefined && waktuPenjemputan !== "") {
      updatePermintaanData.waktu_penjemputan = new Date(
        waktuPenjemputan,
      ).toISOString();
    }

    const { error: orderError } = await supabaseAdmin
      .from("permintaan")
      .update(updatePermintaanData)
      .eq("id", orderId);

    if (orderError) throw orderError;

    // 3. Update Order Items (Assuming 1-to-1 relationship)
    if (produk || layanan || parfum) {
      const updates: any = {};

      if (produk) updates.produk_layanan = produk;
      if (layanan) updates.jenis_layanan = layanan;
      if (parfum) updates.parfum = parfum;

      const { error: itemError } = await supabaseAdmin
        .from("order_items")
        .update(updates)
        .eq("permintaan_id", orderId);

      if (itemError) throw itemError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating order:", error);

    return NextResponse.json(
      { error: "Gagal mengupdate data pesanan" },
      { status: 500 },
    );
  }
}
