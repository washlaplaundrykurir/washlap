"use client";

import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Input } from "@heroui/input";
import { useEffect, useState } from "react";
import {
  ScrollText,
  Search,
  User,
  MapPin,
  Truck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";
import { History, RefreshCw } from "lucide-react";

interface Order {
  id: string;
  nomor_tiket: string;
  jenis_tugas: string;
  alamat_jalan: string;
  google_maps_link: string;
  waktu_order: string;
  status_id: number;
  catatan_khusus: string;
  courier_id: string | null;
  customers: {
    id: string;
    nomor_hp: string;
    nama_terakhir: string;
  } | null;
  auth_users: {
    id: string;
    full_name: string;
    email: string;
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

interface CourierGroup {
  courierId: string;
  courierName: string;
  courierEmail: string | null;
  orders: Order[];
  orderCount: number;
}

const statusColors: Record<
  number,
  "default" | "primary" | "secondary" | "success" | "warning" | "danger"
> = {
  1: "warning", // Baru
  2: "primary", // Ditugaskan
  3: "secondary", // Proses Jemput
  4: "secondary", // Proses Cuci
  5: "secondary", // Proses Antar
  6: "success", // Selesai
  7: "danger", // Batal
};

const statusLabels: Record<number, string> = {
  1: "Baru",
  2: "Ditugaskan",
  3: "Jemput",
  4: "Cuci",
  5: "Antar",
  6: "Selesai",
  7: "Batal",
};

interface StatusLog {
  id: string;
  status_id_baru: number;
  created_at: string;
  auth_users: {
    full_name: string;
    email: string;
  } | null;
  status_ref: {
    nama_status: string;
  } | null;
}

export default function RiwayatPage() {
  const [data, setData] = useState<CourierGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState("");
  // const [totalOrders, setTotalOrders] = useState(0); // Unused variable
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Date Filter State (Default: Last 8 days)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now);
    firstDay.setDate(now.getDate() - 7); // 8 days including today

    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  }, []);

  const [selectedLogs, setSelectedLogs] = useState<StatusLog[]>([]);
  const [selectedOrderForLogs, setSelectedOrderForLogs] = useState<any>(null);
  const [logsLoading, setLogsLoading] = useState(false);
  const timelineModal = useDisclosure();

  const [reassignLoading, setReassignLoading] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!startDate || !endDate) {
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setHasFetched(true);
      const params = new URLSearchParams();
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("dateField", "waktu_penjemputan");

      const response = await fetch(`/api/orders/list?${params.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal mengambil data");
      }

      setData(result.data);
      // setTotalOrders(result.totalOrders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLogs = async (order: any) => {
    setSelectedOrderForLogs(order);
    setLogsLoading(true);
    timelineModal.onOpen();
    console.log("Fetching logs for orderId:", order.id);
    try {
      // Use the new query param based endpoint
      const response = await fetch(`/api/logs?orderId=${order.id}`);
      const result = await response.json();

      if (response.ok) {
        setSelectedLogs(result.data);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Failed to fetch logs", error);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleReassign = async (orderId: string, customerId: string) => {
    if (
      !confirm(
        "Apakah anda yakin ingin menugaskan kembali pesanan ini? Status akan kembali ke 'Ditugaskan'.",
      )
    )
      return;

    setReassignLoading(orderId);
    try {
      const response = await fetch("/api/orders/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          customerId,
          statusId: 2, // Back to Assigned
        }),
      });

      if (response.ok) {
        fetchOrders(); // Refresh list
      } else {
        alert("Gagal menugaskan kembali");
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Reassign error", error);
    } finally {
      setReassignLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTimeOnly = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const [sortDescriptor, setSortDescriptor] = useState({
    column: "waktu_order",
    direction: "descending",
  });

  // Flatten orders and filter
  const allOrders = data.flatMap((group) =>
    group.orders.map((order) => ({ ...order, courierName: group.courierName })),
  );

  const filteredOrders = allOrders
    .filter((order) => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        order.nomor_tiket?.toLowerCase().includes(searchLower) ||
        order.customers?.nama_terakhir?.toLowerCase().includes(searchLower) ||
        order.customers?.nomor_hp?.includes(searchTerm) ||
        order.alamat_jalan?.toLowerCase().includes(searchLower) ||
        order.courierName?.toLowerCase().includes(searchLower);

      const matchesStatus =
        statusFilter === "all" || String(order.status_id) === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let first: string | number = "";
      let second: string | number = "";

      switch (sortDescriptor.column) {
        case "waktu_order":
          first = new Date(a.waktu_order).getTime();
          second = new Date(b.waktu_order).getTime();
          break;
        case "customer":
          first = a.customers?.nama_terakhir || "";
          second = b.customers?.nama_terakhir || "";
          break;
        case "status":
          first = a.status_ref?.nama_status || "";
          second = b.status_ref?.nama_status || "";
          break;
        case "ticket":
          first = a.nomor_tiket || "";
          second = b.nomor_tiket || "";
          break;
        default:
          first = new Date(a.waktu_order).getTime();
          second = new Date(b.waktu_order).getTime();
      }

      const cmp = first < second ? -1 : first > second ? 1 : 0;

      return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <ScrollText className="w-6 h-6" /> Riwayat Pesanan
            </h1>
            <p className="text-gray-600 dark:text-white/70">
              Total: {filteredOrders.length} pesanan
            </p>
          </div>
          <Input
            className="w-full md:w-72"
            classNames={{
              inputWrapper:
                "bg-white/60 dark:bg-white/15 backdrop-blur-xl border border-black/10 dark:border-white/30",
            }}
            placeholder="Cari tiket, nama, HP..."
            startContent={<Search className="text-gray-400" size={16} />}
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
        </div>

        <div className="flex flex-col xl:flex-row xl:items-end gap-4 p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Filter Tanggal
              </span>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  className="w-full"
                  size="sm"
                  variant="bordered"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="text-gray-400 font-bold">-</span>
                <Input
                  type="date"
                  className="w-full"
                  size="sm"
                  variant="bordered"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Status
              </span>
              <Select
                className="w-full"
                defaultSelectedKeys={["all"]}
                placeholder="Filter Status"
                selectionMode="single"
                size="sm"
                variant="bordered"
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {[
                  <SelectItem key="all">Semua Status</SelectItem>,
                  ...Object.entries(statusLabels).map(([id, label]) => (
                    <SelectItem key={id}>{label}</SelectItem>
                  )),
                ]}
              </Select>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Urutkan
              </span>
              <div className="flex items-center gap-2">
                <Select
                  className="w-full"
                  placeholder="Urutkan"
                  selectedKeys={[sortDescriptor.column]}
                  selectionMode="single"
                  size="sm"
                  variant="bordered"
                  onChange={(e) => {
                    if (e.target.value) {
                      setSortDescriptor((prev) => ({
                        ...prev,
                        column: e.target.value,
                      }));
                    }
                  }}
                >
                  <SelectItem key="waktu_order">Tanggal</SelectItem>
                  <SelectItem key="customer">Nama Pelanggan</SelectItem>
                  <SelectItem key="status">Status</SelectItem>
                  <SelectItem key="ticket">Nomor Tiket</SelectItem>
                </Select>

                <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  className="shrink-0"
                  onClick={() =>
                    setSortDescriptor((prev) => ({
                      ...prev,
                      direction:
                        prev.direction === "ascending"
                          ? "descending"
                          : "ascending",
                    }))
                  }
                >
                  {sortDescriptor.direction === "ascending" ? (
                    <span className="font-bold">↑</span>
                  ) : (
                    <span className="font-bold">↓</span>
                  )}
                </Button>
              </div>
            </div>

            <div className="flex items-end">
              <Button
                color="primary"
                isLoading={isLoading}
                size="md"
                className="w-full font-bold"
                onPress={fetchOrders}
              >
                Tampilkan
              </Button>
            </div>
          </div>
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
        <Card className="mb-4 backdrop-blur-xl bg-red-500/20 border border-red-500/30">
          <CardBody className="p-6 text-center text-red-600 dark:text-red-400">
            {error}
          </CardBody>
        </Card>
      )}

      {!isLoading && !hasFetched ? (
        <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
          <CardBody className="py-20 text-center text-gray-500">
            <Sparkles className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-800 dark:text-gray-200 mb-2">
              Pilih Rentang Tanggal
            </h3>
            <p>
              Silakan pilih rentang tanggal dan klik <b>Tampilkan</b> untuk
              memuat riwayat pesanan.
            </p>
          </CardBody>
        </Card>
      ) : (
        !isLoading &&
        !error && (
          <div className="space-y-3">
            {filteredOrders.length === 0 ? (
              <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
                <CardBody className="p-6 text-center text-gray-600 dark:text-white/70">
                  {searchTerm
                    ? "Tidak ada hasil pencarian."
                    : "Belum ada riwayat pesanan."}
                </CardBody>
              </Card>
            ) : (
              filteredOrders.map((order) => (
                <Card
                  key={order.id}
                  className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30"
                >
                  <CardBody className="p-4">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-bold text-gray-900 dark:text-white">
                            {order.nomor_tiket || "No Ticket"}
                          </span>
                          <Chip
                            color={
                              order.jenis_tugas === "JEMPUT"
                                ? "secondary"
                                : "primary"
                            }
                            size="sm"
                            variant="flat"
                          >
                            {order.jenis_tugas}
                          </Chip>
                          <Chip
                            color={statusColors[order.status_id] || "default"}
                            size="sm"
                          >
                            {order.status_ref?.nama_status || "Unknown"}
                          </Chip>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-white/70 mb-1 flex items-center gap-1">
                          <User size={14} />{" "}
                          {order.customers?.nama_terakhir || "Unknown"} •{" "}
                          {order.customers?.nomor_hp || "-"}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-white/50 mb-1 flex items-center gap-1">
                          <MapPin size={14} /> {order.alamat_jalan || "-"}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-white/50 flex items-center gap-1">
                          <Truck size={14} /> Kurir: {order.courierName || "-"}
                        </p>
                        {order.google_maps_link && (
                          <Link
                            className="text-xs text-primary hover:underline mt-1 inline-block"
                            href={order.google_maps_link}
                            target="_blank"
                          >
                            Buka di Google Maps →
                          </Link>
                        )}
                      </div>

                      <div className="flex flex-col justify-between items-end gap-2">
                        <div className="text-right text-sm text-gray-400 dark:text-white/40">
                          <p>{formatDate(order.waktu_order)}</p>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            startContent={<History size={14} />}
                            variant="flat"
                            onPress={() => fetchLogs(order)}
                          >
                            Timeline
                          </Button>

                          {/* Allow Re-assign if status is > 2 (Ditugaskan) and < 6 (Selesai) */}
                          {order.status_id > 2 && order.status_id < 6 && (
                            <Button
                              color="warning"
                              isLoading={reassignLoading === order.id}
                              size="sm"
                              startContent={<RefreshCw size={14} />}
                              variant="flat"
                              onPress={() =>
                                order.customers?.id &&
                                handleReassign(order.id, order.customers.id)
                              }
                            >
                              Tugaskan Lagi
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))
            )}
          </div>
        )
      )}

      {/* Timeline Modal */}
      <Modal
        isOpen={timelineModal.isOpen}
        scrollBehavior="inside"
        onClose={timelineModal.onClose}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1">
            Timeline Pesanan
          </ModalHeader>
          <ModalBody>
            {logsLoading ? (
              <div className="flex justify-center p-4">
                <Spinner />
              </div>
            ) : selectedLogs.length === 0 ? (
              <p className="text-center text-gray-500">
                Belum ada riwayat aktivitas.
              </p>
            ) : (
              <div className="relative space-y-6 my-4">
                {/* Vertical Line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-gray-200 dark:bg-gray-700 pointer-events-none" />

                {selectedLogs.map((log) => (
                  <div key={log.id} className="relative pl-8">
                    {/* Dot */}
                    <div className="absolute left-0 top-0.5 w-4 h-4 bg-primary rounded-full border-2 border-white dark:border-gray-800 z-10 shadow-sm" />

                    <div className="flex flex-col">
                      <span className="text-xs text-gray-500 mb-1">
                        {formatDate(log.created_at)} •{" "}
                        {formatTimeOnly(log.created_at)}
                      </span>
                      <span className="font-semibold text-gray-800 dark:text-white">
                        {log.status_ref?.nama_status || "Status Update"}
                        {log.status_id_baru === 2 &&
                          selectedOrderForLogs?.courierName && (
                            <span className="text-primary ml-1">
                              ke {selectedOrderForLogs.courierName}
                            </span>
                          )}
                      </span>
                      <span className="text-xs text-gray-500">
                        {log.auth_users?.full_name
                          ? `Oleh: ${log.auth_users.full_name}`
                          : "System Update"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button color="primary" onPress={timelineModal.onClose}>
              Tutup
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
