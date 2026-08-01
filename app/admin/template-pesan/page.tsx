"use client";

import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Textarea } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { ArrowLeft, MessageSquareText, RotateCcw, Save } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useToast } from "@/components/ToastProvider";
import {
  buildTicketWaMessage,
  DEFAULT_TICKET_MESSAGE_TEMPLATE,
  TICKET_MESSAGE_PLACEHOLDERS,
} from "@/lib/whatsapp";

const PREVIEW_TICKET = {
  nomor_tiket: "J ABC 1234",
  jenis_tugas: "JEMPUT" as const,
  alamat_jalan: "Jl. Contoh No. 10",
  waktu_penjemputan: "2026-07-31T03:00:00.000Z",
  nama: "Nama Pelanggan",
  nomor_hp: "628123456789",
  catatan_khusus: "Hubungi sebelum tiba",
};

export default function MessageTemplatePage() {
  const { showToast } = useToast();
  const [template, setTemplate] = useState(DEFAULT_TICKET_MESSAGE_TEMPLATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const response = await fetch("/api/admin/message-template");
        const result = await response.json();

        if (!response.ok) throw new Error(result.error);
        setTemplate(result.template || DEFAULT_TICKET_MESSAGE_TEMPLATE);
      } catch (error) {
        showToast(
          "error",
          error instanceof Error
            ? error.message
            : "Gagal memuat template pesan",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchTemplate();
  }, [showToast]);

  const preview = useMemo(
    () => buildTicketWaMessage(PREVIEW_TICKET, template),
    [template],
  );

  const handleSave = async () => {
    if (!template.trim()) {
      showToast("warning", "Template pesan tidak boleh kosong");

      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch("/api/admin/message-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template }),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.error);
      setTemplate(result.template);
      showToast("success", "Template pesan berhasil disimpan");
    } catch (error) {
      showToast(
        "error",
        error instanceof Error
          ? error.message
          : "Gagal menyimpan template pesan",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner label="Memuat template..." size="lg" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <div className="mb-6 flex items-center gap-3">
        <Button isIconOnly as={Link} href="/admin" variant="flat">
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black text-gray-900 dark:text-white">
            <MessageSquareText className="text-primary" size={24} />
            Template Pesan Tiket
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Digunakan oleh tombol Copy Detail Tiket dan Kirim WA setelah tiket
            dibuat.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="border border-black/10 dark:border-white/10">
          <CardHeader className="flex-col items-start gap-1 border-b border-divider px-5 py-4">
            <h2 className="font-bold">Editor Template</h2>
            <p className="text-xs text-gray-500">
              Placeholder akan otomatis diganti dengan data tiket.
            </p>
          </CardHeader>
          <CardBody className="gap-4 p-5">
            <Textarea
              aria-label="Template pesan tiket"
              classNames={{ input: "font-mono text-sm leading-relaxed" }}
              maxLength={10000}
              minRows={18}
              value={template}
              variant="bordered"
              onValueChange={setTemplate}
            />

            <div>
              <p className="mb-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                Placeholder yang tersedia
              </p>
              <div className="flex flex-wrap gap-2">
                {TICKET_MESSAGE_PLACEHOLDERS.map((placeholder) => (
                  <Chip
                    key={placeholder.token}
                    color="primary"
                    size="sm"
                    title={placeholder.label}
                    variant="flat"
                  >
                    {placeholder.token}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <Button
                startContent={<RotateCcw size={16} />}
                variant="flat"
                onPress={() => setTemplate(DEFAULT_TICKET_MESSAGE_TEMPLATE)}
              >
                Gunakan Template Bawaan
              </Button>
              <Button
                color="primary"
                isLoading={isSaving}
                startContent={!isSaving ? <Save size={16} /> : undefined}
                onPress={handleSave}
              >
                Simpan Template
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card className="border border-black/10 dark:border-white/10">
          <CardHeader className="flex-col items-start gap-1 border-b border-divider px-5 py-4">
            <h2 className="font-bold">Preview Pesan</h2>
            <p className="text-xs text-gray-500">
              Contoh hasil yang akan disalin ke clipboard.
            </p>
          </CardHeader>
          <CardBody className="p-5">
            <pre className="whitespace-pre-wrap break-words rounded-xl bg-gray-100 p-4 font-sans text-sm leading-relaxed text-gray-700 dark:bg-white/5 dark:text-gray-200">
              {preview}
            </pre>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
