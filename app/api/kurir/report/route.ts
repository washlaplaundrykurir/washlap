
import { NextRequest, NextResponse } from "next/server";
import { jwtDecode } from "jwt-decode";
import { cookies } from "next/headers";
import { createSupabaseAdmin } from "@/utils/supabase/server";

interface JWTPayload {
    sub: string;
    email: string;
    exp: number;
}

export async function GET(request: NextRequest) {
    try {
        const cookieStore = await cookies();
        const accessToken = cookieStore.get("sb-access-token")?.value;

        if (!accessToken) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        let userId: string | null = null;
        try {
            const decoded = jwtDecode<JWTPayload>(accessToken);
            if (decoded.exp * 1000 > Date.now()) {
                userId = decoded.sub;
            }
        } catch {
            return NextResponse.json({ error: "Invalid token" }, { status: 401 });
        }

        if (!userId) {
            return NextResponse.json({ error: "Token expired" }, { status: 401 });
        }

        const supabase = createSupabaseAdmin();
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        let query = supabase
            .from("permintaan")
            .select("id, jenis_tugas, waktu_kurir_selesai, status_id")
            .eq("courier_id", userId)
            .in("status_id", [3, 4, 5, 6]); // Completed courier tasks (Jemput=3, Antar=5, or further)

        if (startDate) {
            query = query.gte("waktu_kurir_selesai", startDate);
        }
        if (endDate) {
            const nextDay = new Date(endDate);
            nextDay.setDate(nextDay.getDate() + 1);
            query = query.lt("waktu_kurir_selesai", nextDay.toISOString().split("T")[0]);
        }

        const { data: tasks, error } = await query;

        if (error) {
            console.error("Report Fetch Error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Process data to group by date
        // Result format: Record<DateString, { jemput: 0, antar: 0, total: 0 }>
        const reportData: Record<string, { jemput: number; antar: number; total: number }> = {};

        tasks.forEach((task) => {
            if (!task.waktu_kurir_selesai) return;

            const dateKey = new Date(task.waktu_kurir_selesai).toISOString().split("T")[0]; // YYYY-MM-DD

            if (!reportData[dateKey]) {
                reportData[dateKey] = { jemput: 0, antar: 0, total: 0 };
            }

            if (task.jenis_tugas === "JEMPUT") {
                reportData[dateKey].jemput++;
            } else if (task.jenis_tugas === "ANTAR") {
                reportData[dateKey].antar++;
            }
            reportData[dateKey].total++;
        });

        // Convert to array and sort by date descending
        const reportArray = Object.entries(reportData).map(([date, stats]) => ({
            date,
            ...stats,
        })).sort((a, b) => b.date.localeCompare(a.date));

        return NextResponse.json({ success: true, data: reportArray });

    } catch (error: any) {
        console.error("Server error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
