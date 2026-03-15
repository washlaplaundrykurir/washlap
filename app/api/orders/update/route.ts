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
      waktu_penjemputan, // Fixed from waktuPenjemputan to match frontend
      catatanKhusus,
    } = await request.json();

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID diperlukan" },
        { status: 400 },
      );
    }

    let finalCustomerId = customerId;

    // 1. Handle Customer Data
    if (finalCustomerId) {
      const { error: customerError } = await supabaseAdmin
        .from("customers")
        .update({
          nama_terakhir: nama,
          nomor_hp: phone,
        })
        .eq("id", finalCustomerId);

      if (customerError) throw customerError;
    } else if (phone) {
      const { data: newCustomer, error: upsertError } = await supabaseAdmin
        .from("customers")
        .upsert(
          {
            nomor_hp: phone,
            nama_terakhir: nama,
            ...(alamat ? { alamat_terakhir: alamat } : {}),
            ...(mapsLink ? { google_maps_terakhir: mapsLink } : {}),
          },
          { onConflict: "nomor_hp" },
        )
        .select("id")
        .single();

      if (upsertError) throw upsertError;
      finalCustomerId = newCustomer.id;
    }

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
        changed_by: user?.id || null,
      });
    }

    if (finalCustomerId) {
      updatePermintaanData.customer_id = finalCustomerId;
    }

    if (courierId !== undefined) {
      updatePermintaanData.courier_id = courierId === "" ? null : courierId;
    }
    if (nomorNota !== undefined && nomorNota !== "")
      updatePermintaanData.nomor_nota = nomorNota;

    // Process waktu_penjemputan mapped from frontend key
    if (
      waktu_penjemputan !== undefined &&
      waktu_penjemputan !== null &&
      waktu_penjemputan !== ""
    ) {
      updatePermintaanData.waktu_penjemputan = waktu_penjemputan;
    } else if (waktu_penjemputan === null) {
      updatePermintaanData.waktu_penjemputan = null;
    }

    if (catatanKhusus !== undefined) {
      updatePermintaanData.catatan_khusus = catatanKhusus;
    }

    const { error: orderError } = await supabaseAdmin
      .from("permintaan")
      .update(updatePermintaanData)
      .eq("id", orderId);

    if (orderError) throw orderError;

    // 3. Update Order Items
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
