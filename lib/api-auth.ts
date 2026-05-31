/**
 * API Authentication Helper
 *
 * Verifikasi token JWT menggunakan Supabase auth.getUser() yang memvalidasi
 * signature token ke server Supabase — bukan hanya decode base64.
 *
 * Gunakan helper ini di semua API route yang butuh autentikasi.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";

export type UserRole = "admin" | "super-admin" | "kurir";

// Umur cookie sesi (samakan dengan login route)
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: SESSION_COOKIE_MAX_AGE,
  path: "/",
};

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
}

export interface AuthResult {
  user: AuthUser | null;
  error: NextResponse | null;
}

/**
 * Verifikasi token dari cookie dan kembalikan user yang terautentikasi.
 * Menggunakan supabase.auth.getUser() untuk validasi signature — aman dari token palsu.
 *
 * @param requiredRoles - Role yang diizinkan. Jika kosong, semua role yang login diizinkan.
 */
export async function requireAuth(
  requiredRoles: UserRole[] = [],
): Promise<AuthResult> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get("sb-access-token")?.value;
  const refreshToken = cookieStore.get("sb-refresh-token")?.value;

  if (!accessToken) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Tidak terautentikasi" },
        { status: 401 },
      ),
    };
  }

  const supabase = createSupabaseAdmin();

  // Verifikasi token ke Supabase server — ini yang benar, bukan jwtDecode
  let {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  // Access token expired/invalid: coba refresh pakai refresh token yang tersimpan.
  // Cookie httpOnly tidak bisa di-refresh dari client, jadi diperbarui di sini.
  if ((authError || !authUser) && refreshToken) {
    const { data: refreshed, error: refreshError } =
      await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (!refreshError && refreshed.session && refreshed.user) {
      authUser = refreshed.user;
      authError = null;

      // Tulis ulang cookie dengan token baru (access + refresh yang dirotasi)
      cookieStore.set(
        "sb-access-token",
        refreshed.session.access_token,
        sessionCookieOptions,
      );
      cookieStore.set(
        "sb-refresh-token",
        refreshed.session.refresh_token,
        sessionCookieOptions,
      );
    }
  }

  if (authError || !authUser) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Token tidak valid atau sudah expired" },
        { status: 401 },
      ),
    };
  }

  // Ambil role dari tabel auth_users
  const { data: userData, error: userError } = await supabase
    .from("auth_users")
    .select("role, full_name, email")
    .eq("id", authUser.id)
    .single();

  if (userError || !userData) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Data user tidak ditemukan" },
        { status: 401 },
      ),
    };
  }

  const user: AuthUser = {
    id: authUser.id,
    email: userData.email || authUser.email || "",
    role: userData.role as UserRole,
    full_name: userData.full_name,
  };

  // Cek role jika diperlukan
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Tidak memiliki akses" },
        { status: 403 },
      ),
    };
  }

  return { user, error: null };
}

/** Shorthand: hanya admin dan super-admin */
export const requireAdmin = () => requireAuth(["admin", "super-admin"]);

/** Shorthand: hanya super-admin */
export const requireSuperAdmin = () => requireAuth(["super-admin"]);

/** Shorthand: hanya kurir */
export const requireKurir = () => requireAuth(["kurir"]);

/** Shorthand: semua role yang login */
export const requireLogin = () => requireAuth([]);
