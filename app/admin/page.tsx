"use client";

import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { CheckboxGroup, Checkbox } from "@heroui/checkbox";
import { DatePicker } from "@heroui/date-picker";
import { Divider } from "@heroui/divider";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { useState, useEffect } from "react";
import {
  CalendarDateTime,
  today,
  getLocalTimeZone,
} from "@internationalized/date";
import { I18nProvider } from "@react-aria/i18n";
import { ClipboardList, Truck, Package, Plus, Megaphone } from "lucide-react";

import { useToast } from "@/components/ToastProvider";

interface Stats {
  todayOrders: number;
  pendingOrders: number;
  activeCouriers: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats>({
    todayOrders: 0,
    pendingOrders: 0,
    activeCouriers: 0,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });
  const { showToast } = useToast();

  const orderModal = useDisclosure();

  const [formData, setFormData] = useState({
    nama: "",
    nomorHP: "",
    alamat: "",
    googleMapsLink: "",
    permintaan: [] as string[],
    waktuPenjemputan: null as CalendarDateTime | null,
    produkLayanan: "",
    produkLayananManual: "",
    jenisLayanan: "",
    parfum: "",
    catatan: "",
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch stats from API (simplified)
      const response = await fetch("/api/orders/list");

      if (response.ok) {
        const result = await response.json();
        const allOrders =
          result.data?.flatMap((g: { orders: unknown[] }) => g.orders) || [];
        const todayStart = new Date();

        todayStart.setHours(0, 0, 0, 0);

        setStats({
          todayOrders: allOrders.filter(
            (o: { waktu_order: string }) =>
              new Date(o.waktu_order) >= todayStart,
          ).length,
          pendingOrders: allOrders.filter(
            (o: { status_id: number }) => o.status_id < 6,
          ).length,
          activeCouriers:
            result.data?.filter(
              (g: { courierId: string }) => g.courierId !== "unassigned",
            ).length || 0,
        });
      }
    } catch {
      // Ignore errors
    }
  };

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setSubmitStatus({ type: null, message: "" });

    try {
      // Convert CalendarDateTime to ISO string
      const waktuPenjemputanStr = formData.waktuPenjemputan
        ? `${formData.waktuPenjemputan.year}-${String(formData.waktuPenjemputan.month).padStart(2, "0")}-${String(formData.waktuPenjemputan.day).padStart(2, "0")}T${String(formData.waktuPenjemputan.hour).padStart(2, "0")}:${String(formData.waktuPenjemputan.minute).padStart(2, "0")}`
        : null;

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          waktuPenjemputan: waktuPenjemputanStr,
        }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Terjadi kesalahan");

