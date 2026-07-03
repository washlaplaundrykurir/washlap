import { ReportsClient } from "@/components/admin/reports/ReportsClient";

export default function ReportLogsPage() {
  return (
    <ReportsClient
      availableTabs={["logs"]}
      initialTab="logs"
      subtitle="Riwayat perubahan status tiket"
      title="Log Aktivitas"
    />
  );
}
