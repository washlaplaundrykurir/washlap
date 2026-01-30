"use client";

import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function UnauthorizedContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  // Pesan error berdasarkan tipe
  const errorMessages: Record<string, { title: string; message: string }> = {
    account_not_registered: {
      title: "Akun Tidak Terdaftar",
      message:
        "Email Anda belum terdaftar dalam sistem. Silakan hubungi administrator untuk mendaftarkan akun Anda.",
    },
    unauthorized: {
      title: "Akses Ditolak",
      message: "Anda tidak memiliki izin untuk mengakses halaman ini.",
    },
  };

  const errorInfo = errorMessages[error || ""] || errorMessages.unauthorized;

  return (
    <Card className="w-full max-w-md backdrop-blur-2xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30 shadow-2xl text-center">
      <CardBody className="p-8">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {errorInfo.title}
        </h1>
        <p className="text-gray-600 dark:text-white/70 mb-6">
          {errorInfo.message}
        </p>
        <div className="flex gap-3 justify-center">
          <Button as={Link} color="primary" href="/" variant="flat">
            Kembali ke Beranda
          </Button>
          <Button as={Link} color="default" href="/login" variant="bordered">
            Login Ulang
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-red-100 to-orange-50 dark:from-red-900 dark:to-gray-950 -z-20" />

      {/* Blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-red-400/30 dark:bg-red-400/40 rounded-full blur-[120px] -z-10" />

      <Suspense
        fallback={
          <Card className="w-full max-w-md backdrop-blur-2xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30 shadow-2xl text-center">
            <CardBody className="p-8">
              <div className="text-6xl mb-4">🚫</div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Akses Ditolak
              </h1>
            </CardBody>
          </Card>
        }
      >
        <UnauthorizedContent />
      </Suspense>
    </div>
  );
}
