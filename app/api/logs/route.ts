import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/api-auth";
import {
  enrichWithNotaImports,
  type ImportedNotaRecord,
  type NotaImportInfo,
} from "@/lib/nota-import";
import {
  buildReportTimeline,
  type ReportTimeline,
  type TimelineStatusLog,
} from "@/lib/report-timeline";

interface StatusLogRow extends TimelineStatusLog {
  id: string;
  changed_by: string | null;
  auth_users: {
    full_name: string | null;
    email: string | null;
    role?: string | null;
  } | null;
  status_ref: {
    nama_status: string;
  } | null;
}

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  created_at: string;
  actor_name: string | null;
  actor_email: string | null;
  status_name: string | null;
  source: "order" | "status_log" | "imported_nota";
}

interface TimelineOrder {
  id: string;
  nomor_tiket?: string | null;
  nomor_nota?: string | null;
  jenis_tugas?: string | null;
  waktu_order?: string | null;
  waktu_assigned?: string | null;
  waktu_kurir_selesai?: string | null;
  waktu_selesai?: string | null;
  waktu_input_nota?: string | null;
  customers?: { nomor_hp?: string | null } | null;
  nota_import?: NotaImportInfo | null;
}

function eventFromOrder(
  type: string,
  title: string,
  createdAt: string | null | undefined,
  source: TimelineEvent["source"],
): TimelineEvent | null {
  if (!createdAt || createdAt === "-") return null;

  return {
    id: `${type}-${createdAt}`,
    type,
    title,
    created_at: createdAt,
    actor_name: null,
    actor_email: null,
    status_name: null,
    source,
  };
}

function eventFromLog(
  type: string,
  title: string,
  log: StatusLogRow | undefined,
): TimelineEvent | null {
  if (!log?.created_at) return null;

  return {
    id: `${type}-${log.id}`,
    type,
    title,
    created_at: log.created_at,
    actor_name: log.auth_users?.full_name || null,
    actor_email: log.auth_users?.email || null,
    status_name: log.status_ref?.nama_status || null,
    source: "status_log",
  };
}

function sortedLogs(logs: StatusLogRow[]) {
  return [...logs].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

function findLogByTime(logs: StatusLogRow[], createdAt?: string | null) {
  if (!createdAt || createdAt === "-") return undefined;

  return logs.find((log) => log.created_at === createdAt);
}

function buildTimelineEvents(
  order: TimelineOrder,
  logs: StatusLogRow[],
  timeline: ReportTimeline,
): TimelineEvent[] {
  const orderLogs = sortedLogs(logs);
  const assignmentLogs = orderLogs.filter((log) => log.status_id_baru === 2);
  const events = [
    eventFromOrder(
      "transaksi_created",
      "Create transaksi",
      timeline.transaksi_created_at,
      "imported_nota",
    ),
    eventFromOrder(
      "admin_nota_input",
      "Isi nomor nota oleh admin",
      timeline.admin_nota_input_at,
      "order",
    ),
    eventFromOrder(
      "ticket_created",
      "Create tiket",
      timeline.tiket_created_at,
      "order",
    ),
    eventFromLog(
      "ticket_assigned",
      "Tiket ditugaskan ke kurir",
      assignmentLogs[0],
    ) ||
      eventFromOrder(
        "ticket_assigned",
        "Tiket ditugaskan ke kurir",
        timeline.tiket_assigned_at,
        "order",
      ),
    eventFromLog(
      "ticket_reassigned",
      "Tiket dipindah ke kurir lain",
      assignmentLogs.length > 1 ? assignmentLogs.at(-1) : undefined,
    ),
    eventFromLog(
      "courier_completed",
      "Selesai oleh kurir",
      findLogByTime(orderLogs, timeline.kurir_completed_at),
    ) ||
      eventFromOrder(
        "courier_completed",
        "Selesai oleh kurir",
        timeline.kurir_completed_at,
        "order",
      ),
    eventFromLog(
      "courier_cancelled",
      "Dibatalkan oleh kurir",
      findLogByTime(orderLogs, timeline.kurir_cancelled_at),
    ),
    eventFromOrder(
      "imported_nota_created",
      "Create nota dari import",
      timeline.imported_nota_created_at,
      "imported_nota",
    ),
    eventFromOrder(
      "jemput_nota_input",
      "Input nota transaksi jemput",
      timeline.jemput_nota_input_at,
      "order",
    ),
    eventFromLog(
      "antar_ticket_completed",
      "Selesai tiket antar",
      findLogByTime(orderLogs, timeline.antar_ticket_completed_at),
    ) ||
      eventFromOrder(
        "antar_ticket_completed",
        "Selesai tiket antar",
        timeline.antar_ticket_completed_at,
        "order",
      ),
  ].filter((event): event is TimelineEvent => Boolean(event));

  return events.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = createSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("orderId");

    if (!orderId) {
      return NextResponse.json(
        { error: "Order ID (orderId) query parameter is required" },
        { status: 400 },
      );
    }

    console.log("Fetching logs for OrderID:", orderId);

    const { data, error } = await supabase
      .from("status_logs")
      .select(
        `
        id,
        permintaan_id,
        status_id_baru,
        created_at,
        changed_by,
        auth_users:changed_by (
          full_name,
          email,
          role
        ),
        status_ref:status_id_baru (
          nama_status
        )
      `,
      )
      .eq("permintaan_id", orderId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Database error fetching logs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: order, error: orderError } = await supabase
      .from("permintaan")
      .select(
        `
        id,
        nomor_tiket,
        nomor_nota,
        jenis_tugas,
        waktu_order,
        waktu_assigned,
        waktu_kurir_selesai,
        waktu_selesai,
        waktu_input_nota,
        customers:customer_id (
          nomor_hp
        )
      `,
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    let importedNota: ImportedNotaRecord[] = [];

    if ((order as TimelineOrder).nomor_nota) {
      const { data: importRow, error: importError } = await supabase
        .from("imported_nota_transactions")
        .select(
          "nomor_nota, nomor_hp, nama_pelanggan, tanggal_terima, tanggal_selesai",
        )
        .eq("nomor_nota", (order as TimelineOrder).nomor_nota)
        .maybeSingle();

      if (importError) {
        return NextResponse.json(
          { error: importError.message },
          { status: 500 },
        );
      }

      if (importRow) {
        importedNota = [importRow as ImportedNotaRecord];
      }
    }

    const enrichedOrder = enrichWithNotaImports(
      [order as TimelineOrder],
      importedNota,
    )[0];
    const logs = (data || []) as unknown as StatusLogRow[];
    const timeline = buildReportTimeline(enrichedOrder, logs);
    const timelineEvents = buildTimelineEvents(enrichedOrder, logs, timeline);

    return NextResponse.json({
      data,
      timeline: timelineEvents,
      timeline_summary: timeline,
      nota_import: enrichedOrder.nota_import,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error fetching logs:", err);

    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
