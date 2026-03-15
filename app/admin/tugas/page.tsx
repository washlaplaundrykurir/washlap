"use client";

import { Card, CardBody, CardHeader, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Select, SelectItem } from "@heroui/select";
import { Tabs, Tab } from "@heroui/tabs";
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
import { useSearchParams } from "next/navigation";
import {
  ClipboardList,
  Truck,
  Package,
  User,
  MapPin,
  Check,
  X,
  Phone,
  UserCheck,
  ExternalLink,
  Clock,
  ShoppingBasket,
  ChevronRight,
  Info,
  FileText,
  CalendarCheck,
  ArrowUpNarrowWide,
  ArrowDownWideNarrow,
  ListFilter,
} from "lucide-react";

import { useToast } from "@/components/ToastProvider";
import { useCouriers } from "@/hooks/use-master-data";

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
  customers: { id: string; nomor_hp: string; nama_terakhir: string } | null;
  auth_users: { id: string; full_name: string; email: string } | null;
  status_ref: { id: number; nama_status: string } | null;
  created_by_user: { id: string; full_name: string } | null;
  order_items: {
    id: string;
    produk_layanan: string;
    jenis_layanan: string;
    parfum: string;
  }[];
}

function TugasPageContent() {
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "jemput",
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const { data: couriers = [] } = useCouriers();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Sorting State
  const [sortCriteria, setSortCriteria] = useState("waktu_order");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { showToast } = useToast();

  const assignModal = useDisclosure();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedCourier, setSelectedCourier] = useState<string>("");

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/tasks?status=pending`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      setOrders(result.data || []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Gagal memuat data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedOrder || !selectedCourier) return;
    try {
      setActionLoading("assign");
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedOrder.id,
          courier_id: selectedCourier,
          status_id: 2,
        }),
      });

      if (!response.ok) throw new Error((await response.json()).error);
      assignModal.onClose();
      setSelectedOrder(null);
      setSelectedCourier("");
      fetchOrders();
      showToast("success", "Kurir berhasil ditugaskan!");
    } catch (err: any) {
      showToast("error", err.message || "Gagal menugaskan kurir");
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (orderId: string) => {
    try {
      setActionLoading(orderId);
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: orderId,
          status_id: activeTab === "jemput" ? 3 : 5,
        }),
      });

      if (!response.ok) throw new Error((await response.json()).error);
      fetchOrders();
      const action = activeTab === "jemput" ? "dijemput" : "diantar";

      showToast("success", `Order berhasil ${action}!`);
    } catch (err: any) {
      showToast("error", err.message || "Gagal merubah status");
    } finally {
      setActionLoading(null);
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

  const parseCatatan = (catatan: string) => {
    if (!catatan) return "Tidak ada catatan khusus";

    if (
      catatan.includes("Produk:") ||
      catatan.includes("Jenis:") ||
      catatan.includes("Parfum:")
    ) {
      const parts = catatan.split(", ");
      const cleanParts = parts
        .map((p) => {
          const [label, value] = p.split(": ");
          return value && value.trim() ? `${label}: ${value.trim()}` : null;
        })
        .filter(Boolean);

      return cleanParts.length > 0
        ? cleanParts.join(" • ")
        : "Permintaan standar";
    }

    return catatan;
  };

  const filteredOrders = useMemo(() => {
    const type = activeTab === "jemput" ? "JEMPUT" : "ANTAR";
    let list = orders.filter((o) => o.jenis_tugas === type);

    list = [...list].sort((a, b) => {
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
        case "kurir":
          valA = (a.auth_users?.full_name || "").toLowerCase();
          valB = (b.auth_users?.full_name || "").toLowerCase();
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
  }, [orders, activeTab, sortCriteria, sortDirection]);

  const jemputCount = useMemo(
    () => orders.filter((o) => o.jenis_tugas === "JEMPUT").length,
    [orders],
  );

  const antarCount = useMemo(
    () => orders.filter((o) => o.jenis_tugas === "ANTAR").length,
    [orders],
  );

  return (
    <div className="max-w-7xl mx-auto px-2 pb-10">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 md:mb-8 gap-3 bg-white/40 dark:bg-white/5 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-white/20 backdrop-blur-sm">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="p-2 md:p-3 bg-blue-600 rounded-xl md:rounded-2xl shadow-lg shadow-blue-500/20">
            <ClipboardList className="w-5 h-5 md:w-8 md:h-8 text-white" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-gray-900 dark:text-white">
              Tugas Kurir
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-xs md:text-sm font-medium">
              Monitor penugasan hari ini
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
          {/* Sorting Component */}
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
              <SelectItem key="kurir" textValue="Nama Kurir">
                Nama Kurir
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
        <Tabs
          aria-label="Selection tabs"
          classNames={{
            tabList:
              "gap-4 w-full relative rounded-none p-0 border-b border-divider",
            cursor: "w-full bg-blue-500 h-[2px] rounded-full",
            tab: "max-w-fit px-2 md:px-4 h-10 transition-all",
            tabContent:
              "group-data-[selected=true]:text-blue-500 text-sm md:text-lg font-bold transition-transform",
          }}
          color={activeTab === "jemput" ? "secondary" : "primary"}
          selectedKey={activeTab}
          variant="underlined"
          onSelectionChange={(key) => setActiveTab(key as string)}
        >
          <Tab
            key="jemput"
            title={
              <div className="flex items-center space-x-2">
                <Truck size={16} />
                <span>Siap Jemput</span>
                <Chip
                  color="secondary"
                  size="sm"
                  variant="shadow"
                  className="font-black h-5 text-[10px]"
                >
                  {jemputCount}
                </Chip>
              </div>
            }
          />
          <Tab
            key="antar"
            title={
              <div className="flex items-center space-x-2">
                <Package size={16} />
                <span>Siap Antar</span>
                <Chip
                  color="primary"
                  size="sm"
                  variant="shadow"
                  className="font-black h-5 text-[10px]"
                >
                  {antarCount}
                </Chip>
              </div>
            }
          />
        </Tabs>

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
        ) : filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 bg-white/10 dark:bg-white/5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-zinc-800">
            <p className="text-gray-500 dark:text-gray-400 font-bold text-sm">
              Tidak ada tugas{" "}
              {activeTab === "jemput" ? "penjemputan" : "pengantaran"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-5">
            {filteredOrders.map((order) => (
              <Card
                key={order.id}
                className="group border border-black/5 dark:border-white/10 shadow-sm relative overflow-hidden"
              >
                <div
                  className={`absolute top-0 left-0 bottom-0 w-1 ${activeTab === "jemput" ? "bg-secondary" : "bg-primary"}`}
                />
                <CardHeader className="flex justify-between items-center px-4 pt-4 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-black text-base md:text-xl text-gray-800 dark:text-white">
                      {order.nomor_tiket}
                    </span>
                    <div className="flex gap-1">
                      <Chip
                        color={order.status_id === 2 ? "warning" : "success"}
                        size="sm"
                        variant="flat"
                        className="font-black uppercase h-5 px-1.5 text-[9px]"
                      >
                        {order.status_ref?.nama_status || "PENDING"}
                      </Chip>
                      <Chip
                        color={
                          order.jenis_tugas === "JEMPUT"
                            ? "secondary"
                            : "primary"
                        }
                        size="sm"
                        variant="flat"
                        className="font-black h-5 px-1.5 text-[9px] text-white"
                      >
                        {order.jenis_tugas === "JEMPUT" ? "JEM" : "ANT"}
                      </Chip>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400 font-bold text-[10px] bg-gray-50 dark:bg-white/5 px-1.5 py-0.5 rounded-md">
                    <Clock size={10} />
                    {getTimeAgo(order.waktu_order)}
                  </div>
                </CardHeader>

                <CardBody className="px-4 py-2 space-y-3">
                  <div className="bg-white/50 dark:bg-white/5 rounded-xl p-3 border border-black/5 dark:border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-blue-500" />
                        <span className="font-black text-gray-900 dark:text-white text-xs uppercase">
                          {order.customers?.nama_terakhir || "PELANGGAN"}
                        </span>
                      </div>
                      <Link
                        href={`tel:${order.customers?.nomor_hp}`}
                        className="p-1 px-2.5 bg-green-500/10 text-green-600 rounded-full text-[10px] font-bold"
                      >
                        <Phone size={10} className="inline mr-1" /> Hubungi
                      </Link>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin
                        size={14}
                        className="text-orange-500 shrink-0 mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-gray-600 dark:text-gray-300 font-semibold line-clamp-1">
                          {order.alamat_jalan || "Alamat belum diinput"}
                        </p>
                        {order.google_maps_link && (
                          <Link
                            href={order.google_maps_link}
                            target="_blank"
                            className="text-blue-500 text-[10px] font-bold mt-1 inline-flex items-center gap-1"
                          >
                            Google Maps <ExternalLink size={8} />
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-purple-500/5 p-2 rounded-lg border border-purple-500/10">
                      <span className="text-[8px] font-black text-purple-600 uppercase block mb-0.5">
                        Jadwal
                      </span>
                      <p className="text-[10px] font-black dark:text-white truncate">
                        {order.waktu_penjemputan
                          ? formatDate(order.waktu_penjemputan)
                          : "ASAP"}
                      </p>
                    </div>
                    <div className="bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                      <span className="text-[8px] font-black text-amber-600 uppercase block mb-0.5">
                        Permintaan
                      </span>
                      <p className="text-[10px] font-bold dark:text-white truncate italic">
                        {parseCatatan(order.catatan_khusus)}
                      </p>
                    </div>
                  </div>

                  {order.order_items?.[0] ? (
                    <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-800 text-[10px] py-1.5 px-2 rounded-lg border border-black/5 dark:border-white/5">
                      <ShoppingBasket size={12} className="text-gray-400" />
                      <span className="font-black text-gray-700 dark:text-gray-200 truncate max-w-[50px]">
                        {order.order_items[0].produk_layanan}
                      </span>
                      <span className="text-gray-300">|</span>
                      <span className="font-medium text-gray-500 truncate max-w-[50px]">
                        {order.order_items[0].jenis_layanan}
                      </span>
                      <span className="ml-auto bg-white dark:bg-zinc-700 px-1.5 rounded font-bold text-gray-500">
                        {order.order_items[0].parfum || "None"}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-400 italic px-1">
                      Tanpa detail layanan
                    </div>
                  )}

                  <div className="pt-2 flex justify-between items-center text-[9px] text-gray-400 font-bold border-t border-divider">
                    <span className="uppercase">
                      {order.created_by_user
                        ? `ADMIN: ${order.created_by_user.full_name?.split(" ")[0].toUpperCase()}`
                        : "OLEH: CUSTOMER"}
                    </span>
                    <span>{formatDate(order.waktu_order)}</span>
                  </div>
                </CardBody>

                <CardFooter className="px-4 py-3 bg-gray-50/50 dark:bg-white/5 border-t border-divider flex justify-between items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[7px] uppercase text-gray-400 font-black block mb-0.5">
                      Kurir
                    </span>
                    <div className="flex items-center gap-1 text-[11px] font-black text-blue-600 dark:text-blue-400 truncate">
                      <UserCheck size={10} className="shrink-0" />
                      <span className="truncate">
                        {order.auth_users?.full_name || "Unassigned"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 pt-0.5">
                    <Button
                      size="sm"
                      variant="flat"
                      className="bg-zinc-200 dark:bg-zinc-800 font-bold h-8 px-3 text-[10px] min-w-0"
                      onPress={() => {
                        setSelectedOrder(order);
                        setSelectedCourier(order.courier_id || "");
                        assignModal.onOpen();
                      }}
                    >
                      Ganti
                    </Button>
                    <Button
                      color="success"
                      size="sm"
                      variant="solid"
                      className="font-black h-8 px-4 text-[10px] shadow-sm min-w-0"
                      isLoading={actionLoading === order.id}
                      onPress={() => handleComplete(order.id)}
                    >
                      {activeTab === "jemput" ? "Jemput" : "Antar"}
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={assignModal.isOpen}
        onClose={assignModal.onClose}
        placement="center"
        backdrop="blur"
        size="xs"
      >
        <ModalContent className="bg-white dark:bg-zinc-900 border border-divider">
          <ModalHeader className="flex flex-col gap-1 pb-0 pt-4 px-4">
            <h2 className="text-base font-black">Pilih Kurir</h2>
            <p className="text-gray-400 text-[8px] font-black uppercase tracking-widest">
              Update Operasional
            </p>
          </ModalHeader>
          <ModalBody className="py-4 px-4">
            <div className="space-y-3">
              <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                <span className="text-[8px] text-blue-500 font-black uppercase block mb-0.5">
                  Tugas Aktif
                </span>
                <p className="text-sm font-black dark:text-white">
                  {selectedOrder?.nomor_tiket}
                </p>
              </div>
              <Select
                placeholder="Pilih kurir..."
                selectedKeys={selectedCourier ? [selectedCourier] : []}
                onSelectionChange={(k) =>
                  setSelectedCourier(Array.from(k)[0] as string)
                }
                variant="bordered"
                size="sm"
                classNames={{ trigger: "rounded-lg" }}
              >
                {couriers.map((c: any) => (
                  <SelectItem key={c.id} textValue={c.full_name || c.email}>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">
                        {c.full_name || "Tanpa Nama"}
                      </span>
                      <span className="text-[9px] text-gray-500">
                        {c.email}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </Select>
            </div>
          </ModalBody>
          <ModalFooter className="pb-4 pt-0 px-4 flex gap-2">
            <Button
              variant="light"
              size="sm"
              className="font-bold flex-1"
              onPress={assignModal.onClose}
            >
              Batal
            </Button>
            <Button
              color="primary"
              size="sm"
              className="font-black flex-1 h-9"
              isLoading={actionLoading === "assign"}
              onPress={handleAssign}
            >
              Simpan
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

export default function TugasPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center">
          <Spinner size="lg" color="primary" />
        </div>
      }
    >
      <TugasPageContent />
    </Suspense>
  );
}
