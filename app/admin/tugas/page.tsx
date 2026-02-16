"use client";

import { Card, CardBody } from "@heroui/card";
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
import { useEffect, useState, Suspense } from "react";
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
} from "lucide-react";

import { useToast } from "@/components/ToastProvider";

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
  customers: { id: string; nomor_hp: string; nama_terakhir: string } | null;
  auth_users: { id: string; full_name: string; email: string } | null;
  status_ref: { id: number; nama_status: string } | null;
  created_by_user: { id: string; full_name: string } | null;
  order_items: { jenis_layanan: string }[];
}

interface Courier {
  id: string;
  email: string;
  full_name: string;
}

function TugasPageContent() {
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState(
    searchParams.get("tab") || "jemput",
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [jemputCount, setJemputCount] = useState(0);
  const [antarCount, setAntarCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const { showToast } = useToast();

  const assignModal = useDisclosure();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedCourier, setSelectedCourier] = useState<string>("");

  useEffect(() => {
    // Update URL when tab changes without reloading
    const url = new URL(window.location.href);

    url.searchParams.set("tab", activeTab);
    window.history.pushState({}, "", url);

    fetchOrders();
  }, [activeTab]);

  useEffect(() => {
    fetchCouriers();
    fetchCounts(); // Fetch counts for both tabs on mount
  }, []);

  const fetchCounts = async () => {
    try {
      const [jemputRes, antarRes] = await Promise.all([
        fetch("/api/tasks?type=JEMPUT"),
        fetch("/api/tasks?type=ANTAR"),
      ]);
      const jemputData = await jemputRes.json();
      const antarData = await antarRes.json();

      // Count only orders with status "Ditugaskan" (status_id = 2)
      setJemputCount(
        jemputData.data?.filter((o: Order) => o.status_id === 2).length || 0,
      );
      setAntarCount(
        antarData.data?.filter((o: Order) => o.status_id === 2).length || 0,
      );
    } catch {
      /* ignore */
    }
  };

  const fetchOrders = async () => {
    try {
      setIsLoading(true);
      const type = activeTab === "jemput" ? "JEMPUT" : "ANTAR";
      const response = await fetch(`/api/tasks?type=${type}&status=pending`);
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);
      // Filter only orders with status "Ditugaskan" (status_id = 2)
      const pendingOrders =
        result.data?.filter((o: Order) => o.status_id === 2) || [];

      setOrders(pendingOrders);
      // Update counts after fetching
      if (activeTab === "jemput") {
        setJemputCount(pendingOrders.length);
      } else {
        setAntarCount(pendingOrders.length);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCouriers = async () => {
    try {
      const response = await fetch("/api/couriers");
      const result = await response.json();

      if (response.ok) setCouriers(result.data);
    } catch {
      /* ignore */
    }
  };

  const handleAssign = async () => {
    if (!selectedOrder || !selectedCourier) return;
    try {
      setActionLoading(true);
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
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async (orderId: string) => {
    try {
      const response = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status_id: 6 }),
      });

      if (!response.ok) throw new Error((await response.json()).error);
      fetchOrders();
      const action = activeTab === "jemput" ? "dijemput" : "diantar";

      showToast("success", `Order berhasil ${action}!`);
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Error");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const [sortDescriptor, setSortDescriptor] = useState({
    column: "waktu_order",
    direction: "descending",
  });

  const sortedOrders = [...orders].sort((a, b) => {
    let first: string | number | null = a[sortDescriptor.column as keyof Order] as string | number | null;
    let second: string | number | null = b[sortDescriptor.column as keyof Order] as string | number | null;

    if (sortDescriptor.column === "customers") {
      first = a.customers?.nama_terakhir || "";
      second = b.customers?.nama_terakhir || "";
    } else if (sortDescriptor.column === "couriers") {
      first =
        a.auth_users?.full_name || a.auth_users?.email || "Belum ditugaskan";
      second =
        b.auth_users?.full_name || b.auth_users?.email || "Belum ditugaskan";
    }

    // Convert to default empty string if null/undefined for safe comparison
    const firstStr = (first ?? "").toString();
    const secondStr = (second ?? "").toString();

    const cmp = firstStr < secondStr ? -1 : firstStr > secondStr ? 1 : 0;

    return sortDescriptor.direction === "descending" ? -cmp : cmp;
  });

  return (
    <>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6" /> Tugas Kurir
          </h1>
          <p className="text-gray-600 dark:text-white/70">
            Kelola penjemputan dan pengantaran
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            className="w-48"
            label="Urutkan"
            placeholder="Pilih urutan"
            selectedKeys={[sortDescriptor.column]}
            variant="bordered"
            onChange={(e) => {
              if (e.target.value) {
                setSortDescriptor({
                  column: e.target.value,
                  direction: sortDescriptor.direction,
                });
              }
            }}
          >
            <SelectItem key="waktu_order">Tanggal</SelectItem>
            <SelectItem key="customers">Nama Pelanggan</SelectItem>
            <SelectItem key="couriers">Nama Kurir</SelectItem>
          </Select>
          <Button
            isIconOnly
            variant="flat"
            onClick={() =>
              setSortDescriptor((prev) => ({
                ...prev,
                direction:
                  prev.direction === "ascending" ? "descending" : "ascending",
              }))
            }
          >
            {sortDescriptor.direction === "ascending" ? (
              <span className="text-lg">↑</span>
            ) : (
              <span className="text-lg">↓</span>
            )}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <Tabs
          aria-label="Tugas options"
          classNames={{
            tabList:
              "gap-6 w-full relative rounded-none p-0 border-b border-divider",
            cursor: "w-full bg-blue-500",
            tab: "max-w-fit px-0 h-12",
            tabContent: "group-data-[selected=true]:text-blue-500 text-lg",
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
                <Chip color="secondary" size="sm" variant="flat">
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
                <Chip color="primary" size="sm" variant="flat">
                  {antarCount}
                </Chip>
              </div>
            }
          />
        </Tabs>

        {error && (
          <Card className="bg-red-500/20 border border-red-500/30">
            <CardBody className="text-red-600 dark:text-red-400 text-sm">
              {error}{" "}
              <Button
                className="ml-2"
                size="sm"
                variant="light"
                onClick={() => setError("")}
              >
                <X size={14} />
              </Button>
            </CardBody>
          </Card>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : sortedOrders.length === 0 ? (
          <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
            <CardBody className="py-12 text-center text-gray-500">
              Tidak ada tugas{" "}
              {activeTab === "jemput" ? "penjemputan" : "pengantaran"} saat ini
            </CardBody>
          </Card>
        ) : (
          <div className="space-y-4">
            {sortedOrders.map((order) => (
              <Card
                key={order.id}
                className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30"
              >
                <CardBody className="p-4">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {order.nomor_tiket}
                        </span>
                        <Chip
                          color={activeTab === "jemput" ? "warning" : "primary"}
                          size="sm"
                        >
                          {order.status_ref?.nama_status}
                        </Chip>
                        <Chip
                          color={
                            activeTab === "jemput" ? "secondary" : "primary"
                          }
                          size="sm"
                          variant="flat"
                        >
                          {activeTab === "jemput" ? "JEM" : "ANT"}
                          {order.order_items?.some(
                            (i) => i.jenis_layanan?.toLowerCase() === "express",
                          ) && " E"}
                        </Chip>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-white/70 mb-1 flex items-center gap-1">
                        <User size={14} />{" "}
                        {order.customers?.nama_terakhir || "-"} •{" "}
                        {order.customers?.nomor_hp}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-white/50 mb-2 flex items-center gap-1">
                        <MapPin size={14} /> {order.alamat_jalan}
                      </p>
                      {order.google_maps_link && (
                        <Link
                          className="text-xs text-primary hover:underline"
                          href={order.google_maps_link}
                          target="_blank"
                        >
                          Buka Maps →
                        </Link>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        Order: {formatDate(order.waktu_order)}
                      </p>
                      {order.created_by_user && (
                        <p className="text-xs text-gray-500 mt-1">
                          Admin: {order.created_by_user.full_name}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 min-w-[180px]">
                      <div className="text-sm">
                        <span className="text-gray-500">Kurir: </span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {order.auth_users?.full_name ||
                            order.auth_users?.email ||
                            "Belum ditugaskan"}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          className="flex-1"
                          size="sm"
                          variant="flat"
                          onClick={() => {
                            setSelectedOrder(order);
                            setSelectedCourier(order.courier_id || "");
                            assignModal.onOpen();
                          }}
                        >
                          {order.courier_id ? "Ganti" : "Tugaskan"}
                        </Button>
                        <Button
                          className="flex-1"
                          color="success"
                          size="sm"
                          variant="flat"
                          onClick={() => handleComplete(order.id)}
                        >
                          {activeTab === "jemput" ? (
                            <>
                              <Check size={16} /> Jemput
                            </>
                          ) : (
                            <>
                              <Check size={16} /> Antar
                            </>
                          )}
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
      <Modal isOpen={assignModal.isOpen} onClose={assignModal.onClose}>
        <ModalContent className="bg-white dark:bg-gray-900">
          <ModalHeader>Tugaskan Kurir</ModalHeader>
          <ModalBody>
            <p className="text-sm text-gray-600 mb-4">
              Tiket: <strong>{selectedOrder?.nomor_tiket}</strong>
            </p>
            <Select
              label="Pilih Kurir"
              selectedKeys={selectedCourier ? [selectedCourier] : []}
              onSelectionChange={(k) =>
                setSelectedCourier(Array.from(k)[0] as string)
              }
            >
              {couriers.map((c) => (
                <SelectItem key={c.id}>{c.full_name || c.email}</SelectItem>
              ))}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="light" onClick={assignModal.onClose}>
              Batal
            </Button>
            <Button
              color="primary"
              isLoading={actionLoading}
              onClick={handleAssign}
            >
              Tugaskan
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export default function TugasPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <TugasPageContent />
    </Suspense>
  );
}
