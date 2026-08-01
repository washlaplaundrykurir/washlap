"use client";

import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { useState } from "react";
import Link from "next/link";
import {
  History,
  ArrowLeft,
  Inbox,
  User,
  MapPin,
  Clock3,
  CheckCircle2,
  XCircle,
} from "lucide-react";

import { formatDateTimeWIB } from "@/lib/datetime";

interface Order {
  id: string;
  nomor_tiket: string;
  nomor_nota: string | null;
  jenis_tugas: string;
  alamat_jalan: string;
  google_maps_link: string;
  waktu_order: string;
  waktu_kurir_selesai: string | null;
  sla_kurir_status: "MEET" | "FAILED" | null;
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
  const [courierName, setCourierName] = useState("Kurir");
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [error, setError] = useState("");

  // Default filter: last 7 days
  const today = new Date();
  const sevenDaysAgo = new Date();

  sevenDaysAgo.setDate(today.getDate() - 7);

  const [startDate, setStartDate] = useState(
    sevenDaysAgo.toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      setHasFetched(true);
      setError("");
      const params = new URLSearchParams({
        status: "completed",
        startDate,
        endDate,
      });

      const response = await fetch(`/api/kurir/tasks?${params}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal mengambil data");
      }

      setOrders(result.data || []);
      if (result.courierName) setCourierName(result.courierName);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => formatDateTimeWIB(dateString);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gray-700 dark:bg-white/10 rounded-xl">
          <History className="w-5 h-5 text-white dark:text-white" />
        </div>
        <div>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
              Riwayat Tugas
            </h1>
            <span className="text-sm font-bold text-primary-600 dark:text-primary-400">
              {courierName}
            </span>
          </div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
            {hasFetched
              ? `Total: ${orders.length} tugas selesai`
              : "Pilih tanggal dan klik Tampilkan"}
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-6 backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30 rounded-xl p-4 flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Input
            classNames={{ label: "text-xs font-bold" }}
            label="Dari"
            size="sm"
            type="date"
            value={startDate}
            variant="bordered"
            onValueChange={setStartDate}
          />
          <Input
            classNames={{ label: "text-xs font-bold" }}
            label="Sampai"
            size="sm"
            type="date"
            value={endDate}
            variant="bordered"
            onValueChange={setEndDate}
          />
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1 font-bold"
            color="primary"
            isLoading={isLoading}
            size="sm"
            onClick={fetchHistory}
          >
            Tampilkan
          </Button>
          <Button
            as={Link}
            className="font-bold"
            href="/kurir"
            size="sm"
            startContent={<ArrowLeft size={14} />}
            variant="flat"
          >
            Kembali
          </Button>
        </div>
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
      {!isLoading && !hasFetched ? (
        <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
          <CardBody className="py-16 text-center flex flex-col items-center gap-3">
            <History className="w-12 h-12 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-white/50 font-medium">
              Pilih rentang tanggal dan klik <b>Tampilkan</b> untuk memuat
              riwayat.
            </p>
          </CardBody>
        </Card>
      ) : (
        !isLoading &&
        !error && (
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
                          {/* Display Nomor Nota if available */}
                          {order.nomor_nota && (
                            <Chip
                              className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
                              size="sm"
                              variant="flat"
                            >
                              Nota: {order.nomor_nota}
                            </Chip>
                          )}
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
                      <div className="text-sm text-gray-400 dark:text-white/40 md:min-w-56 md:text-right">
                        <p>{formatDate(order.waktu_order)}</p>
                        {order.waktu_kurir_selesai && (
                          <p className="mt-2 flex items-center gap-1 text-gray-600 dark:text-white/70 md:justify-end">
                            <Clock3 size={14} />
                            Selesai {order.jenis_tugas.toLowerCase()}:{" "}
                            {formatDate(order.waktu_kurir_selesai)}
                          </p>
                        )}
                        {order.sla_kurir_status && (
                          <div className="mt-2 flex md:justify-end">
                            <Chip
                              color={
                                order.sla_kurir_status === "MEET"
                                  ? "success"
                                  : "danger"
                              }
                              size="sm"
                              startContent={
                                order.sla_kurir_status === "MEET" ? (
                                  <CheckCircle2 size={12} />
                                ) : (
                                  <XCircle size={12} />
                                )
                              }
                              variant="flat"
                            >
                              {order.sla_kurir_status} SLA
                            </Chip>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              ))
            )}
          </div>
        )
      )}
    </div>
  );
}
