import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Cliente com a service key (ignora RLS). Só para rotas de servidor, como o webhook. */
export function supabaseAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
}
