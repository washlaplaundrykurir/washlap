import { ReportsClient } from "@/components/admin/reports/ReportsClient";

export default function ReportSlaNotaJemputPage() {
  return (
    <ReportsClient
      availableTabs={["sla_nota_jemput"]}
      initialTab="sla_nota_jemput"
      subtitle="Laporan performa waktu input nota untuk tiket penjemputan"
      title="Laporan SLA Nota Jemput"
    />
  );
}
