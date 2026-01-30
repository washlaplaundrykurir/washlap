"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input, Textarea } from "@heroui/input";
import { RadioGroup, Radio } from "@heroui/radio";
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

import { useToast } from "@/components/ToastProvider";
import { useState, useEffect } from "react";
import { CalendarDateTime } from "@internationalized/date";
import { I18nProvider } from "@react-aria/i18n";
import { ClipboardList, Truck, Package, FlaskConical, Plus } from "lucide-react";

interface Stats {
    todayOrders: number;
    pendingOrders: number;
    activeCouriers: number;
}

export default function AdminPage() {
    const [stats, setStats] = useState<Stats>({ todayOrders: 0, pendingOrders: 0, activeCouriers: 0 });
    const [isLoading, setIsLoading] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
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
                const allOrders = result.data?.flatMap((g: { orders: unknown[] }) => g.orders) || [];
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);

                setStats({
                    todayOrders: allOrders.filter((o: { waktu_order: string }) => new Date(o.waktu_order) >= todayStart).length,
                    pendingOrders: allOrders.filter((o: { status_id: number }) => o.status_id < 6).length,
                    activeCouriers: result.data?.filter((g: { courierId: string }) => g.courierId !== 'unassigned').length || 0,
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
        setSubmitStatus({ type: null, message: '' });

        try {
            // Convert CalendarDateTime to ISO string
            const waktuPenjemputanStr = formData.waktuPenjemputan
                ? `${formData.waktuPenjemputan.year}-${String(formData.waktuPenjemputan.month).padStart(2, '0')}-${String(formData.waktuPenjemputan.day).padStart(2, '0')}T${String(formData.waktuPenjemputan.hour).padStart(2, '0')}:${String(formData.waktuPenjemputan.minute).padStart(2, '0')}`
                : null;

            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, waktuPenjemputan: waktuPenjemputanStr }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Terjadi kesalahan');

            setSubmitStatus({ type: 'success', message: 'Pesanan berhasil ditambahkan!' });
            showToast("success", "Pesanan berhasil ditambahkan!");
            resetForm();
            fetchStats();
            setTimeout(() => orderModal.onClose(), 1500);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Terjadi kesalahan';
            setSubmitStatus({ type: 'error', message: errorMsg });
            showToast("error", errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            nama: "", nomorHP: "", alamat: "", googleMapsLink: "",
            permintaan: [], waktuPenjemputan: null, produkLayanan: "",
            produkLayananManual: "", jenisLayanan: "", parfum: "",
        });
        setSubmitStatus({ type: null, message: '' });
    };

    const fillDummyData = () => {
        const names = ["Budi Santoso", "Ani Wijaya", "Dedi Prasetyo", "Siti Rahayu", "Eko Susanto"];
        const addresses = [
            "Jl. Merdeka No. 45, Surabaya",
            "Jl. Gatot Subroto No. 12, Jakarta",
            "Jl. Sudirman No. 78, Bandung",
            "Jl. Ahmad Yani No. 23, Semarang",
            "Jl. Diponegoro No. 99, Yogyakarta",
        ];
        const randomName = names[Math.floor(Math.random() * names.length)];
        const randomAddress = addresses[Math.floor(Math.random() * addresses.length)];
        const randomPhone = `08${Math.floor(Math.random() * 9000000000 + 1000000000)}`;

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
            nama: randomName,
            nomorHP: randomPhone,
            alamat: randomAddress,
            googleMapsLink: "https://maps.google.com/?q=-7.2575,112.7521",
            permintaan: Math.random() > 0.5 ? ["jemput", "antar"] : ["jemput"],
            waktuPenjemputan: tomorrowDt,
            produkLayanan: ["cuci-setrika", "cuci-saja", "setrika-saja"][Math.floor(Math.random() * 3)],
            produkLayananManual: "",
            jenisLayanan: Math.random() > 0.3 ? "reguler" : "express",
            parfum: ["soft", "strong", "tanpa-parfum"][Math.floor(Math.random() * 3)],
        });
    };

    return (
        <>
            {/* Header with Add Button */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard Admin</h1>
                <Button color="primary" onClick={() => { resetForm(); orderModal.onOpen(); }} startContent={<Plus size={18} />}>
                    Tambah Pesanan
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
                    <CardBody className="p-6">
                        <p className="text-sm text-gray-600 dark:text-white/70">Total Pesanan Hari Ini</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.todayOrders}</p>
                    </CardBody>
                </Card>
                <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
                    <CardBody className="p-6">
                        <p className="text-sm text-gray-600 dark:text-white/70">Pesanan Pending</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.pendingOrders}</p>
                    </CardBody>
                </Card>
                <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
                    <CardBody className="p-6">
                        <p className="text-sm text-gray-600 dark:text-white/70">Kurir dengan Tugas</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stats.activeCouriers}</p>
                    </CardBody>
                </Card>
            </div>

            {/* Info Card */}
            <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
                <CardBody className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Button variant="flat" className="h-20" onClick={() => { resetForm(); orderModal.onOpen(); }}>
                            <div className="flex flex-col items-center justify-center">
                                <ClipboardList className="w-8 h-8 mb-1" />
                                <p className="text-xs pt-1">Tambah Pesanan</p>
                            </div>
                        </Button>
                        <Button variant="flat" className="h-20" as="a" href="/admin/tugas?tab=jemput">
                            <div className="flex flex-col items-center justify-center">
                                <Truck className="w-8 h-8 mb-1" />
                                <p className="text-xs pt-1">Siap Jemput</p>
                            </div>
                        </Button>
                        <Button variant="flat" className="h-20" as="a" href="/admin/tugas?tab=antar">
                            <div className="flex flex-col items-center justify-center">
                                <Package className="w-8 h-8 mb-1" />
                                <p className="text-xs pt-1">Siap Antar</p>
                            </div>
                        </Button>
                        <Button variant="flat" className="h-20" as="a" href="/admin/orders">
                            <div className="flex flex-col items-center justify-center">
                                <ClipboardList className="w-8 h-8 mb-1" />
                                <p className="text-xs pt-1">Belum Ditugaskan</p>
                            </div>
                        </Button>
                    </div>
                </CardBody>
            </Card>
            {/* Add Order Modal */}
            <Modal isOpen={orderModal.isOpen} onClose={orderModal.onClose} size="2xl" scrollBehavior="inside">
                <ModalContent className="bg-white dark:bg-gray-900 max-h-[90vh]">
                    <ModalHeader>Tambah Pesanan Baru</ModalHeader>
                    <ModalBody className="overflow-y-auto">
                        <div className="flex flex-col gap-4">
                            {submitStatus.type && (
                                <div className={`p-3 rounded-lg text-sm ${submitStatus.type === 'success' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}`}>
                                    {submitStatus.message}
                                </div>
                            )}

                            <Input label="Nama Pelanggan" value={formData.nama} onValueChange={(v) => handleInputChange("nama", v)} isRequired />
                            <Input label="Nomor HP" value={formData.nomorHP} onValueChange={(v) => handleInputChange("nomorHP", v)} isRequired />
                            <Textarea label="Alamat Lengkap" value={formData.alamat} onValueChange={(v) => handleInputChange("alamat", v)} isRequired />
                            <Input label="Link Google Maps" value={formData.googleMapsLink} onValueChange={(v) => handleInputChange("googleMapsLink", v)} />

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
                                    label="Waktu Penjemputan"
                                    granularity="minute"
                                    hourCycle={24}
                                    value={formData.waktuPenjemputan}
                                    onChange={(v) => setFormData((prev) => ({ ...prev, waktuPenjemputan: v as CalendarDateTime | null }))}
                                />
                            </I18nProvider>

                            <Divider />

                            <RadioGroup
                                label="Produk Layanan"
                                value={formData.produkLayanan}
                                onValueChange={(v) => handleInputChange("produkLayanan", v)}
                                isRequired
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
                                    onValueChange={(v) => handleInputChange("produkLayananManual", v)}
                                />
                            )}

                            <RadioGroup
                                label="Jenis Layanan"
                                value={formData.jenisLayanan}
                                onValueChange={(v) => handleInputChange("jenisLayanan", v)}
                                isRequired
                            >
                                <Radio value="reguler">Reguler</Radio>
                                <Radio value="express">Express</Radio>
                            </RadioGroup>

                            <RadioGroup
                                label="Parfum"
                                value={formData.parfum}
                                onValueChange={(v) => handleInputChange("parfum", v)}
                                isRequired
                            >
                                <Radio value="soft">Soft</Radio>
                                <Radio value="strong">Strong</Radio>
                                <Radio value="tanpa-parfum">Tanpa Parfum</Radio>
                            </RadioGroup>
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        {process.env.NODE_ENV === 'development' && (
                            <Button variant="flat" color="warning" onClick={fillDummyData} className="mr-auto">
                                🧪 Fill Dummy
                            </Button>
                        )}
                        <Button variant="light" onClick={orderModal.onClose}>Batal</Button>
                        <Button color="primary" isLoading={isLoading} onClick={handleSubmit}>
                            Simpan Pesanan
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal >
        </>
    );
}
