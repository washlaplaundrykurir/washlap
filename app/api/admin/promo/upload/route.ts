import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE_MB = 5;

export async function POST(request: NextRequest) {
    const { error: authError } = await requireAdmin();
    if (authError) return authError;

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        // Validasi tipe MIME
        if (!ALLOWED_MIME_TYPES.includes(file.type)) {
            return NextResponse.json(
                { error: "Tipe file tidak diizinkan. Hanya gambar (JPEG, PNG, WebP, GIF)." },
                { status: 400 },
            );
        }

        // Validasi ukuran file
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            return NextResponse.json(
                { error: `Ukuran file maksimal ${MAX_FILE_SIZE_MB}MB.` },
                { status: 400 },
            );
        }

        // Gunakan ekstensi dari MIME type, bukan dari nama file
        const mimeToExt: Record<string, string> = {
            "image/jpeg": "jpg",
            "image/png": "png",
            "image/webp": "webp",
            "image/gif": "gif",
        };
        const fileExt = mimeToExt[file.type] || "jpg";
        const fileName = `promo-${Date.now()}.${fileExt}`;

        const supabase = createSupabaseAdmin();

        const { error: uploadError } = await supabase.storage
            .from("promos")
            .upload(fileName, file);

        if (uploadError) {
            return NextResponse.json(
                { error: uploadError.message },
                { status: 500 },
            );
        }

        const {
            data: { publicUrl },
        } = supabase.storage.from("promos").getPublicUrl(fileName);

        return NextResponse.json({ publicUrl });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
