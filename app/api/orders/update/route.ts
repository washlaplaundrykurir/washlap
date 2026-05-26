/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

export async function PUT(request: NextRequest) {
  const { user, error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const supabaseAdmin = createSupabaseAdmin();

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

    // Guard: tiket yang sudah ditugaskan (status >= 2) hanya bisa dibatalkan oleh admin,
    // bukan super-admin
    if (statusId === 7) {
      const { data: currentOrder, error: fetchError } = await supabaseAdmin
        .from("permintaan")
        .select("status_id")
        .eq("id", orderId)
        .single();

      if (fetchError || !currentOrder) {
        return NextResponse.json(
          { error: "Order tidak ditemukan" },
          { status: 404 },
        );
      }

      if (currentOrder.status_id >= 2 && user!.role === "super-admin") {
        return NextResponse.json(
          { error: "Tiket yang sudah ditugaskan hanya dapat dibatalkan oleh admin" },
          { status: 403 },
        );
      }
    }

    let finalCustomerId = customerId;

    // Normalisasi nomor HP (dipakai di kedua branch)
    const normalizePhone = (p: string): string => {
      const digitsOnly = (p || "").replace(/[^0-9]/g, "");
      if (!digitsOnly) return "";
      if (digitsOnly.startsWith("0")) return "62" + digitsOnly.slice(1);
      return digitsOnly;
    };

    // 1. Handle Customer Data
    if (finalCustomerId) {
      const customerUpdate: Record<string, any> = {};

      if (nama !== undefined) customerUpdate.nama_terakhir = nama;
      if (phone !== undefined && phone !== null && phone !== "") {
        const normalized = normalizePhone(phone.trim());
        if (normalized) customerUpdate.nomor_hp = normalized;
      }

      if (Object.keys(customerUpdate).length > 0) {
        const { error: customerError } = await supabaseAdmin
          .from("customers")
          .update(customerUpdate)
          .eq("id", finalCustomerId);

        if (customerError) throw customerError;
      }
    } else if (phone) {
      const normalizedPhone = normalizePhone(phone.trim());

      const { data: newCustomer, error: upsertError } = await supabaseAdmin
        .from("customers")
        .upsert(
          {
            nomor_hp: normalizedPhone,
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
    const updatePermintaanData: Record<string, unknown> = {};

    if (alamat !== undefined) updatePermintaanData.alamat_jalan = alamat;
    if (mapsLink !== undefined)
      updatePermintaanData.google_maps_link = mapsLink;

    if (statusId !== undefined && statusId !== null) {
      updatePermintaanData.status_id = statusId;
      if (statusId === 2)
        updatePermintaanData.waktu_assigned = new Date().toISOString();
      if (statusId === 6)
        updatePermintaanData.waktu_selesai = new Date().toISOString();

      // Log status change
      await supabaseAdmin.from("status_logs").insert({
        permintaan_id: orderId,
        status_id_baru: statusId,
        changed_by: user!.id,
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
