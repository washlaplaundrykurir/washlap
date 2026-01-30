import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const supabase = createSupabaseAdmin();

        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'Email dan password diperlukan' },
                { status: 400 }
            );
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            return NextResponse.json(
                { error: error.message },
                { status: 401 }
            );
        }

        // Get user role from auth_users table
        const { data: userData } = await supabase
            .from('auth_users')
            .select('role')
            .eq('id', data.user.id)
            .single();

        // Create response with session cookie
        const response = NextResponse.json({
            success: true,
            user: {
                id: data.user.id,
                email: data.user.email,
                role: userData?.role || null,
            },
            session: data.session,
        });

        // Set auth cookies for middleware to read
        response.cookies.set('sb-access-token', data.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        response.cookies.set('sb-refresh-token', data.session.refresh_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7, // 7 days
            path: '/',
        });

        return response;
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'Terjadi kesalahan server' },
            { status: 500 }
        );
    }
}
