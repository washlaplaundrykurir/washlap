"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Divider } from "@heroui/divider";
import { Spinner } from "@heroui/spinner";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/admin";

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle OAuth callback errors
  useEffect(() => {
    const errorParam = searchParams.get("error");

    if (
      errorParam === "account_not_registered" ||
      errorParam === "email_not_registered"
    ) {
      setError(
        "Email Anda tidak terdaftar di sistem. Hubungi admin untuk didaftarkan.",
      );
    } else if (errorParam === "access_denied") {
      setError(
        "Akses ditolak. Akun Anda tidak memiliki izin untuk halaman tersebut. Silakan login dengan akun lain.",
      );
    } else if (
      errorParam === "auth_code_error" ||
      errorParam === "auth_init_error"
    ) {
      setError("Gagal verifikasi login Google.");
    } else if (errorParam === "server_configuration_error") {
      setError("Konfigurasi server bermasalah (Missing URL/Key).");
    } else if (errorParam) {
      setError("Terjadi kesalahan saat login.");
    }
  }, [searchParams]);

  const handleGoogleLogin = () => {
    setIsLoading(true);
    window.location.href = `/api/auth/google?redirectTo=${redirectTo}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Login gagal");
      }

      // Redirect based on role
      if (data.user.role === "admin") {
        router.push("/admin");
      } else if (data.user.role === "kurir") {
        router.push("/kurir");
      } else {
        router.push(redirectTo);
      }
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login gagal");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 bg-gradient-to-br from-blue-100 to-purple-50 dark:from-blue-900 dark:to-gray-950 -z-20" />

      {/* Blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-400/30 dark:bg-blue-400/40 rounded-full blur-[120px] -z-10" />

      <Card className="w-full max-w-md backdrop-blur-2xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30 shadow-2xl">
        <CardHeader className="flex flex-col gap-1 pb-0">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Login
          </h1>
          <p className="text-sm text-gray-600 dark:text-white/70">
            Masuk ke akun Washlap Laundry
          </p>
        </CardHeader>
        <Divider className="my-4 bg-black/10 dark:bg-white/20" />
        <CardBody>
          <form className="flex flex-col gap-4" onSubmit={handleLogin}>
            {error && (
              <div className="p-3 rounded-lg bg-red-500/20 text-red-600 dark:text-red-400 text-sm border border-red-500/30">
                {error}
              </div>
            )}

            <Button
              className="w-full font-medium bg-white dark:bg-white/10 border border-black/5 dark:border-white/10"
              color="default"
              isLoading={isLoading}
              size="lg"
              startContent={
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    className="text-[#4285F4]"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="currentColor"
                  />
                  <path
                    className="text-[#34A853]"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="currentColor"
                  />
                  <path
                    className="text-[#FBBC05]"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.29.81-.55z"
                    fill="currentColor"
                  />
                  <path
                    className="text-[#EA4335]"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="currentColor"
                  />
                </svg>
              }
              type="button"
              variant="flat"
              onPress={handleGoogleLogin}
            >
              Masuk dengan Google
            </Button>

            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-white/50">
              <div className="flex-1 h-[1px] bg-black/10 dark:bg-white/10" />
              atau
              <div className="flex-1 h-[1px] bg-black/10 dark:bg-white/10" />
            </div>

            <Input
              isRequired
              classNames={{
                label: "text-gray-700 dark:text-white/80",
                input: "text-gray-900 dark:text-white",
                inputWrapper:
                  "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20",
              }}
              label="Email"
              labelPlacement="outside"
              placeholder="email@example.com"
              type="email"
              value={formData.email}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, email: value }))
              }
            />

            <Input
              isRequired
              classNames={{
                label: "text-gray-700 dark:text-white/80",
                input: "text-gray-900 dark:text-white",
                inputWrapper:
                  "bg-black/5 dark:bg-white/10 border-black/10 dark:border-white/20",
              }}
              label="Password"
              labelPlacement="outside"
              placeholder="••••••••"
              type="password"
              value={formData.password}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, password: value }))
              }
            />

            <Button
              className="mt-2 font-medium"
              color="primary"
              isLoading={isLoading}
              size="lg"
              type="submit"
            >
              {isLoading ? "Memproses..." : "Login"}
            </Button>

            <p className="text-center text-sm text-gray-600 dark:text-white/60 mt-2">
              Belum punya akun?{" "}
              <Link className="text-primary hover:underline" href="/register">
                Daftar
              </Link>
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
