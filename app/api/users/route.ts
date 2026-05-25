/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

// GET - List all users
export async function GET() {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = createSupabaseAdmin();

    const { data: users, error } = await supabase
      .from("auth_users")
      .select("id, email, role, full_name, is_active")
      .order("email");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: users });
  } catch (error) {
    console.error("Get users error:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = createSupabaseAdmin();

    const { email, password, role, full_name } = await request.json();

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email dan role diperlukan" },
        { status: 400 },
      );
    }

    // Password wajib diisi — tidak ada default password lemah
    if (!password || password.trim().length < 8) {
      return NextResponse.json(
        { error: "Password wajib diisi dan minimal 8 karakter" },
        { status: 400 },
      );
    }

    // Create user in auth.users
    const { data: authData, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password: password,
        email_confirm: true,
        user_metadata: {
          role,
          full_name,
        },
      });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // EXPLICIT UPDATE: Force update public.auth_users to ensure correct role
    // This overrides any default 'user' role set by triggers
    const { error: profileError } = await supabase
      .from("auth_users")
      .update({
        role: role, // Ensure this is the selected role (e.g., 'kurir', 'admin')
        full_name: full_name,
      })
      .eq("id", authData.user.id);

    if (profileError) {
      console.error("Profile update error:", profileError);
      // We don't block response, but we log it
    }

    return NextResponse.json({
      success: true,
      message: "User berhasil dibuat",
      user: {
        id: authData.user.id,
        email,
        role,
        full_name,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT - Update user
export async function PUT(request: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = createSupabaseAdmin();

    const { id, role, full_name, password } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "User ID diperlukan" },
        { status: 400 },
      );
    }

    // Step 1: Update Password and Metadata in auth.users
    const updateAttrs: any = {
      user_metadata: { role, full_name },
    };
    if (password && password.length > 0) {
      updateAttrs.password = password;
    }

    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      id,
      updateAttrs,
    );

    if (authUpdateError) {
      return NextResponse.json(
        { error: "Gagal update auth: " + authUpdateError.message },
        { status: 400 },
      );
    }

    // Step 2: Update Profile
    const { error } = await supabase
      .from("auth_users")
      .update({ role, full_name })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "User berhasil diupdate",
    });
  } catch (error) {
    console.error("Update user error:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE - Delete user
export async function DELETE(request: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = createSupabaseAdmin();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "User ID diperlukan" },
        { status: 400 },
      );
    }

    // Delete from auth_users table first
    const { error: profileError } = await supabase
      .from("auth_users")
      .delete()
      .eq("id", id);

    if (profileError) {
      return NextResponse.json(
        { error: profileError.message },
        { status: 500 },
      );
    }

    // Delete from auth.users
    const { error: authError } = await supabase.auth.admin.deleteUser(id);

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "User berhasil dihapus",
    });
  } catch (error) {
    console.error("Delete user error:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PATCH - Toggle aktif/nonaktif user
export async function PATCH(request: NextRequest) {
  const { user: adminUser, error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = createSupabaseAdmin();
    const { id, is_active } = await request.json();

    if (!id || is_active === undefined) {
      return NextResponse.json(
        { error: "User ID dan status is_active diperlukan" },
        { status: 400 },
      );
    }

    // Cegah admin menonaktifkan dirinya sendiri
    if (id === adminUser!.id) {
      return NextResponse.json(
        { error: "Tidak dapat menonaktifkan akun sendiri" },
        { status: 403 },
      );
    }

    // Update kolom is_active di auth_users
    const { error: updateError } = await supabase
      .from("auth_users")
      .update({ is_active })
      .eq("id", id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Jika dinonaktifkan, paksa logout semua sesi user tersebut
    if (!is_active) {
      await supabase.auth.admin.signOut(id, "global");
    }

    return NextResponse.json({
      success: true,
      message: is_active ? "User berhasil diaktifkan" : "User berhasil dinonaktifkan",
    });
  } catch (error) {
    console.error("Toggle user status error:", error);

    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
