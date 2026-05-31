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
import {
  FileSpreadsheet,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import * as XLSX from "xlsx";

import { useToast } from "@/components/ToastProvider";
import { WIB_TIME_ZONE } from "@/lib/datetime";

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState("rekap");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Data states
  const [rekapData, setRekapData] = useState<any[]>([]);
  const [slaData, setSlaData] = useState<any[]>([]);
  const [ticketsData, setTicketsData] = useState<any[]>([]);
  const [logsData, setLogsData] = useState<any[]>([]);

  // Loading states
  const [isRekapLoading, setIsRekapLoading] = useState(false);
  const [isSlaLoading, setIsSlaLoading] = useState(false);
  const [isTicketsLoading, setIsTicketsLoading] = useState(false);
  const [isLogsLoading, setIsLogsLoading] = useState(false);

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

  const [logsSort, setLogsSort] = useState<SortDescriptor>({
    column: "waktu",
    direction: "descending",
  });

  const { showToast } = useToast();

  // Set default dates
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now);
    firstDay.setDate(now.getDate() - 7);

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

    fetchTab("rekap", setRekapData, setIsRekapLoading);
    fetchTab("sla", setSlaData, setIsSlaLoading);
    fetchTab("tickets", setTicketsData, setIsTicketsLoading);
    fetchTab("logs", setLogsData, setIsLogsLoading);
  };

  const sortItems = (items: any[], sortDescriptor: SortDescriptor) => {
    return [...items].sort((a, b) => {
      let first = a[sortDescriptor.column as keyof any];
      let second = b[sortDescriptor.column as keyof any];

      // Nested logic for specific columns
      if (sortDescriptor.column === "status") {
        first = a.status_ref?.nama_status;
        second = b.status_ref?.nama_status;
      } else if (sortDescriptor.column === "pelanggan") {
        first = a.customers?.nama_terakhir;
        second = b.customers?.nama_terakhir;
      } else if (sortDescriptor.column === "kurir") {
        first = a.auth_users?.full_name;
        second = b.auth_users?.full_name;
      }

      // Percentage/Number logic
      if (
        sortDescriptor.column === "meet_pct" ||
        sortDescriptor.column === "failed_pct"
      ) {
        first = parseInt(first) || 0;
        second = parseInt(second) || 0;
      }

      if (sortDescriptor.column === "sla_tiket") {
        first = a.raw_sla_tiket;
        second = b.raw_sla_tiket;
      }
      if (sortDescriptor.column === "sla_kurir") {
        first = a.raw_sla_kurir;
        second = b.raw_sla_kurir;
      }
      if (sortDescriptor.column === "sla_nota") {
        first = a.raw_sla_nota;
        second = b.raw_sla_nota;
      }

      const cmp = first < second ? -1 : first > second ? 1 : 0;
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
  const sortedLogs = useMemo(
    () => sortItems(logsData, logsSort),
    [logsData, logsSort],
  );

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Rekap Sheet
    const rekapExport = sortedRekap.map((item) => ({
      "Nama Kurir": item.name,
      Antar: item.antar,
      Jemput: item.jemput,
      "Meet %": item.meet_pct,
      "Failed %": item.failed_pct,
      Total: item.total,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rekapExport),
      "Rekap Performa",
    );

    // 2. SLA Sheet
    const slaExport = sortedSla.map((item) => ({
      Tiket: item.nomor_tiket,
      "Tgl Tiket": formatDate(item.tanggal_tiket),
      "Waktu Penjemputan": formatDate(item.waktu_penjemputan),
      Nota: item.nomor_nota,
      "Tgl Assign": formatDate(item.tanggal_assign),
      "Tgl Kurir Selesai": formatDate(item.tanggal_diselesaikan_kurir),
      "SLA Tiket (Durasi)": item.sla_tiket_durasi,
      "Status SLA Tiket": item.sla_tiket_status,
      "SLA Kurir (Durasi)": item.sla_kurir_durasi,
      "Status SLA Kurir": item.sla_kurir_status,
      "Tgl Input Nota": formatDate(item.tanggal_input_nota),
      "SLA Nota (Durasi)": item.sla_nota_durasi,
      "Status SLA Nota": item.sla_nota_status,
      "Dibuat Oleh": item.dibuat_oleh,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(slaExport),
      "Laporan SLA",
    );

    // 3. Tickets Sheet
    const ticketsExport = sortedTickets.map((item) => ({
      Tiket: item.nomor_tiket,
      Jenis: item.jenis_tugas,
      "Tgl Order": formatDate(item.waktu_order),
      Status: item.status_ref?.nama_status,
      Pelanggan: item.customers?.nama_terakhir,
      Kurir: item.auth_users?.full_name || "-",
      Nota: item.nomor_nota || "-",
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(ticketsExport),
      "Daftar Tiket",
    );

    // 4. Logs Sheet
    const logsExport = sortedLogs.map((log) => ({
      Waktu: formatDate(log.waktu),
      Tiket: log.tiket,
      Nota: log.nota,
      Status: log.status,
      Oleh: log.oleh,
    }));
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(logsExport),
      "Log Aktivitas",
    );

    XLSX.writeFile(wb, `Laporan_Washlap_${startDate}_ke_${endDate}.xlsx`);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr || dateStr === "-") return "-";
    try {
      return new Date(dateStr).toLocaleString("id-ID", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: WIB_TIME_ZONE,
      });
    } catch {
      return dateStr;
    }
  };

  const renderSLAChip = (status: string, duration: string) => {
    if (status === "-" || !status)
      return <span className="text-gray-400">-</span>;

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

  const renderTableContent = () => {
    const currentLoading =
      activeTab === "rekap"
        ? isRekapLoading
        : activeTab === "sla"
          ? isSlaLoading
          : activeTab === "tickets"
            ? isTicketsLoading
            : isLogsLoading;

    if (currentLoading) {
      return (
        <div className="flex justify-center py-20">
          <Spinner size="lg" label="Memuat data..." />
        </div>
      );
    }

    if (activeTab === "rekap") {
      return (
        <Table
          aria-label="Tabel Rekap"
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
          <TableBody items={sortedRekap} emptyContent="Tidak ada data.">
            {(item) => (
              <TableRow key={item.name}>
                <TableCell className="font-medium text-blue-600">
                  {item.name}
                </TableCell>
                <TableCell>{item.antar}</TableCell>
                <TableCell>{item.jemput}</TableCell>
                <TableCell>
                  <Chip size="sm" color="success" variant="flat">
                    {item.meet_pct}
                  </Chip>
                </TableCell>
                <TableCell>
                  <Chip size="sm" color="danger" variant="flat">
                    {item.failed_pct}
                  </Chip>
                </TableCell>
                <TableCell className="font-bold">{item.total}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      );
    }

    if (activeTab === "sla") {
      return (
        <Table
          aria-label="Tabel SLA"
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
          <TableBody items={sortedSla} emptyContent="Tidak ada data.">
            {(item) => (
              <TableRow key={item.nomor_tiket}>
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
            )}
          </TableBody>
        </Table>
      );
    }

    if (activeTab === "tickets") {
      return (
        <Table
          aria-label="Tabel Tiket"
          sortDescriptor={ticketsSort}
          onSortChange={setTicketsSort}
        >
          <TableHeader>
            <TableColumn key="nomor_tiket" allowsSorting>
              TIKET
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
            <TableColumn key="kurir" allowsSorting>
              KURIR
            </TableColumn>
            <TableColumn key="nomor_nota">NOTA</TableColumn>
          </TableHeader>
          <TableBody items={sortedTickets} emptyContent="Tidak ada data.">
            {(item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono">{item.nomor_tiket}</TableCell>
                <TableCell>{formatDate(item.waktu_order)}</TableCell>
                <TableCell>{item.status_ref?.nama_status}</TableCell>
                <TableCell>{item.customers?.nama_terakhir}</TableCell>
                <TableCell>{item.auth_users?.full_name || "-"}</TableCell>
                <TableCell>{item.nomor_nota || "-"}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      );
    }

    return (
      <Table
        aria-label="Tabel Log"
        sortDescriptor={logsSort}
        onSortChange={setLogsSort}
      >
        <TableHeader>
          <TableColumn key="waktu" allowsSorting>
            WAKTU
          </TableColumn>
          <TableColumn key="tiket" allowsSorting>
            TIKET
          </TableColumn>
          <TableColumn key="nota" allowsSorting>
            NOTA
          </TableColumn>
          <TableColumn key="status" allowsSorting>
            STATUS
          </TableColumn>
          <TableColumn key="oleh" allowsSorting>
            OLEH
          </TableColumn>
        </TableHeader>
        <TableBody items={sortedLogs} emptyContent="Tidak ada data.">
          {(item) => (
            <TableRow key={item.id}>
              <TableCell>{formatDate(item.waktu)}</TableCell>
              <TableCell className="font-mono font-medium">
                {item.tiket}
              </TableCell>
              <TableCell className="font-mono">{item.nota}</TableCell>
              <TableCell>
                <Chip size="sm" variant="flat" color="primary">
                  {item.status}
                </Chip>
              </TableCell>
              <TableCell>{item.oleh}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    );
  };

  const isAnyLoading =
    isRekapLoading || isSlaLoading || isTicketsLoading || isLogsLoading;
  const currentTabHasData =
    (activeTab === "rekap"
      ? rekapData
      : activeTab === "sla"
        ? slaData
        : activeTab === "tickets"
          ? ticketsData
          : logsData
    ).length > 0;

  const activeTabDescription =
    activeTab === "rekap"
      ? "Rekap transaksi berdasarkan tanggal tapi sudah antar/jemput oleh kurir."
      : activeTab === "sla"
        ? "Laporan SLA berdasarkan durasi proses tiket (request-selesai), durasi kurir (assign-selesai), dan durasi input nota."
        : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet /> Laporan Admin
          </h1>
          <p className="text-gray-500 text-sm">
            Rekapitulasi operasional dan log aktivitas
          </p>
        </div>
        <Button
          color="success"
          isDisabled={!currentTabHasData}
          startContent={<FileSpreadsheet size={18} />}
          onPress={exportToExcel}
        >
          Export Excel
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-xl border border-gray-200">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
          Filter Tanggal
        </p>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            size="sm"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-gray-400">-</span>
          <Input
            type="date"
            size="sm"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button
          color="primary"
          isLoading={isAnyLoading}
          size="sm"
          variant="flat"
          onPress={handleLoadAll}
          startContent={<Search size={14} />}
        >
          Tampilkan
        </Button>
      </div>

      <Card>
        <CardBody className="p-4">
          <Tabs
            aria-label="Tipe Laporan"
            color="primary"
            selectedKey={activeTab}
            variant="underlined"
            onSelectionChange={(k) => setActiveTab(k as string)}
          >
            <Tab key="rekap" title="Rekap Performa" />
            <Tab key="sla" title="Laporan SLA" />
            <Tab key="tickets" title="Daftar Tiket" />
            <Tab
              key="logs"
              title={
                <div className="flex items-center gap-2">
                  <Clock size={16} /> Log Aktivitas
                </div>
              }
            />
          </Tabs>
          {activeTabDescription && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {activeTabDescription}
            </p>
          )}
          <div className="mt-4 overflow-x-auto">{renderTableContent()}</div>
        </CardBody>
      </Card>
    </div>
  );
}
