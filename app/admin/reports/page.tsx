"use client";

import { useState, useEffect, useMemo } from "react";
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
  SortDescriptor,
} from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { FileSpreadsheet, Search, CheckCircle2, XCircle } from "lucide-react";
import * as XLSX from "xlsx";

import { useToast } from "@/components/ToastProvider";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("rekap");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Separate states for each report type
  const [rekapData, setRekapData] = useState<any[]>([]);
  const [slaData, setSlaData] = useState<any[]>([]);
  const [ticketsData, setTicketsData] = useState<any[]>([]);

  const [isRekapLoading, setIsRekapLoading] = useState(false);
  const [isSlaLoading, setIsSlaLoading] = useState(false);
  const [isTicketsLoading, setIsTicketsLoading] = useState(false);

  // Sorting states
  const [rekapSort, setRekapSort] = useState<SortDescriptor>({
    column: "name",
    direction: "ascending",
  });
  const [slaSort, setSlaSort] = useState<SortDescriptor>({
    column: "tanggal_tiket",
    direction: "descending",
  });
  const [ticketsSort, setTicketsSort] = useState<SortDescriptor>({
    column: "waktu_order",
    direction: "descending",
  });

  const { showToast } = useToast();

  // Set default dates (8 days range including today)
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now);
    firstDay.setDate(now.getDate() - 7); // 8 days including today

    setStartDate(firstDay.toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  }, []);

  const fetchTab = async (
    type: string,
    setData: (d: any[]) => void,
    setLoading: (l: boolean) => void,
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type,
        startDate,
        endDate,
      });
      const res = await fetch(`/api/reports?${params.toString()}`);
      const result = await res.json();

      if (res.ok) {
        setData(result.data || []);
      } else {
        showToast("error", result.error || `Gagal memuat laporan ${type}`);
      }
    } catch {
      showToast("error", `Terjadi kesalahan saat memuat laporan ${type}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadAll = () => {
    if (!startDate || !endDate) {
      showToast("error", "Pilih rentang tanggal terlebih dahulu");
      return;
    }

    // Trigger all fetches in parallel
    fetchTab("rekap", setRekapData, setIsRekapLoading);
    fetchTab("sla", setSlaData, setIsSlaLoading);
    fetchTab("tickets", setTicketsData, setIsTicketsLoading);
  };

  const sortItems = (items: any[], sortDescriptor: SortDescriptor) => {
    return [...items].sort((a, b) => {
      const first = a[sortDescriptor.column as keyof any];
      const second = b[sortDescriptor.column as keyof any];

      // Handle nested values for tickets
      let firstVal = first;
      let secondVal = second;

      if (sortDescriptor.column === "status")
        firstVal = a.status_ref?.nama_status;
      if (sortDescriptor.column === "status")
        secondVal = b.status_ref?.nama_status;
      if (sortDescriptor.column === "pelanggan")
        firstVal = a.customers?.nama_terakhir;
      if (sortDescriptor.column === "pelanggan")
        secondVal = b.customers?.nama_terakhir;
      if (sortDescriptor.column === "kurir") firstVal = a.auth_users?.full_name;
      if (sortDescriptor.column === "kurir")
        secondVal = b.auth_users?.full_name;
      if (sortDescriptor.column === "created_by")
        firstVal = a.created_by_user?.full_name || "Customer";
      if (sortDescriptor.column === "created_by")
        secondVal = b.created_by_user?.full_name || "Customer";

      // Rekap Performance Sorting
      if (sortDescriptor.column === "meet_pct") firstVal = parseInt(a.meet_pct);
      if (sortDescriptor.column === "meet_pct")
        secondVal = parseInt(b.meet_pct);
      if (sortDescriptor.column === "failed_pct")
        firstVal = parseInt(a.failed_pct);
      if (sortDescriptor.column === "failed_pct")
        secondVal = parseInt(b.failed_pct);

      // SLA Sorting
      if (sortDescriptor.column === "sla_tiket") firstVal = a.raw_sla_tiket;
      if (sortDescriptor.column === "sla_tiket") secondVal = b.raw_sla_tiket;
      if (sortDescriptor.column === "sla_kurir") firstVal = a.raw_sla_kurir;
      if (sortDescriptor.column === "sla_kurir") secondVal = b.raw_sla_kurir;
      if (sortDescriptor.column === "sla_nota") firstVal = a.raw_sla_nota;
      if (sortDescriptor.column === "sla_nota") secondVal = b.raw_sla_nota;

      const cmp = firstVal < secondVal ? -1 : firstVal > secondVal ? 1 : 0;

      return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });
  };

  const sortedRekap = useMemo(
    () => sortItems(rekapData, rekapSort),
    [rekapData, rekapSort],
  );
  const sortedSla = useMemo(
    () => sortItems(slaData, slaSort),
    [slaData, slaSort],
  );
  const sortedTickets = useMemo(
    () => sortItems(ticketsData, ticketsSort),
    [ticketsData, ticketsSort],
  );

  const exportToExcel = () => {
    if (
      rekapData.length === 0 &&
      slaData.length === 0 &&
      ticketsData.length === 0
    ) {
      showToast(
        "warning",
        "Tidak ada data untuk diekspor. Silakan tekan 'Tampilkan' terlebih dahulu.",
      );
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Sheet Rekap
    if (rekapData.length > 0) {
      const rekapExport = sortedRekap.map((item) => ({
        "Nama Kurir": item.name,
        Antar: item.antar,
        Jemput: item.jemput,
        "Meet %": item.meet_pct,
        "Failed %": item.failed_pct,
        Total: item.total,
      }));
      const wsRekap = XLSX.utils.json_to_sheet(rekapExport);
      XLSX.utils.book_append_sheet(wb, wsRekap, "Rekap Kurir");
    }

    // 2. Sheet SLA (Split Columns)
    if (slaData.length > 0) {
      const slaExport = sortedSla.map((item) => ({
        Tiket: item.nomor_tiket,
        "Tgl Tiket": formatDate(item.tanggal_tiket),
        "Waktu Penjemputan": formatDate(item.waktu_penjemputan),
        Nota: item.nomor_nota,
        "Tgl Assign": formatDate(item.tanggal_assign),
        "Tgl Kurir Selesai": formatDate(item.tanggal_diselesaikan_kurir),
        "SLA Tiket (Menit)": item.sla_tiket_durasi,
        "Status SLA Tiket": item.sla_tiket_status,
        "SLA Kurir (Menit)": item.sla_kurir_durasi,
        "Status SLA Kurir": item.sla_kurir_status,
        "Tgl Input Nota": formatDate(item.tanggal_input_nota),
        "SLA Nota (Menit)": item.sla_nota_durasi,
        "Status SLA Nota": item.sla_nota_status,
        "Dibuat Oleh": item.dibuat_oleh,
      }));
      const wsSla = XLSX.utils.json_to_sheet(slaExport);
      XLSX.utils.book_append_sheet(wb, wsSla, "Laporan SLA");
    }

    // 3. Sheet Tiket
    if (ticketsData.length > 0) {
      const ticketsExport = sortedTickets.map((item) => ({
        Tiket: item.nomor_tiket,
        Jenis: item.jenis_tugas,
        "Tgl Order": formatDate(item.waktu_order),
        Status: item.status_ref?.nama_status || "-",
        Pelanggan: item.customers?.nama_terakhir || "-",
        Alamat: item.alamat_jalan || "-",
        Kurir: item.auth_users?.full_name || "-",
        Nota: item.nomor_nota || "-",
        "Dibuat Oleh": item.created_by_user?.full_name || "Customer",
      }));
      const wsTickets = XLSX.utils.json_to_sheet(ticketsExport);
      XLSX.utils.book_append_sheet(wb, wsTickets, "Daftar Tiket");
    }

    XLSX.writeFile(wb, `Laporan_Washlap_${startDate}_ke_${endDate}.xlsx`);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === "-") return "-";
    // Menggunakan timeZone: "UTC" untuk menampilkan data apa adanya sesuai yang di database (+00)
    return new Date(dateStr).toLocaleString("id-ID", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
      timeZone: "UTC",
    });
  };

  const renderSLAChip = (status: string, duration: string) => {
    if (status === "-") return <span className="text-gray-400">-</span>;

    const isMeet = status === "MEET";
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium">{duration}</span>
        <Chip
          className="capitalize border-none gap-1 h-6"
          color={isMeet ? "success" : "danger"}
          size="sm"
          variant="flat"
          startContent={
            isMeet ? <CheckCircle2 size={12} /> : <XCircle size={12} />
          }
        >
          {status}
        </Chip>
      </div>
    );
  };

  // UI components for each tab
  const renderTableContent = () => {
    const currentLoading =
      activeTab === "rekap"
        ? isRekapLoading
        : activeTab === "sla"
          ? isSlaLoading
          : isTicketsLoading;

    if (currentLoading) {
      return (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label={`Memuat data ${activeTab}...`} />
        </div>
      );
    }

    if (activeTab === "rekap") {
      return (
        <>
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 rounded text-sm text-blue-700 dark:text-blue-300">
            Rekap transaksi berdasarkan tanggal tap sudah antar/jemput oleh
            kurir
          </div>
          <Table
            aria-label="Laporan Rekap"
            sortDescriptor={rekapSort}
            onSortChange={setRekapSort}
          >
            <TableHeader>
              <TableColumn key="name" allowsSorting>
                NAMA KURIR
              </TableColumn>
              <TableColumn key="antar" allowsSorting>
                ANTAR
              </TableColumn>
              <TableColumn key="jemput" allowsSorting>
                JEMPUT
              </TableColumn>
              <TableColumn key="meet_pct" allowsSorting>
                MEET %
              </TableColumn>
              <TableColumn key="failed_pct" allowsSorting>
                FAILED %
              </TableColumn>
              <TableColumn key="total" allowsSorting>
                TOTAL
              </TableColumn>
            </TableHeader>
            <TableBody emptyContent="Tidak ada data. Tekan 'Tampilkan' untuk memuat.">
              {sortedRekap.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell>{item.antar}</TableCell>
                  <TableCell>{item.jemput}</TableCell>
                  <TableCell>
                    <Chip color="success" variant="flat" size="sm">
                      {item.meet_pct}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <Chip color="danger" variant="flat" size="sm">
                      {item.failed_pct}
                    </Chip>
                  </TableCell>
                  <TableCell className="font-bold">{item.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      );
    }

    if (activeTab === "sla") {
      return (
        <Table
          aria-label="Laporan SLA"
          sortDescriptor={slaSort}
          onSortChange={setSlaSort}
        >
          <TableHeader>
            <TableColumn key="nomor_tiket" allowsSorting>
              TIKET
            </TableColumn>
            <TableColumn key="tanggal_tiket" allowsSorting>
              TGL TIKET
            </TableColumn>
            <TableColumn key="waktu_penjemputan" allowsSorting>
              WAKTU PENJEMPUTAN
            </TableColumn>
            <TableColumn key="nomor_nota" allowsSorting>
              NOTA
            </TableColumn>
            <TableColumn key="tanggal_assign" allowsSorting>
              TGL ASSIGN
            </TableColumn>
            <TableColumn key="tanggal_diselesaikan_kurir" allowsSorting>
              TGL KURIR SELESAI
            </TableColumn>
            <TableColumn key="sla_tiket" allowsSorting>
              SLA TIKET (REQ-SELESAI)
            </TableColumn>
            <TableColumn key="sla_kurir" allowsSorting>
              SLA KURIR (ASSIGN-SELESAI)
            </TableColumn>
            <TableColumn key="tanggal_input_nota" allowsSorting>
              TGL INPUT NOTA
            </TableColumn>
            <TableColumn key="sla_nota" allowsSorting>
              SLA NOTA
            </TableColumn>
            <TableColumn key="dibuat_oleh" allowsSorting>
              DIBUAT OLEH
            </TableColumn>
          </TableHeader>
          <TableBody emptyContent="Tidak ada data. Tekan 'Tampilkan' untuk memuat.">
            {sortedSla.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell>{item.nomor_tiket}</TableCell>
                <TableCell>{formatDate(item.tanggal_tiket)}</TableCell>
                <TableCell>{formatDate(item.waktu_penjemputan)}</TableCell>
                <TableCell>{item.nomor_nota}</TableCell>
                <TableCell>{formatDate(item.tanggal_assign)}</TableCell>
                <TableCell>
                  {formatDate(item.tanggal_diselesaikan_kurir)}
                </TableCell>
                <TableCell>
                  {renderSLAChip(item.sla_tiket_status, item.sla_tiket_durasi)}
                </TableCell>
                <TableCell>
                  {renderSLAChip(item.sla_kurir_status, item.sla_kurir_durasi)}
                </TableCell>
                <TableCell>{formatDate(item.tanggal_input_nota)}</TableCell>
                <TableCell>
                  {renderSLAChip(item.sla_nota_status, item.sla_nota_durasi)}
                </TableCell>
                <TableCell>{item.dibuat_oleh}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      );
    }

    // Tickets Detail
    return (
      <Table
        aria-label="Laporan Menu"
        sortDescriptor={ticketsSort}
        onSortChange={setTicketsSort}
      >
        <TableHeader>
          <TableColumn key="nomor_tiket" allowsSorting>
            TIKET
          </TableColumn>
          <TableColumn key="jenis_tugas" allowsSorting>
            JENIS
          </TableColumn>
          <TableColumn key="waktu_order" allowsSorting>
            TGL ORDER
          </TableColumn>
          <TableColumn key="status" allowsSorting>
            STATUS
          </TableColumn>
          <TableColumn key="pelanggan" allowsSorting>
            PELANGGAN
          </TableColumn>
          <TableColumn key="alamat_jalan" allowsSorting>
            ALAMAT
          </TableColumn>
          <TableColumn key="kurir" allowsSorting>
            KURIR
          </TableColumn>
          <TableColumn key="nomor_nota" allowsSorting>
            NOTA
          </TableColumn>
          <TableColumn key="created_by" allowsSorting>
            DIBUAT OLEH
          </TableColumn>
        </TableHeader>
        <TableBody emptyContent="Tidak ada data. Tekan 'Tampilkan' untuk memuat.">
          {sortedTickets.map((item, idx) => (
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
              <TableCell>
                {item.created_by_user?.full_name || "Customer"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  const isAnyLoading = isRekapLoading || isSlaLoading || isTicketsLoading;
  const currentTabHasData =
    (activeTab === "rekap"
      ? sortedRekap
      : activeTab === "sla"
        ? sortedSla
        : sortedTickets
    ).length > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet /> Laporan Admin
          </h1>
          <p className="text-gray-500">
            Rekapitulasi data dan kinerja operasional
          </p>
        </div>

        <Button
          className="w-full sm:w-auto"
          color="success"
          isDisabled={!currentTabHasData}
          startContent={<FileSpreadsheet size={18} />}
          onPress={exportToExcel}
        >
          Export Excel
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 mb-6 bg-gray-50 dark:bg-zinc-900/50 rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full md:w-auto">
          <span className="text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
            Filter Tanggal:
          </span>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="w-full sm:w-40"
              size="sm"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <span className="text-gray-400">-</span>
            <Input
              type="date"
              className="w-full sm:w-40"
              size="sm"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="hidden md:block w-px h-6 bg-gray-300 dark:bg-gray-700" />

        <Button
          className="w-full md:w-auto"
          color="primary"
          isLoading={isAnyLoading}
          size="sm"
          variant="flat"
          onPress={handleLoadAll}
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
            <Tab
              key="rekap"
              title={
                <div className="flex items-center gap-2">
                  <span>Rekap Kurir</span>
                  {isRekapLoading && <Spinner size="sm" />}
                </div>
              }
            />
            <Tab
              key="sla"
              title={
                <div className="flex items-center gap-2">
                  <span>Laporan SLA</span>
                  {isSlaLoading && <Spinner size="sm" />}
                </div>
              }
            />
            <Tab
              key="tickets"
              title={
                <div className="flex items-center gap-2">
                  <span>Detail Tiket</span>
                  {isTicketsLoading && <Spinner size="sm" />}
                </div>
              }
            />
          </Tabs>

          <div className="mt-4 overflow-x-auto">{renderTableContent()}</div>
        </CardBody>
      </Card>
    </div>
  );
}
