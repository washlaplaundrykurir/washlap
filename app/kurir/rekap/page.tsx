"use client";

import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Spinner } from "@heroui/spinner";
import { ArrowLeft, FileChartColumn, Printer } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";


interface ReportRow {
    date: string;
    jemput: number;
    antar: number;
    total: number;
}

export default function CourierReportPage() {
    const [reportData, setReportData] = useState<ReportRow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");

    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);

    const [startDate, setStartDate] = useState(firstDay.toISOString().split("T")[0]);
    const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);

    useEffect(() => {
        fetchReport();
    }, [startDate, endDate]);

    const fetchReport = async () => {
        try {
            setIsLoading(true);
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
        // Create date object from the date string (YYYY-MM-DD)
        // We adding time component to avoid timezone issues when parsing simple dates
        const date = new Date(dateString + 'T12:00:00');
        return date.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileChartColumn className="w-6 h-6 text-blue-500" /> Rekapitulasi Tugas
                    </h1>
                    <p className="text-gray-600 dark:text-white/70">
                        Laporan harian penjemputan dan pengantaran
                    </p>
                </div>

                <Button as={Link} href="/kurir" variant="flat" startContent={<ArrowLeft size={16} />}>
                    Kembali
                </Button>
            </div>

            <Card className="mb-6 backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
                <CardBody className="flex flex-col md:flex-row gap-4 p-4 items-end">
                    <Input
                        type="date"
                        label="Dari Tanggal"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full md:w-1/3"
                    />
                    <Input
                        type="date"
                        label="Sampai Tanggal"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full md:w-1/3"
                    />
                    <Button color="primary" onClick={fetchReport} isLoading={isLoading}>
                        Terapkan
                    </Button>
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
