import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/utils/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const supabase = createSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const unassignedOnly = searchParams.get('unassigned') === 'true';

        // Build query for permintaan with customer and courier info
        let query = supabase
            .from('permintaan')
            .select(`
        id,
        nomor_tiket,
        jenis_tugas,
        alamat_jalan,
        google_maps_link,
        waktu_order,
        waktu_penjemputan,
        status_id,
        catatan_khusus,
        courier_id,
        customer_id,
        customers:customer_id (
          id,
          nomor_hp,
          nama_terakhir
        ),
        auth_users:courier_id (
          id,
          full_name,
          email
        ),

        status_ref:status_id (
          id,
          nama_status
        ),
        order_items (
          id,
          produk_layanan,
          jenis_layanan,
          parfum
        )
      `);

        // Filter for unassigned orders only (courier_id is null OR status_id = 1)
        if (unassignedOnly) {
            query = query.or('courier_id.is.null,status_id.eq.1');
        }

        const { data: orders, error } = await query.order('waktu_order', { ascending: false });

        if (error) {
            console.error('Fetch orders error:', error);
            return NextResponse.json(
                { error: 'Gagal mengambil data pesanan', details: error.message },
                { status: 500 }
            );
        }

        // Group orders by courier
        const groupedOrders: Record<string, {
            courier: { id: string; name: string; email: string } | null;
            orders: typeof orders;
        }> = {};

        // Initialize "Unassigned" group
        groupedOrders['unassigned'] = {
            courier: null,
            orders: [],
        };

        orders?.forEach((order) => {
            const courierId = order.courier_id || 'unassigned';

            if (!groupedOrders[courierId]) {
                const courierData = order.auth_users as unknown as { id: string; full_name: string; email: string } | null;
                groupedOrders[courierId] = {
                    courier: courierData ? {
                        id: courierData.id,
                        name: courierData.full_name || courierData.email,
                        email: courierData.email,
                    } : null,
                    orders: [],
                };
            }

            groupedOrders[courierId].orders.push(order);
        });

        // Convert to array for easier frontend handling
        const result = Object.entries(groupedOrders).map(([key, value]) => ({
            courierId: key,
            courierName: value.courier?.name || 'Belum Ditugaskan',
            courierEmail: value.courier?.email || null,
            orders: value.orders,
            orderCount: value.orders.length,
        })).filter(group => group.orderCount > 0);

        return NextResponse.json({
            success: true,
            data: result,
            totalOrders: orders?.length || 0,
        });

    } catch (error) {
        console.error('Server error:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        );
    }
}
