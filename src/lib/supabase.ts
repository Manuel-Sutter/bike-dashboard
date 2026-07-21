import { createClient } from "@supabase/supabase-js";

// Server-only: uses the service_role key, which bypasses RLS. Never import
// this from a client component - it's for Route Handlers and Server
// Components only.
export function getSupabaseServerClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
