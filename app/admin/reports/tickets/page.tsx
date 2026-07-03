import { ReportsClient } from "@/components/admin/reports/ReportsClient";

export default function ReportTicketsPage() {
  return (
    <ReportsClient
      availableTabs={["tickets"]}
      initialTab="tickets"
      subtitle="Daftar tiket operasional berdasarkan rentang tanggal order"
      title="Daftar Tiket"
    />
  );
}
