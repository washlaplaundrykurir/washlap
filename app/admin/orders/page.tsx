"use client";

import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Select, SelectItem } from "@heroui/select";
import { Input, Textarea } from "@heroui/input";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { useEffect, useState, Suspense, useMemo } from "react";
import Link from "next/link";
import {
  ClipboardList,
  User,
  MapPin,
  X,
  Phone,
  ExternalLink,
  Clock,
  ChevronRight,
  Info,
  CalendarCheck,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  ListFilter,
  Save,
  ShoppingBasket,
  Smartphone,
  Tag,
  Map,
} from "lucide-react";

import { useToast } from "@/components/ToastProvider";
import { useCouriers, useStatuses } from "@/hooks/use-master-data";

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
  courier_id: string | null;
  customer_id: string;
  nomor_nota: string | null;
  customers: {
    id: string;
    nomor_hp: string;
    nama_terakhir: string;
  } | null;
  status_ref: {
    id: number;
    nama_status: string;
  } | null;
  created_by_user: {
    id: string;
    full_name: string;
  } | null;
  order_items: {
    id: string;
    produk_layanan: string;
    jenis_layanan: string;
    parfum: string;
  }[];
}

function OrdersPageContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const { data: couriers = [] } = useCouriers();
  const { data: statuses = [] } = useStatuses();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { showToast } = useToast();

  // Sorting State
  const [sortCriteria, setSortCriteria] = useState("waktu_order");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Modal State
  const editModal = useDisclosure();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState({
    alamat: "",
    statusId: "",
    courierId: "",
    nomorNota: "",
    catatanKhusus: "",
    waktuJemput: "",
  });

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/orders/list?unassigned=true");
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      const unassignedGroup = result.data.find(
        (g: any) => g.courierId === "unassigned",
      );

      setOrders(unassignedGroup?.orders || []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Gagal memuat data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenEdit = (order: Order) => {
    setSelectedOrder(order);

    let formattedDate = "";
    if (order.waktu_penjemputan) {
      formattedDate = new Date(order.waktu_penjemputan)
        .toISOString()
        .substring(0, 16);
    }

    setEditForm({
      alamat: order.alamat_jalan || "",
      statusId: order.status_id.toString(),
      courierId: order.courier_id || "",
      nomorNota: order.nomor_nota || "",
      catatanKhusus: order.catatan_khusus || "",
      waktuJemput: formattedDate,
    });
    editModal.onOpen();
  };

  const handleSaveChanges = async () => {
    if (!selectedOrder) return;
    try {
      setIsSaving(true);
      const response = await fetch("/api/orders/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: selectedOrder.id,
          customerId: selectedOrder.customer_id,
          nama: selectedOrder.customers?.nama_terakhir,
          phone: selectedOrder.customers?.nomor_hp,
          alamat: editForm.alamat,
          statusId: parseInt(editForm.statusId),
          courierId: editForm.courierId || null,
          nomorNota: editForm.nomorNota || null,
          catatanKhusus: editForm.catatanKhusus,
          waktu_penjemputan: editForm.waktuJemput
            ? `${editForm.waktuJemput}:00Z`
            : null,
        }),
      });

      if (!response.ok) throw new Error((await response.json()).error);

      showToast("success", "Pesanan berhasil diperbarui");
      editModal.onClose();
      fetchOrders();
    } catch (err: any) {
      showToast("error", err.message || "Terjadi kesalahan saat menyimpan");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const orderDate = new Date(dateString);
    const diffInMinutes = Math.floor(
      (now.getTime() - (orderDate.getTime() - 7 * 3600000)) / 60000,
    );

    if (diffInMinutes < 1) return "Baru saja";
    if (diffInMinutes < 60) return `${diffInMinutes}m lalu`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}j lalu`;
    return `${Math.floor(diffInMinutes / 1440)}h lalu`;
  };

  const sortedOrders = useMemo(() => {
    let list = [...orders];
    list.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      switch (sortCriteria) {
        case "waktu_order":
          valA = new Date(a.waktu_order).getTime();
          valB = new Date(b.waktu_order).getTime();
          break;
        case "waktu_penjemputan":
          valA = new Date(a.waktu_penjemputan || 0).getTime();
          valB = new Date(b.waktu_penjemputan || 0).getTime();
          break;
        case "nama":
          valA = (a.customers?.nama_terakhir || "").toLowerCase();
          valB = (b.customers?.nama_terakhir || "").toLowerCase();
          break;
        case "tiket":
          valA = a.nomor_tiket;
          valB = b.nomor_tiket;
          break;
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return list;
  }, [orders, sortCriteria, sortDirection]);

  return (
    <div className="max-w-7xl mx-auto px-2 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-8 gap-3 bg-white/40 dark:bg-white/5 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-white/20 backdrop-blur-sm">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="p-2 md:p-3 bg-orange-600 rounded-xl md:rounded-2xl shadow-lg shadow-orange-500/20">
            <ClipboardList className="w-5 h-5 md:w-8 md:h-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-gray-900 dark:text-white">
              Belum Ditugaskan
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">
              Kelola pesanan baru yang menunggu kurir
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1 w-full sm:w-auto">
            <Select
              aria-label="Kriteria Urutan"
              placeholder="Urutkan..."
              selectedKeys={[sortCriteria]}
              onSelectionChange={(keys) =>
                setSortCriteria(Array.from(keys)[0] as string)
              }
              size="sm"
              className="flex-1 sm:min-w-[160px]"
              startContent={<ListFilter size={14} className="text-gray-400" />}
              variant="flat"
              classNames={{
                trigger: "bg-white dark:bg-zinc-800 rounded-xl font-bold h-10",
              }}
            >
              <SelectItem key="waktu_order" textValue="Waktu Order">
                Waktu Order
              </SelectItem>
              <SelectItem key="waktu_penjemputan" textValue="Waktu Penjemputan">
                Waktu Penjemputan
              </SelectItem>
              <SelectItem key="nama" textValue="Nama Pelanggan">
                Nama Pelanggan
              </SelectItem>
              <SelectItem key="tiket" textValue="Nomor Tiket">
                Nomor Tiket
              </SelectItem>
            </Select>
            <Button
              isIconOnly
              variant="flat"
              size="sm"
              className="bg-white dark:bg-zinc-800 h-10 w-10 min-w-10 rounded-xl"
              onPress={() =>
                setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
              }
            >
              {sortDirection === "asc" ? (
                <ArrowUpNarrowWide size={18} className="text-blue-500" />
              ) : (
                <ArrowDownWideNarrow size={18} className="text-blue-500" />
              )}
            </Button>
          </div>

          <Button
            isLoading={isLoading}
            variant="flat"
            size="sm"
            className="font-bold bg-white dark:bg-zinc-800 w-full sm:w-auto h-10 px-4 rounded-xl"
            onClick={fetchOrders}
            startContent={<Info size={16} />}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {error && (
          <Card className="bg-red-500/10 border border-red-500/20 backdrop-blur-md">
            <CardBody className="text-red-600 dark:text-red-400 text-xs flex items-center justify-between p-3">
              <span className="flex items-center gap-2">
                <X size={14} />
                {error}
              </span>
              <Button size="sm" variant="light" onClick={() => setError("")}>
                Tutup
              </Button>
            </CardBody>
          </Card>
        )}

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Spinner size="md" color="primary" />
            <p className="text-gray-500 text-xs font-bold animate-pulse">
              Menghubungkan...
            </p>
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 bg-white/10 dark:bg-white/5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-zinc-800">
            <p className="text-gray-500 dark:text-gray-400 font-bold text-sm text-center px-4 uppercase tracking-widest">
              Semua order sudah diproses
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
            {sortedOrders.map((order) => (
              <Card
                key={order.id}
                className="group border border-black/5 dark:border-white/10 shadow-sm relative overflow-hidden"
              >
                <div
                  className={`absolute top-0 left-0 bottom-0 w-1 ${order.jenis_tugas === "JEMPUT" ? "bg-secondary" : "bg-primary"}`}
                />
                <CardHeader className="flex justify-between items-center px-4 pt-4 pb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-base md:text-xl text-gray-800 dark:text-white">
                      {order.nomor_tiket}
                    </span>
                    <Chip
                      color={
                        order.jenis_tugas === "JEMPUT" ? "secondary" : "primary"
                      }
                      size="sm"
                      variant="flat"
                      className="font-black h-5 px-1.5 text-[9px] text-white"
                    >
                      {order.jenis_tugas === "JEMPUT" ? "JEM" : "ANT"}
                    </Chip>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400 font-bold text-[10px] bg-gray-50 dark:bg-white/5 px-1.5 py-0.5 rounded-md">
                    <Clock size={10} />
                    {getTimeAgo(order.waktu_order)}
                  </div>
                </CardHeader>

                <CardBody className="px-4 py-2 space-y-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User size={14} className="text-blue-500" />
                      <span className="font-black text-gray-900 dark:text-white text-xs uppercase">
                        {order.customers?.nama_terakhir || "PELANGGAN"}
                      </span>
                    </div>

                    <div className="flex items-start gap-2">
                      <MapPin
                        size={14}
                        className="text-orange-500 shrink-0 mt-0.5"
                      />
                      <p className="text-[11px] text-gray-600 dark:text-gray-300 font-semibold line-clamp-1">
                        {order.alamat_jalan || "Alamat belum diinput"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-zinc-50 dark:bg-white/5 p-2 rounded-lg border border-divider">
                      <span className="text-[8px] font-black text-gray-400 uppercase block mb-0.5">
                        Waktu Order
                      </span>
                      <p className="text-[10px] font-bold dark:text-white truncate">
                        {formatDate(order.waktu_order)}
                      </p>
                    </div>
                    <div className="bg-purple-500/5 p-2 rounded-lg border border-purple-500/10">
                      <span className="text-[8px] font-black text-purple-600 uppercase block mb-0.5">
                        Jadwal Jemput
                      </span>
                      <p className="text-[10px] font-black dark:text-purple-200 truncate">
                        {order.waktu_penjemputan
                          ? formatDate(order.waktu_penjemputan)
                          : "ASAP"}
                      </p>
                    </div>
                  </div>
                </CardBody>

                <CardFooter className="px-4 py-3 bg-gray-50/50 dark:bg-white/5 border-t border-divider flex justify-end">
                  <Button
                    color="primary"
                    size="sm"
                    className="font-black h-8 px-6 shadow-sm min-w-0"
                    onPress={() => handleOpenEdit(order)}
                    endContent={<ChevronRight size={14} />}
                  >
                    Tugaskan Kurir
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={editModal.isOpen}
        onClose={editModal.onClose}
        size="2xl"
        scrollBehavior="inside"
        backdrop="blur"
      >
        <ModalContent className="bg-white dark:bg-zinc-900 border border-divider">
          <ModalHeader className="flex flex-col gap-1 pb-4 pt-6 px-6 border-b border-divider">
            <h2 className="text-xl font-black">Detail & Penugasan</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded">
                NO TIKET: {selectedOrder?.nomor_tiket}
              </span>
              <span className="text-xs font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded uppercase">
                {selectedOrder?.jenis_tugas}
              </span>
            </div>
          </ModalHeader>
          <ModalBody className="py-4 px-6 space-y-6">
            <div className="space-y-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                Informasi Order (Read-only)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input
                  isReadOnly
                  label="Nama Pelanggan"
                  value={selectedOrder?.customers?.nama_terakhir || "-"}
                  variant="flat"
                  size="sm"
                  startContent={<User size={16} className="text-gray-400" />}
                />
                <Input
                  isReadOnly
                  label="Nomor HP"
                  value={selectedOrder?.customers?.nomor_hp || "-"}
                  variant="flat"
                  size="sm"
                  startContent={
                    <Smartphone size={16} className="text-gray-400" />
                  }
                />
                <Input
                  isReadOnly
                  label="Produk"
                  value={selectedOrder?.order_items?.[0]?.produk_layanan || "-"}
                  variant="flat"
                  size="sm"
                  startContent={
                    <ShoppingBasket size={16} className="text-gray-400" />
                  }
                />
                <Input
                  isReadOnly
                  label="Layanan"
                  value={selectedOrder?.order_items?.[0]?.jenis_layanan || "-"}
                  variant="flat"
                  size="sm"
                  startContent={<Tag size={16} className="text-gray-400" />}
                />
                <Input
                  isReadOnly
                  label="Parfum"
                  value={selectedOrder?.order_items?.[0]?.parfum || "-"}
                  variant="flat"
                  size="sm"
                  startContent={<Info size={16} className="text-gray-400" />}
                />
              </div>
              {selectedOrder?.google_maps_link && (
                <div className="flex items-center gap-2 p-2 bg-zinc-50 dark:bg-white/5 rounded-xl border border-divider">
                  <Map size={16} className="text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500">
                    Google Maps:
                  </span>
                  <Link
                    href={selectedOrder.google_maps_link}
                    target="_blank"
                    className="text-xs text-blue-500 font-bold hover:underline"
                  >
                    Buka Link Lokasi →
                  </Link>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                Data Editable
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Jadwal Penjemputan"
                  type="datetime-local"
                  value={editForm.waktuJemput}
                  onChange={(e) =>
                    setEditForm({ ...editForm, waktuJemput: e.target.value })
                  }
                  variant="bordered"
                  className="font-bold"
                  startContent={
                    <CalendarCheck size={16} className="text-primary" />
                  }
                />
                <div className="hidden md:block" />
              </div>
              <Textarea
                label="Alamat Lengkap"
                value={editForm.alamat}
                onChange={(e) =>
                  setEditForm({ ...editForm, alamat: e.target.value })
                }
                variant="bordered"
                className="font-bold"
                minRows={2}
              />
              <Textarea
                label="Catatan Khusus / Detail Permintaan"
                value={editForm.catatanKhusus}
                onChange={(e) =>
                  setEditForm({ ...editForm, catatanKhusus: e.target.value })
                }
                variant="bordered"
                className="font-bold"
                minRows={2}
              />
            </div>

            <div className="p-4 bg-zinc-50 dark:bg-white/5 rounded-2xl border border-divider space-y-4">
              <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                Konfigurasi Penugasan
              </p>
              <div className="grid grid-cols-1 gap-4">
                <Select
                  label="Status Pesanan"
                  selectedKeys={[editForm.statusId]}
                  onSelectionChange={(keys) =>
                    setEditForm({
                      ...editForm,
                      statusId: Array.from(keys)[0] as string,
                    })
                  }
                  variant="bordered"
                  className="font-bold"
                >
                  {statuses
                    .filter((s) => s.id === 1 || s.id === 2)
                    .map((s) => (
                      <SelectItem key={s.id.toString()}>
                        {s.nama_status}
                      </SelectItem>
                    ))}
                </Select>

                {editForm.statusId === "2" && (
                  <div className="space-y-4 pt-2 border-t border-divider">
                    <Select
                      label="Pilih Kurir Lapangan"
                      placeholder="Pilih kurir..."
                      selectedKeys={
                        editForm.courierId ? [editForm.courierId] : []
                      }
                      onSelectionChange={(keys) =>
                        setEditForm({
                          ...editForm,
                          courierId: Array.from(keys)[0] as string,
                        })
                      }
                      variant="bordered"
                      className="font-bold"
                    >
                      {couriers.map((c: any) => (
                        <SelectItem
                          key={c.id}
                          textValue={c.full_name || c.email}
                        >
                          {c.full_name || c.email}
                        </SelectItem>
                      ))}
                    </Select>

                    {selectedOrder?.jenis_tugas === "ANTAR" && (
                      <Input
                        label="Nomor Nota Fisik"
                        placeholder="Contoh: 12345"
                        value={editForm.nomorNota}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            nomorNota: e.target.value,
                          })
                        }
                        variant="bordered"
                        className="font-bold border-l-4 border-l-primary"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </ModalBody>
          <ModalFooter className="pb-6 pt-2 px-6 flex gap-2 border-t border-divider">
            <Button
              variant="light"
              className="font-bold flex-1"
              onPress={editModal.onClose}
            >
              Batal
            </Button>
            <Button
              color="primary"
              className="font-black flex-[2] h-12 shadow-lg shadow-blue-500/20"
              isLoading={isSaving}
              onPress={handleSaveChanges}
              startContent={<Save size={18} />}
            >
              Simpan & Tugaskan
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center">
          <Spinner size="lg" color="primary" />
        </div>
      }
    >
      <OrdersPageContent />
    </Suspense>
  );
}
