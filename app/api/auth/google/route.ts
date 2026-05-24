import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseUrl, supabaseServiceKey } from "@/utils/supabase/server";
import { getSiteUrl } from "@/utils/get-url";

// Daftar path relatif yang diizinkan untuk redirect setelah login
const ALLOWED_REDIRECT_PATHS = ["/admin", "/kurir"];

function isSafeRedirect(path: string): boolean {
  // Hanya izinkan path relatif (tidak boleh mulai dengan // atau http)
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  // Hanya izinkan path yang dikenal
  return ALLOWED_REDIRECT_PATHS.some((allowed) => path.startsWith(allowed));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawRedirectTo = searchParams.get("redirectTo") || "/admin";

  // Validasi redirect — tolak URL eksternal atau path tidak dikenal
  const redirectTo = isSafeRedirect(rawRedirectTo) ? rawRedirectTo : "/admin";

  const cookieStore = await cookies();

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Server configuration error: Missing Supabase URL or Key" },
      { status: 500 },
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseServiceKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // The `setAll` method was called from a Server Component.
        }
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getSiteUrl()}auth/callback?next=${redirectTo}`,
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    return NextResponse.redirect(`${getSiteUrl()}login?error=auth_init_error`);
  }

  if (data.url) {
    return NextResponse.redirect(data.url);
  }

  return NextResponse.redirect(`${getSiteUrl()}login?error=unknown_error`);
}
