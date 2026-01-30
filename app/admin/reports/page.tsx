"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Tabs, Tab } from "@heroui/tabs";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Spinner } from "@heroui/spinner";
import { FileSpreadsheet, Search, CalendarDays } from "lucide-react";
import * as XLSX from "xlsx";

export default function ReportsPage() {
    const [activeTab, setActiveTab] = useState("rekap");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [data, setData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Set default dates (current month)
    useEffect(() => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        setStartDate(firstDay.toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
    }, []);

    // Fetch data when filters/tab apply
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams({
                type: activeTab,
                startDate,
                endDate
            });
            const res = await fetch(`/api/reports?${params.toString()}`);
            const result = await res.json();
            if (res.ok) {
                setData(result.data || []);
            }
        } catch (error) {
            console.error("Failed to fetch reports", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (startDate && endDate) {
            fetchData();
        }
    }, [activeTab, startDate, endDate]); // Auto fetch on change

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Laporan");
        XLSX.writeFile(wb, `Laporan_${activeTab}_${startDate}_${endDate}.xlsx`);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr || dateStr === '-') return '-';
        return new Date(dateStr).toLocaleString("id-ID");
    };

    // Render Table Helper
    const renderTable = () => {
        if (activeTab === "rekap") {
            return (
                <Table aria-label="Laporan Rekap">
                    <TableHeader>
                        <TableColumn>NAMA KURIR</TableColumn>
                        <TableColumn>JUMLAH ANTAR</TableColumn>
                        <TableColumn>JUMLAH JEMPUT</TableColumn>
                        <TableColumn>TOTAL</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="Tidak ada data">
                        {data.map((item, idx) => (
                            <TableRow key={idx}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell>{item.antar}</TableCell>
                                <TableCell>{item.jemput}</TableCell>
                                <TableCell className="font-bold">{item.total}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            );
        }

        if (activeTab === "sla") {
            return (
                <Table aria-label="Laporan SLA">
                    <TableHeader>
                        <TableColumn>TIKET</TableColumn>
                        <TableColumn>TGL TIKET</TableColumn>
                        <TableColumn>NOTA</TableColumn>
                        <TableColumn>TGL ASSIGN</TableColumn>
                        <TableColumn>TGL KURIR SELESAI</TableColumn>
                        <TableColumn>SELISIH (ASSIGN-SELESAI)</TableColumn>
                        <TableColumn>TGL INPUT NOTA</TableColumn>
                        <TableColumn>SELISIH (SELESAI-INPUT)</TableColumn>
                    </TableHeader>
                    <TableBody emptyContent="Tidak ada data">
                        {data.map((item, idx) => (
                            <TableRow key={idx}>
                                <TableCell>{item.nomor_tiket}</TableCell>
                                <TableCell>{formatDate(item.tanggal_tiket)}</TableCell>
                                <TableCell>{item.nomor_nota}</TableCell>
                                <TableCell>{formatDate(item.tanggal_assign)}</TableCell>
                                <TableCell>{formatDate(item.tanggal_diselesaikan_kurir)}</TableCell>
                                <TableCell>{item.selisih_assign_selesai}</TableCell>
                                <TableCell>{formatDate(item.tanggal_input_nota)}</TableCell>
                                <TableCell>{item.selisih_selesai_input}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            );
        }

        // Default: Tickets (Detail)
        return (
            <Table aria-label="Laporan Menu">
                <TableHeader>
                    <TableColumn>TIKET</TableColumn>
                    <TableColumn>JENIS</TableColumn>
                    <TableColumn>TGL ORDER</TableColumn>
                    <TableColumn>STATUS</TableColumn>
                    <TableColumn>PELANGGAN</TableColumn>
                    <TableColumn>ALAMAT</TableColumn>
                    <TableColumn>KURIR</TableColumn>
                    <TableColumn>NOTA</TableColumn>
                </TableHeader>
                <TableBody emptyContent="Tidak ada data">
                    {data.map((item, idx) => (
                        <TableRow key={idx}>
                            <TableCell>{item.nomor_tiket}</TableCell>
                            <TableCell>{item.jenis_tugas}</TableCell>
                            <TableCell>{formatDate(item.waktu_order)}</TableCell>
                            <TableCell>{item.status_ref?.nama_status}</TableCell>
                            <TableCell>{item.customers?.nama_terakhir}</TableCell>
                            <TableCell className="max-w-xs truncate">{item.alamat_jalan}</TableCell>
                            <TableCell>{item.auth_users?.full_name || '-'}</TableCell>
                            <TableCell>{item.nomor_nota || '-'}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        <FileSpreadsheet /> Laporan Admin
                    </h1>
                    <p className="text-gray-500">Rekapitulasi data dan kinerja operasional</p>
                </div>
                <Button color="success" onPress={exportToExcel} isDisabled={data.length === 0} startContent={<FileSpreadsheet size={18} />}>
                    Export Excel
                </Button>
            </div>

            <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
                <CardBody className="p-4">
                    <div className="flex flex-wrap gap-4 items-end mb-6">
                        <Input
                            label="Dari Tanggal"
                            type="date"
                            value={startDate}
                            onValueChange={setStartDate}
                            className="max-w-[200px]"
                            variant="bordered"
                        />
                        <Input
                            label="Sampai Tanggal"
                            type="date"
                            value={endDate}
                            onValueChange={setEndDate}
                            className="max-w-[200px]"
                            variant="bordered"
                        />
                        <Button color="primary" variant="flat" onPress={fetchData} isLoading={isLoading}>
                            <Search size={18} /> Tampilkan
                        </Button>
                    </div>

                    <Tabs
                        aria-label="Report Types"
                        selectedKey={activeTab}
                        onSelectionChange={(k) => setActiveTab(k as string)}
                        color="primary"
                        variant="underlined"
                    >
                        <Tab key="rekap" title="Rekap Kurir" />
                        <Tab key="sla" title="Laporan SLA" />
                        <Tab key="tickets" title="Detail Tiket" />
                    </Tabs>

                    <div className="mt-4">
                        {isLoading ? (
                            <div className="flex justify-center py-10"><Spinner size="lg" /></div>
                        ) : (
                            renderTable()
                        )}
                    </div>
                </CardBody>
            </Card>
        </div>
    );
}
