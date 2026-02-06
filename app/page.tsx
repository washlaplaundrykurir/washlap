"use client";

import { Card, CardBody } from "@heroui/card";
import { Input, Textarea } from "@heroui/input";
import { Button } from "@heroui/button";
import { RadioGroup, Radio } from "@heroui/radio";
import { Checkbox, CheckboxGroup } from "@heroui/checkbox";
import { Divider } from "@heroui/divider";
import { DatePicker } from "@heroui/date-picker";
import { useState, useEffect } from "react";
import {
  CalendarDateTime,
  today,
  now,
  getLocalTimeZone,
} from "@internationalized/date";
import { I18nProvider } from "@react-aria/i18n";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { Image } from "@heroui/image";

import { ThemeSwitch } from "@/components/theme-switch";

export default function Home() {
  const isDevelopment = process.env.NODE_ENV === "development";

  const [formData, setFormData] = useState({
    nama: "",
    nomorHP: "",
    alamat: "",
    googleMapsLink: "",
    permintaan: [] as string[],
    waktuPenjemputan: (() => {
      const n = now(getLocalTimeZone());

      return new CalendarDateTime(
        n.year,
        n.month,
        n.day,
        n.hour,
        n.minute,
        n.second,
      );
    })() as CalendarDateTime | null,
    produkLayanan: "",
    produkLayananManual: "",
    jenisLayanan: "",
    parfum: "",
    catatan: "",
  });

  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [ticketNumbers, setTicketNumbers] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: "success" | "error" | null;
    message: string;
  }>({ type: null, message: "" });

  const [promo, setPromo] = useState<{ imageUrl: string; text: string } | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/admin/promo")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.is_active) {
          setPromo({
            imageUrl: data.promo_image_url,
            text: data.promo_text,
          });
        }
      })
      // eslint-disable-next-line no-console
      .catch((err) => console.error("Failed to fetch promo", err));
  }, []);

  const resetForm = () => {
    setFormData({
      nama: "",
      nomorHP: "",
      alamat: "",
      googleMapsLink: "",
      permintaan: [],
      waktuPenjemputan: (() => {
        const n = now(getLocalTimeZone());

        return new CalendarDateTime(
          n.year,
          n.month,
          n.day,
          n.hour,
          n.minute,
          n.second,
        );
      })(),
      produkLayanan: "",
      produkLayananManual: "",
      jenisLayanan: "",
      parfum: "",
      catatan: "",
    });
    setSubmitStatus({ type: null, message: "" });
  };

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Debug function to fill form with dummy data
  // ... (keep fillDummyData as is or if it's not in the range being replaced, be careful)
  // To avoid replacing fillDummyData if it's large, I will try to target specific blocks.
  // But wait, replace_file_content works on a block.
  // I need to insert resetForm before handleInputChange or similar.
  // And update handleSubmit.
  // And update the JSX.

  // Actually, I'll use multi_replace_file_content to be precise.

  // Debug function to fill form with dummy data
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
    ];
    const addresses = [
      "Jl. Merdeka No. 45, Surabaya",
      "Jl. Gatot Subroto No. 12, Jakarta",
      "Jl. Sudirman No. 78, Bandung",
      "Jl. Ahmad Yani No. 23, Semarang",
      "Jl. Diponegoro No. 99, Yogyakarta",
      "Perumahan Griya Indah Blok A1 No. 5",
    ];
    const notes = [
      "",
      "Pakaian mudah luntur, mohon dipisah",
      "Noda minyak di kemeja putih",
      "Tolong dilipat rapi",
      "Jangan pakai pewangi terlalu banyak",
      "Antar sore ya",
      "Hubungi satpam jika tidak ada orang",
      "",
    ];

    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomAddress =
      addresses[Math.floor(Math.random() * addresses.length)];
    const randomPhone = `08${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
    const randomNote = notes[Math.floor(Math.random() * notes.length)];

    const products = ["cuci-setrika", "cuci-lipat", "lainnya"];
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const randomProductManual =
      randomProduct === "lainnya" ? "Cuci Bedcover" : "";

    const services = ["reguler", "express"];
    const randomService = services[Math.floor(Math.random() * services.length)];

    const perfumes = ["soft", "strong", "tanpa-parfum"];
    const randomPerfume = perfumes[Math.floor(Math.random() * perfumes.length)];

    // Dates
    const date = new Date();

    date.setDate(date.getDate() + Math.floor(Math.random() * 3));
    // Ensure we don't pick past time if today
    if (date.getDate() === new Date().getDate()) {
      date.setHours(new Date().getHours() + 1 + Math.floor(Math.random() * 5));
    } else {
      date.setHours(8 + Math.floor(Math.random() * 9));
    }
    date.setMinutes(Math.floor(Math.random() * 4) * 15);

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
      googleMapsLink: "https://maps.google.com/?q=-6.2088,106.8456",
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
    setSubmitStatus({ type: null, message: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSubmitStatus({ type: null, message: "" });

    // Validate Checkbox Group (Permintaan)
    if (formData.permintaan.length === 0) {
      setSubmitStatus({
        type: "error",
        message: "Mohon pilih salah satu permintaan (Antar/Jemput)",
      });
      setIsLoading(false);

      return;
    }

    try {
      // Convert CalendarDateTime to ISO string
      const waktuPenjemputanStr = formData.waktuPenjemputan
        ? `${formData.waktuPenjemputan.year}-${String(formData.waktuPenjemputan.month).padStart(2, "0")}-${String(formData.waktuPenjemputan.day).padStart(2, "0")}T${String(formData.waktuPenjemputan.hour).padStart(2, "0")}:${String(formData.waktuPenjemputan.minute).padStart(2, "0")}`
        : null;

      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...formData,
          waktuPenjemputan: waktuPenjemputanStr,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Terjadi kesalahan");
      }

      const tickets = data.orders.map((o: any) => o.nomor_tiket);

      setTicketNumbers(tickets);
      onOpen(); // Open success modal

      // Form reset is now handled in the modal close actions
    } catch (error) {
      setSubmitStatus({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat mengirim pesanan",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-12 px-4 relative overflow-hidden">
      {/* Gradient Background - Light: Blue to White, Dark: Blue to Dark */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-100 to-purple-50 dark:from-blue-900 dark:to-gray-950 -z-20" />

      {/* Theme Switch Button & Debug Button */}
      <div className="fixed top-4 right-4 z-50 flex gap-2">
        {isDevelopment && (
          <Button
            className="backdrop-blur-xl bg-yellow-500/20 border border-yellow-500/30"
            color="warning"
            size="sm"
            variant="flat"
            onClick={fillDummyData}
          >
            🧪 Fill Dummy
          </Button>
        )}
        <div className="backdrop-blur-xl bg-black/10 dark:bg-white/15 border border-black/20 dark:border-white/30 rounded-full p-2 shadow-lg">
          <ThemeSwitch />
        </div>
      </div>

      {/* Promo Section */}
      {promo && (
        <div className="w-full max-w-2xl mx-auto mb-6 pt-20 relative z-10">
          <Card className="backdrop-blur-2xl bg-white/80 dark:bg-black/40 border border-primary/20 dark:border-primary/30 shadow-2xl relative overflow-hidden group">
            {promo.imageUrl && (
              <div className="relative w-full aspect-video md:aspect-[21/9]">
                <Image
                  removeWrapper
                  alt="Promo Banner"
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  src={promo.imageUrl}
                />
              </div>
            )}
            {promo.text && (
              <CardBody className="p-4 text-center">
                <p className="text-gray-800 dark:text-white font-medium whitespace-pre-wrap text-lg">
                  {promo.text}
                </p>
              </CardBody>
            )}
          </Card>
        </div>
      )}

      {/* Google Forms Style Header with Glassmorphism */}
      <div
        className={`w-full max-w-2xl mx-auto mb-6 ${promo ? "" : "pt-8"} relative`}
      >
        {/* Blob behind header */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-blue-400/30 dark:bg-blue-400/40 rounded-full blur-[100px] animate-pulse -z-10" />
        <Card className="border-t-8 border-t-primary backdrop-blur-2xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30 shadow-2xl">
          <CardBody className="p-6">
            <h1 className="text-3xl font-normal text-gray-900 dark:text-white mb-2">
              Selamat Datang Di Washlap Laundry
            </h1>
            <p className="text-gray-600 dark:text-white/70 text-sm">
              Silahkan isi form berikut untuk request layanan laundry
            </p>
            <Divider className="my-4 bg-black/10 dark:bg-white/20" />
            <div className="flex flex-col gap-2 text-sm text-gray-700 dark:text-white/80">
              <p className="flex gap-2 items-start">
                <span>📷</span>
                <span>
                  Untuk memudahkan kurir kami menjemput pakaian anda, mohon
                  dapat fotokan ke admin kami, tas laundry yang anda gunakan.
                </span>
              </p>
              <p className="flex gap-2 items-start">
                <span>👜</span>
                <span>
                  Jangan lupa beri nama pada tas pakaian yang anda gunakan,
                  untuk mencegah tertukar dengan pelanggan lain.
                </span>
              </p>
              <p className="flex gap-2 items-start">
                <span>👕</span>
                <span>
                  Untuk kenyamanan bersama, mohon dapat dihitung terlebih dahulu
                  jumlah pakaiannya.
                </span>
              </p>
            </div>
            <Divider className="my-4 bg-black/10 dark:bg-white/20" />
            <p className="text-sm text-danger">
              * Menunjukkan pertanyaan yang wajib diisi
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Form Card with Glassmorphism */}
      <form
        className="w-full max-w-2xl mx-auto relative pb-8"
        onSubmit={handleSubmit}
      >
        {/* Blobs behind form */}
        <div className="absolute top-[5%] left-[-10%] w-[350px] h-[350px] bg-purple-400/30 dark:bg-purple-400/50 rounded-full blur-[120px] animate-pulse -z-10" />
        <div
          className="absolute top-[35%] right-[-15%] w-[400px] h-[400px] bg-cyan-400/25 dark:bg-cyan-400/40 rounded-full blur-[120px] animate-pulse -z-10"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute bottom-[15%] left-[-5%] w-[300px] h-[300px] bg-pink-400/25 dark:bg-pink-400/40 rounded-full blur-[100px] animate-pulse -z-10"
          style={{ animationDelay: "0.5s" }}
        />

        <Card className="backdrop-blur-2xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30 shadow-2xl">
          <CardBody className="p-6 flex flex-col gap-6">
            {/* Nama */}
            <Input
              isRequired
              classNames={{
                label: "text-gray-700 dark:text-white/80",
                input: "text-gray-900 dark:text-white",
                description: "text-gray-500 dark:text-white/50",
                inputWrapper:
                  "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/15 group-data-[focus=true]:bg-black/10 dark:group-data-[focus=true]:bg-white/15",
              }}
              description="Untuk memastikan pakaian anda tidak tertukar dengan pelanggan lain dengan nama yang sama, mohon dapat memberikan setidaknya 2 nama anda. Contoh: Budi Santoso, Tika Sudarso."
              label="Nama"
              labelPlacement="outside"
              placeholder="Jawaban Anda"
              value={formData.nama}
              onValueChange={(value) => handleInputChange("nama", value)}
            />

            {/* Nomor HP */}
            <Input
              isRequired
              classNames={{
                label: "text-gray-700 dark:text-white/80",
                input: "text-gray-900 dark:text-white",
                description: "text-gray-500 dark:text-white/50",
                inputWrapper:
                  "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/15 group-data-[focus=true]:bg-black/10 dark:group-data-[focus=true]:bg-white/15",
              }}
              label="Nomor HP"
              labelPlacement="outside"
              placeholder="Jawaban Anda"
              value={formData.nomorHP}
              onValueChange={(value) => handleInputChange("nomorHP", value)}
            />

            {/* Alamat */}
            <Textarea
              classNames={{
                label: "text-gray-700 dark:text-white/80",
                input: "text-gray-900 dark:text-white",
                description: "text-gray-500 dark:text-white/50",
                inputWrapper:
                  "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/15 group-data-[focus=true]:bg-black/10 dark:group-data-[focus=true]:bg-white/15",
              }}
              description="(Wajib bagi pelanggan baru). Agar kurir kami dapat mencapai lokasi anda dengan cepat, berikan informasi detail lokasi anda seperti link google maps, warna rumah, nama petokoan atau petunjuk lainnya."
              label="Alamat"
              labelPlacement="outside"
              minRows={3}
              placeholder="Jawaban Anda"
              value={formData.alamat}
              onValueChange={(value) => handleInputChange("alamat", value)}
            />

            {/* Google Maps Link */}
            <Input
              classNames={{
                label: "text-gray-700 dark:text-white/80",
                input: "text-gray-900 dark:text-white",
                inputWrapper:
                  "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/15 group-data-[focus=true]:bg-black/10 dark:group-data-[focus=true]:bg-white/15",
              }}
              label="Google Maps Delivery Link"
              labelPlacement="outside"
              placeholder="Jawaban Anda"
              value={formData.googleMapsLink}
              onValueChange={(value) =>
                handleInputChange("googleMapsLink", value)
              }
            />

            <Divider className="bg-black/10 dark:bg-white/20" />

            {/* Permintaan (Checkbox) */}
            <CheckboxGroup
              isRequired
              classNames={{
                wrapper: "gap-3",
                label: "text-gray-700 dark:text-white/80",
                description: "text-gray-500 dark:text-white/50",
              }}
              description="Jika anda mengajukan pengantaran dan sekaligus jemput lagi, silahkan pilih keduanya. Jika anda ingin jemput saja atau hantar saja silahakan pilih salah satu."
              label="Permintaan"
              value={formData.permintaan}
              onValueChange={(value) => handleInputChange("permintaan", value)}
            >
              <Checkbox
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper: "before:border-gray-400 dark:before:border-white/50",
                }}
                value="antar"
              >
                Antar
              </Checkbox>
              <Checkbox
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper: "before:border-gray-400 dark:before:border-white/50",
                }}
                value="jemput"
              >
                Jemput
              </Checkbox>
            </CheckboxGroup>

            {/* Waktu Penjemputan */}
            <div className="mb-4">
              <I18nProvider locale="id-ID">
                <DatePicker
                  classNames={{
                    base: "w-full",
                    label: "text-gray-700 dark:text-white/80",
                    inputWrapper:
                      "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20",
                    selectorButton: "text-gray-600 dark:text-white/70",
                  }}
                  granularity="minute"
                  hourCycle={24}
                  label="Kapan perkiraan waktu penjemputan"
                  labelPlacement="outside"
                  minValue={today(getLocalTimeZone())}
                  value={formData.waktuPenjemputan}
                  onChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      waktuPenjemputan: value as CalendarDateTime | null,
                    }))
                  }
                />
              </I18nProvider>
              <p className="text-xs text-gray-500 dark:text-white/50 mt-2">
                Jam operasional: 11:00-20:30
              </p>
              <p className="text-xs text-gray-500 dark:text-white/50 mt-1 italic">
                &quot;Kami akan mengusahakan untuk dapat melakukan penjemputan
                sesuai dengan jam yang telah anda berikan. Namun sebelumnya kami
                mohon maaf jika kami belum tentu bisa melakukan antar/jemput
                sesuai dengan jam yang anda informasikan karena berbagai kondisi
                lapangan.&quot;
              </p>
            </div>

            <Divider className="bg-black/10 dark:bg-white/20" />

            {/* Produk Layanan */}
            <RadioGroup
              classNames={{
                wrapper: "gap-3",
                label: "text-gray-700 dark:text-white/80",
              }}
              label="Produk Layanan"
              value={formData.produkLayanan}
              onValueChange={(value) =>
                handleInputChange("produkLayanan", value)
              }
            >
              <Radio
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper:
                    "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
                value="cuci-setrika"
              >
                Cuci Setrika
              </Radio>
              <Radio
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper:
                    "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
                value="cuci-lipat"
              >
                Cuci Lipat
              </Radio>
              <Radio
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper:
                    "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
                value="lainnya"
              >
                Lainnya
              </Radio>
            </RadioGroup>
            {formData.produkLayanan === "lainnya" && (
              <Input
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  input: "text-gray-900 dark:text-white",
                  inputWrapper:
                    "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/15 group-data-[focus=true]:bg-black/10 dark:group-data-[focus=true]:bg-white/15",
                }}
                label="Produk Layanan Lainnya"
                labelPlacement="outside"
                placeholder="Isi jika anda memilih selain cuci setrika dan cuci lipat"
                value={formData.produkLayananManual}
                onValueChange={(value) =>
                  handleInputChange("produkLayananManual", value)
                }
              />
            )}

            {/* Jenis Layanan */}
            <RadioGroup
              classNames={{
                wrapper: "gap-3",
                label: "text-gray-700 dark:text-white/80",
              }}
              label="Jenis Layanan"
              value={formData.jenisLayanan}
              onValueChange={(value) =>
                handleInputChange("jenisLayanan", value)
              }
            >
              <Radio
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper:
                    "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
                value="reguler"
              >
                Reguler
              </Radio>
              <Radio
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper:
                    "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
                value="express"
              >
                Express
              </Radio>
            </RadioGroup>

            {/* Parfum */}
            <RadioGroup
              classNames={{
                wrapper: "gap-3",
                label: "text-gray-700 dark:text-white/80",
              }}
              label="Parfum"
              value={formData.parfum}
              onValueChange={(value) => handleInputChange("parfum", value)}
            >
              <Radio
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper:
                    "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
                value="soft"
              >
                Soft
              </Radio>
              <Radio
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper:
                    "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
                value="strong"
              >
                Strong
              </Radio>
              <Radio
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper:
                    "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
                value="tanpa-parfum"
              >
                Tanpa Parfum
              </Radio>
            </RadioGroup>

            <Divider className="bg-black/10 dark:bg-white/20" />

            {/* Catatan Tambahan */}
            <Textarea
              classNames={{
                label: "text-gray-700 dark:text-white/80",
                input: "text-gray-900 dark:text-white",
                inputWrapper:
                  "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/15 group-data-[focus=true]:bg-black/10 dark:group-data-[focus=true]:bg-white/15",
              }}
              label="Catatan Tambahan (Opsional)"
              labelPlacement="outside"
              minRows={3}
              placeholder="Tambahkan catatan khusus jika ada (misal: pakaian luntur, noda membandel, dll)"
              value={formData.catatan}
              onValueChange={(value) => handleInputChange("catatan", value)}
            />

            <Divider className="bg-black/10 dark:bg-white/20" />

            {/* Status Message */}
            {submitStatus.type && (
              <div
                className={`p-4 rounded-lg text-center ${
                  submitStatus.type === "success"
                    ? "bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30"
                    : "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30"
                }`}
              >
                {submitStatus.message}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-between items-center">
              <Button
                className="font-medium px-8 shadow-lg shadow-primary/30"
                color="primary"
                isDisabled={isLoading}
                isLoading={isLoading}
                size="lg"
                type="submit"
              >
                {isLoading ? "Mengirim..." : "Submit"}
              </Button>
              <Button
                className="text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white"
                isDisabled={isLoading}
                type="button"
                variant="light"
                onClick={resetForm}
              >
                Hapus Formulir
              </Button>
            </div>

            {/* Footer Note */}
            <p className="text-sm text-gray-500 dark:text-white/50 text-center mt-4">
              Infokan ke admin, jika ada informasi lain yang belum tercakup
              dalam form ini.
            </p>
          </CardBody>
        </Card>
      </form>

      {/* Success Modal */}
      <Modal
        backdrop="blur"
        hideCloseButton={true}
        isDismissable={false}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      >
        <ModalContent className="bg-white dark:bg-gray-900 border border-black/10 dark:border-white/20">
          {(onClose) => (
            <>
              <ModalHeader className="flex flex-col gap-1 text-gray-900 dark:text-white">
                Permintaan Berhasil
              </ModalHeader>
              <ModalBody>
                <p className="text-gray-600 dark:text-white/80">
                  Permintaan antar/jemput anda sudah berhasil kami proses dengan
                  nomor tiket{" "}
                  <span className="font-bold text-primary">
                    {ticketNumbers.join(", ")}
                  </span>
                  .
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mt-2">
                  <p className="text-sm text-gray-600 dark:text-white/80 italic">
                    &quot;Untuk memastikan, anda dapat menginformasikan
                    permintaan antar jemput anda melalui WA dengan tombol
                    dibawah. Jangan lupa, kirimkan juga foto tas yang akan di
                    jemput, untuk mencegah tertukar.&quot;
                  </p>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  color="danger"
                  variant="light"
                  onPress={() => {
                    onClose();
                    resetForm();
                  }}
                >
                  Tutup
                </Button>
                <Button
                  className="bg-[#25D366] text-white font-medium"
                  onPress={() => {
                    // WhatsApp Logic
                    const waktuJemputStr = formData.waktuPenjemputan
                      ? `${String(formData.waktuPenjemputan.day).padStart(2, "0")}/${String(formData.waktuPenjemputan.month).padStart(2, "0")}/${formData.waktuPenjemputan.year} ${String(formData.waktuPenjemputan.hour).padStart(2, "0")}:${String(formData.waktuPenjemputan.minute).padStart(2, "0")}`
                      : "-";
                    const message = `Mohon proses permintaan antar/jemput dengan nomor tiket ${ticketNumbers.join(", ")}.\nNama: ${formData.nama}\nNomor: ${formData.nomorHP}\nAlamat: ${formData.alamat || "-"}\nWaktu siap jemput: ${waktuJemputStr}\nCatatan: ${formData.catatan || ""}`;
                    const encodedMessage = encodeURIComponent(message);
                    const whatsappNumber = "6285765909380";

                    window.open(
                      `https://wa.me/${whatsappNumber}?text=${encodedMessage}`,
                      "_blank",
                    );
                    onClose();
                    resetForm();
                  }}
                >
                  Kirim ke Admin
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
