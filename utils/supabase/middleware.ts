import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

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
    },
  );

  // Get access token from cookie
  const accessToken = request.cookies.get("sb-access-token")?.value;
  const refreshToken = request.cookies.get("sb-refresh-token")?.value;

  let user = null;

  if (accessToken) {
    try {
      // Verifikasi token ke Supabase server (bukan hanya decode base64)
      const {
        data: { user: authUser },
        error,
      } = await supabase.auth.getUser(accessToken);

      if (!error && authUser) {
        user = {
          id: authUser.id,
          email: authUser.email,
        };
      } else if (refreshToken) {
        // Access token expired: coba refresh agar sesi tidak putus saat navigasi
        const { data: refreshed, error: refreshError } =
          await supabase.auth.refreshSession({ refresh_token: refreshToken });

        if (!refreshError && refreshed.session && refreshed.user) {
          user = {
            id: refreshed.user.id,
            email: refreshed.user.email,
          };

          // Set cookie token baru pada response yang diteruskan ke browser
          const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax" as const,
            maxAge: 60 * 60 * 24 * 7,
            path: "/",
          };

          supabaseResponse.cookies.set(
            "sb-access-token",
            refreshed.session.access_token,
            cookieOptions,
          );
          supabaseResponse.cookies.set(
            "sb-refresh-token",
            refreshed.session.refresh_token,
            cookieOptions,
          );
        }
      }
    } catch {
      user = null;
    }
  }

  return { supabase, user, supabaseResponse };
}
