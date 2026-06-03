import type { NotaImportInfo } from "./nota-import";

export interface ReportTimeline {
  transaksi_created_at: string | null;
  admin_nota_input_at: string | null;
  tiket_created_at: string | null;
  tiket_assigned_at: string | null;
  tiket_reassigned_at: string | null;
  kurir_completed_at: string | null;
  kurir_cancelled_at: string | null;
  imported_nota_created_at: string | null;
  jemput_nota_input_at: string | null;
  antar_ticket_completed_at: string | null;
}

interface TimelineOrder {
  id: string;
  jenis_tugas?: string | null;
  waktu_order?: string | null;
  waktu_assigned?: string | null;
  waktu_kurir_selesai?: string | null;
  waktu_selesai?: string | null;
  waktu_input_nota?: string | null;
  nota_import?: NotaImportInfo | null;
}

export interface TimelineStatusLog {
  permintaan_id: string;
  status_id_baru: number;
  created_at: string;
  auth_users?: {
    role?: string | null;
  } | null;
}

function sortedLogsForOrder(
  orderId: string,
  logs: TimelineStatusLog[],
): TimelineStatusLog[] {
  return logs
    .filter((log) => log.permintaan_id === orderId)
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
}

function latestLogTime(
  logs: TimelineStatusLog[],
  statusId: number,
): string | null {
  const log = logs.filter((item) => item.status_id_baru === statusId).at(-1);

  return log?.created_at || null;
}

function firstLogTime(
  logs: TimelineStatusLog[],
  statusId: number,
): string | null {
  return (
    logs.find((item) => item.status_id_baru === statusId)?.created_at || null
  );
}

export function buildReportTimeline(
  order: TimelineOrder,
  logs: TimelineStatusLog[] = [],
): ReportTimeline {
  const orderLogs = sortedLogsForOrder(order.id, logs);
  const assignmentLogs = orderLogs.filter((log) => log.status_id_baru === 2);
  const statusSixTime =
    latestLogTime(orderLogs, 6) || order.waktu_selesai || null;
  const importedNotaCreatedAt = order.nota_import?.tanggal_terima || null;
  const jenisTugas = order.jenis_tugas?.toUpperCase();
  const kurirCancelLog = orderLogs
    .filter(
      (log) =>
        log.status_id_baru === 7 &&
        log.auth_users?.role?.toLowerCase() === "kurir",
    )
    .at(-1);

  return {
    transaksi_created_at: importedNotaCreatedAt,
    admin_nota_input_at: order.waktu_input_nota || null,
    tiket_created_at: order.waktu_order || firstLogTime(orderLogs, 1),
    tiket_assigned_at:
      assignmentLogs[0]?.created_at || order.waktu_assigned || null,
    tiket_reassigned_at:
      assignmentLogs.length > 1 ? assignmentLogs.at(-1)!.created_at : null,
    kurir_completed_at:
      latestLogTime(orderLogs, 3) ||
      latestLogTime(orderLogs, 5) ||
      order.waktu_kurir_selesai ||
      null,
    kurir_cancelled_at: kurirCancelLog?.created_at || null,
    imported_nota_created_at: importedNotaCreatedAt,
    jemput_nota_input_at: jenisTugas === "JEMPUT" ? statusSixTime : null,
    antar_ticket_completed_at: jenisTugas === "ANTAR" ? statusSixTime : null,
  };
}
