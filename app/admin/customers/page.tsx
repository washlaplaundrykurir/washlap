"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    useDisclosure,
} from "@heroui/modal";

import { useToast } from "@/components/ToastProvider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { X, MapPin } from "lucide-react";

interface Customer {
    id: string;
    nomor_hp: string;
    nama_terakhir: string | null;
    alamat_terakhir: string | null;
    google_maps_terakhir: string | null;
    created_at: string;
}

export default function CustomersPage() {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [actionLoading, setActionLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const { showToast } = useToast();

    const editModal = useDisclosure();
    const deleteModal = useDisclosure();

    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [formData, setFormData] = useState({
        nama_terakhir: "",
        alamat_terakhir: "",
        google_maps_terakhir: "",
    });

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            setIsLoading(true);
            const response = await fetch("/api/customers");
            const result = await response.json();

            if (!response.ok) throw new Error(result.error);

            setCustomers(result.data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error fetching customers");
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedCustomer) return;

        try {
            setActionLoading(true);
            const response = await fetch("/api/customers", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: selectedCustomer.id,
                    ...formData,
                }),
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            editModal.onClose();
            fetchCustomers();
            showToast("success", "Pelanggan berhasil diupdate!");
        } catch (err) {
            showToast("error", err instanceof Error ? err.message : "Error updating customer");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedCustomer) return;

        try {
            setActionLoading(true);
            const response = await fetch(`/api/customers?id=${selectedCustomer.id}`, {
                method: "DELETE",
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.error);

            deleteModal.onClose();
            setSelectedCustomer(null);
            fetchCustomers();
            showToast("success", "Pelanggan berhasil dihapus!");
        } catch (err) {
            showToast("error", err instanceof Error ? err.message : "Error deleting customer");
        } finally {
            setActionLoading(false);
        }
    };

    const openEditModal = (customer: Customer) => {
        setSelectedCustomer(customer);
        setFormData({
            nama_terakhir: customer.nama_terakhir || "",
            alamat_terakhir: customer.alamat_terakhir || "",
            google_maps_terakhir: customer.google_maps_terakhir || "",
        });
        editModal.onOpen();
    };

    const openDeleteModal = (customer: Customer) => {
        setSelectedCustomer(customer);
        deleteModal.onOpen();
    };

    const filteredCustomers = customers.filter(
        (c) =>
            c.nama_terakhir?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.nomor_hp?.includes(searchQuery) ||
            c.alamat_terakhir?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    };

    return (
        <>
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        Daftar Pelanggan
                    </h1>
                    <p className="text-gray-600 dark:text-white/70">
                        Total: {customers.length} pelanggan
                    </p>
                </div>
                <Input
                    placeholder="Cari nama, HP, atau alamat..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    className="w-full md:w-72"
                    classNames={{
                        inputWrapper: "bg-white/60 dark:bg-white/10",
                    }}
                />
            </div>

            {/* Error Alert */}
            {error && (
                <Card className="mb-4 bg-red-500/20 border border-red-500/30">
                    <CardBody className="text-red-600 dark:text-red-400 text-sm">
                        <Button size="sm" variant="light" className="ml-2" onClick={() => setError("")}>
                            <X size={16} />
                        </Button>
                    </CardBody>
                </Card>
            )}

            {/* Loading */}
            {
                isLoading && (
                    <div className="flex justify-center py-20">
                        <Spinner size="lg" />
                    </div>
                )
            }

            {/* Customers Grid */}
            {
                !isLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredCustomers.length === 0 ? (
                            <Card className="col-span-full backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
                                <CardBody className="py-8 text-center text-gray-500 dark:text-white/50">
                                    {searchQuery ? "Tidak ada pelanggan yang cocok" : "Belum ada pelanggan"}
                                </CardBody>
                            </Card>
                        ) : (
                            filteredCustomers.map((customer) => (
                                <Card
                                    key={customer.id}
                                    className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30"
                                >
                                    <CardHeader className="flex justify-between items-start pb-0">
                                        <div>
                                            <h3 className="font-semibold text-gray-900 dark:text-white">
                                                {customer.nama_terakhir || "Tanpa Nama"}
                                            </h3>
                                            <p className="text-sm text-primary font-medium">
                                                {customer.nomor_hp}
                                            </p>
                                        </div>
                                        <p className="text-xs text-gray-400 dark:text-white/40">
                                            {formatDate(customer.created_at)}
                                        </p>
                                    </CardHeader>
                                    <CardBody className="pt-2">
                                        {customer.alamat_terakhir ? (
                                            <p className="text-sm text-gray-600 dark:text-white/70 mb-2 line-clamp-2 flex items-center gap-1">
                                                <MapPin size={14} /> {customer.alamat_terakhir}
                                            </p>
                                        ) : (
                                            <p className="text-sm text-gray-400 dark:text-white/40 mb-2">
                                                Alamat belum tersedia
                                            </p>
                                        )}

                                        {customer.google_maps_terakhir && (
                                            <Link
                                                href={customer.google_maps_terakhir}
                                                target="_blank"
                                                className="text-xs text-primary hover:underline"
                                            >
                                                Buka Google Maps →
                                            </Link>
                                        )}

                                        <div className="flex gap-2 mt-3">
                                            <Button
                                                size="sm"
                                                variant="flat"
                                                className="flex-1"
                                                onClick={() => openEditModal(customer)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                color="danger"
                                                variant="flat"
                                                onClick={() => openDeleteModal(customer)}
                                            >
                                                Hapus
                                            </Button>
                                        </div>
                                    </CardBody>
                                </Card>
                            ))
                        )}
                    </div>
                )
            }
            {/* Edit Modal */}
            <Modal isOpen={editModal.isOpen} onClose={editModal.onClose} size="lg">
                <ModalContent className="bg-white dark:bg-gray-900">
                    <ModalHeader>Edit Pelanggan</ModalHeader>
                    <ModalBody>
                        <div className="flex flex-col gap-4">
                            <Input
                                label="Nomor HP"
                                value={selectedCustomer?.nomor_hp || ""}
                                isDisabled
                            />
                            <Input
                                label="Nama"
                                value={formData.nama_terakhir}
                                onValueChange={(v) => setFormData({ ...formData, nama_terakhir: v })}
                            />
                            <Textarea
                                label="Alamat"
                                value={formData.alamat_terakhir}
                                onValueChange={(v) => setFormData({ ...formData, alamat_terakhir: v })}
                            />
                            <Input
                                label="Link Google Maps"
                                value={formData.google_maps_terakhir}
                                onValueChange={(v) => setFormData({ ...formData, google_maps_terakhir: v })}
                            />
                        </div>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onClick={editModal.onClose}>
                            Batal
                        </Button>
                        <Button color="primary" isLoading={actionLoading} onClick={handleUpdate}>
                            Simpan
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Delete Modal */}
            <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.onClose}>
                <ModalContent className="bg-white dark:bg-gray-900">
                    <ModalHeader>Hapus Pelanggan</ModalHeader>
                    <ModalBody>
                        <p className="text-gray-600 dark:text-white/70">
                            Apakah Anda yakin ingin menghapus pelanggan{" "}
                            <strong>{selectedCustomer?.nama_terakhir || selectedCustomer?.nomor_hp}</strong>?
                        </p>
                    </ModalBody>
                    <ModalFooter>
                        <Button variant="light" onClick={deleteModal.onClose}>
                            Batal
                        </Button>
                        <Button color="danger" isLoading={actionLoading} onClick={handleDelete}>
                            Hapus
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>
        </>
    );
}
