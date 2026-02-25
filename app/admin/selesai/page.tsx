"use client";

import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Tabs, Tab } from "@heroui/tabs";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  User,
  MapPin,
  Truck,
  CheckCircle,
  Check,
  FileText,
  Sparkles,
  RotateCcw,
} from "lucide-react";

import { useToast } from "@/components/ToastProvider";

interface Order {
  id: string;
  nomor_tiket: string;
  jenis_tugas: string;
  alamat_jalan: string;
  google_maps_link: string;
  waktu_order: string;
  waktu_selesai: string;
  status_id: number;
  catatan_khusus: string;
  nomor_nota: string | null;
  customers: { id: string; nomor_hp: string; nama_terakhir: string } | null;
  auth_users: { id: string; full_name: string; email: string } | null;
  status_ref: { id: number; nama_status: string } | null;
  order_items: {
    id: string;
    produk_layanan: string;
    jenis_layanan: string;
    parfum: string;
  }[];
}

const PendingCard = ({
  order,
  notaInputs,
  setNotaInputs,
  actionLoading,
  confirmOrder,
  revertOrder,
  formatDate,
}: {
  order: Order;
  notaInputs: Record<string, string>;
  setNotaInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  actionLoading: string | null;
  confirmOrder: (orderId: string, hasExistingNota: boolean) => void;
  revertOrder: (orderId: string, customerId: string) => void;
  formatDate: (date: string) => string;
}) => (
  <Card className="backdrop-blur-xl bg-yellow-50/60 dark:bg-yellow-500/10 border border-yellow-300/50 dark:border-yellow-500/30">
    <CardBody className="p-4">
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900 dark:text-white">
              {order.nomor_tiket}
            </span>
            <Chip color="warning" size="sm">
              {order.status_ref?.nama_status || "Menunggu Konfirmasi"}
            </Chip>
            <Chip
              color={order.jenis_tugas === "JEMPUT" ? "secondary" : "primary"}
              size="sm"
              variant="flat"
            >
              {order.jenis_tugas}
            </Chip>
          </div>
          <p className="text-xs text-gray-400">
            {formatDate(order.waktu_order)}
          </p>
        </div>

        <div className="text-sm">
          <p className="text-gray-600 dark:text-white/70 flex items-center gap-1">
            <User size={14} /> {order.customers?.nama_terakhir || "-"} •{" "}
            {order.customers?.nomor_hp}
          </p>
          <p className="text-gray-500 dark:text-white/50 flex items-center gap-1">
            <MapPin size={14} /> {order.alamat_jalan}
          </p>
          <p className="text-gray-500 dark:text-white/50 flex items-center gap-1">
            <Truck size={14} /> Kurir:{" "}
            {order.auth_users?.full_name || order.auth_users?.email || "-"}
          </p>

          {/* Customer Order Details using simple grid */}
          {order.order_items && order.order_items.length > 0 && (
            <div className="mt-2 p-3 bg-yellow-100/50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800/30">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Detail Permintaan Customer:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                <div className="flex flex-col">
                  <span className="text-gray-500 dark:text-gray-400">
                    Produk
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {order.order_items[0].produk_layanan.replace(/-/g, " ")}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-500 dark:text-gray-400">
                    Layanan
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {order.order_items[0].jenis_layanan}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-500 dark:text-gray-400">
                    Parfum
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white capitalize">
                    {order.order_items[0].parfum.replace(/-/g, " ")}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Section - Different for JEMPUT vs ANTAR */}
        <div className="flex gap-2 items-center pt-2 border-t border-yellow-200 dark:border-yellow-500/20">
          {order.jenis_tugas === "JEMPUT" ? (
            /* JEMPUT: Need to input nota */
            <>
              <Input
                className="flex-1"
                placeholder="Masukkan nomor nota"
                size="sm"
                value={notaInputs[order.id] || ""}
                variant="flat"
                onValueChange={(v) =>
                  setNotaInputs((prev) => ({ ...prev, [order.id]: v }))
                }
              />
              <Button
                isIconOnly
                color="warning"
                isLoading={actionLoading === order.id}
                size="sm"
                title="Kembalikan ke Ditugaskan"
                variant="flat"
                onClick={() =>
                  order.customers?.id &&
                  revertOrder(order.id, order.customers.id)
                }
              >
                <RotateCcw size={16} />
              </Button>
              <Button
                color="success"
                isLoading={actionLoading === order.id}
                size="sm"
                onClick={() => confirmOrder(order.id, false)}
              >
                <Check size={16} /> Selesai
              </Button>
            </>
          ) : (
            /* ANTAR: Input nota if missing, otherwise show it */
            <>
              {order.nomor_nota ? (
                <span className="text-sm text-gray-600 dark:text-white/70 flex-1 flex items-center gap-1">
                  <FileText size={14} /> Nota:{" "}
                  <strong>{order.nomor_nota}</strong>
                </span>
              ) : (
                <Input
                  className="flex-1"
                  placeholder="Masukkan nomor nota"
                  size="sm"
                  value={notaInputs[order.id] || ""}
                  variant="flat"
                  onValueChange={(v) =>
                    setNotaInputs((prev) => ({ ...prev, [order.id]: v }))
                  }
                />
              )}
              <Button
                isIconOnly
                color="warning"
                isLoading={actionLoading === order.id}
                size="sm"
                title="Kembalikan ke Ditugaskan"
                variant="flat"
                onClick={() =>
                  order.customers?.id &&
                  revertOrder(order.id, order.customers.id)
                }
              >
                <RotateCcw size={16} />
              </Button>
              <Button
                color="success"
                isLoading={actionLoading === order.id}
                size="sm"
                onClick={() => confirmOrder(order.id, !!order.nomor_nota)}
              >
                <Check size={16} /> Selesai
              </Button>
            </>
          )}
        </div>
      </div>
    </CardBody>
  </Card>
);

const CompletedCard = ({
  order,
  formatDate,
}: {
  order: Order;
  formatDate: (date: string) => string;
}) => (
  <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
    <CardBody className="p-4">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-gray-900 dark:text-white">
            {order.nomor_tiket}
          </span>
          <Chip color="success" size="sm">
            Selesai
          </Chip>
          <Chip
            color={order.jenis_tugas === "JEMPUT" ? "secondary" : "primary"}
            size="sm"
            variant="flat"
          >
            {order.jenis_tugas}
          </Chip>
          {order.nomor_nota && (
            <Chip color="default" size="sm" variant="bordered">
              <FileText className="inline mr-1" size={12} /> {order.nomor_nota}
            </Chip>
          )}
        </div>
        <p className="text-xs text-gray-400">
          {formatDate(order.waktu_selesai || order.waktu_order)}
        </p>
      </div>
      <p className="text-sm text-gray-600 dark:text-white/70 mb-1 flex items-center gap-1">
        <User size={14} /> {order.customers?.nama_terakhir || "-"} •{" "}
        {order.customers?.nomor_hp}
      </p>
      <p className="text-sm text-gray-500 dark:text-white/50 mb-1 flex items-center gap-1">
        <MapPin size={14} /> {order.alamat_jalan}
      </p>
      <p className="text-sm text-gray-500 dark:text-white/50 flex items-center gap-1">
        <Truck size={14} /> Kurir:{" "}
        {order.auth_users?.full_name || order.auth_users?.email || "-"}
      </p>
      {order.google_maps_link && (
        <Link
          className="text-xs text-primary hover:underline mt-1 inline-block"
          href={order.google_maps_link}
          target="_blank"
        >
          Buka Maps →
        </Link>
      )}
    </CardBody>
  </Card>
);

export default function SelesaiPage() {
  const [pendingOrders, setPendingOrders] = useState<Order[]>([]);
  const [completedOrders, setCompletedOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [notaInputs, setNotaInputs] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Date filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { showToast } = useToast();

  // Revert Modal State
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [revertTarget, setRevertTarget] = useState<{
    id: string;
    customerId: string;
  } | null>(null);

  // Set default dates (last month and current month)
  useEffect(() => {
    const now = new Date();
    // Get the first day of the previous month
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchAllOrders();
    }
  }, [startDate, endDate]);

  const fetchAllOrders = async () => {
    try {
      setIsLoading(true);

      const params = new URLSearchParams({
        startDate,
        endDate,
      });

      const [jemputRes, antarRes] = await Promise.all([
        fetch(`/api/tasks?type=JEMPUT&${params.toString()}`),
        fetch(`/api/tasks?type=ANTAR&${params.toString()}`),
      ]);

      const jemputData = await jemputRes.json();
      const antarData = await antarRes.json();

      const allOrders = [...(jemputData.data || []), ...(antarData.data || [])];

      // Separate pending confirmation (status 3 = Sudah Jemput, 5 = Sudah Antar) and completed (status 6)
      setPendingOrders(
        allOrders.filter((o: Order) => o.status_id === 3 || o.status_id === 5),
      );
      setCompletedOrders(allOrders.filter((o: Order) => o.status_id === 6));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setIsLoading(false);
    }
  };

  const confirmOrder = async (orderId: string, hasExistingNota: boolean) => {
    const nota = notaInputs[orderId]?.trim();

    // JEMPUT orders require nota input
    if (!hasExistingNota && !nota) {
      showToast("error", "Nomor nota harus diisi!");

      return;
    }

    try {
      setActionLoading(orderId);
      const response = await fetch("/api/orders/confirm", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: orderId,
          nomor_nota: hasExistingNota ? undefined : nota,
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      showToast("success", "Order dikonfirmasi!");
      setNotaInputs((prev) => ({ ...prev, [orderId]: "" }));
      fetchAllOrders();
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Gagal konfirmasi",
      );
    } finally {
      setActionLoading(null);
    }
  };

  const initiateRevert = (orderId: string, customerId: string) => {
    setRevertTarget({ id: orderId, customerId });
    onOpen();
  };

  const executeRevert = async () => {
    if (!revertTarget) return;

    try {
      setActionLoading(revertTarget.id);
      const response = await fetch("/api/orders/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: revertTarget.id,
          customerId: revertTarget.customerId,
          statusId: 2, // Revert to Ditugaskan
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error);

      showToast("success", "Status berhasil dikembalikan ke Ditugaskan");
      fetchAllOrders();
      onOpenChange(); // Close modal
    } catch (err) {
      showToast(
        "error",
        err instanceof Error ? err.message : "Gagal mengupdate status",
      );
    } finally {
      setActionLoading(null);
      setRevertTarget(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";

    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <>
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <CheckCircle size={24} /> Selesai
            </h1>
            <p className="text-gray-600 dark:text-white/70">
              Konfirmasi dan riwayat order selesai
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs font-medium text-gray-500 uppercase">
              Filter Tanggal:
            </span>
            <Input
              type="date"
              className="w-36"
              size="sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-gray-400">-</span>
            <Input
              type="date"
              className="w-36"
              size="sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 hidden md:block" />

          <Button
            color="primary"
            isLoading={isLoading}
            size="sm"
            variant="flat"
            onPress={fetchAllOrders}
          >
            Tampilkan
          </Button>
        </div>
      </div>

      {error && (
        <Card className="mb-4 bg-red-500/20 border border-red-500/30">
          <CardBody className="text-red-600 dark:text-red-400 text-sm">
            {error}
          </CardBody>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : (
        <Tabs
          aria-label="Selesai tabs"
          classNames={{
            tabList: "bg-white/60 dark:bg-white/15 backdrop-blur-xl",
          }}
          color="primary"
          variant="bordered"
        >
          <Tab
            key="pending"
            title={
              <div className="flex items-center gap-2">
                <span>Menunggu Konfirmasi</span>
                {pendingOrders.length > 0 && (
                  <Chip color="warning" size="sm" variant="solid">
                    {pendingOrders.length}
                  </Chip>
                )}
              </div>
            }
          >
            <div className="space-y-4 mt-4">
              {pendingOrders.length === 0 ? (
                <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
                  <CardBody className="py-8 text-center text-gray-500">
                    <Sparkles className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    Tidak ada order yang menunggu konfirmasi
                  </CardBody>
                </Card>
              ) : (
                pendingOrders.map((order) => (
                  <PendingCard
                    key={order.id}
                    actionLoading={actionLoading}
                    confirmOrder={confirmOrder}
                    formatDate={formatDate}
                    notaInputs={notaInputs}
                    order={order}
                    revertOrder={initiateRevert}
                    setNotaInputs={setNotaInputs}
                  />
                ))
              )}
            </div>
          </Tab>

          <Tab key="completed" title={`Selesai (${completedOrders.length})`}>
            <div className="space-y-4 mt-4">
              {completedOrders.length === 0 ? (
                <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
                  <CardBody className="py-8 text-center text-gray-500">
                    Belum ada order yang selesai
                  </CardBody>
                </Card>
              ) : (
                completedOrders.map((order) => (
                  <CompletedCard
                    key={order.id}
                    formatDate={formatDate}
                    order={order}
                  />
                ))
              )}
            </div>
          </Tab>
        </Tabs>
      )}

      {/* Confirmation Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1">
                Konfirmasi Pengembalian
              </ModalHeader>
              <ModalBody>
                <p>
                  Apakah Anda yakin ingin mengembalikan status order ini ke{" "}
                  <b>Ditugaskan</b>?
                </p>
                <p className="text-sm text-gray-500">
                  Tindakan ini akan membatalkan status &quot;Sudah
                  Jemput/Antar&quot; dan mengembalikan order ini ke antrian
                  tugas kurir.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button color="danger" variant="light" onPress={onClose}>
                  Batal
                </Button>
                <Button color="primary" onPress={executeRevert}>
                  Ya, Kembalikan
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
