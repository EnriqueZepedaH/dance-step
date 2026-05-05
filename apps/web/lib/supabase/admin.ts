import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { env } from "@/lib/env";

let cached: SupabaseClient<Database> | null = null;

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (cached) return cached;

  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      "Supabase admin client requires SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  cached = createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  return cached;
}
