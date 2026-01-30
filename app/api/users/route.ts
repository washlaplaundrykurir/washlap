import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/utils/supabase/server';

// GET - List all users
export async function GET() {
    try {
        const supabase = createSupabaseAdmin();

        const { data: users, error } = await supabase
            .from('auth_users')
            .select('id, email, role, full_name')
            .order('email');

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: users });
    } catch (error) {
        console.error('Get users error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// POST - Create new user
export async function POST(request: NextRequest) {
    try {
        const supabase = createSupabaseAdmin();

        const { email, password, role, full_name } = await request.json();

        if (!email || !password || !role) {
            return NextResponse.json(
                { error: 'Email, password, dan role diperlukan' },
                { status: 400 }
            );
        }

        // Create user in auth.users
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 400 });
        }

        // Create record in auth_users table
        const { error: profileError } = await supabase
            .from('auth_users')
            .insert({
                id: authData.user.id,
                email,
                role,
                full_name: full_name || null,
            });

        if (profileError) {
            // Rollback: delete the auth user if profile creation fails
            await supabase.auth.admin.deleteUser(authData.user.id);
            return NextResponse.json({ error: profileError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'User berhasil dibuat',
            user: { id: authData.user.id, email, role, full_name },
        });
    } catch (error) {
        console.error('Create user error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// PUT - Update user
export async function PUT(request: NextRequest) {
    try {
        const supabase = createSupabaseAdmin();

        const { id, role, full_name } = await request.json();

        if (!id) {
            return NextResponse.json({ error: 'User ID diperlukan' }, { status: 400 });
        }

        const { error } = await supabase
            .from('auth_users')
            .update({ role, full_name })
            .eq('id', id);

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'User berhasil diupdate' });
    } catch (error) {
        console.error('Update user error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

// DELETE - Delete user
export async function DELETE(request: NextRequest) {
    try {
        const supabase = createSupabaseAdmin();

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'User ID diperlukan' }, { status: 400 });
        }

        // Delete from auth_users table first
        const { error: profileError } = await supabase
            .from('auth_users')
            .delete()
            .eq('id', id);

        if (profileError) {
            return NextResponse.json({ error: profileError.message }, { status: 500 });
        }

        // Delete from auth.users
        const { error: authError } = await supabase.auth.admin.deleteUser(id);

        if (authError) {
            return NextResponse.json({ error: authError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'User berhasil dihapus' });
    } catch (error) {
        console.error('Delete user error:', error);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
