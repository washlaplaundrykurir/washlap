import { createClient } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { jwtDecode } from 'jwt-decode';

interface JWTPayload {
    sub: string;
    email: string;
    exp: number;
}

export async function updateSession(request: NextRequest) {
    const supabaseResponse = NextResponse.next({
        request,
    });

    const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY!,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );

    // Get access token from cookie
    const accessToken = request.cookies.get('sb-access-token')?.value;

    let user = null;

    if (accessToken) {
        try {
            // Decode JWT to get user info
            const decoded = jwtDecode<JWTPayload>(accessToken);

            // Check if token is expired
            if (decoded.exp * 1000 > Date.now()) {
                user = {
                    id: decoded.sub,
                    email: decoded.email,
                };
            }
        } catch {
            // Invalid token, user remains null
            user = null;
        }
    }

    return { supabase, user, supabaseResponse };
}
