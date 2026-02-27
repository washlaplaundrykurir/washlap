"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@heroui/button";
import { Textarea } from "@heroui/input";
import { Switch } from "@heroui/switch";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Image } from "@heroui/image";
import {
  ArrowLeft,
  Save,
  Upload,
  Trash2,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import Link from "next/link";

import { useToast } from "@/components/ToastProvider";

export default function PromoPage() {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    promo_text: "",
    promo_image_url: "",
    is_active: false,
  });

  useEffect(() => {
    fetchPromoSettings();
  }, []);

  const fetchPromoSettings = async () => {
    try {
      const response = await fetch("/api/admin/promo");

      if (response.ok) {
        const data = await response.json();

        if (data) {
          setFormData({
            promo_text: data.promo_text || "",
            promo_image_url: data.promo_image_url || "",
            is_active: data.is_active || false,
          });
        }
      }
    } catch {
      showToast("error", "Gagal memuat pengaturan promo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    const file = e.target.files[0];

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/promo/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Gagal mengupload gambar");
      }

      const { publicUrl } = await response.json();

      setFormData((prev) => ({ ...prev, promo_image_url: publicUrl }));
      showToast("success", "Gambar berhasil diupload");
    } catch {
      showToast("error", "Gagal mengupload gambar");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/promo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error("Failed to update");

      showToast("success", "Pengaturan promo berhasil disimpan");
    } catch {
      showToast("error", "Gagal menyimpan pengaturan");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl min-h-screen pb-20">
      <div className="flex items-center gap-4 mb-6">
        <Button
          isIconOnly
          as={Link}
          className="rounded-full"
          href="/admin"
          variant="flat"
        >
          <ArrowLeft size={20} />
        </Button>
        <h1 className="text-2xl font-bold">Kelola Promo</h1>
      </div>

      <Card className="mb-6">
        <CardHeader className="flex justify-between items-center px-6 py-4 border-b dark:border-white/10">
          <div className="flex flex-col">
            <span className="font-semibold text-lg">Status Promo</span>
            <span className="text-small text-default-500">
              Aktifkan untuk menampilkan di halaman pelanggan
            </span>
          </div>
          <Switch
            isSelected={formData.is_active}
            onValueChange={(val) =>
              setFormData((prev) => ({ ...prev, is_active: val }))
            }
          >
            {formData.is_active ? "Aktif" : "Nonaktif"}
          </Switch>
        </CardHeader>
        <CardBody className="gap-6 p-6">
          {/* Image Upload Section */}
          <div>
            <p className="block text-sm font-medium mb-2">Gambar Promo</p>
            <div className="flex flex-col items-center gap-4 p-4 border-2 border-dashed rounded-xl border-default-300 dark:border-white/20 bg-default-50 dark:bg-white/5">
              {formData.promo_image_url ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black/5">
                  <Image
                    removeWrapper
                    alt="Promo Preview"
                    className="w-full h-full object-cover"
                    src={formData.promo_image_url}
                  />
                  <Button
                    isIconOnly
                    className="absolute top-2 right-2 z-10"
                    color="danger"
                    size="sm"
                    variant="flat"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, promo_image_url: "" }))
                    }
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-default-500">
                  <ImageIcon className="mb-2 opacity-50" size={48} />
                  <p className="text-sm">Belum ada gambar</p>
                </div>
              )}

              <input
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                type="file"
                onChange={handleFileChange}
              />

              <Button
                color="primary"
                isDisabled={isUploading}
                startContent={
                  isUploading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Upload size={18} />
                  )
                }
                variant="flat"
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading
                  ? "Mengupload..."
                  : formData.promo_image_url
                    ? "Ganti Gambar"
                    : "Upload Gambar"}
              </Button>
            </div>
          </div>

          {/* Text Section */}
          <div>
            <Textarea
              label="Teks Promo"
              minRows={3}
              placeholder="Masukkan deskripsi promo menarik anda disini..."
              value={formData.promo_text}
              onValueChange={(val) =>
                setFormData((prev) => ({ ...prev, promo_text: val }))
              }
            />
            <p className="text-xs text-default-400 mt-1">
              Teks ini akan muncul di bawah gambar promo.
            </p>
          </div>
        </CardBody>
      </Card>

      <Button
        className="w-full font-medium"
        color="primary"
        isDisabled={isSaving || isUploading}
        isLoading={isSaving}
        size="lg"
        startContent={
          isSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />
        }
        onClick={handleSave}
      >
        Simpan Perubahan
      </Button>
    </div>
  );
}
