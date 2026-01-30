"use client";

import { Card, CardBody } from "@heroui/card";
import { Input, Textarea } from "@heroui/input";
import { Button } from "@heroui/button";
import { RadioGroup, Radio } from "@heroui/radio";
import { Checkbox, CheckboxGroup } from "@heroui/checkbox";
import { Divider } from "@heroui/divider";
import { DatePicker } from "@heroui/date-picker";
import { useState } from "react";
import { now, getLocalTimeZone, CalendarDateTime } from "@internationalized/date";
import { I18nProvider } from "@react-aria/i18n";
import { ThemeSwitch } from "@/components/theme-switch";

export default function Home() {
  const isDevelopment = process.env.NODE_ENV === 'development';

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
  });

  const [isLoading, setIsLoading] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Debug function to fill form with dummy data
  const fillDummyData = () => {
    // Tomorrow at 14:00
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDt = new CalendarDateTime(
      tomorrow.getFullYear(),
      tomorrow.getMonth() + 1,
      tomorrow.getDate(),
      14, 0
    );

    setFormData({
      nama: "John Doe",
      nomorHP: "081234567890",
      alamat: "Jl. Contoh No. 123, RT 01/RW 02, Kelurahan Test, Kecamatan Demo, Jakarta Selatan 12345",
      googleMapsLink: "https://maps.google.com/?q=-6.2088,106.8456",
      permintaan: ["antar", "jemput"],
      waktuPenjemputan: tomorrowDt,
      produkLayanan: "cuci-setrika",
      produkLayananManual: "",
      jenisLayanan: "reguler",
      parfum: "soft",
    });
    setSubmitStatus({ type: null, message: '' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSubmitStatus({ type: null, message: '' });

    try {
      // Convert CalendarDateTime to ISO string
      const waktuPenjemputanStr = formData.waktuPenjemputan
        ? `${formData.waktuPenjemputan.year}-${String(formData.waktuPenjemputan.month).padStart(2, '0')}-${String(formData.waktuPenjemputan.day).padStart(2, '0')}T${String(formData.waktuPenjemputan.hour).padStart(2, '0')}:${String(formData.waktuPenjemputan.minute).padStart(2, '0')}`
        : null;

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          waktuPenjemputan: waktuPenjemputanStr,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kesalahan');
      }

      setSubmitStatus({
        type: 'success',
        message: 'Pesanan berhasil dikirim! Kami akan segera menghubungi Anda.',
      });

      // Reset form after successful submission
      setFormData({
        nama: "",
        nomorHP: "",
        alamat: "",
        googleMapsLink: "",
        permintaan: [],
        waktuPenjemputan: null,
        produkLayanan: "",
        produkLayananManual: "",
        jenisLayanan: "",
        parfum: "",
      });
    } catch (error) {
      setSubmitStatus({
        type: 'error',
        message: error instanceof Error ? error.message : 'Terjadi kesalahan saat mengirim pesanan',
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
            size="sm"
            color="warning"
            variant="flat"
            className="backdrop-blur-xl bg-yellow-500/20 border border-yellow-500/30"
            onClick={fillDummyData}
          >
            🧪 Fill Dummy
          </Button>
        )}
        <div className="backdrop-blur-xl bg-black/10 dark:bg-white/15 border border-black/20 dark:border-white/30 rounded-full p-2 shadow-lg">
          <ThemeSwitch />
        </div>
      </div>

      {/* Google Forms Style Header with Glassmorphism */}
      <div className="w-full max-w-2xl mx-auto mb-6 pt-8 relative">
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
            <p className="text-sm text-danger">* Menunjukkan pertanyaan yang wajib diisi</p>
          </CardBody>
        </Card>
      </div>

      {/* Form Card with Glassmorphism */}
      <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto relative pb-8">
        {/* Blobs behind form */}
        <div className="absolute top-[5%] left-[-10%] w-[350px] h-[350px] bg-purple-400/30 dark:bg-purple-400/50 rounded-full blur-[120px] animate-pulse -z-10" />
        <div className="absolute top-[35%] right-[-15%] w-[400px] h-[400px] bg-cyan-400/25 dark:bg-cyan-400/40 rounded-full blur-[120px] animate-pulse -z-10" style={{ animationDelay: "1s" }} />
        <div className="absolute bottom-[15%] left-[-5%] w-[300px] h-[300px] bg-pink-400/25 dark:bg-pink-400/40 rounded-full blur-[100px] animate-pulse -z-10" style={{ animationDelay: "0.5s" }} />

        <Card className="backdrop-blur-2xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30 shadow-2xl">
          <CardBody className="p-6 flex flex-col gap-6">
            {/* Nama */}
            <Input
              label="Nama"
              placeholder="Jawaban Anda"
              labelPlacement="outside"
              value={formData.nama}
              onValueChange={(value) => handleInputChange("nama", value)}
              classNames={{
                label: "text-gray-700 dark:text-white/80",
                input: "text-gray-900 dark:text-white",
                inputWrapper: "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/15 group-data-[focus=true]:bg-black/10 dark:group-data-[focus=true]:bg-white/15",
              }}
            />

            {/* Nomor HP */}
            <Input
              label="Nomor HP"
              description="Informasikan nomor HP anda, agar tidak tertukar dengan pelanggan lain"
              placeholder="Jawaban Anda"
              labelPlacement="outside"
              value={formData.nomorHP}
              onValueChange={(value) => handleInputChange("nomorHP", value)}
              classNames={{
                label: "text-gray-700 dark:text-white/80",
                input: "text-gray-900 dark:text-white",
                description: "text-gray-500 dark:text-white/50",
                inputWrapper: "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/15 group-data-[focus=true]:bg-black/10 dark:group-data-[focus=true]:bg-white/15",
              }}
            />

            {/* Alamat */}
            <Textarea
              label="Alamat"
              description="(Wajib bagi pelanggan baru). Agar kurir kami dapat mencapai lokasi anda dengan cepat, berikan informasi detail lokasi anda seperti link google maps, warna rumah, nama petokoan atau petunjuk lainnya."
              placeholder="Jawaban Anda"
              labelPlacement="outside"
              value={formData.alamat}
              onValueChange={(value) => handleInputChange("alamat", value)}
              minRows={3}
              classNames={{
                label: "text-gray-700 dark:text-white/80",
                input: "text-gray-900 dark:text-white",
                description: "text-gray-500 dark:text-white/50",
                inputWrapper: "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/15 group-data-[focus=true]:bg-black/10 dark:group-data-[focus=true]:bg-white/15",
              }}
            />

            {/* Google Maps Link */}
            <Input
              label="Google Maps Delivery Link"
              placeholder="Jawaban Anda"
              labelPlacement="outside"
              value={formData.googleMapsLink}
              onValueChange={(value) =>
                handleInputChange("googleMapsLink", value)
              }
              classNames={{
                label: "text-gray-700 dark:text-white/80",
                input: "text-gray-900 dark:text-white",
                inputWrapper: "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/15 group-data-[focus=true]:bg-black/10 dark:group-data-[focus=true]:bg-white/15",
              }}
            />

            <Divider className="bg-black/10 dark:bg-white/20" />

            {/* Permintaan (Checkbox) */}
            <CheckboxGroup
              label="Permintaan"
              description="Jika anda mengajukan pengantaran dan sekaligus jemput lagi, silahkan pilih keduanya. Jika anda ingin jemput saja atau hantar saja silahakan pilih salah satu."
              value={formData.permintaan}
              onValueChange={(value) => handleInputChange("permintaan", value)}
              classNames={{
                wrapper: "gap-3",
                label: "text-gray-700 dark:text-white/80",
                description: "text-gray-500 dark:text-white/50",
              }}
            >
              <Checkbox
                value="antar"
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper: "before:border-gray-400 dark:before:border-white/50",
                }}
              >
                Antar
              </Checkbox>
              <Checkbox
                value="jemput"
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper: "before:border-gray-400 dark:before:border-white/50",
                }}
              >
                Jemput
              </Checkbox>
            </CheckboxGroup>

            {/* Waktu Penjemputan */}
            <div className="mb-4">
              <I18nProvider locale="id-ID">
                <DatePicker
                  label="Kapan perkiraan waktu penjemputan"
                  granularity="minute"
                  hourCycle={24}
                  labelPlacement="outside"
                  value={formData.waktuPenjemputan}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, waktuPenjemputan: value as CalendarDateTime | null }))
                  }
                  classNames={{
                    base: "w-full",
                    label: "text-gray-700 dark:text-white/80",
                    inputWrapper: "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20",
                    selectorButton: "text-gray-600 dark:text-white/70",
                  }}
                />
              </I18nProvider>
              <p className="text-xs text-gray-500 dark:text-white/50 mt-2">
                Jam operasional: 11:00-20:30
              </p>
            </div>

            <Divider className="bg-black/10 dark:bg-white/20" />

            {/* Produk Layanan */}
            <RadioGroup
              isRequired
              label="Produk Layanan"
              value={formData.produkLayanan}
              onValueChange={(value) =>
                handleInputChange("produkLayanan", value)
              }
              classNames={{
                wrapper: "gap-3",
                label: "text-gray-700 dark:text-white/80",
              }}
            >
              <Radio
                value="cuci-setrika"
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper: "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
              >
                Cuci Setrika
              </Radio>
              <Radio
                value="cuci-lipat"
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper: "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
              >
                Cuci Lipat
              </Radio>
              <Radio
                value="lainnya"
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper: "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
              >
                Lainnya
              </Radio>
            </RadioGroup>
            {formData.produkLayanan === "lainnya" && (
              <Input
                label="Produk Layanan Lainnya"
                placeholder="Isi jika anda memilih selain cuci setrika dan cuci lipat"
                labelPlacement="outside"
                value={formData.produkLayananManual}
                onValueChange={(value) =>
                  handleInputChange("produkLayananManual", value)
                }
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  input: "text-gray-900 dark:text-white",
                  inputWrapper: "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20 hover:bg-black/10 dark:hover:bg-white/15 group-data-[focus=true]:bg-black/10 dark:group-data-[focus=true]:bg-white/15",
                }}
              />
            )}

            {/* Jenis Layanan */}
            <RadioGroup
              isRequired
              label="Jenis Layanan"
              value={formData.jenisLayanan}
              onValueChange={(value) =>
                handleInputChange("jenisLayanan", value)
              }
              classNames={{
                wrapper: "gap-3",
                label: "text-gray-700 dark:text-white/80",
              }}
            >
              <Radio
                value="reguler"
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper: "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
              >
                Reguler
              </Radio>
              <Radio
                value="express"
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper: "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
              >
                Express
              </Radio>
            </RadioGroup>

            {/* Parfum */}
            <RadioGroup
              isRequired
              label="Parfum"
              value={formData.parfum}
              onValueChange={(value) => handleInputChange("parfum", value)}
              classNames={{
                wrapper: "gap-3",
                label: "text-gray-700 dark:text-white/80",
              }}
            >
              <Radio
                value="soft"
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper: "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
              >
                Soft
              </Radio>
              <Radio
                value="strong"
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper: "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
              >
                Strong
              </Radio>
              <Radio
                value="tanpa-parfum"
                classNames={{
                  label: "text-gray-700 dark:text-white/80",
                  wrapper: "group-data-[selected=true]:border-primary border-gray-300 dark:border-white/60",
                }}
              >
                Tanpa Parfum
              </Radio>
            </RadioGroup>

            <Divider className="bg-black/10 dark:bg-white/20" />

            {/* Status Message */}
            {submitStatus.type && (
              <div
                className={`p-4 rounded-lg text-center ${submitStatus.type === 'success'
                  ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
                  : 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                  }`}
              >
                {submitStatus.message}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-between items-center">
              <Button
                type="submit"
                color="primary"
                size="lg"
                className="font-medium px-8 shadow-lg shadow-primary/30"
                isLoading={isLoading}
                isDisabled={isLoading}
              >
                {isLoading ? 'Mengirim...' : 'Submit'}
              </Button>
              <Button
                type="button"
                variant="light"
                className="text-gray-600 dark:text-white/70 hover:text-gray-900 dark:hover:text-white"
                isDisabled={isLoading}
                onClick={() => {
                  setFormData({
                    nama: "",
                    nomorHP: "",
                    alamat: "",
                    googleMapsLink: "",
                    permintaan: [],
                    waktuPenjemputan: null,
                    produkLayanan: "",
                    produkLayananManual: "",
                    jenisLayanan: "",
                    parfum: "",
                  });
                  setSubmitStatus({ type: null, message: '' });
                }}
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
    </div>
  );
}
