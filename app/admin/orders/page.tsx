"use client";

import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Input, Textarea } from "@heroui/input";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { useEffect, useState } from "react";
import { Smartphone, MapPin, Sparkles, Calendar, Truck } from "lucide-react";

import { useToast } from "@/components/ToastProvider";

interface Order {
  id: string;
  nomor_tiket: string;
  jenis_tugas: string;
  alamat_jalan: string;
  google_maps_link: string;
  waktu_order: string;
  waktu_penjemputan: string | null;
  status_id: number;
  catatan_khusus: string;
  nomor_nota: string | null;
  courier_id: string | null;
  customers: {
    id: string;
    nomor_hp: string;
    nama_terakhir: string;
  } | null;
  status_ref: {
    id: number;
    nama_status: string;
  } | null;
  order_items: {
    id: string;
    produk_layanan: string;
    jenis_layanan: string;
    parfum: string;
  }[];
}

interface Courier {
  id: string;
  full_name: string;
}

interface Status {
  id: number;
  nama_status: string;
}

interface CourierGroup {
  courierId: string;
  courierName: string;
  courierEmail: string | null;
  orders: Order[];
  orderCount: number;
}

export default function OrdersPage() {
  const [data, setData] = useState<CourierGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [totalOrders, setTotalOrders] = useState(0);

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const { showToast } = useToast();

  useEffect(() => {
    fetchOrders();
    fetchCouriers();
    fetchStatuses();
  }, []);

  const fetchCouriers = async () => {
    try {
      const response = await fetch("/api/couriers");
      const result = await response.json();

      if (response.ok) setCouriers(result.data);
    } catch {
      /* ignore */
    }
  };

  const fetchStatuses = async () => {
    try {
      const response = await fetch("/api/statuses");
      const result = await response.json();

      if (response.ok) setStatuses(result.data);
    } catch {
      /* ignore */
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch("/api/orders/list?unassigned=true");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal mengambil data");
      }

      setData(result.data);
      setTotalOrders(result.totalOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).replace(/\./g, ':') + " WIB";
  };

  // State form edit
  const [editFormData, setEditFormData] = useState({
    nama: "",
    phone: "",
    alamat: "",
    mapsLink: "",
    produk: "",
    layanan: "",
    parfum: "",
    statusId: 0,
    courierId: "",
    nomorNota: "",
    waktuPenjemputan: "",
    catatanKhusus: "",
  });

  // Reset form saat modal dibuka
  useEffect(() => {
    if (selectedOrder) {
      const item = selectedOrder.order_items?.[0] || {
        produk_layanan: "",
        jenis_layanan: "",
        parfum: "",
      };

      setEditFormData({
        nama: selectedOrder.customers?.nama_terakhir || "",
        phone: selectedOrder.customers?.nomor_hp || "",
        alamat: selectedOrder.alamat_jalan || "",
        mapsLink: selectedOrder.google_maps_link || "",
        produk: item.produk_layanan || "",
        layanan: item.jenis_layanan || "",
        parfum: item.parfum || "",
        statusId: selectedOrder.status_id,
        courierId: selectedOrder.courier_id || "",
        nomorNota: selectedOrder.nomor_nota || "",
        waktuPenjemputan: selectedOrder.waktu_penjemputan
          ? new Date(selectedOrder.waktu_penjemputan).toISOString().slice(0, 16)
          : "",
        catatanKhusus: selectedOrder.catatan_khusus || "",
      });
    }
  }, [selectedOrder]);

  const handleSaveChanges = async () => {
    if (!selectedOrder) return;

    if (!editFormData.nama?.trim() || !editFormData.phone?.trim()) {
      showToast("error", "Nama dan Nomor HP wajib diisi!");

      return;
    }

    try {
      const response = await fetch("/api/orders/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          customerId: selectedOrder.customers?.id || null,
          ...editFormData,
        }),
      });

      if (!response.ok) throw new Error("Gagal menyimpan perubahan");

      showToast("success", "Data pesanan berhasil disimpan!");
      fetchOrders();
      setSelectedOrder(null);
    } catch {
      showToast("error", "Gagal menyimpan perubahan");
    }
  };

  const handleCancel = async () => {
    if (!selectedOrder) return;
    if (!confirm("Apakah Anda yakin ingin membatalkan pesanan ini? Aksi ini tidak dapat dibatalkan.")) return;

    try {
      const response = await fetch("/api/orders/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          statusId: 7, // Batal
        }),
      });

      if (!response.ok) throw new Error("Gagal membatalkan pesanan");

      showToast("success", "Pesanan berhasil dibatalkan");
      fetchOrders();
      setSelectedOrder(null);
    } catch {
      showToast("error", "Gagal membatalkan pesanan");
    }
  };

  return (
    <>
      {/* Content */}
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Belum Ditugaskan
          </h1>
          <p className="text-gray-600 dark:text-white/70">
            Total: {totalOrders} item
          </p>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-20">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="backdrop-blur-xl bg-red-500/20 border border-red-500/30">
          <CardBody className="p-6 text-center text-red-600 dark:text-red-400">
            {error}
          </CardBody>
        </Card>
      )}

      {/* Orders List */}
      {!isLoading && !error && (
        <div className="space-y-3">
          {data.length === 0 || data.every((g) => g.orders.length === 0) ? (
            <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
              <CardBody className="p-6 text-center text-gray-600 dark:text-white/70 flex flex-col items-center gap-2">
                <Sparkles className="w-8 h-8 text-gray-400" />
                Tidak ada pesanan yang belum ditugaskan.
              </CardBody>
            </Card>
          ) : (
            data
              .flatMap((group) => group.orders)
              .map((order) => (
                <Card
                  key={order.id}
                  isPressable
                  className="w-full backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30 hover:bg-white/80 dark:hover:bg-white/20 transition-colors"
                  onPress={() => setSelectedOrder(order)}
                >
                  <CardBody className="p-3 md:p-4">
                    {/* Mobile: Stack layout, Desktop: Inline layout */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                      {/* Left: Ticket & Customer Info */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Chip
                          className="shrink-0"
                          color={
                            order.jenis_tugas === "JEMPUT"
                              ? "secondary"
                              : "primary"
                          }
                          size="sm"
                          variant="flat"
                        >
                          {order.jenis_tugas === "JEMPUT" ? "J" : "A"}
                        </Chip>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 dark:text-white text-sm truncate">
                            {order.nomor_tiket} •{" "}
                            {order.customers?.nama_terakhir || "?"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-white/50 truncate">
                            <MapPin className="inline mr-1" size={12} />{" "}
                            {order.alamat_jalan || "-"}
                          </p>
                        </div>
                      </div>

                      {/* Right: Phone & Time */}
                      <div className="flex items-center justify-between md:justify-end gap-3 text-xs text-gray-500 dark:text-white/50">
                        <span className="md:hidden flex items-center gap-1">
                          <Smartphone size={12} />{" "}
                          {order.customers?.nomor_hp || "-"}
                        </span>
                        <span className="hidden md:flex items-center gap-1">
                          <Smartphone size={12} />{" "}
                          {order.customers?.nomor_hp || "-"}
                        </span>
                        <span className="text-gray-400 flex items-center gap-1">
                          <Calendar size={12} /> {formatDate(order.waktu_order)}
                        </span>
                        {order.waktu_penjemputan && (
                          <span className="text-primary flex items-center gap-1">
                            <Truck size={12} /> {formatDate(order.waktu_penjemputan)}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))
          )}
        </div>
      )}
      {/* Edit Modal */}
      <Modal
        isOpen={!!selectedOrder}
        scrollBehavior="inside"
        size="2xl"
        onClose={() => setSelectedOrder(null)}
      >
        <ModalContent className="bg-white dark:bg-gray-900">
          <ModalHeader>Edit Pesanan {selectedOrder?.nomor_tiket}</ModalHeader>
          <ModalBody>
            {selectedOrder && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    isReadOnly={!!selectedOrder?.customers}
                    label="Nama Pelanggan"
                    value={editFormData.nama}
                    variant="flat"
                    onValueChange={(v) =>
                      setEditFormData((p) => ({ ...p, nama: v }))
                    }
                  />
                  <Input
                    isReadOnly={!!selectedOrder?.customers}
                    label="Nomor HP"
                    value={editFormData.phone}
                    variant="flat"
                    onValueChange={(v) =>
                      setEditFormData((p) => ({ ...p, phone: v }))
                    }
                  />
                </div>

                <div className="space-y-4">
                  <Input
                    label="Alamat Lengkap"
                    value={editFormData.alamat}
                    variant="flat"
                    onValueChange={(v) =>
                      setEditFormData((p) => ({ ...p, alamat: v }))
                    }
                  />
                  <Input
                    description={
                      editFormData.mapsLink ? (
                        <a
                          className="text-primary hover:underline text-xs"
                          href={editFormData.mapsLink}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Test Link
                        </a>
                      ) : null
                    }
                    label="Link Google Maps"
                    value={editFormData.mapsLink}
                    variant="flat"
                    onValueChange={(v) =>
                      setEditFormData((p) => ({ ...p, mapsLink: v }))
                    }
                  />
                </div>

                {/* Waktu Penjemputan */}
                <Input
                  label="Waktu Penjemputan"
                  type="datetime-local"
                  value={editFormData.waktuPenjemputan || ""}
                  variant="flat"
                  onValueChange={(v) =>
                    setEditFormData((p) => ({ ...p, waktuPenjemputan: v }))
                  }
                />

                <Textarea
                  label="Catatan Khusus"
                  value={editFormData.catatanKhusus}
                  variant="flat"
                  onValueChange={(v) =>
                    setEditFormData((p) => ({ ...p, catatanKhusus: v }))
                  }
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Produk"
                    value={editFormData.produk}
                    variant="flat"
                    onValueChange={(v) =>
                      setEditFormData((p) => ({ ...p, produk: v }))
                    }
                  />
                  <Input
                    label="Layanan"
                    value={editFormData.layanan}
                    variant="flat"
                    onValueChange={(v) =>
                      setEditFormData((p) => ({ ...p, layanan: v }))
                    }
                  />
                  <Input
                    label="Parfum"
                    value={editFormData.parfum}
                    variant="flat"
                    onValueChange={(v) =>
                      setEditFormData((p) => ({ ...p, parfum: v }))
                    }
                  />
                </div>

                <div className="flex flex-col gap-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                  {/* Status - Full width */}
                  <Select
                    label="Status Pesanan"
                    selectedKeys={[editFormData.statusId.toString()]}
                    onChange={(e) => {
                      if (e.target.value)
                        setEditFormData((p) => ({
                          ...p,
                          statusId: parseInt(e.target.value),
                        }));
                    }}
                  >
                    {statuses
                      .filter((s) => s.id === 1 || s.id === 2)
                      .map((s) => (
                        <SelectItem key={s.id}>{s.nama_status}</SelectItem>
                      ))}
                  </Select>

                  {/* Kurir + Nota side by side */}
                  {editFormData.statusId === 2 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Select
                        label="Kurir assigned"
                        selectedKeys={
                          editFormData.courierId ? [editFormData.courierId] : []
                        }
                        onChange={(e) => {
                          setEditFormData((p) => ({
                            ...p,
                            courierId: e.target.value,
                          }));
                        }}
                      >
                        {couriers.map((c) => (
                          <SelectItem key={c.id}>{c.full_name}</SelectItem>
                        ))}
                      </Select>

                      {/* Nota input for ANTAR orders when assigning */}
                      {selectedOrder?.jenis_tugas === "ANTAR" && (
                        <Input
                          label="Nomor Nota (Opsional)"
                          placeholder="Bisa diisi nanti di halaman Selesai"
                          value={editFormData.nomorNota}
                          variant="flat"
                          onValueChange={(v) =>
                            setEditFormData((p) => ({ ...p, nomorNota: v }))
                          }
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </ModalBody>
          <ModalFooter className="flex justify-between sm:justify-end gap-2">
            <div className="flex w-full sm:w-auto sm:mr-auto">
              <Button
                color="danger"
                variant="flat"
                onPress={handleCancel}
              >
                Batalkan Pesanan
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                color="danger"
                variant="light"
                onPress={() => setSelectedOrder(null)}
              >
                Tutup
              </Button>
              <Button color="primary" onPress={handleSaveChanges}>
                Simpan Perubahan
              </Button>
            </div>
          </ModalFooter>
        </ModalContent >
      </Modal>
    </>
  );
}
