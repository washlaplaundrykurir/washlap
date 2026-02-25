"use client";

import { useState, useEffect } from "react";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Tabs, Tab } from "@heroui/tabs";
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
} from "@heroui/table";
import { Spinner } from "@heroui/spinner";
import { FileSpreadsheet, Search } from "lucide-react";
import * as XLSX from "xlsx";

import { useToast } from "@/components/ToastProvider";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("rekap");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  // Set default dates (last month and current month)
  useEffect(() => {
    const now = new Date();
    // Get the first day of the previous month
    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  }, []);

  // Fetch data when filters/tab apply
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        type: activeTab,
        startDate,
        endDate,
      });
      const res = await fetch(`/api/reports?${params.toString()}`);
      const result = await res.json();

      if (res.ok) {
        setData(result.data || []);
      }
    } catch {
      showToast("error", "Gagal memuat laporan");
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
    let exportData = data;

    if (activeTab === "rekap") {
      exportData = data.map((item) => ({
        "Nama Kurir": item.name,
        "Jumlah Antar": item.antar,
        "Jumlah Jemput": item.jemput,
        "Total": item.total,
      }));
    } else if (activeTab === "sla") {
      exportData = data.map((item) => ({
        "Tiket": item.nomor_tiket,
        "Tgl Tiket": formatDate(item.tanggal_tiket),
        "Nota": item.nomor_nota,
        "Tgl Assign": formatDate(item.tanggal_assign),
        "Tgl Kurir Selesai": formatDate(item.tanggal_diselesaikan_kurir),
        "Selisih (Assign-Selesai)": item.selisih_assign_selesai,
        "Tgl Input Nota": formatDate(item.tanggal_input_nota),
        "Selisih (Selesai-Input)": item.selisih_selesai_input,
      }));
    } else {
      exportData = data.map((item) => ({
        "Tiket": item.nomor_tiket,
        "Jenis": item.jenis_tugas,
        "Tgl Order": formatDate(item.waktu_order),
        "Status": item.status_ref?.nama_status || "-",
        "Pelanggan": item.customers?.nama_terakhir || "-",
        "Alamat": item.alamat_jalan || "-",
        "Kurir": item.auth_users?.full_name || "-",
        "Nota": item.nomor_nota || "-",
      }));
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Laporan");
    XLSX.writeFile(wb, `Laporan_${activeTab}_${startDate}_${endDate}.xlsx`);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === "-") return "-";

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
                <TableCell>
                  {formatDate(item.tanggal_diselesaikan_kurir)}
                </TableCell>
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
              <TableCell className="max-w-xs truncate">
                {item.alamat_jalan}
              </TableCell>
              <TableCell>{item.auth_users?.full_name || "-"}</TableCell>
              <TableCell>{item.nomor_nota || "-"}</TableCell>
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
          <p className="text-gray-500">
            Rekapitulasi data dan kinerja operasional
          </p>
        </div>
        <Button
          color="success"
          isDisabled={data.length === 0}
          startContent={<FileSpreadsheet size={18} />}
          onPress={exportToExcel}
        >
          Export Excel
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-4 mb-6 bg-gray-50 dark:bg-zinc-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <span className="text-xs font-medium text-gray-500 uppercase">
            Filter Tanggal:
          </span>
          <Input
            type="date"
            className="w-36"
            size="sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-gray-400">-</span>
          <Input
            type="date"
            className="w-36"
            size="sm"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 hidden md:block" />

        <Button
          color="primary"
          isLoading={isLoading}
          size="sm"
          variant="flat"
          onPress={fetchData}
        >
          <Search size={14} /> Tampilkan
        </Button>
      </div>

      <Card className="backdrop-blur-xl bg-white/60 dark:bg-white/15 border border-black/10 dark:border-white/30">
        <CardBody className="p-4">
          <Tabs
            aria-label="Report Types"
            color="primary"
            selectedKey={activeTab}
            variant="underlined"
            onSelectionChange={(k) => setActiveTab(k as string)}
          >
            <Tab key="rekap" title="Rekap Kurir" />
            <Tab key="sla" title="Laporan SLA" />
            <Tab key="tickets" title="Detail Tiket" />
          </Tabs>

          <div className="mt-4">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Spinner size="lg" />
              </div>
            ) : (
              renderTable()
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
