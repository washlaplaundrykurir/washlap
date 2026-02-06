import {
  createClient as createClientJS,
  SupabaseClient,
} from "@supabase/supabase-js";

// Server-side only env vars (not exposed to browser)
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

/**
 * Creates a Supabase admin client with service role key.
 * This client bypasses RLS and should only be used in server-side code (API routes).
 *
 * @returns {SupabaseClient} Supabase client with service role permissions
 */
export function createSupabaseAdmin(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables",
    );
  }

  return createClientJS(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Pre-initialized singleton for convenience (lazy initialization)
let _supabaseAdmin: SupabaseClient | null = null;

/**
 * Gets a singleton instance of the Supabase admin client.
 * Useful when you want to reuse the same client instance.
 *
 * @returns {SupabaseClient} Supabase client with service role permissions
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createSupabaseAdmin();
  }

  return _supabaseAdmin;
}

// Export the URL and key for cases where direct access is needed
export { supabaseUrl, supabaseServiceKey };

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client for server-side usage (API routes, Server Components).
 * It handles cookie management for you.
 *
 * @param {Awaited<ReturnType<typeof cookies>>} cookieStore - The cookie store from next/headers
 * @returns {SupabaseClient} Key-based Supabase client with auth context
 */
export function createClient(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error("Missing Supabase URL or Key");
  }

  return createServerClient(url, key, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch (error) {
          // The `set` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch (error) {
          // The `delete` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}
