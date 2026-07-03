import { ReportsClient } from "@/components/admin/reports/ReportsClient";

export default function ReportsPage() {
  return <ReportsClient availableTabs={["rekap", "sla"]} initialTab="rekap" />;
}
