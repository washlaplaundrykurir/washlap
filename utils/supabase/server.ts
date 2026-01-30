import { createClient, SupabaseClient } from '@supabase/supabase-js';

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
        throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables');
    }

    return createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
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
