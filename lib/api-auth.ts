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
  const {
    data: { user: authUser },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

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
