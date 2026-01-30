import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = createSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'tickets';
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');

        let query = supabase
            .from('permintaan')
            .select(`
                id,
                nomor_tiket,
                nomor_nota,
                jenis_tugas,
                alamat_jalan,
                waktu_order,
                waktu_assigned,
                waktu_kurir_selesai,
                waktu_selesai,
                status_id,
                catatan_khusus,
                courier_id,
                customers:customer_id (
                    nama_terakhir,
                    nomor_hp
                ),
                auth_users:courier_id (
                    full_name,
                    email
                ),
                status_ref:status_id (
                    nama_status
                ),
                order_items (
                    produk_layanan,
                    jenis_layanan,
                    parfum
                )
            `);

        // Date Filter
        if (startDate && endDate) {
            // Adjust endDate to end of day
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            query = query.gte('waktu_order', new Date(startDate).toISOString())
                .lte('waktu_order', end.toISOString());
        }

        const { data: orders, error } = await query.order('waktu_order', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Process data based on report type
        if (type === 'rekap') {
            const rekap: Record<string, { name: string, antar: number, jemput: number, total: number }> = {};

            orders?.forEach(orderItem => {
                const order = orderItem as any;
                const courierName = order.auth_users?.full_name || order.auth_users?.email || (Array.isArray(order.auth_users) && order.auth_users[0]?.full_name) || 'Belum Ditugaskan';
                if (!rekap[courierName]) {
                    rekap[courierName] = { name: courierName, antar: 0, jemput: 0, total: 0 };
                }

                // Count completed/processed tasks
                if (order.status_id >= 3 && order.status_id !== 7) { // 3=Jemput, 5=Antar, 6=Selesai. Exclude Batal (7) ? Req says "diselesaikan".
                    if (order.jenis_tugas === 'ANTAR') rekap[courierName].antar++;
                    else if (order.jenis_tugas === 'JEMPUT') rekap[courierName].jemput++;
                    rekap[courierName].total++;
                }
            });

            return NextResponse.json({ data: Object.values(rekap) });
        }

        else if (type === 'sla') {
            const slaData = orders?.map(order => {
                const assignTime = order.waktu_assigned ? new Date(order.waktu_assigned).getTime() : null;
                const courierDoneTime = order.waktu_kurir_selesai ? new Date(order.waktu_kurir_selesai).getTime() : null;
                const confirmTime = order.waktu_selesai ? new Date(order.waktu_selesai).getTime() : null;
                const orderTime = order.waktu_order ? new Date(order.waktu_order).getTime() : null;

                const diffAssignToCourierDone = (assignTime && courierDoneTime)
                    ? Math.round((courierDoneTime - assignTime) / (1000 * 60)) // in minutes
                    : null;

                const diffCourierDoneToConfirm = (courierDoneTime && confirmTime)
                    ? Math.round((confirmTime - courierDoneTime) / (1000 * 60)) // in minutes
                    : null;

                // Formatting helper
                const formatDuration = (mins: number | null) => {
                    if (mins === null) return '-';
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    return `${h}j ${m}m`;
                };

                return {
                    nomor_tiket: order.nomor_tiket,
                    tanggal_tiket: order.waktu_order,
                    nomor_nota: order.nomor_nota || '-',
                    tanggal_assign: order.waktu_assigned || '-',
                    tanggal_diselesaikan_kurir: order.waktu_kurir_selesai || '-',
                    selisih_assign_selesai: formatDuration(diffAssignToCourierDone),
                    tanggal_input_nota: order.waktu_selesai || '-', // Assuming confirm time is input nota time
                    selisih_selesai_input: formatDuration(diffCourierDoneToConfirm),
                    raw_diff_1: diffAssignToCourierDone,
                    raw_diff_2: diffCourierDoneToConfirm
                };
            });

            return NextResponse.json({ data: slaData });
        }

        // Default: Tickets (Raw Data)
        return NextResponse.json({ data: orders });

    } catch (error) {
        console.error('Report API Error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