      setSubmitStatus({
        type: "success",
        message: "Pesanan berhasil ditambahkan!",
      });
      showToast("success", "Pesanan berhasil ditambahkan!");
      resetForm();
      fetchStats();
      setTimeout(() => orderModal.onClose(), 1500);
    } catch (error) {
      const errorMsg =
        error instanceof Error ? error.message : "Terjadi kesalahan";

      setSubmitStatus({ type: "error", message: errorMsg });
      showToast("error", errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    // Default to now
    const now = new Date();
    const nowDt = new CalendarDateTime(
      now.getFullYear(),
      now.getMonth() + 1,
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
    );

    setFormData({
      nama: "",
      nomorHP: "",
      alamat: "",
      googleMapsLink: "",
      permintaan: [],
      waktuPenjemputan: nowDt,
      produkLayanan: "",
      produkLayananManual: "",
      jenisLayanan: "",
      parfum: "",
      catatan: "",
    });
    setSubmitStatus({ type: null, message: "" });
  };

  const fillDummyData = () => {
    const names = [
      "Budi Santoso",
      "Ani Wijaya",
      "Dedi Prasetyo",
      "Siti Rahayu",
      "Eko Susanto",
      "Rina Kartika",
      "Joko Widodo",
      "Megawati Putri",
      "Ahmad Dhani",
      "Luna Maya",
      "Raffi Ahmad",
      "Nagita Slavina",
      "Deddy Corbuzier",
      "Raisa Andriana",
    ];
    const addresses = [
      "Jl. Merdeka No. 45, Surabaya",
      "Jl. Gatot Subroto No. 12, Jakarta",
      "Jl. Sudirman No. 78, Bandung",
      "Jl. Ahmad Yani No. 23, Semarang",
      "Jl. Diponegoro No. 99, Yogyakarta",
      "Perumahan Griya Indah Blok A1 No. 5",
      "Apartemen Sejahtera Lt. 12 Unit 5B",
      "Jl. Malioboro No. 1, Yogyakarta",
      "Jl. Pahlawan No. 10, Malang",
      "Komplek Setiabudi Regency No. 88",
    ];
    const notes = [
      "",
      "Pakaian mudah luntur, mohon dipisah",
      "Noda minyak di kemeja putih",
      "Tolong dilipat rapi",
      "Jangan pakai pewangi terlalu banyak",
      "Antar sore ya",
      "Hubungi satpam jika tidak ada orang",
      "Baju bayi, gunakan deterjen khusus jika ada",
      "",
    ];

    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomAddress =
      addresses[Math.floor(Math.random() * addresses.length)];
    const randomPhone = `08${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
    const randomNote = notes[Math.floor(Math.random() * notes.length)];

    const products = ["cuci-setrika", "cuci-lipat", "setrika-saja", "lainnya"];
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const randomProductManual =
      randomProduct === "lainnya" ? "Cuci Karpet" : "";

    const services = ["reguler", "express"];
    const randomService = services[Math.floor(Math.random() * services.length)];

    const perfumes = ["soft", "strong", "tanpa-parfum"];
    const randomPerfume = perfumes[Math.floor(Math.random() * perfumes.length)];

    // Random date within next 3 days
    const date = new Date();

    date.setDate(date.getDate() + Math.floor(Math.random() * 3));
    date.setHours(
      8 + Math.floor(Math.random() * 9),
      Math.floor(Math.random() * 4) * 15,
      0,
      0,
    );

    const timeDto = new CalendarDateTime(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
    );

    setFormData({
      nama: randomName,
      nomorHP: randomPhone,
      alamat: randomAddress,
      googleMapsLink: "https://maps.google.com/?q=-7.2575,112.7521",
      permintaan:
        Math.random() > 0.5
          ? ["jemput", "antar"]
          : Math.random() > 0.5
            ? ["jemput"]
            : ["antar"],
      waktuPenjemputan: timeDto,
      produkLayanan: randomProduct,
      produkLayananManual: randomProductManual,
      jenisLayanan: randomService,
      parfum: randomPerfume,
      catatan: randomNote,
    });
  };

  return (
    <>
      {/* Header with Add Button */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard Admin
        </h1>
        <Button
          color="primary"
          startContent={<Plus size={18} />}
          onClick={() => {
            resetForm();
            orderModal.onOpen();
          }}
        >
          Tambah Pesanan
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
          <CardBody className="p-6">
            <p className="text-sm text-gray-600 dark:text-white/70">
              Total Pesanan Hari Ini
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.todayOrders}
            </p>
          </CardBody>
        </Card>
        <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
          <CardBody className="p-6">
            <p className="text-sm text-gray-600 dark:text-white/70">
              Pesanan Pending
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.pendingOrders}
            </p>
          </CardBody>
        </Card>
        <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
          <CardBody className="p-6">
            <p className="text-sm text-gray-600 dark:text-white/70">
              Kurir dengan Tugas
            </p>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {stats.activeCouriers}
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Info Card */}
      <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
        <CardBody className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              className="h-20"
              variant="flat"
              onClick={() => {
                resetForm();
                orderModal.onOpen();
              }}
            >
              <div className="flex flex-col items-center justify-center">
                <ClipboardList className="w-8 h-8 mb-1" />
                <p className="text-xs pt-1">Tambah Pesanan</p>
              </div>
            </Button>
            <Button
              as="a"
              className="h-20"
              href="/admin/tugas?tab=jemput"
              variant="flat"
            >
              <div className="flex flex-col items-center justify-center">
                <Truck className="w-8 h-8 mb-1" />
                <p className="text-xs pt-1">Siap Jemput</p>
              </div>
            </Button>
            <Button
              as="a"
              className="h-20"
              href="/admin/tugas?tab=antar"
              variant="flat"
            >
              <div className="flex flex-col items-center justify-center">
                <Package className="w-8 h-8 mb-1" />
                <p className="text-xs pt-1">Siap Antar</p>
              </div>
            </Button>
            <Button as="a" className="h-20" href="/admin/orders" variant="flat">
              <div className="flex flex-col items-center justify-center">
                <ClipboardList className="w-8 h-8 mb-1" />
                <p className="text-xs pt-1">Belum Ditugaskan</p>
              </div>
            </Button>
            <Button as="a" className="h-20" href="/admin/promo" variant="flat">
              <div className="flex flex-col items-center justify-center">
                <Megaphone className="w-8 h-8 mb-1" />
                <p className="text-xs pt-1">Kelola Promo</p>
              </div>
            </Button>
          </div>
        </CardBody>
      </Card>
      {/* Add Order Modal */}
      <Modal
        isOpen={orderModal.isOpen}
        scrollBehavior="inside"
        size="2xl"
        onClose={orderModal.onClose}
      >
        <ModalContent className="bg-white dark:bg-gray-900 max-h-[90vh]">
          <ModalHeader>Tambah Pesanan Baru</ModalHeader>
          <ModalBody className="overflow-y-auto">
            <div className="flex flex-col gap-4">
              {submitStatus.type && (
                <div
                  className={`p-3 rounded-lg text-sm ${submitStatus.type === "success" ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"}`}
                >
                  {submitStatus.message}
                </div>
              )}

              <Input
                isRequired
                label="Nama Pelanggan"
                value={formData.nama}
                onValueChange={(v) => handleInputChange("nama", v)}
              />
              <Input
                isRequired
                label="Nomor HP"
                value={formData.nomorHP}
                onValueChange={(v) => handleInputChange("nomorHP", v)}
              />
              <Textarea
                isRequired
                label="Alamat Lengkap"
                value={formData.alamat}
                onValueChange={(v) => handleInputChange("alamat", v)}
              />
              <Input
                label="Link Google Maps"
                value={formData.googleMapsLink}
                onValueChange={(v) => handleInputChange("googleMapsLink", v)}
              />

              <Divider />

              <CheckboxGroup
                label="Permintaan"
                value={formData.permintaan}
                onValueChange={(v) => handleInputChange("permintaan", v)}
              >
                <Checkbox value="jemput">Jemput</Checkbox>
                <Checkbox value="antar">Antar</Checkbox>
              </CheckboxGroup>

              <I18nProvider locale="id-ID">
                <DatePicker
                  granularity="minute"
                  hourCycle={24}
                  label="Waktu Penjemputan"
                  minValue={today(getLocalTimeZone())}
                  value={formData.waktuPenjemputan}
                  onChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      waktuPenjemputan: v as CalendarDateTime | null,
                    }))
                  }
                />
              </I18nProvider>

              <Divider />

              {/* Hidden fields as per admin request
              <RadioGroup
                isRequired
                label="Produk Layanan"
                value={formData.produkLayanan}
                onValueChange={(v) => handleInputChange("produkLayanan", v)}
              >
                <Radio value="cuci-setrika">Cuci + Setrika</Radio>
                <Radio value="cuci-saja">Cuci Saja</Radio>
                <Radio value="setrika-saja">Setrika Saja</Radio>
                <Radio value="lainnya">Lainnya</Radio>
              </RadioGroup>

              {formData.produkLayanan === "lainnya" && (
                <Input
                  label="Produk Layanan Lainnya"
                  value={formData.produkLayananManual}
                  onValueChange={(v) =>
                    handleInputChange("produkLayananManual", v)
                  }
                />
              )}

              <RadioGroup
                isRequired
                label="Jenis Layanan"
                value={formData.jenisLayanan}
                onValueChange={(v) => handleInputChange("jenisLayanan", v)}
              >
                <Radio value="reguler">Reguler</Radio>
                <Radio value="express">Express</Radio>
              </RadioGroup>

              <RadioGroup
                isRequired
                label="Parfum"
                value={formData.parfum}
                onValueChange={(v) => handleInputChange("parfum", v)}
              >
                <Radio value="soft">Soft</Radio>
                <Radio value="strong">Strong</Radio>
                <Radio value="tanpa-parfum">Tanpa Parfum</Radio>
              </RadioGroup>
              */}

              <Textarea
                label="Catatan Tambahan"
                placeholder="Tambahkan catatan khusus jika ada"
                value={formData.catatan}
                onValueChange={(v) => handleInputChange("catatan", v)}
              />
            </div>
          </ModalBody>
          <ModalFooter>
            {process.env.NODE_ENV === "development" && (
              <Button
                className="mr-auto"
                color="warning"
                variant="flat"
                onClick={fillDummyData}
              >
                🧪 Fill Dummy
              </Button>
            )}
            <Button variant="light" onClick={orderModal.onClose}>
              Batal
            </Button>
            <Button
              color="primary"
              isLoading={isLoading}
              onClick={handleSubmit}
            >
              Simpan Pesanan
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
