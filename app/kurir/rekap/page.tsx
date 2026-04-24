"use client";

import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { ArrowLeft, FileChartColumn, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";


interface ReportRow {
    date: string;
    jemput: number;
    antar: number;
    total: number;
}

export default function CourierReportPage() {
    const [reportData, setReportData] = useState<ReportRow[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);
    const [error, setError] = useState("");

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const [startDate, setStartDate] = useState(firstDay.toISOString().split("T")[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);

    const fetchReport = async () => {
        try {
            setIsLoading(true);
            setHasFetched(true);
            setError("");
            const params = new URLSearchParams({ startDate, endDate });
            const response = await fetch(`/api/kurir/report?${params}`);
            const result = await response.json();

            if (!response.ok) throw new Error(result.error);

            setReportData(result.data);
        } catch (err: any) {
            setError(err.message || "Gagal memuat laporan");
        } finally {
            setIsLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString + 'T12:00:00');
        return date.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
                    <FileChartColumn className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-black tracking-tight text-gray-900 dark:text-white">
                        Rekapitulasi Tugas
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 text-xs font-medium">
                        Laporan harian penjemputan dan pengantaran
                    </p>
                </div>
            </div>

            {/* Filter */}
            <Card className="mb-6 backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
                <CardBody className="p-4 gap-3 flex flex-col">
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            type="date"
                            label="Dari Tanggal"
                            size="sm"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            variant="bordered"
                            classNames={{ label: "text-xs font-bold" }}
                        />
                        <Input
                            type="date"
                            label="Sampai Tanggal"
                            size="sm"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            variant="bordered"
                            classNames={{ label: "text-xs font-bold" }}
                        />
                    </div>
                    <div className="flex gap-2">
                        <Button
                            color="primary"
                            onClick={fetchReport}
                            isLoading={isLoading}
                            className="flex-1 font-bold"
                            size="sm"
                        >
                            Tampilkan
                        </Button>
                        <Button
                            as={Link}
                            href="/kurir"
                            variant="flat"
                            size="sm"
                            startContent={<ArrowLeft size={14} />}
                            className="font-bold"
                        >
                            Kembali
                        </Button>
                    </div>
                </CardBody>
            </Card>

            {error && (
                <Card className="bg-red-500/20 border border-red-500/30 mb-6">
                    <CardBody className="text-red-600 p-4 text-center">
                        {error}
                    </CardBody>
                </Card>
            )}

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Spinner size="lg" />
                </div>
            ) : !hasFetched ? (
                <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
                    <CardBody className="py-16 text-center flex flex-col items-center gap-3">
                        <FileChartColumn className="w-12 h-12 text-gray-300 dark:text-gray-600" />
                        <p className="text-gray-500 dark:text-white/50 font-medium">
                            Pilih rentang tanggal dan klik <b>Tampilkan</b> untuk memuat data.
                        </p>
                    </CardBody>
                </Card>
            ) : (
                <div className="overflow-x-auto">
                    <Table aria-label="Tabel Rekapitulasi" classNames={{
                        wrapper: "backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30 shadow-none",
                    }}>
                        <TableHeader>
                            <TableColumn>TANGGAL</TableColumn>
                            <TableColumn>JEMPUT</TableColumn>
                            <TableColumn>ANTAR</TableColumn>
                            <TableColumn>TOTAL</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent={"Tidak ada data untuk periode ini."}>
                            {reportData.map((row) => (
                                <TableRow key={row.date}>
                                    <TableCell className="font-medium">{formatDate(row.date)}</TableCell>
                                    <TableCell>
                                        <span className="text-secondary font-bold">{row.jemput}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-primary font-bold">{row.antar}</span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-bold">{row.total}</span>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            )}
        </div>
    );
}
