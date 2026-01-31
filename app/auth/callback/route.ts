/* eslint-disable no-console */
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  createSupabaseAdmin,
  supabaseUrl,
  supabaseServiceKey,
} from "@/utils/supabase/server";
import { getSiteUrl } from "@/utils/get-url";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Default redirect ke /admin setelah login Google
  const next = searchParams.get("next") ?? "/admin";

  if (code) {
    const cookieStore = await cookies();

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase URL or Service Key");

      return NextResponse.redirect(
        `${getSiteUrl()}login?error=server_configuration_error`,
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
            // Ignored
          }
        },
      },
    });

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      // Check if user's email exists in auth_users whitelist
      try {
        const supabaseAdmin = createSupabaseAdmin();
        const userEmail = data.user.email;
        const userId = data.user.id;

        console.log(`[AUTH] Checking whitelist for email: ${userEmail}`);

        // Check if email is registered in auth_users (whitelist)
        const { data: existingUser, error: queryError } = await supabaseAdmin
          .from("auth_users")
          .select("id")
          .eq("email", userEmail)
          .single();

        console.log(`[AUTH] Whitelist check result:`, {
          existingUser,
          queryError,
        });

        if (!existingUser) {
          // Email not in whitelist - user not authorized
          console.log(
            `[AUTH] Email ${userEmail} NOT in whitelist. Deleting user ${userId}...`,
          );

          // 1. Sign out the session first
          await supabase.auth.signOut();
          console.log(`[AUTH] Signed out successfully`);

          // 2. Delete the newly created user from auth.users
          const { error: deleteError } =
            await supabaseAdmin.auth.admin.deleteUser(userId);

          if (deleteError) {
            console.error(`[AUTH] Failed to delete user:`, deleteError);
          } else {
            console.log(`[AUTH] User ${userId} deleted successfully`);
          }

          // 3. Redirect dengan pesan error yang jelas
          return NextResponse.redirect(
            `${getSiteUrl()}login?error=email_not_registered`,
          );
        }

        console.log(
          `[AUTH] Email ${userEmail} found in whitelist. Proceeding...`,
        );
      } catch (err) {
        console.error("[AUTH] Error verifying user:", err);
        await supabase.auth.signOut();

        return NextResponse.redirect(`${getSiteUrl()}login?error=server_error`);
      }

      // User valid, redirect ke /admin
      const response = NextResponse.redirect(`${getSiteUrl()}${next.startsWith('/') ? next.slice(1) : next}`);

      // Set Manual Cookies for existing middleware compatibility
      response.cookies.set("sb-access-token", data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      response.cookies.set("sb-refresh-token", data.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });

      return response;
    }
  }

  // Return to login if error
  return NextResponse.redirect(`${getSiteUrl()}login?error=auth_code_error`);
}
