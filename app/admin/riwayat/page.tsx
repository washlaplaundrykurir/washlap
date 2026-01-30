"use client";

import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { Input } from "@heroui/input";

import { useEffect, useState } from "react";
import { ScrollText, Search, User, MapPin, Truck } from "lucide-react";
import Link from "next/link";

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
    customers: {
        id: string;
        nomor_hp: string;
        nama_terakhir: string;
    } | null;
    auth_users: {
        id: string;
        full_name: string;
        email: string;
    } | null;
    status_ref: {
        id: number;
        nama_status: string;
    } | null;
    order_items: {
        id: string;
        produk_layanan: string;
        jenis_layanan: string;
        parfum: string;
    }[];
}

interface CourierGroup {
    courierId: string;
    courierName: string;
    courierEmail: string | null;
    orders: Order[];
    orderCount: number;
}

const statusColors: Record<number, "default" | "primary" | "secondary" | "success" | "warning" | "danger"> = {
    1: "warning",    // Baru
    2: "primary",    // Ditugaskan
    3: "secondary",  // Proses Jemput
    4: "secondary",  // Proses Cuci
    5: "secondary",  // Proses Antar
    6: "success",    // Selesai
    7: "danger",     // Batal
};

export default function RiwayatPage() {
    const [data, setData] = useState<CourierGroup[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [totalOrders, setTotalOrders] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchOrders();
    }, []);

    const fetchOrders = async () => {
        try {
            const response = await fetch("/api/orders/list");
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Gagal mengambil data");
            }

            setData(result.data);
            setTotalOrders(result.totalOrders);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Terjadi kesalahan");
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    // Flatten orders and filter by search term
    const allOrders = data.flatMap(group =>
        group.orders.map(order => ({ ...order, courierName: group.courierName }))
    );

    const filteredOrders = allOrders.filter(order => {
        const searchLower = searchTerm.toLowerCase();
        return (
            order.nomor_tiket?.toLowerCase().includes(searchLower) ||
            order.customers?.nama_terakhir?.toLowerCase().includes(searchLower) ||
            order.customers?.nomor_hp?.includes(searchTerm) ||
            order.alamat_jalan?.toLowerCase().includes(searchLower) ||
            order.courierName?.toLowerCase().includes(searchLower)
        );
    });

    return (
        <>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <ScrollText className="w-6 h-6" /> Riwayat Pesanan
                    </h1>
                    <p className="text-gray-600 dark:text-white/70">
                        Total: {totalOrders} pesanan
                    </p>
                </div>
                <Input
                    placeholder="Cari tiket, nama, HP, alamat..."
                    value={searchTerm}
                    onValueChange={setSearchTerm}
                    className="max-w-xs"
                    classNames={{
                        inputWrapper: "bg-white/60 dark:bg-white/15 backdrop-blur-xl border border-black/10 dark:border-white/30"
                    }}
                    startContent={<Search size={16} className="text-gray-400" />}
                />
            </div>

            {/* Loading State */}
            {isLoading && (
                <div className="flex justify-center items-center py-20">
                    <Spinner size="lg" />
                </div>
            )}

            {/* Error State */}
            {error && (
                <Card className="backdrop-blur-xl bg-red-500/20 border border-red-500/30">
                    <CardBody className="p-6 text-center text-red-600 dark:text-red-400">
                        {error}
                    </CardBody>
                </Card>
            )}

            {/* Orders List (Read-only) */}
            {!isLoading && !error && (
                <div className="space-y-3">
                    {filteredOrders.length === 0 ? (
                        <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
                            <CardBody className="p-6 text-center text-gray-600 dark:text-white/70">
                                {searchTerm ? "Tidak ada hasil pencarian." : "Belum ada riwayat pesanan."}
                            </CardBody>
                        </Card>
                    ) : (
                        filteredOrders.map((order) => (
                            <Card
                                key={order.id}
                                className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30"
                            >
                                <CardBody className="p-4">
                                    <div className="flex flex-col md:flex-row justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                <span className="font-bold text-gray-900 dark:text-white">
                                                    {order.nomor_tiket || "No Ticket"}
                                                </span>
                                                <Chip
                                                    size="sm"
                                                    variant="flat"
                                                    color={order.jenis_tugas === "JEMPUT" ? "secondary" : "primary"}
                                                >
                                                    {order.jenis_tugas}
                                                </Chip>
                                                <Chip
                                                    size="sm"
                                                    color={statusColors[order.status_id] || "default"}
                                                >
                                                    {order.status_ref?.nama_status || "Unknown"}
                                                </Chip>
                                            </div>
                                            <p className="text-sm text-gray-600 dark:text-white/70 mb-1 flex items-center gap-1">
                                                <User size={14} /> {order.customers?.nama_terakhir || "Unknown"} • {order.customers?.nomor_hp || "-"}
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-white/50 mb-1 flex items-center gap-1">
                                                <MapPin size={14} /> {order.alamat_jalan || "-"}
                                            </p>
                                            <p className="text-sm text-gray-500 dark:text-white/50 flex items-center gap-1">
                                                <Truck size={14} /> Kurir: {order.courierName || "-"}
                                            </p>
                                            {order.google_maps_link && (
                                                <Link
                                                    href={order.google_maps_link}
                                                    target="_blank"
                                                    className="text-xs text-primary hover:underline mt-1 inline-block"
                                                >
                                                    Buka di Google Maps →
                                                </Link>
                                            )}
                                        </div>
                                        <div className="text-right text-sm text-gray-400 dark:text-white/40 min-w-[120px]">
                                            <p>{formatDate(order.waktu_order)}</p>
                                            {order.order_items?.[0] && (
                                                <div className="mt-2 text-xs">
                                                    <p>Produk: {order.order_items[0].produk_layanan}</p>
                                                    <p>Layanan: {order.order_items[0].jenis_layanan}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        ))
                    )}
                </div>
            )}
        </>
    );
}
