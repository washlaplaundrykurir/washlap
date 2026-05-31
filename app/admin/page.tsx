"use client";

import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { CheckboxGroup, Checkbox } from "@heroui/checkbox";
import { Divider } from "@heroui/divider";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/modal";
import { useState, useEffect, useRef } from "react";
import {
  ClipboardList,
  Truck,
  Package,
  Plus,
  Megaphone,
  Search,
} from "lucide-react";

import { useToast } from "@/components/ToastProvider";
import { buildDuplicateConfirmText } from "@/lib/duplicate-checks";
import {
  type TicketWaData,
  buildTicketWaMessage,
  buildWaUrl,
  activityWord,
} from "@/lib/whatsapp";

interface Stats {
  todayOrders: number;
  pendingOrders: number;
  activeCouriers: number;
}

/**
 * Pending duplicate-ticket match used to drive the blocking confirm modal
 * (Req 3.4). `nomor_hp_local` is already in 08xxx form; passing it through
 * `buildDuplicateConfirmText` (which calls `toLocal08`) is idempotent.
 */
type DupMatch = {
  jenis_tugas: "ANTAR" | "JEMPUT";
  nama: string | null;
  nomor_hp_local: string;
};

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
  const [userName, setUserName] = useState("");

  const orderModal = useDisclosure();
  const autofillModal = useDisclosure();
  const dupConfirmModal = useDisclosure();

  // Blocking duplicate-ticket confirmation state (Req 3.2, 3.4).
  // `dupMatch` holds the match shown in the modal body; `dupResolveRef` holds
  // the resolver of the Promise that `handleSubmit` awaits so the admin's
  // Ya/Tidak choice (or dismissal) can resume the submit flow.
  const [dupMatch, setDupMatch] = useState<DupMatch | null>(null);
  const dupResolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  // Post-save success state (Req 1.1). When non-null, the order modal swaps the
  // create form for the success view listing the created tickets, each with a
  // per-ticket "Kirim WA" action (Req 1.9, OQ-1). `null` = still on the form.
  const [savedOrders, setSavedOrders] = useState<TicketWaData[] | null>(null);

  /**
   * Open the blocking confirm modal for `match` and resolve to the admin's
   * choice: `true` on "Ya" (confirm, Req 3.6), `false` on "Tidak" or dismissal
   * (decline, Req 3.7). Only one confirm is in flight at a time.
   */
  const askDuplicateConfirm = (match: DupMatch): Promise<boolean> => {
    setDupMatch(match);
    dupConfirmModal.onOpen();

    return new Promise<boolean>((resolve) => {
      dupResolveRef.current = resolve;
    });
  };

  /** Resolve the pending confirm promise exactly once and close the modal. */
  const resolveDuplicateConfirm = (confirmed: boolean) => {
    const resolver = dupResolveRef.current;

    dupResolveRef.current = null;
    dupConfirmModal.onClose();
    setDupMatch(null);
    if (resolver) resolver(confirmed);
  };

  // Auto-fill state
  const [foundCustomer, setFoundCustomer] = useState<{
    nama: string | null;
    alamat: string | null;
    googleMapsLink: string | null;
  } | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const normalizePhone = (phone: string): string => {
    const digitsOnly = phone.replace(/[^0-9]/g, "");
    if (!digitsOnly) return "";
    if (digitsOnly.startsWith("0")) return "62" + digitsOnly.slice(1);
    return digitsOnly;
  };

  // Plain input handler: only updates the field. The customer lookup is no
  // longer automatic — the admin triggers it explicitly via the search button.
  const handlePhoneChange = (value: string) => {
    handleInputChange("nomorHP", value);
  };

  // Explicit, button-triggered customer lookup by phone number. Opens the
  // autofill modal when a saved customer is found, otherwise informs the admin.
  const handleLookupCustomer = async () => {
    const normalized = normalizePhone(formData.nomorHP.trim());

    if (normalized.length < 7) {
      showToast(
        "warning",
        "Masukkan nomor HP yang valid (minimal 7 digit) sebelum mencari.",
      );

      return;
    }

    // Cancel any in-flight lookup before starting a new one.
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();

    abortRef.current = controller;
    setIsLookingUp(true);

    try {
      const res = await fetch(
        `/api/customers/lookup?phone=${encodeURIComponent(normalized)}`,
        { signal: controller.signal },
      );
      const result = await res.json();

      if (result.data && result.data.nama) {
        setFoundCustomer(result.data);
        autofillModal.onOpen();
      } else {
        showToast(
          "info",
          "Nomor ini belum pernah order. Silakan isi data secara manual.",
        );
      }
    } catch (error) {
      if ((error as Error)?.name !== "AbortError") {
        showToast("error", "Gagal mencari data pelanggan. Coba lagi.");
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleApplyAutofill = () => {
    if (!foundCustomer) return;
    setFormData((prev) => ({
      ...prev,
      nama: foundCustomer.nama || prev.nama,
      alamat: foundCustomer.alamat || prev.alamat,
      googleMapsLink: foundCustomer.googleMapsLink || prev.googleMapsLink,
    }));
    autofillModal.onClose();
    setFoundCustomer(null);
  };

  const [formData, setFormData] = useState({
    nama: "",
    nomorHP: "",
    alamat: "",
    googleMapsLink: "",
    permintaan: [] as string[],
    waktuPenjemputan: (() => {
      const n = new Date();

      n.setMinutes(n.getMinutes() - n.getTimezoneOffset());

      return n.toISOString().slice(0, 16);
    })() as string | null,
    nomorNota: "",
    produkLayanan: "",
    produkLayananManual: "",
    jenisLayanan: "",
    parfum: "",
    catatan: "",
  });

  const fetchUser = async () => {
    try {
      const cachedUser = localStorage.getItem("washlap_user_data");
      if (cachedUser) {
        const { user, timestamp } = JSON.parse(cachedUser);
        if (Date.now() - timestamp < 3600000 && user?.full_name) {
          setUserName(user.full_name);
          return;
        }
      }

      const res = await fetch("/api/users/me");

      if (res.ok) {
        const data = await res.json();

        setUserName(data.user?.full_name || "");
        localStorage.setItem(
          "washlap_user_data",
          JSON.stringify({ user: data.user, timestamp: Date.now() }),
        );
      }
    } catch {
      // Ignore
    }
  };

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
            (o: { status_id: number }) => o.status_id === 1,
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

  useEffect(() => {
    fetchStats();
    fetchUser();
  }, []);

  const handleInputChange = (field: string, value: string | string[]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setSubmitStatus({ type: null, message: "" });

    // Validate Input
    if (!formData.nama?.trim() || !formData.nomorHP?.trim()) {
      setSubmitStatus({
        type: "error",
        message: "Nama dan Nomor HP wajib diisi!",
      });
      setIsLoading(false);

      return;
    }

    const normalizedPhone = normalizePhone(formData.nomorHP?.trim() || "");

    // Selected activity types, lowercase as stored in formData ("jemput"/"antar").
    const selectedTypes = formData.permintaan;

    // Per-type confirm flags collected from the blocking pre-check (Req 3.6).
    const confirmDuplicate: Record<string, boolean> = {};
    // Types the admin declined (uppercase) — excluded from the POST so a
    // declined type is never created, without mutating formData (Req 3.7, 4.3).
    const declinedTypes = new Set<string>();

    try {
      // --- Blocking open-ticket pre-check per activity type (Req 3.1, 3.2) ---
      for (const type of selectedTypes) {
        const upper = type.toUpperCase() as "ANTAR" | "JEMPUT";

        try {
          const res = await fetch(
            `/api/orders/check-duplicate?phone=${encodeURIComponent(
              normalizedPhone,
            )}&jenis=${encodeURIComponent(upper)}`,
          );

          if (!res.ok) {
            // Pre-check failed: do not silently force the save through. Surface
            // a toast and fall back to the authoritative server gate — the POST
            // will still return 409 for this type if a duplicate exists.
            showToast(
              "warning",
              "Gagal memeriksa tiket duplikat. Pemeriksaan akan dilakukan saat menyimpan.",
            );
            continue;
          }

          const result = await res.json();

          if (result?.exists) {
            const confirmed = await askDuplicateConfirm({
              jenis_tugas: upper,
              nama: result.nama ?? null,
              nomor_hp_local: result.nomor_hp_local ?? normalizedPhone,
            });

            if (confirmed) {
              confirmDuplicate[upper] = true;
            } else {
              // Declined/dismissed: cancel the save for this type (Req 3.7).
              declinedTypes.add(upper);
            }
          }
        } catch {
          // Network error on the pre-check: same fallback as a non-OK response.
          showToast(
            "warning",
            "Gagal memeriksa tiket duplikat. Pemeriksaan akan dilakukan saat menyimpan.",
          );
        }
      }

      // Build the POST payload's activity list from only the non-declined
      // types (do NOT mutate formData). If the admin had selected types and all
      // were declined, abort the save entirely and keep the form unchanged.
      let permintaanToSubmit = selectedTypes.filter(
        (t) => !declinedTypes.has(t.toUpperCase()),
      );

      if (selectedTypes.length > 0 && permintaanToSubmit.length === 0) {
        setIsLoading(false);

        return;
      }

      // POST with confirm flags + nomorNota; re-prompt + re-POST on a 409 race.
      const postOrders = async (
        permintaanList: string[],
        confirmFlags: Record<string, boolean>,
      ) => {
        const response = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            permintaan: permintaanList,
            nomorHP: normalizedPhone,
            confirmDuplicate: confirmFlags,
          }),
        });
        const data = await response.json();

        return { response, data };
      };

      // Bounded loop: each iteration either confirms a type (so it no longer
      // 409s) or drops a declined type from the list, guaranteeing progress.
      const MAX_CONFIRM_ROUNDS = 5;
      let data: any = null;
      let response: Response | null = null;

      for (let round = 0; round < MAX_CONFIRM_ROUNDS; round++) {
        ({ response, data } = await postOrders(
          permintaanToSubmit,
          confirmDuplicate,
        ));

        if (response.status === 409 && data?.requiresConfirmation) {
          const raceMatches: DupMatch[] = (data.matches ?? []).map(
            (m: any) => ({
              jenis_tugas: m.jenis_tugas,
              nama: m.nama ?? null,
              nomor_hp_local: m.nomor_hp_local ?? normalizedPhone,
            }),
          );

          const declinedThisRound = new Set<string>();

          for (const match of raceMatches) {
            const confirmed = await askDuplicateConfirm(match);

            if (confirmed) {
              confirmDuplicate[match.jenis_tugas] = true;
            } else {
              declinedThisRound.add(match.jenis_tugas.toUpperCase());
            }
          }

          if (declinedThisRound.size > 0) {
            permintaanToSubmit = permintaanToSubmit.filter(
              (t) => !declinedThisRound.has(t.toUpperCase()),
            );
          }

          // All remaining types declined → cancel the save, keep the form.
          if (permintaanToSubmit.length === 0) {
            setIsLoading(false);

            return;
          }

          // Re-POST with the updated confirm flags / reduced list.
          continue;
        }

        break;
      }

      if (!response || !response.ok) {
        throw new Error(data?.error || "Terjadi kesalahan");
      }

      // --- Post-save success state (Req 1.1, replaces the auto-close) ---
      const orders: TicketWaData[] = Array.isArray(data?.orders)
        ? data.orders
        : [];

      setSubmitStatus({
        type: "success",
        message: "Pesanan berhasil ditambahkan!",
      });
      showToast("success", "Pesanan berhasil ditambahkan!");

      // Toast each nota duplicate warning as a non-blocking warning (Req 2.2,
      // OQ-3), identifying the duplicated nomor_nota and activity type.
      const warnings: Array<{
        type?: string;
        jenis_tugas?: "ANTAR" | "JEMPUT";
        nomor_nota?: string;
      }> = Array.isArray(data?.warnings) ? data.warnings : [];

      for (const w of warnings) {
        if (w?.type === "duplicate_nota") {
          const word = w.jenis_tugas ? activityWord(w.jenis_tugas) : "";

          showToast(
            "warning",
            `Nomor nota "${w.nomor_nota ?? "-"}" sudah dipakai untuk permintaan ${word}.`,
          );
        }
      }

      // Surface the invalid-contact error immediately on save, independent of
      // any WA click (Req 1.12). A ticket is invalid when buildWaUrl is null.
      const invalidOrders = orders.filter(
        (o) => buildWaUrl(o.nomor_hp, buildTicketWaMessage(o)) === null,
      );

      if (invalidOrders.length > 0) {
        showToast(
          "error",
          invalidOrders.length === orders.length
            ? "Nomor HP tidak valid, WA tidak dapat dikirim."
            : `${invalidOrders.length} tiket memiliki nomor HP tidak valid, WA tidak dapat dikirim.`,
        );
      }

      // Switch the modal into the success state; it stays open until the admin
      // presses "Tutup" (Req 1.10). Do NOT auto-close or resetForm here.
      setSavedOrders(orders);
      fetchStats();
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

    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const nowStr = now.toISOString().slice(0, 16);

    setFormData({
      nama: "",
      nomorHP: "",
      alamat: "",
      googleMapsLink: "",
      permintaan: [],
      waktuPenjemputan: nowStr,
      nomorNota: "",
      produkLayanan: "",
      produkLayananManual: "",
      jenisLayanan: "",
      parfum: "",
      catatan: "",
    });
    setSubmitStatus({ type: null, message: "" });
    // Clear any post-save success state so opening the modal fresh starts on
    // the form (Req 1.10). All "Tambah Pesanan" handlers call resetForm().
    setSavedOrders(null);
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
    const randomNota = `INV-${Math.floor(Math.random() * 900 + 100)}`;

    const products = ["cuci-setrika", "cuci-lipat", "setrika-saja", "lainnya"];
    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const randomProductManual =
      randomProduct === "lainnya" ? "Cuci Karpet" : "";

    const services = ["reguler", "express"];
    const randomService = services[Math.floor(Math.random() * services.length)];

    const perfumes = ["soft", "strong", "tanpa-parfum"];
    const randomPerfume = perfumes[Math.floor(Math.random() * perfumes.length)];

    // Random date within next 3 days
    // Random date within next 3 days
    const date = new Date();

    date.setDate(date.getDate() + Math.floor(Math.random() * 3));
    date.setHours(
      8 + Math.floor(Math.random() * 9),
      Math.floor(Math.random() * 4) * 15,
      0,
      0,
    );
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    const timeDto = date.toISOString().slice(0, 16);

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
      nomorNota: randomNota,
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          Dashboard Admin
          {userName && (
            <span className="text-lg font-normal text-gray-500 dark:text-gray-400">
              ({userName})
            </span>
          )}
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
      {/* Autofill Confirmation Modal */}
      <Modal
        backdrop="blur"
        isOpen={autofillModal.isOpen}
        onOpenChange={autofillModal.onOpenChange}
        size="sm"
      >
        <ModalContent className="bg-white dark:bg-gray-900 border border-black/10 dark:border-white/20">
          {(onClose) => (
            <>
              <ModalHeader className="text-gray-900 dark:text-white text-base">
                Data pelanggan ditemukan
              </ModalHeader>
              <ModalBody className="pb-2">
                <p className="text-sm text-gray-600 dark:text-white/70 mb-3">
                  Nomor ini pernah order sebelumnya. Gunakan data tersimpan?
                </p>
                <div className="bg-gray-50 dark:bg-white/5 rounded-lg p-3 space-y-1.5 text-sm">
                  {foundCustomer?.nama && (
                    <div>
                      <span className="text-gray-400 text-xs">Nama</span>
                      <p className="font-medium text-gray-800 dark:text-white">{foundCustomer.nama}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-400 text-xs">Alamat</span>
                    {foundCustomer?.alamat ? (
                      <p className="font-medium text-gray-800 dark:text-white line-clamp-2">{foundCustomer.alamat}</p>
                    ) : (
                      <p className="font-medium text-gray-400 dark:text-gray-500 italic">Belum pernah dimasukkan</p>
                    )}
                  </div>
                  <div>
                    <span className="text-gray-400 text-xs">Google Maps</span>
                    {foundCustomer?.googleMapsLink ? (
                      <p className="font-medium text-blue-500 truncate">{foundCustomer.googleMapsLink}</p>
                    ) : (
                      <p className="font-medium text-gray-400 dark:text-gray-500 italic">Belum pernah dimasukkan</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 dark:text-white/40 mt-2">
                  Anda tetap bisa mengubah data ini setelah diisi.
                </p>
              </ModalBody>
              <ModalFooter className="gap-2">
                <Button
                  variant="light"
                  size="sm"
                  onPress={() => {
                    onClose();
                    setFoundCustomer(null);
                  }}
                >
                  Tidak, isi manual
                </Button>
                <Button
                  color="primary"
                  size="sm"
                  onPress={handleApplyAutofill}
                >
                  Ya, gunakan data ini
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>

      {/* Duplicate-ticket Confirmation Modal (blocking, Req 3.2/3.4/3.6/3.7) */}
      <Modal
        backdrop="blur"
        isOpen={dupConfirmModal.isOpen}
        size="sm"
        onOpenChange={(open) => {
          // Dismissing without choosing (backdrop/esc/close) resolves as a
          // decline (false) per Req 3.7.
          if (!open) resolveDuplicateConfirm(false);
        }}
      >
        <ModalContent className="bg-white dark:bg-gray-900 border border-black/10 dark:border-white/20">
          <>
            <ModalHeader className="text-gray-900 dark:text-white text-base">
              Tiket duplikat ditemukan
            </ModalHeader>
            <ModalBody className="pb-2">
              <p className="text-sm text-gray-700 dark:text-white/80">
                {dupMatch
                  ? buildDuplicateConfirmText({
                      nomor_hp: dupMatch.nomor_hp_local,
                      nama: dupMatch.nama,
                      jenis_tugas: dupMatch.jenis_tugas,
                    })
                  : ""}
              </p>
            </ModalBody>
            <ModalFooter className="gap-2">
              <Button
                size="sm"
                variant="light"
                onPress={() => resolveDuplicateConfirm(false)}
              >
                Tidak
              </Button>
              <Button
                color="primary"
                size="sm"
                onPress={() => resolveDuplicateConfirm(true)}
              >
                Ya
              </Button>
            </ModalFooter>
          </>
        </ModalContent>
      </Modal>

      {/* Add Order Modal */}
      <Modal
        isOpen={orderModal.isOpen}
        scrollBehavior="inside"
        size="2xl"
        onClose={orderModal.onClose}
      >        <ModalContent className="bg-white dark:bg-gray-900 max-h-[90vh]">
          <ModalHeader>
            {savedOrders !== null ? "Pesanan Tersimpan" : "Tambah Pesanan Baru"}
          </ModalHeader>
          <ModalBody className="overflow-y-auto">
            {savedOrders !== null ? (
              <div className="flex flex-col gap-4">
                {submitStatus.type && (
                  <div
                    className={`p-3 rounded-lg text-sm ${submitStatus.type === "success" ? "bg-green-500/20 text-green-600" : "bg-red-500/20 text-red-600"}`}
                  >
                    {submitStatus.message}
                  </div>
                )}
                <p className="text-sm text-gray-600 dark:text-white/70">
                  Kirim konfirmasi WhatsApp ke pelanggan untuk setiap tiket di
                  bawah ini.
                </p>
                {savedOrders.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-white/50">
                    Tidak ada tiket untuk ditampilkan.
                  </p>
                ) : (
                  savedOrders.map((ticket, idx) => {
                    const waUrl = buildWaUrl(
                      ticket.nomor_hp,
                      buildTicketWaMessage(ticket),
                    );
                    const label =
                      ticket.jenis_tugas === "ANTAR" ? "Antar" : "Jemput";

                    return (
                      <div
                        key={`${ticket.nomor_tiket}-${idx}`}
                        className="rounded-lg border border-black/10 dark:border-white/20 p-3 flex flex-col gap-2"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {ticket.nomor_tiket}
                            </p>
                            <span className="text-xs text-gray-500 dark:text-white/60">
                              {label}
                              {ticket.nama ? ` · ${ticket.nama}` : ""}
                            </span>
                          </div>
                          {waUrl && (
                            <Button
                              className="bg-green-500 text-white shrink-0"
                              size="sm"
                              onPress={() => window.open(waUrl, "_blank")}
                            >
                              Kirim WA ({label})
                            </Button>
                          )}
                        </div>
                        {!waUrl && (
                          <span className="inline-block w-fit rounded-md bg-red-500/20 px-2 py-1 text-xs text-red-600">
                            Nomor HP tidak valid, WA tidak dapat dikirim
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
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
                label="Nomor HP"
                description="Isi nomor HP lalu tekan tombol cari untuk mengambil data pelanggan tersimpan."
                placeholder="Contoh: 08123456789"
                value={formData.nomorHP}
                onValueChange={handlePhoneChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleLookupCustomer();
                  }
                }}
                endContent={
                  <Button
                    isIconOnly
                    aria-label="Cari data pelanggan"
                    color="primary"
                    isLoading={isLookingUp}
                    size="sm"
                    variant="flat"
                    onPress={handleLookupCustomer}
                  >
                    <Search size={16} />
                  </Button>
                }
              />
              <Input
                isRequired
                label="Nama Pelanggan"
                value={formData.nama}
                onValueChange={(v) => handleInputChange("nama", v)}
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

              <Input
                label="Waktu Penjemputan"
                type="datetime-local"
                value={formData.waktuPenjemputan || ""}
                onChange={(e) =>
                  handleInputChange("waktuPenjemputan", e.target.value)
                }
              />

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

              <Input
                label="Nomor Nota"
                placeholder="Contoh: INV-001"
                value={formData.nomorNota}
                onValueChange={(v) => handleInputChange("nomorNota", v)}
              />
            </div>
            )}
          </ModalBody>
          <ModalFooter>
            {savedOrders !== null ? (
              <Button
                color="primary"
                onPress={() => {
                  resetForm();
                  orderModal.onClose();
                }}
              >
                Tutup
              </Button>
            ) : (
              <>
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
              </>
            )}
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
