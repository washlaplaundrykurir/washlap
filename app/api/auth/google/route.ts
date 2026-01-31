import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { supabaseUrl, supabaseServiceKey } from "@/utils/supabase/server";
import { getSiteUrl } from "@/utils/get-url";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const redirectTo = searchParams.get("redirectTo") || "/admin";
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
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${getSiteUrl()}auth/callback?next=${redirectTo}`,
      skipBrowserRedirect: true, // PENTING: Agar return URL, bukan coba redirect sendiri
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
