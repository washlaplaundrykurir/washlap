import { NextRequest, NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/utils/supabase/server";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        const fileExt = file.name.split(".").pop();
        const fileName = `promo-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const supabase = createSupabaseAdmin();

        const { error: uploadError } = await supabase.storage
            .from("promos")
            .upload(filePath, file);

        if (uploadError) {
            return NextResponse.json(
                { error: uploadError.message },
                { status: 500 },
            );
        }

        const {
            data: { publicUrl },
        } = supabase.storage.from("promos").getPublicUrl(filePath);

        return NextResponse.json({ publicUrl });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
