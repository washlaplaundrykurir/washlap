"use client";

import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Hand, Truck, Package, CheckCircle, ClipboardList } from "lucide-react";

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

interface Stats {
  todayTasks: number;
  pendingTasks: number;
  completedTasks: number;
  totalTasks: number;
}

const statusColors: Record<
  number,
  "default" | "primary" | "secondary" | "success" | "warning" | "danger"
> = {
  1: "warning",
  2: "primary",
  3: "secondary",
  4: "secondary",
  5: "secondary",
  6: "success",
  7: "danger",
};

// Status IDs:
// 6 = Selesai (completed)
// 7 = Dibatalkan (cancelled)

export default function KurirPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<Stats>({
    todayTasks: 0,
    pendingTasks: 0,
    completedTasks: 0,
    totalTasks: 0,
  });
  const [courierName, setCourierName] = useState("Kurir");
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/kurir/tasks?status=pending");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal mengambil data");
      }

      setOrders(result.data || []);
      setStats(
        result.stats || {
          todayTasks: 0,
          pendingTasks: 0,
          completedTasks: 0,
          totalTasks: 0,
        },
      );
      if (result.courierName) setCourierName(result.courierName);
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Terjadi kesalahan",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (orderId: string, newStatusId: number) => {
    try {
      setActionLoading(orderId);
      const response = await fetch("/api/kurir/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status_id: newStatusId }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      showToast(
        "success",
        newStatusId === 7 ? "Tugas dibatalkan" : "Tugas selesai!",
      );
      fetchTasks();
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Gagal update status",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }).replace(/\./g, ':') + " WIB";
  };

  // Get complete button label based on jenis_tugas
  const getCompleteLabel = (jenisTugas: string) => {
    return jenisTugas === "JEMPUT" ? (
      <>
        <CheckCircle size={16} /> Sudah Jemput
      </>
    ) : (
      <>
        <CheckCircle size={16} /> Sudah Antar
      </>
    );
  };

  // Check if task can be completed or cancelled
  const isFinalized = (statusId: number) => statusId >= 6;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Content */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Hand className="w-6 h-6 text-yellow-500" /> Halo, {courierName}!
        </h1>
        <p className="text-gray-600 dark:text-white/70">
          Siap untuk mengirim pesanan hari ini?
        </p>
      </div>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
          <CardBody className="p-4 text-center">
            <p className="text-xs text-gray-600 dark:text-white/70">Hari Ini</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.todayTasks}
            </p>
          </CardBody>
        </Card>
        <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
          <CardBody className="p-4 text-center">
            <p className="text-xs text-gray-600 dark:text-white/70">Pending</p>
            <p className="text-2xl font-bold text-warning">
              {stats.pendingTasks}
            </p>
          </CardBody>
        </Card>
        <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
          <CardBody className="p-4 text-center">
            <p className="text-xs text-gray-600 dark:text-white/70">Selesai</p>
            <p className="text-2xl font-bold text-success">
              {stats.completedTasks}
            </p>
          </CardBody>
        </Card>
        <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
          <CardBody className="p-4 text-center">
            <p className="text-xs text-gray-600 dark:text-white/70">Total</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats.totalTasks}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Task List */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ClipboardList className="w-5 h-5" /> Tugas Aktif
        </h2>
        <div className="flex gap-2">
          <Button as={Link} href="/kurir/rekap" size="sm" variant="flat">
            Lihat Rekap
          </Button>
          <Button as={Link} href="/kurir/history" size="sm" variant="flat">
            Lihat Riwayat →
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      ) : orders.length === 0 ? (
        <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
          <CardBody className="p-8 text-center flex flex-col items-center">
            <Package className="w-12 h-12 mb-4 text-gray-400" />
            <p className="text-gray-600 dark:text-white/70">
              Tidak ada tugas aktif saat ini.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card
              key={order.id}
              className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30"
            >
              <CardBody className="p-4">
                <div className="flex flex-col gap-3">
                  {/* Header */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900 dark:text-white">
                        {order.nomor_tiket}
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
                    </div>
                    <Chip
                      color={statusColors[order.status_id] || "default"}
                      size="sm"
                    >
                      {order.status_ref?.nama_status || "Unknown"}
                    </Chip>
                  </div>

                  {/* Customer Info */}
                  <div className="text-sm">
                    <p className="text-gray-900 dark:text-white font-medium flex items-center gap-1">
                      <Hand size={14} />{" "}
                      {order.customers?.nama_terakhir || "Unknown"}
                    </p>
                    <p className="text-gray-600 dark:text-white/70 flex items-center gap-1">
                      <Truck size={14} /> {order.customers?.nomor_hp || "-"}
                    </p>
                  </div>

                  {/* Address */}
                  <div className="text-sm">
                    <p className="text-gray-600 dark:text-white/70 flex items-center gap-1">
                      <Truck size={14} /> {order.alamat_jalan || "-"}
                    </p>
                    {order.google_maps_link && (
                      <Link
                        className="text-primary text-xs hover:underline"
                        href={order.google_maps_link}
                        target="_blank"
                      >
                        Buka di Google Maps →
                      </Link>
                    )}
                  </div>

                  {/* Notes */}
                  {order.catatan_khusus && (
                    <div className="text-xs bg-yellow-100 dark:bg-yellow-500/20 p-2 rounded-lg text-yellow-800 dark:text-yellow-200">
                      <ClipboardList className="inline mr-1" size={12} />{" "}
                      {order.catatan_khusus}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-white/10">
                    <div className="flex flex-col">
                      <span className="text-xs text-gray-400">
                        {formatDate(order.waktu_order)}
                      </span>
                      {order.waktu_penjemputan && (
                        <span className="text-xs font-medium text-primary flex items-center gap-1 mt-1">
                          <Truck size={12} /> {formatDate(order.waktu_penjemputan)}
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {/* Cancel Button */}
                      <Button
                        color="danger"
                        isDisabled={isFinalized(order.status_id)}
                        isLoading={actionLoading === order.id + "-cancel"}
                        size="sm"
                        variant="flat"
                        onClick={() => {
                          setActionLoading(order.id + "-cancel");
                          updateStatus(order.id, 7);
                        }}
                      >
                        <CheckCircle className="rotate-45" size={16} />{" "}
                        Dibatalkan
                      </Button>

                      {/* Complete Button */}
                      <Button
                        color="success"
                        isDisabled={isFinalized(order.status_id)}
                        isLoading={actionLoading === order.id + "-complete"}
                        size="sm"
                        onClick={() => {
                          setActionLoading(order.id + "-complete");
                          // JEMPUT → status 3, ANTAR → status 5
                          updateStatus(
                            order.id,
                            order.jenis_tugas === "JEMPUT" ? 3 : 5,
                          );
                        }}
                      >
                        {getCompleteLabel(order.jenis_tugas)}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
