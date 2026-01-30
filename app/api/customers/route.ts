import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/utils/supabase/server';

// GET - List all customers
export async function GET() {
    try {
        const supabase = createSupabaseAdmin();

        const { data: customers, error } = await supabase
            .from('customers')
            .select('*')
            .order('nama_terakhir');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: customers });
    } catch (error) {
        console.error('Get customers error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// PUT - Update customer
export async function PUT(request: NextRequest) {
    try {
        const supabase = createSupabaseAdmin();

        const { id, nama_terakhir, alamat_terakhir, google_maps_terakhir } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'Customer ID diperlukan' }, { status: 400 });
        }

        const { error } = await supabase
            .from('customers')
            .update({ nama_terakhir, alamat_terakhir, google_maps_terakhir })
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Customer berhasil diupdate' });
    } catch (error) {
        console.error('Update customer error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE - Delete customer
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createSupabaseAdmin();

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Customer ID diperlukan' }, { status: 400 });
        }

        const { error } = await supabase
            .from('customers')
            .delete()
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Customer berhasil dihapus' });
    } catch (error) {
        console.error('Delete customer error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
