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
      }
    } catch {
      user = null;
    }
  }

  return { supabase, user, supabaseResponse };
}
