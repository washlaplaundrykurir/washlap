"use client";

import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Button } from "@heroui/button";
import { useEffect, useState } from "react";
import Link from "next/link";
import { History, ArrowLeft, Inbox, User, MapPin } from "lucide-react";

interface Order {
  id: string;
  nomor_tiket: string;
  jenis_tugas: string;
  alamat_jalan: string;
  google_maps_link: string;
  waktu_order: string;
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

export default function KurirHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/kurir/tasks?status=completed");
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal mengambil data");
      }

      setOrders(result.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
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

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <History className="w-6 h-6" /> Riwayat Tugas
          </h1>
          <p className="text-sm text-gray-600 dark:text-white/70">
            Total: {orders.length} tugas selesai
          </p>
        </div>
        <Button as={Link} href="/kurir" size="sm" variant="flat">
          <ArrowLeft size={16} /> Kembali
        </Button>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center py-12">
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

      {/* History List */}
      {!isLoading && !error && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
              <CardBody className="p-8 text-center flex flex-col items-center">
                <Inbox className="w-12 h-12 mb-4 text-gray-400" />
                <p className="text-gray-600 dark:text-white/70">
                  Belum ada riwayat tugas.
                </p>
              </CardBody>
            </Card>
          ) : (
            orders.map((order) => (
              <Card
                key={order.id}
                className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30"
              >
                <CardBody className="p-4">
                  <div className="flex flex-col md:flex-row justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
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
                        <Chip
                          color={statusColors[order.status_id] || "default"}
                          size="sm"
                        >
                          {order.status_ref?.nama_status || "Unknown"}
                        </Chip>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-white/70 flex items-center gap-1">
                        <User size={14} />{" "}
                        {order.customers?.nama_terakhir || "Unknown"} •{" "}
                        {order.customers?.nomor_hp || "-"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-white/50 flex items-center gap-1">
                        <MapPin size={14} /> {order.alamat_jalan || "-"}
                      </p>
                    </div>
                    <div className="text-right text-sm text-gray-400 dark:text-white/40">
                      {formatDate(order.waktu_order)}
                    </div>
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
