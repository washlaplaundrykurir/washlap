import { createBrowserClient } from '@supabase/ssr'

// Note: Client-side hanya bisa akses NEXT_PUBLIC_* env vars
// Karena user tidak menggunakan ANON_KEY, kita perlu expose URL saja
// dan semua operasi authenticated akan melalui API routes
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

// Untuk client-side, jika tidak ada ANON_KEY, client akan tetap dibuat
// tapi akan bergantung pada session yang sudah ada dari server
export function createSupabaseClient() {
    if (!supabaseUrl) {
        console.error("Supabase URL Missing");
    }

    // Jika tidak ada public key, gunakan empty string
    // Client akan bergantung pada session cookies dari server-side auth
    const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    return createBrowserClient(
        supabaseUrl || '',
        publicKey
    )
}
