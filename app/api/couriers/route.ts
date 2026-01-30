import { NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/utils/supabase/server';

// GET - Get all couriers for assignment dropdown
export async function GET() {
    try {
        const supabase = createSupabaseAdmin();

        const { data: couriers, error } = await supabase
            .from('auth_users')
            .select('id, email, full_name')
            .eq('role', 'kurir')
            .order('full_name');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: couriers });
    } catch (error) {
        console.error('Get couriers error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
