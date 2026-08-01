"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  Upload,
} from "lucide-react";
import * as XLSX from "xlsx";

import { useToast } from "@/components/ToastProvider";
import { WIB_TIME_ZONE } from "@/lib/datetime";

type ReportTabKey = "rekap" | "sla" | "sla_nota_jemput" | "tickets" | "logs";

interface ReportsClientProps {
  initialTab?: ReportTabKey;
  availableTabs?: ReportTabKey[];
  title?: string;
  subtitle?: string;
}

const tabLabels: Record<ReportTabKey, string> = {
  rekap: "Rekap Performa",
  sla: "Laporan SLA",
  sla_nota_jemput: "SLA Nota Jemput",
  tickets: "Daftar Tiket",
  logs: "Log Aktivitas",
};

export function ReportsClient({
  initialTab = "rekap",
  availableTabs = ["rekap", "sla"],
  title = "Laporan Admin",
  subtitle = "Rekapitulasi operasional dan log aktivitas",
}: ReportsClientProps) {
  const [activeTab, setActiveTab] = useState<ReportTabKey>(initialTab);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Data states
  const [rekapData, setRekapData] = useState<any[]>([]);
  const [slaData, setSlaData] = useState<any[]>([]);
  const [slaNotaJemputData, setSlaNotaJemputData] = useState<any[]>([]);
  const [slaNotaJemputSummary, setSlaNotaJemputSummary] = useState<{
    totalJemput: number;
    countNoNota: number;
    countMeet: number;
    countFailed: number;
    meetPct: string;
  } | null>(null);
  const [ticketsData, setTicketsData] = useState<any[]>([]);
  const [logsData, setLogsData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string>("");

  // Loading states
  const [isRekapLoading, setIsRekapLoading] = useState(false);
  const [isSlaLoading, setIsSlaLoading] = useState(false);
  const [isSlaNotaJemputLoading, setIsSlaNotaJemputLoading] = useState(false);
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
  const [slaNotaJemputSort, setSlaNotaJemputSort] = useState<SortDescriptor>({
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
    setSummary?: (s: any) => void,
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
        if (setSummary && result.summary) {
          setSummary(result.summary);
        }
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

    if (availableTabs.includes("rekap")) {
      fetchTab("rekap", setRekapData, setIsRekapLoading);
    }
    if (availableTabs.includes("sla")) {
      fetchTab("sla", setSlaData, setIsSlaLoading);
    }
    if (availableTabs.includes("sla_nota_jemput")) {
      fetchTab(
        "sla_nota_jemput",
        setSlaNotaJemputData,
        setIsSlaNotaJemputLoading,
        setSlaNotaJemputSummary,
      );
    }
    if (availableTabs.includes("tickets")) {
      fetchTab("tickets", setTicketsData, setIsTicketsLoading);
    }
    if (availableTabs.includes("logs")) {
      fetchTab("logs", setLogsData, setIsLogsLoading);
    }
  };

  const handleImportFile = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    const formData = new FormData();

    formData.set("file", file);
    setIsImporting(true);
    setImportSummary("");

    try {
      const response = await fetch("/api/admin/import-nota", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Gagal import data nota");
      }

      const summary = `${result.uniqueNotas || 0} nota valid: ${result.inserted || 0} baru, ${result.updated || 0} diperbarui`;

      setImportSummary(summary);
      showToast("success", summary);

      if (currentTabHasData) {
        handleLoadAll();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal import data nota";

      showToast("error", message);
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
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
      } else if (sortDescriptor.column === "nota_import_status") {
        const rank = (notaImport: any) => {
          if (notaImport?.matched) return 2;
          if (notaImport?.match_reason === "phone_mismatch") return 1;

          return 0;
        };

        first = rank(a.nota_import);
        second = rank(b.nota_import);
      } else if (sortDescriptor.column === "tanggal_create_nota") {
        first = a.nota_import?.tanggal_terima
          ? new Date(a.nota_import.tanggal_terima).getTime()
          : 0;
        second = b.nota_import?.tanggal_terima
          ? new Date(b.nota_import.tanggal_terima).getTime()
          : 0;
      } else if (sortDescriptor.column === "tanggal_selesai_nota") {
        first = a.nota_import?.tanggal_selesai
          ? new Date(a.nota_import.tanggal_selesai).getTime()
          : 0;
        second = b.nota_import?.tanggal_selesai
          ? new Date(b.nota_import.tanggal_selesai).getTime()
          : 0;
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
  const sortedSlaNotaJemput = useMemo(
    () => sortItems(slaNotaJemputData, slaNotaJemputSort),
    [slaNotaJemputData, slaNotaJemputSort],
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

    if (availableTabs.includes("rekap")) {
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
    }

    if (availableTabs.includes("sla")) {
      const slaExport = sortedSla.map((item) => ({
        Tiket: item.nomor_tiket,
        "Nama Kurir": item.nama_kurir || "-",
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
        "Tgl Selesai Nota": formatDate(item.tanggal_selesai_nota),
        "Validasi Nota": formatNotaImportStatus(item.nota_import),
        "SLA Nota (Durasi)": item.sla_nota_durasi,
        "Status SLA Nota": item.sla_nota_status,
        "Dibuat Oleh": item.dibuat_oleh,
      }));

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(slaExport),
        "Laporan SLA",
      );
    }

    if (availableTabs.includes("sla_nota_jemput")) {
      const slaJemputExport = sortedSlaNotaJemput.map((item) => ({
        "Nomor Tiket": item.nomor_tiket,
        "Nama Kurir": item.nama_kurir || "-",
        "Nama Cust": item.nama_cust,
        "Nomor HP": item.nomor_hp,
        "Tgl Tiket": formatDate(item.tanggal_tiket),
        Week: item.week,
        "Tgl Kurir Selesai": formatDate(item.waktu_kurir_selesai),
        "Nomor Nota": item.nomor_nota,
        "Tgl Input Nota": formatDate(item.tanggal_input_nota),
        "Selisih Input (Durasi)": item.selisih_input_durasi,
        "Status SLA Input": item.sla_input_status,
        "Nota Uploaded": item.has_uploaded_nota,
        "Tgl Nota Upload": formatDate(item.tanggal_nota_upload),
        "Selisih Upload (Durasi)": item.selisih_upload_durasi,
      }));

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(slaJemputExport),
        "SLA Nota Jemput",
      );
    }

    if (availableTabs.includes("tickets")) {
      const ticketsExport = sortedTickets.map((item) => ({
        Tiket: item.nomor_tiket,
        Jenis: item.jenis_tugas,
        "Tgl Order": formatDate(item.waktu_order),
        Status: item.status_ref?.nama_status,
        Pelanggan: item.customers?.nama_terakhir,
        Kurir: item.auth_users?.full_name || "-",
        Nota: item.nomor_nota || "-",
        "Tgl Create Nota": formatDate(item.nota_import?.tanggal_terima),
        "Tgl Selesai Nota": formatDate(item.nota_import?.tanggal_selesai),
        "Validasi Nota": formatNotaImportStatus(item.nota_import),
      }));

      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(ticketsExport),
        "Daftar Tiket",
      );
    }

    if (availableTabs.includes("logs")) {
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
    }

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
          startContent={
            isMeet ? <CheckCircle2 size={12} /> : <XCircle size={12} />
          }
          variant="flat"
        >
          {status}
        </Chip>
      </div>
    );
  };

  const formatNotaImportStatus = (notaImport: any) => {
    if (notaImport?.matched) return "Cocok";
    if (notaImport?.match_reason === "phone_mismatch") return "HP beda";
    if (notaImport?.match_reason === "phone_missing") return "HP kosong";

    return "Belum cocok";
  };

  const renderNotaImportChip = (notaImport: any) => {
    const matched = notaImport?.matched === true;
    const isPhoneMismatch = notaImport?.match_reason === "phone_mismatch";
    const isPhoneMissing = notaImport?.match_reason === "phone_missing";

    return (
      <Chip
        color={matched ? "success" : isPhoneMismatch ? "danger" : "warning"}
        size="sm"
        variant="flat"
      >
        {matched
          ? "Cocok"
          : isPhoneMismatch
            ? "HP beda"
            : isPhoneMissing
              ? "HP kosong"
              : "Belum cocok"}
      </Chip>
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
          <Spinner label="Memuat data..." size="lg" />
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
          <TableBody emptyContent="Tidak ada data." items={sortedRekap}>
            {(item) => (
              <TableRow key={item.name}>
                <TableCell className="font-medium text-blue-600">
                  {item.name}
                </TableCell>
                <TableCell>{item.antar}</TableCell>
                <TableCell>{item.jemput}</TableCell>
                <TableCell>
                  <Chip color="success" size="sm" variant="flat">
                    {item.meet_pct}
                  </Chip>
                </TableCell>
                <TableCell>
                  <Chip color="danger" size="sm" variant="flat">
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
            <TableColumn key="nama_kurir" allowsSorting>
              NAMA KURIR
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
            <TableColumn key="nota_import_status" allowsSorting>
              VALIDASI NOTA
            </TableColumn>
            <TableColumn key="tanggal_create_nota" allowsSorting>
              TGL CREATE NOTA
            </TableColumn>
            <TableColumn key="tanggal_selesai_nota" allowsSorting>
              TGL SELESAI NOTA
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
          <TableBody emptyContent="Tidak ada data." items={sortedSla}>
            {(item) => (
              <TableRow key={item.nomor_tiket}>
                <TableCell>{item.nomor_tiket}</TableCell>
                <TableCell className="font-medium text-blue-600">
                  {item.nama_kurir || "-"}
                </TableCell>
                <TableCell>{formatDate(item.tanggal_tiket)}</TableCell>
                <TableCell>{formatDate(item.waktu_penjemputan)}</TableCell>
                <TableCell>{item.nomor_nota}</TableCell>
                <TableCell>{renderNotaImportChip(item.nota_import)}</TableCell>
                <TableCell>
                  {formatDate(item.nota_import?.tanggal_terima)}
                </TableCell>
                <TableCell>{formatDate(item.tanggal_selesai_nota)}</TableCell>
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
            <TableColumn key="nota_import_status" allowsSorting>
              VALIDASI NOTA
            </TableColumn>
            <TableColumn key="tanggal_create_nota" allowsSorting>
              TGL CREATE NOTA
            </TableColumn>
            <TableColumn key="tanggal_selesai_nota" allowsSorting>
              TGL SELESAI NOTA
            </TableColumn>
          </TableHeader>
          <TableBody emptyContent="Tidak ada data." items={sortedTickets}>
            {(item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono">{item.nomor_tiket}</TableCell>
                <TableCell>{formatDate(item.waktu_order)}</TableCell>
                <TableCell>{item.status_ref?.nama_status}</TableCell>
                <TableCell>{item.customers?.nama_terakhir}</TableCell>
                <TableCell>{item.auth_users?.full_name || "-"}</TableCell>
                <TableCell>{item.nomor_nota || "-"}</TableCell>
                <TableCell>{renderNotaImportChip(item.nota_import)}</TableCell>
                <TableCell>
                  {formatDate(item.nota_import?.tanggal_terima)}
                </TableCell>
                <TableCell>
                  {formatDate(item.nota_import?.tanggal_selesai)}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      );
    }

    if (activeTab === "sla_nota_jemput") {
      return (
        <div className="space-y-4">
          {slaNotaJemputSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4">
              <Card className="bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800">
                <CardBody className="p-3 text-center">
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Total Tiket Jemput
                  </p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                    {slaNotaJemputSummary.totalJemput}
                  </p>
                </CardBody>
              </Card>
              <Card className="bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800">
                <CardBody className="p-3 text-center">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    Tidak Ada Nota
                  </p>
                  <p className="text-xl font-bold text-amber-700 dark:text-amber-300">
                    {slaNotaJemputSummary.countNoNota}
                  </p>
                </CardBody>
              </Card>
              <Card className="bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800">
                <CardBody className="p-3 text-center">
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Input Nota &le; 2 Jam (MEET)
                  </p>
                  <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    {slaNotaJemputSummary.countMeet}
                  </p>
                </CardBody>
              </Card>
              <Card className="bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800">
                <CardBody className="p-3 text-center">
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                    Input Nota &gt; 2 Jam (FAILED)
                  </p>
                  <p className="text-xl font-bold text-rose-700 dark:text-rose-300">
                    {slaNotaJemputSummary.countFailed}
                  </p>
                </CardBody>
              </Card>
              <Card className="bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 col-span-2 sm:col-span-1">
                <CardBody className="p-3 text-center">
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                    Persentase MEET
                  </p>
                  <p className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                    {slaNotaJemputSummary.meetPct}
                  </p>
                </CardBody>
              </Card>
            </div>
          )}

          <Table
            aria-label="Tabel SLA Nota Jemput"
            sortDescriptor={slaNotaJemputSort}
            onSortChange={setSlaNotaJemputSort}
          >
            <TableHeader>
              <TableColumn key="nomor_tiket" allowsSorting>
                TIKET
              </TableColumn>
              <TableColumn key="nama_kurir" allowsSorting>
                NAMA KURIR
              </TableColumn>
              <TableColumn key="nama_cust" allowsSorting>
                NAMA CUST
              </TableColumn>
              <TableColumn key="nomor_hp" allowsSorting>
                NOMOR HP
              </TableColumn>
              <TableColumn key="tanggal_tiket" allowsSorting>
                TGL TIKET
              </TableColumn>
              <TableColumn key="week" allowsSorting>
                WEEK
              </TableColumn>
              <TableColumn key="waktu_kurir_selesai" allowsSorting>
                TGL KURIR SELESAI
              </TableColumn>
              <TableColumn key="nomor_nota" allowsSorting>
                NOMOR NOTA
              </TableColumn>
              <TableColumn key="tanggal_input_nota" allowsSorting>
                TGL INPUT NOTA
              </TableColumn>
              <TableColumn key="selisih_input" allowsSorting>
                SELISIH INPUT (MENIT)
              </TableColumn>
              <TableColumn key="sla_input_status" allowsSorting>
                STATUS SLA INPUT
              </TableColumn>
              <TableColumn key="has_uploaded_nota" allowsSorting>
                NOTA UPLOADED
              </TableColumn>
              <TableColumn key="tanggal_nota_upload" allowsSorting>
                TGL NOTA UPLOAD
              </TableColumn>
              <TableColumn key="selisih_upload" allowsSorting>
                SELISIH UPLOAD & KURIR SELESAI
              </TableColumn>
            </TableHeader>
            <TableBody emptyContent="Tidak ada data." items={sortedSlaNotaJemput}>
              {(item) => (
                <TableRow key={item.nomor_tiket}>
                  <TableCell className="font-mono font-medium">
                    {item.nomor_tiket}
                  </TableCell>
                  <TableCell className="font-medium text-blue-600">
                    {item.nama_kurir || "-"}
                  </TableCell>
                  <TableCell>{item.nama_cust}</TableCell>
                  <TableCell>{item.nomor_hp}</TableCell>
                  <TableCell>{formatDate(item.tanggal_tiket)}</TableCell>
                  <TableCell>
                    <Chip color="secondary" size="sm" variant="flat">
                      {item.week}
                    </Chip>
                  </TableCell>
                  <TableCell>{formatDate(item.waktu_kurir_selesai)}</TableCell>
                  <TableCell className="font-mono">{item.nomor_nota}</TableCell>
                  <TableCell>{formatDate(item.tanggal_input_nota)}</TableCell>
                  <TableCell>{item.selisih_input_durasi}</TableCell>
                  <TableCell>
                    {renderSLAChip(
                      item.sla_input_status,
                      item.selisih_input_durasi,
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      color={item.has_uploaded_nota === "Ya" ? "success" : "default"}
                      size="sm"
                      variant="flat"
                    >
                      {item.has_uploaded_nota}
                    </Chip>
                  </TableCell>
                  <TableCell>{formatDate(item.tanggal_nota_upload)}</TableCell>
                  <TableCell>{item.selisih_upload_durasi}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
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
        <TableBody emptyContent="Tidak ada data." items={sortedLogs}>
          {(item) => (
            <TableRow key={item.id}>
              <TableCell>{formatDate(item.waktu)}</TableCell>
              <TableCell className="font-mono font-medium">
                {item.tiket}
              </TableCell>
              <TableCell className="font-mono">{item.nota}</TableCell>
              <TableCell>
                <Chip color="primary" size="sm" variant="flat">
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
    isRekapLoading ||
    isSlaLoading ||
    isSlaNotaJemputLoading ||
    isTicketsLoading ||
    isLogsLoading;
  const currentTabHasData =
    (activeTab === "rekap"
      ? rekapData
      : activeTab === "sla"
        ? slaData
        : activeTab === "sla_nota_jemput"
          ? slaNotaJemputData
          : activeTab === "tickets"
            ? ticketsData
            : logsData
    ).length > 0;

  const activeTabDescription =
    activeTab === "rekap"
      ? "Rekap transaksi berdasarkan tanggal tapi sudah antar/jemput oleh kurir."
      : activeTab === "sla"
        ? "Laporan SLA berdasarkan durasi proses tiket (request-selesai), durasi kurir (assign-selesai), dan durasi input nota."
        : activeTab === "sla_nota_jemput"
          ? "Laporan SLA waktu pencatatan/input nota setelah kurir selesai melakukan penjemputan (SLA <= 2 Jam)."
          : activeTab === "tickets"
            ? "Daftar tiket berdasarkan rentang tanggal order."
            : "Log perubahan status tiket.";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileSpreadsheet /> {title}
          </h1>
          <p className="text-gray-500 text-sm">{subtitle}</p>
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

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-white dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-gray-800">
        <input
          ref={fileInputRef}
          accept=".xlsx"
          className="hidden"
          type="file"
          onChange={handleImportFile}
        />
        <Button
          color="primary"
          isLoading={isImporting}
          startContent={<Upload size={16} />}
          variant="flat"
          onPress={() => fileInputRef.current?.click()}
        >
          Import Data Nota
        </Button>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {importSummary ||
            "Upload file Rekap Data Transaksi Reguler untuk validasi nomor nota."}
        </p>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 bg-gray-50 dark:bg-zinc-900/50 rounded-xl border border-gray-200">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
          Filter Tanggal
        </p>
        <div className="flex items-center gap-2">
          <Input
            size="sm"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <span className="text-gray-400">-</span>
          <Input
            size="sm"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <Button
          color="primary"
          isLoading={isAnyLoading}
          size="sm"
          startContent={<Search size={14} />}
          variant="flat"
          onPress={handleLoadAll}
        >
          Tampilkan
        </Button>
      </div>

      <Card>
        <CardBody className="p-4">
          {availableTabs.length > 1 ? (
            <Tabs
              aria-label="Tipe Laporan"
              color="primary"
              selectedKey={activeTab}
              variant="underlined"
              onSelectionChange={(k) => setActiveTab(k as ReportTabKey)}
            >
              {availableTabs.map((tab) => (
                <Tab
                  key={tab}
                  title={
                    tab === "logs" ? (
                      <div className="flex items-center gap-2">
                        <Clock size={16} /> {tabLabels[tab]}
                      </div>
                    ) : (
                      tabLabels[tab]
                    )
                  }
                />
              ))}
            </Tabs>
          ) : (
            <h2 className="text-base font-semibold">{tabLabels[activeTab]}</h2>
          )}{" "}
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
