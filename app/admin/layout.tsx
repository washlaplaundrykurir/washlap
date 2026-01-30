import { DashboardLayout } from "@/components/DashboardLayout";
import { createSupabaseAdmin } from "@/utils/supabase/server";
import { jwtDecode } from "jwt-decode";
import { cookies } from "next/headers";

interface JWTPayload {
    sub: string;
    email: string;
    exp: number;
}

async function getUserRole() {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;

    if (!accessToken) return null;

    try {
        const decoded = jwtDecode<JWTPayload>(accessToken);
        if (decoded.exp * 1000 < Date.now()) return null;

        const supabase = createSupabaseAdmin();
        const { data } = await supabase
            .from("auth_users")
            .select("role")
            .eq("id", decoded.sub)
            .single();

        return data?.role;
    } catch {
        return null;
    }
}

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const role = await getUserRole();

    // Ensure role is one of the expected types. 
    // If null (not logged in), we default to 'admin' (the layout will still render, but pages might redirect/error).
    // Ideally we'd redirect here if !role, but middleware should handle protection.
    const validRole = (role === "super-admin" || role === "kurir") ? role : "admin";

    return (
        <DashboardLayout role={validRole}>
            {children}
        </DashboardLayout>
    );
}
